// core/journey/readiness.js — "Readiness for a role" and the bridge plan.
// For a chosen role, each skill gets three bars on one 0–100 scale:
//   you        how much of the skill your mastered skills already prove
//   course     how far your programme takes the skill (0 = your course won't cover it)
//   employers  what the role asks for (required 100, good to have 50)
// plus the hours to close the gap, the skills the course won't cover, the
// best-fitting roles, and the learner's own plan ("Add to my plan").
// Roles: verified employers' roles on Qubirex, then sample market roles.
import * as dal from '../db/dal.js';
import { ulid } from '../db/ulid.js';
import * as market from '../market/sampleMarket.js';
import { pathwayMap, coverageOf, nodesForSkill } from '../graph/coverage.js';
import { jobMatch } from '../insights.js';
import { matchedRoles } from '../hiringLoop.js';
import { bandOf, BAND_LABEL } from '../readiness/cohort.js';
import { mapSeq } from '../util/seq.js';

const parse = (s, d) => { try { return JSON.parse(s); } catch { return d; } };

async function roleList(user) {
  const qubirex = (await matchedRoles(user)).map(r => ({ id: r.id, title: r.title, employer: r.employer, source: 'qubirex', interview_promise: r.interview_promise, stage: r.stage }));
  const seen = new Set();
  const sample = market.JOBS.filter(j => (seen.has(j.role) ? false : seen.add(j.role))).map(j => ({ id: `market:${j.id}`, title: j.role, employer: null, source: 'market' }));
  return [...qubirex, ...sample];
}

async function roleSkills(id) {
  if (String(id).startsWith('market:')) {
    const j = market.JOBS.find(x => `market:${x.id}` === id);
    return j ? j.skills.map(s => ({ key: s.key, name: s.name, required: s.required, hours: s.hours })) : null;
  }
  const r = await dal.one('SELECT skills_json FROM employer_roles WHERE id = ?', id);
  return r ? parse(r.skills_json, []).map(s => ({ key: s.key, name: s.name, required: s.required !== false, hours: market.SKILLS[s.key]?.hours || 6 })) : null;
}

/** Score one role for a learner: readiness, band and the three bars per skill. */
async function scoreRole(el, map, mastered, minutesById, skills) {
  const memo = new Map(); const mineMemo = new Map();
  const rows = await mapSeq(skills, async (s) => {
    const course = Math.round(Math.min(1, await coverageOf(s.key, map, { memo })) * 100);
    const you = Math.round(Math.min(1, await coverageOf(s.key, map, { onlyNodes: mastered, memo: mineMemo })) * 100);
    const teach = [...await nodesForSkill(s.key, map)];
    const left = teach.filter(n => !mastered.has(n));
    const courseHours = left.reduce((a, n) => a + (minutesById.get(n) || 20), 0) / 60;
    const outside = course === 0 ? (s.hours || 6) : 0;
    return {
      key: s.key, name: s.name, required: !!s.required, you, course, employers: s.required ? 100 : 50,
      verified: you >= 60, hours_to_close: you >= 60 ? 0 : Math.round((courseHours + outside) * 10) / 10,
      not_in_course: course === 0, nodes_left: left.length
    };
  });
  const readiness = Math.round(jobMatch({ skills }, k => rows.find(r => r.key === k)?.verified) * 100);
  return { readiness, band: bandOf(readiness), band_label: BAND_LABEL[bandOf(readiness)], skills: rows };
}

export async function readinessView(user, { roleId = null } = {}) {
  const el = await dal.one(`SELECT el.id AS el_id, e.capability_target_id FROM engagement_learners el JOIN engagements e ON e.id = el.engagement_id WHERE el.id = ?`, user.el_id);
  const map = await pathwayMap(el.capability_target_id);
  const mastered = new Set((await dal.all('SELECT skill_node_id FROM node_mastery WHERE engagement_learner_id = ? AND advanced_at IS NOT NULL', el.el_id)).map(r => r.skill_node_id));
  const minutesById = new Map((await dal.all(`SELECT sn.id, sn.estimated_minutes FROM skill_nodes sn JOIN skill_clusters sc ON sc.id = sn.cluster_id WHERE sc.capability_target_id = ?`, el.capability_target_id)).map(r => [r.id, r.estimated_minutes || 20]));
  const roles = await roleList(user);
  const scored = await mapSeq(roles, async (r) => ({ ...r, ...(await scoreRole(el, map, mastered, minutesById, await roleSkills(r.id) || [])) }));
  const profile = await dal.one('SELECT target_roles FROM learner_profiles WHERE learner_id = ?', user.id);
  const wanted = parse(profile?.target_roles, []).map(x => String(x).toLowerCase());
  const pick = (roleId && scored.find(r => r.id === roleId))
    || scored.find(r => wanted.some(w => r.title.toLowerCase().includes(w.replace(/s$/, ''))))
    || [...scored].sort((a, b) => b.readiness - a.readiness)[0] || null;
  const plan = await dal.all('SELECT skill_name, source, created_at FROM learner_plan WHERE learner_id = ? ORDER BY created_at', user.id);
  return {
    roles: scored.map(({ skills, ...r }) => r),
    best_fit: [...scored].sort((a, b) => b.readiness - a.readiness).slice(0, 3).map(r => ({ id: r.id, title: r.title, employer: r.employer, readiness: r.readiness, band_label: r.band_label })),
    role: pick ? {
      ...pick, short: pick.skills.filter(s => s.required && !s.verified).map(s => s.name),
      hours_to_close: Math.round(pick.skills.reduce((a, s) => a + s.hours_to_close, 0) * 10) / 10,
      course_wont_cover: pick.skills.filter(s => s.not_in_course).map(s => s.name)
    } : null,
    plan
  };
}

export async function addToPlan(learnerId, skillName, source = 'readiness') {
  const name = String(skillName || '').trim().slice(0, 80);
  if (!name) throw Object.assign(new Error('Choose a skill.'), { status: 400 });
  await dal.run('INSERT INTO learner_plan (id, learner_id, skill_name, source, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT (learner_id, skill_name) DO NOTHING',
    ulid(), learnerId, name, String(source || '').slice(0, 40), dal.nowIso());
  return dal.all('SELECT skill_name, source, created_at FROM learner_plan WHERE learner_id = ? ORDER BY created_at', learnerId);
}

export async function removeFromPlan(learnerId, skillName) {
  await dal.run('DELETE FROM learner_plan WHERE learner_id = ? AND skill_name = ?', learnerId, String(skillName || ''));
  return dal.all('SELECT skill_name, source, created_at FROM learner_plan WHERE learner_id = ? ORDER BY created_at', learnerId);
}
