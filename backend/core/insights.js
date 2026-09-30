// core/insights.js
// ─────────────────────────────────────────────────────────────────────────────
// Market insight for institutions. Two questions:
//
//   curriculumCoverage — does our pathway teach what JDs ask for?
//     Each JD skill's coverage comes from the Capability Graph (v4.3 §3.3):
//     min(1, Σ node weights + mean child coverage); covered ≥ 0.8, partly
//     ≥ 0.3, else missing. Adds the cohort's mastery on those nodes and how
//     many students requested the skill.
//
//   cohortStanding — how job-ready are our students?
//     A student's match for a JD is the weighted share of its skills they
//     have VERIFIED: their mastered nodes cover the skill at least 'partly'. Self-declared skills don't
//     count. Job-match index = average over students of their average match
//     across the cohort's target-role JDs.
//
// Pathway, mastery and requests are live data; JD shares, openings and
// benchmarks come from sampleMarket.js and are labelled sample in the UI.
// ─────────────────────────────────────────────────────────────────────────────
import * as market from './market/sampleMarket.js';
import { pathwayMap, coverageOf, coverageStatus, nodesForSkill } from './graph/coverage.js';

const skillOf = (key) => ({ key, ...market.SKILLS[key] });

function pathwayNodes(db, capabilityTargetId) {
  return db.prepare(`
    SELECT sn.id, sn.node_label, sn.estimated_minutes, sc.id as cluster_id, sc.cluster_label
    FROM skill_nodes sn JOIN skill_clusters sc ON sc.id = sn.cluster_id
    WHERE sc.capability_target_id = ? ORDER BY sc.sequence_order, sn.sequence_order
  `).all(capabilityTargetId);
}

// Active (not removed) enrolments with their mastered node ids.
function cohortStudents(db, engagementId, { before = null } = {}) {
  const students = db.prepare(`
    SELECT el.id as el_id, l.id as learner_id, l.name, l.learner_ref, el.current_node_id,
           COALESCE(p.share_with_institution, 0) as opted_in
    FROM engagement_learners el JOIN learners l ON l.id = el.learner_id
    LEFT JOIN learner_profiles p ON p.learner_id = l.id
    WHERE el.engagement_id = ? AND COALESCE(el.access_status, 'active') != 'removed'
  `).all(engagementId);
  const mastery = db.prepare(`
    SELECT engagement_learner_id, skill_node_id, mastery_attainment FROM node_mastery
    WHERE advanced_at IS NOT NULL ${before ? 'AND advanced_at < ?' : ''}
      AND engagement_learner_id IN (SELECT id FROM engagement_learners WHERE engagement_id = ?)
  `).all(...(before ? [before, engagementId] : [engagementId]));
  const byEl = new Map();
  mastery.forEach(m => {
    if (!byEl.has(m.engagement_learner_id)) byEl.set(m.engagement_learner_id, new Map());
    byEl.get(m.engagement_learner_id).set(m.skill_node_id, m.mastery_attainment);
  });
  return students.map(s => ({ ...s, mastered: byEl.get(s.el_id) || new Map() }));
}

// ─── Curriculum vs market ──────────────────────────────────────────────────────
function curriculumCoverage(db, { capabilityTargetId, engagementId = null }) {
  const nodes = pathwayNodes(db, capabilityTargetId);
  const students = engagementId ? cohortStudents(db, engagementId) : [];
  const requests = engagementId
    ? db.prepare('SELECT lower(skill_name) as name, COUNT(*) as n FROM skill_requests WHERE engagement_id = ? GROUP BY lower(skill_name)').all(engagementId)
    : [];

  const map = pathwayMap(capabilityTargetId);
  const memo = new Map();
  const skills = market.INSTITUTION_SKILLS.map(([key, share, trend]) => {
    const skill = skillOf(key);
    const hitIds = nodesForSkill(key, map);
    const hit = nodes.filter(n => hitIds.has(n.id));
    const coverageValue = coverageOf(key, map, { memo });
    const coverage = coverageStatus(coverageValue);
    const where = [...new Set(hit.map(n => n.cluster_label))];

    let mastery = null;
    let masteryNote = coverage === 'missing' ? '—' : 'No students yet';
    if (coverage !== 'missing' && students.length) {
      const ids = new Set(hit.map(n => n.id));
      const scores = [];
      students.forEach(st => st.mastered.forEach((v, nodeId) => { if (ids.has(nodeId)) scores.push(v || 0); }));
      if (scores.length) {
        mastery = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100);
        masteryNote = `${mastery}% avg`;
      } else {
        masteryNote = students.some(st => ids.has(st.current_node_id)) ? 'In progress' : 'Not reached yet';
      }
    }
    const req = requests.find(r => r.name === skill.name.toLowerCase());
    return {
      key, name: skill.name, share, trend, coverage, coverage_value: Math.round(coverageValue * 100) / 100,
      where: where.length ? where.join(', ') : 'Not in pathway',
      nodes_matched: hit.length, mastery, mastery_note: masteryNote,
      suggestion: coverage === 'covered' ? 'Keep' : coverage === 'partly' ? 'Extend' : 'Add cluster',
      requested_by: req ? req.n : 0
    };
  });

  const weight = { covered: 1, partly: 0.5, missing: 0 };
  const totalShare = skills.reduce((a, s) => a + s.share, 0);
  const fit = Math.round((skills.reduce((a, s) => a + s.share * weight[s.coverage], 0) / totalShare) * 100);
  const missing = skills.filter(s => s.coverage === 'missing');

  const rare = market.RARE_SKILLS.map(r => {
    const ids = nodesForSkill(r.key, map);
    const hit = nodes.filter(n => ids.has(n.id));
    return hit.length ? { name: r.name, share: r.share, hours: Math.round(hit.reduce((a, n) => a + (n.estimated_minutes || 20), 0) / 60 * 10) / 10 } : null;
  }).filter(Boolean);

  const taught = (st) => coverageStatus(coverageOf(st.key, map, { memo })) !== 'missing';
  const topics = market.TOPICS.map(t => {
    const covered = t.steps.filter(taught).length;
    return covered < t.steps.length ? {
      id: t.id, name: t.name, growth: t.growth, sector: t.sector,
      why: `${t.desc} Your pathway covers ${covered} of ${t.steps.length} steps; missing: ${t.steps.filter(st => !taught(st)).map(st => st.name).join(', ')}.`,
      steps: t.steps.map(st => st.name)
    } : null;
  }).filter(Boolean).slice(0, 4);

  return {
    sample: true,
    kpis: {
      jds_analysed: market.JDS_ANALYSED,
      fit_pct: fit,
      missing_count: missing.length,
      missing_rising: missing.filter(s => /Rising/.test(s.trend)).length,
      rare_count: rare.length,
      rare_hours: Math.round(rare.reduce((a, r) => a + r.hours, 0) * 10) / 10
    },
    skills, rare, topics,
    pathway_nodes: nodes.length,
    unmapped_nodes: nodes.filter(n => !map.rows.some(r => r.node_id === n.id)).map(n => n.node_label)
  };
}

// ─── Where we stand ────────────────────────────────────────────────────────────
// A learner has verified a skill when their mastered nodes cover it at least
// 'partly' in the Capability Graph.
const verifiedSkill = (key, map, masteredIds) => coverageStatus(coverageOf(key, map, { onlyNodes: masteredIds })) !== 'missing';

function jobMatch(job, isVerified) {
  let earned = 0; let possible = 0;
  job.skills.forEach(sk => {
    const w = sk.required ? 1 : 0.5;
    possible += w;
    if (isVerified(sk.key)) earned += w;
  });
  return possible ? earned / possible : 0;
}

// Target-role JDs for a cohort: jobs in the given roles, or else every job
// where the pathway teaches at least one required skill.
function targetJobs(map, roles) {
  if (roles && roles.length) {
    const wanted = roles.map(r => r.toLowerCase());
    const byRole = market.JOBS.filter(j => wanted.some(w => j.role.toLowerCase().includes(w) || w.includes(j.role.toLowerCase())));
    if (byRole.length) return byRole;
  }
  // No roles given: JDs where the pathway teaches at least half the required
  // skills; if none qualify, any JD it teaches something for.
  const share = (j) => { const req = j.skills.filter(sk => sk.required); return req.filter(sk => coverageStatus(coverageOf(sk.key, map)) !== 'missing').length / (req.length || 1); };
  const strong = market.JOBS.filter(j => share(j) >= 0.5);
  return strong.length ? strong : market.JOBS.filter(j => share(j) > 0);
}

function standingFor(db, engagement, { roles = null, before = null } = {}) {
  const nodes = pathwayNodes(db, engagement.capability_target_id);
  const map = pathwayMap(engagement.capability_target_id);
  const jobs = targetJobs(map, roles);
  const students = cohortStudents(db, engagement.id, { before }).map(st => {
    const masteredIds = new Set(st.mastered.keys());
    const cache = new Map();
    const verified = (key) => { if (!cache.has(key)) cache.set(key, verifiedSkill(key, map, masteredIds)); return cache.get(key); };
    const perJob = jobs.map(j => ({ job: j, m: jobMatch(j, verified) }));
    const avg = perJob.length ? perJob.reduce((a, x) => a + x.m, 0) / perJob.length : 0;
    const best = perJob.reduce((b, x) => (!b || x.m > b.m ? x : b), null);
    return { ...st, verified, perJob, index: avg, best: best ? best.m : 0, bestRole: best ? best.job.role : null };
  });
  const n = students.length || 1;
  const index = Math.round((students.reduce((a, s) => a + s.index, 0) / n) * 100);
  const bandOf = (m) => (m >= 0.7 ? 0 : m >= 0.5 ? 1 : m >= 0.3 ? 2 : 3);
  const bandCounts = [0, 0, 0, 0];
  students.forEach(s => { bandCounts[bandOf(s.best)] += 1; });
  return { nodes, map, jobs, students, index, bandCounts, bands: bandCounts.map(c => Math.round((c / n) * 100)) };
}

function cohortStanding(db, engagement, { roles = null, compare = 'regional', compareEngagement = null } = {}) {
  const now = standingFor(db, engagement, { roles });
  const monthAgo = standingFor(db, engagement, { roles, before: new Date(Date.now() - 30 * 86400000).toISOString().replace('T', ' ').slice(0, 19) });

  // Share of students with each JD skill verified.
  const skillKeys = [...new Set(now.jobs.flatMap(j => j.skills.map(sk => sk.key)))];
  const ours = Object.fromEntries(skillKeys.map(k => {
    const have = now.students.filter(st => st.verified(k)).length;
    return [k, now.students.length ? Math.round((have / now.students.length) * 100) : 0];
  }));

  let comparison;
  if (compare === 'engagement' && compareEngagement) {
    const other = standingFor(db, compareEngagement, { roles });
    const otherSkills = Object.fromEntries(skillKeys.map(k => {
      const have = other.students.filter(st => st.verified(k)).length;
      return [k, other.students.length ? Math.round((have / other.students.length) * 100) : 0];
    }));
    comparison = { label: compareEngagement.title, score: other.index, bands: other.bands, skills: otherSkills, sample: false };
  } else {
    const b = market.BENCHMARKS[compare] || market.BENCHMARKS.regional;
    comparison = { label: b.label, score: b.score, bands: b.bands, skills: b.skills, sample: true };
  }

  const roleNames = [...new Set(now.jobs.map(j => j.role))];
  const roleFit = roleNames.map(role => {
    const roleJobs = now.jobs.filter(j => j.role === role);
    const ready = now.students.filter(st => st.perJob.some(x => x.job.role === role && x.m >= 0.7)).length;
    const req = [...new Set(roleJobs.flatMap(j => j.skills.filter(sk => sk.required).map(sk => sk.key)))];
    const gapKey = req.sort((a, b) => (ours[a] ?? 0) - (ours[b] ?? 0))[0];
    return { role, ready, open: market.ROLE_OPENINGS[role] || null, gap: gapKey ? market.SKILLS[gapKey].name : null };
  });

  const trail = skillKeys
    .filter(k => comparison.skills[k] != null && ours[k] < comparison.skills[k])
    .map(k => ({ skill: market.SKILLS[k].name, ours: ours[k], bench: comparison.skills[k], gap: ours[k] - comparison.skills[k] }))
    .sort((a, b) => a.gap - b.gap).slice(0, 6);

  const top = now.students.filter(st => st.opted_in)
    .sort((a, b) => b.best - a.best).slice(0, 8)
    .map(st => ({ name: st.name, learner_ref: st.learner_ref, role: st.bestRole, match: Math.round(st.best * 100) }));

  return {
    sample: comparison.sample,
    students: now.students.length,
    opted_in: now.students.filter(st => st.opted_in).length,
    index: now.index,
    change_30d: now.index - monthAgo.index,
    bands: ['70%+ match', '50–69%', '30–49%', 'Under 30%'].map((label, i) => ({ label, ours: now.bands[i], ours_count: now.bandCounts[i], theirs: comparison.bands[i] })),
    comparison: { label: comparison.label, score: comparison.score },
    roles: roleFit, trail, top,
    target_roles: roleNames
  };
}

export { curriculumCoverage, cohortStanding, pathwayNodes };
