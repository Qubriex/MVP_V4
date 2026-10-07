// core/hiringLoop.js
// ─────────────────────────────────────────────────────────────────────────────
// The hiring loop between learners and employers (v4.3 canvas L5, L8, E1–E7,
// E10). One readiness definition with the institution side: the match
// between a student's VERIFIED skills and what a role asks for, 0–100
// (Ready ≥ 80 · Nearly ready 60–79 · Building < 60).
//
// Privacy rules, enforced here and not in the UI:
//   • Only students who turned on "Let employers find me" (consent level 3)
//     appear in search, and only as an anonymous candidate code, college and
//     city until they say yes to a request (consent level 4, per employer).
//   • A student answers yes or no per item: skills and evidence, résumé,
//     contact details. Withdrawing stops access on the next request.
//   • College groups under 5 students are not shown ("Too few to show").
// ─────────────────────────────────────────────────────────────────────────────
import crypto from 'crypto';
import * as dal from './db/dal.js';
import { ulid } from './db/ulid.js';
import * as market from './market/sampleMarket.js';
import { jobMatch, verifiedKeys } from './insights.js';
import { grant, withdraw, LEVELS } from './consent/levels.js';
import { notify } from './notify.js';
import { mapSeq } from './util/seq.js';
import { bandOf, BAND_LABEL } from './readiness/cohort.js';

export const MIN_GROUP = 5;
export const SHARE_ITEMS = Object.freeze(['skills', 'resume', 'contact']);
// Stages after the student said yes (or applied): the employer may see who they are.
export const OPEN_STAGES = Object.freeze(['access_granted', 'applied', 'interview', 'dayone', 'offer', 'hired', 'hold', 'not_now']);
const DECIDED = ['interview', 'dayone', 'offer', 'hired', 'not_now'];
const TEXT_VERSION = 'employer-access-v1';

const candidateCode = (employerId, elId) => `C-${crypto.createHash('sha256').update(`${employerId}|${elId}`).digest('hex').slice(0, 6).toUpperCase()}`;
const parse = (s, d) => { try { return JSON.parse(s || ''); } catch { return d; } };
const err = (status, message) => Object.assign(new Error(message), { status });

// ─── Roles from a JD (E2) ──────────────────────────────────────────────────────
const OPTIONAL_HINT = /nice to have|good to have|bonus|preferred|plus\b|optional/i;

/** The skills a JD asks for, from the skill list's keywords. Lines that say "nice to have" mark skills optional. */
export function skillsFromJd(text) {
  const lines = String(text || '').split(/\n|•|;/).map(l => l.trim()).filter(Boolean);
  const found = new Map();
  for (const [key, s] of Object.entries(market.SKILLS)) {
    const words = [s.name, ...(s.keywords || [])].map(w => String(w).toLowerCase()).filter(w => w.length >= 2);
    for (const line of lines) {
      const low = ` ${line.toLowerCase()} `;
      if (words.some(w => new RegExp(`[^a-z0-9]${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^a-z0-9]`).test(low))) {
        const required = !OPTIONAL_HINT.test(line);
        if (!found.has(key) || required) found.set(key, { key, name: s.name, required });
        break;
      }
    }
  }
  return [...found.values()];
}

const shareOf = new Map(market.SKILL_SHARE);
/** Bar vs market: how often current job posts ask for each skill. */
export function barVsMarket(skills) {
  return skills.map(s => ({ ...s, market_share: shareOf.get(s.key) ?? null }));
}

export async function createRole(employerId, userId, b) {
  const skills = (Array.isArray(b.skills) && b.skills.length ? b.skills : skillsFromJd(b.jd_text))
    .filter(s => market.SKILLS[s.key]).map(s => ({ key: s.key, name: market.SKILLS[s.key].name, required: s.required !== false }));
  if (!String(b.title || '').trim()) throw err(400, 'Give the role a title.');
  if (!skills.length) throw err(400, 'No skills found. Paste the job description or pick skills.');
  const id = ulid();
  await dal.run(`INSERT INTO employer_roles (id, employer_id, title, city, jd_text, skills_json, bar, published, interview_promise, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, id, employerId, String(b.title).trim().slice(0, 160), b.city ? String(b.city).slice(0, 80) : null,
  b.jd_text ? String(b.jd_text).slice(0, 20000) : null, JSON.stringify(skills), clampBar(b.bar), b.published ? 1 : 0, b.interview_promise ? 1 : 0, userId, dal.nowIso());
  return id;
}
const clampBar = (v) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= 40 && n <= 100 ? n : 80; };

export async function updateRole(employerId, roleId, b) {
  const r = await dal.one('SELECT * FROM employer_roles WHERE id = ? AND employer_id = ?', roleId, employerId);
  if (!r) return null;
  const skills = Array.isArray(b.skills) ? b.skills.filter(s => market.SKILLS[s.key]).map(s => ({ key: s.key, name: market.SKILLS[s.key].name, required: s.required !== false })) : parse(r.skills_json, []);
  await dal.run('UPDATE employer_roles SET title = ?, city = ?, skills_json = ?, bar = ?, published = ?, interview_promise = ?, status = ? WHERE id = ?',
    b.title ? String(b.title).slice(0, 160) : r.title, b.city !== undefined ? (b.city || null) : r.city, JSON.stringify(skills),
    b.bar !== undefined ? clampBar(b.bar) : r.bar, b.published !== undefined ? (b.published ? 1 : 0) : r.published,
    b.interview_promise !== undefined ? (b.interview_promise ? 1 : 0) : r.interview_promise, ['open', 'closed'].includes(b.status) ? b.status : r.status, r.id);
  return true;
}

export const roleView = (r) => ({ id: r.id, title: r.title, city: r.city, bar: r.bar, status: r.status, published: !!r.published, interview_promise: !!r.interview_promise, created_at: r.created_at, skills: barVsMarket(parse(r.skills_json, [])) });

// ─── Who can be found ──────────────────────────────────────────────────────────
async function discoverable() {
  return dal.all(`SELECT el.id AS el_id, el.engagement_id, l.id AS learner_id, l.name, l.city, l.availability, e.capability_target_id, e.institution_id,
      i.name AS college, i.city AS college_city
    FROM learners l JOIN engagement_learners el ON el.learner_id = l.id JOIN engagements e ON e.id = el.engagement_id JOIN institutions i ON i.id = e.institution_id
    WHERE l.is_discoverable = 1 AND COALESCE(l.is_active, 1) = 1 AND COALESCE(el.access_status, 'active') = 'active'
      AND EXISTS (SELECT 1 FROM consents c WHERE c.learner_id = l.id AND c.level = ? AND c.withdrawn_at IS NULL)`, LEVELS.DISCOVERABLE);
}

async function masteredByEl(elIds) {
  if (!elIds.length) return new Map();
  const rows = await dal.all(`SELECT engagement_learner_id AS el_id, skill_node_id FROM node_mastery WHERE advanced_at IS NOT NULL AND engagement_learner_id IN (${elIds.map(() => '?').join(',')})`, ...elIds);
  const m = new Map();
  rows.forEach(r => { if (!m.has(r.el_id)) m.set(r.el_id, new Set()); m.get(r.el_id).add(r.skill_node_id); });
  return m;
}

/** Score each student against a role: readiness, band, verified and missing skills. */
async function scoreAll(students, skills) {
  const keys = skills.map(s => s.key);
  const mastered = await masteredByEl(students.map(s => s.el_id));
  const job = { skills };
  return mapSeq(students, async (s) => {
    const have = await verifiedKeys(s.capability_target_id, mastered.get(s.el_id) || new Set(), keys);
    const readiness = Math.round(jobMatch(job, k => have.has(k)) * 100);
    return { ...s, readiness, band: bandOf(readiness), verified: skills.filter(k => have.has(k.key)).map(k => k.name), missing: skills.filter(k => k.required && !have.has(k.key)).map(k => k.name) };
  });
}

// ─── Find candidates (E3) ──────────────────────────────────────────────────────
export async function findCandidates(employerId, role, { city = '', band = '' } = {}) {
  const skills = parse(role.skills_json, []);
  const scored = (await scoreAll(await discoverable(), skills))
    .filter(s => !city || s.city === city || s.college_city === city)
    .filter(s => !band || s.band === band)
    .sort((a, b) => b.readiness - a.readiness);
  const pipe = new Map((await dal.all('SELECT el_id, stage FROM employer_pipeline WHERE role_id = ?', role.id)).map(r => [r.el_id, r.stage]));
  const candidates = scored.map(s => ({
    code: candidateCode(employerId, s.el_id), el_id: s.el_id, college: s.college, institution_id: s.institution_id, city: s.city || s.college_city,
    readiness: s.readiness, band: s.band, band_label: BAND_LABEL[s.band], meets_bar: s.readiness >= role.bar,
    points_short: Math.max(0, role.bar - s.readiness), verified: s.verified, missing: s.missing, stage: pipe.get(s.el_id) || null
  }));
  // Best colleges for this role: groups of 5+ only.
  const byCollege = new Map();
  scored.forEach(s => { const g = byCollege.get(s.institution_id) || { institution_id: s.institution_id, college: s.college, city: s.college_city, n: 0, at_bar: 0, near: 0 }; g.n += 1; if (s.readiness >= role.bar) g.at_bar += 1; else if (s.readiness >= role.bar - 20) g.near += 1; byCollege.set(s.institution_id, g); });
  const colleges = [...byCollege.values()].map(g => (g.n < MIN_GROUP ? { institution_id: g.institution_id, college: g.college, city: g.city, too_few: true } : g))
    .sort((a, b) => (b.at_bar || 0) - (a.at_bar || 0));
  return { candidates, colleges, total: candidates.length };
}

// ─── Pipeline (E3–E6) ──────────────────────────────────────────────────────────
async function pipelineRow(employerId, roleId, elId) {
  return dal.one('SELECT * FROM employer_pipeline WHERE employer_id = ? AND role_id = ? AND el_id = ?', employerId, roleId, elId);
}

/** Watch (private bookmark) or Request (asks the student). */
export async function watchOrRequest(employer, role, elId, kind, { items = SHARE_ITEMS, note = null } = {}) {
  const s = (await discoverable()).find(x => x.el_id === elId);
  if (!s) throw err(404, 'This student is not open to employers any more.');
  if (kind === 'request' && employer.kyb_status !== 'verified') throw err(403, 'Requests open once your company is verified. You can still watch candidates.');
  const now = dal.nowIso();
  const cur = await pipelineRow(employer.id, role.id, elId);
  const wanted = SHARE_ITEMS.filter(k => items.includes(k));
  if (cur && OPEN_STAGES.includes(cur.stage)) return cur.id;
  if (cur && cur.stage === 'requested' && kind === 'watch') return cur.id;
  const stage = kind === 'request' ? 'requested' : 'watching';
  const id = cur?.id || ulid();
  if (cur) await dal.run('UPDATE employer_pipeline SET stage = ?, share_json = ?, note = COALESCE(?, note), updated_at = ? WHERE id = ?', stage, JSON.stringify({ asked: wanted }), note, now, id);
  else {
    await dal.run(`INSERT INTO employer_pipeline (id, employer_id, role_id, el_id, learner_id, stage, share_json, interview_promised, note, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, id, employer.id, role.id, elId, s.learner_id, stage, JSON.stringify({ asked: wanted }), role.interview_promise ? 1 : 0, note, now, now);
  }
  if (kind === 'request') {
    await notify({ to: { type: 'learner', id: s.learner_id }, kind: 'employer_request', title: `${employer.name} would like to see your Passport`, body: `For ${role.title}${role.interview_promise ? ' · interview promised if you say yes' : ''}. You choose what to share.`, href: '/learn/jobs' });
  }
  return id;
}

const PLACEMENT_STAGE = { offer: 'offer', hired: 'placed' };
export async function setStage(employer, pipelineId, stage, note = null) {
  const p = await dal.one('SELECT * FROM employer_pipeline WHERE id = ? AND employer_id = ?', pipelineId, employer.id);
  if (!p) return null;
  if (!['interview', 'dayone', 'offer', 'hired', 'hold', 'not_now', 'watching'].includes(stage)) throw err(400, 'Unknown stage.');
  if (stage !== 'watching' && !OPEN_STAGES.includes(p.stage)) throw err(409, 'The student has not said yes yet.');
  await dal.run('UPDATE employer_pipeline SET stage = ?, note = COALESCE(?, note), updated_at = ? WHERE id = ?', stage, note, dal.nowIso(), p.id);
  const role = await dal.one('SELECT title FROM employer_roles WHERE id = ?', p.role_id);
  const msg = { interview: 'invited you to an interview', dayone: 'invited you to a Day-One practice run', offer: 'made you an offer', not_now: 'decided not to go ahead for now', hold: null, hired: null, watching: null }[stage];
  if (msg) await notify({ to: { type: 'learner', id: p.learner_id }, kind: `employer_${stage}`, title: `${employer.name} ${msg}`, body: role?.title || '', href: '/learn/jobs' });
  // Offers and hires reach the college's Placements page.
  if (PLACEMENT_STAGE[stage]) {
    const e = await dal.one('SELECT e.id, e.institution_id FROM engagement_learners el JOIN engagements e ON e.id = el.engagement_id WHERE el.id = ?', p.el_id);
    const existing = await dal.one("SELECT id FROM placements WHERE el_id = ? AND employer_id = ? AND source = 'employer'", p.el_id, employer.id);
    if (existing) await dal.run('UPDATE placements SET status = ?, joined_date = ? WHERE id = ?', PLACEMENT_STAGE[stage], stage === 'hired' ? dal.nowIso().slice(0, 10) : null, existing.id);
    else {
      await dal.run(`INSERT INTO placements (id, institution_id, engagement_id, el_id, learner_id, employer_name, employer_id, role_title, status, offer_date, source, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'employer', ?)`, ulid(), e.institution_id, e.id, p.el_id, p.learner_id, employer.name, employer.id, role?.title || null, PLACEMENT_STAGE[stage], dal.nowIso().slice(0, 10), dal.nowIso());
    }
  }
  return true;
}

/** A reminder to a student who has not answered a request; at most once in 3 days. */
export async function nudge(employer, pipelineId) {
  const p = await dal.one("SELECT * FROM employer_pipeline WHERE id = ? AND employer_id = ? AND stage = 'requested'", pipelineId, employer.id);
  if (!p) throw err(409, 'Only unanswered requests can be nudged.');
  if (p.nudged_at && Date.now() - new Date(p.nudged_at).getTime() < 3 * 86400000) throw err(429, 'Already nudged in the last 3 days.');
  await dal.run('UPDATE employer_pipeline SET nudged_at = ? WHERE id = ?', dal.nowIso(), p.id);
  await notify({ to: { type: 'learner', id: p.learner_id }, kind: 'employer_request', title: `Reminder: ${employer.name} is waiting for your answer`, body: 'Say yes or no — either is fine.', href: '/learn/jobs' });
  return true;
}

const STAGE_LABEL = { watching: 'Watching', requested: 'Asked', declined: 'Said no', access_granted: 'Said yes', applied: 'Applied', interview: 'Interview', dayone: 'Day-One', offer: 'Offer', hired: 'Hired', hold: 'On hold', not_now: 'Not now', withdrawn: 'Withdrew' };

/** Pipeline rows for an employer: names only where the student said yes. */
export async function pipeline(employerId, roleId = null) {
  const rows = await dal.all(`SELECT p.*, r.title AS role_title, r.bar, l.name, i.name AS college, l.city, e.capability_target_id, r.skills_json
    FROM employer_pipeline p JOIN employer_roles r ON r.id = p.role_id JOIN learners l ON l.id = p.learner_id
    JOIN engagement_learners el ON el.id = p.el_id JOIN engagements e ON e.id = el.engagement_id JOIN institutions i ON i.id = e.institution_id
    WHERE p.employer_id = ? ${roleId ? 'AND p.role_id = ?' : ''} ORDER BY p.updated_at DESC`, ...(roleId ? [employerId, roleId] : [employerId]));
  const mastered = await masteredByEl(rows.map(r => r.el_id));
  const out = await mapSeq(rows, async (r) => {
    const skills = parse(r.skills_json, []);
    const have = await verifiedKeys(r.capability_target_id, mastered.get(r.el_id) || new Set(), skills.map(s => s.key));
    const readiness = Math.round(jobMatch({ skills }, k => have.has(k)) * 100);
    const open = OPEN_STAGES.includes(r.stage);
    return {
      id: r.id, role_id: r.role_id, role_title: r.role_title, el_id: r.el_id, code: candidateCode(employerId, r.el_id),
      name: open ? r.name : null, college: r.college, city: r.city, stage: r.stage, stage_label: STAGE_LABEL[r.stage],
      readiness, band_label: BAND_LABEL[bandOf(readiness)], interview_promised: !!r.interview_promised, nudged_at: r.nudged_at,
      waiting_days: Math.floor((Date.now() - new Date(r.updated_at).getTime()) / 86400000), created_at: r.created_at, updated_at: r.updated_at
    };
  });
  const counts = Object.fromEntries(Object.keys(STAGE_LABEL).map(k => [k, out.filter(r => r.stage === k).length]));
  const decided = rows.filter(r => DECIDED.includes(r.stage));
  const weeks = decided.length ? Math.round((decided.reduce((a, r) => a + (new Date(r.updated_at) - new Date(r.created_at)), 0) / decided.length / (7 * 86400000)) * 10) / 10 : null;
  return {
    rows: out,
    funnel: [['Asked', counts.requested + counts.access_granted + counts.declined + counts.applied + counts.interview + counts.dayone + counts.offer + counts.hired + counts.hold + counts.not_now],
      ['Said yes or applied', counts.access_granted + counts.applied + counts.interview + counts.dayone + counts.offer + counts.hired + counts.hold + counts.not_now],
      ['Interview', counts.interview + counts.dayone + counts.offer + counts.hired], ['Offer', counts.offer + counts.hired], ['Hired', counts.hired]].map(([label, n]) => ({ label, n })),
    counts, weeks_to_decide: weeks,
    waiting: out.filter(r => ['access_granted', 'applied'].includes(r.stage)).length
  };
}

/** One candidate (E4). Who they are and their evidence only after a yes. */
export async function candidate(employerId, pipelineId, { skillLines, skillFacts, activeCredential }) {
  const p = await dal.one(`SELECT p.*, r.title AS role_title, r.skills_json, r.bar, l.name, l.city, l.email, lp.phone, lp.headline, lp.about, i.name AS college, e.capability_target_id
    FROM employer_pipeline p JOIN employer_roles r ON r.id = p.role_id JOIN learners l ON l.id = p.learner_id
    LEFT JOIN learner_profiles lp ON lp.learner_id = l.id
    JOIN engagement_learners el ON el.id = p.el_id JOIN engagements e ON e.id = el.engagement_id JOIN institutions i ON i.id = e.institution_id
    WHERE p.id = ? AND p.employer_id = ?`, pipelineId, employerId);
  if (!p) return null;
  const skills = parse(p.skills_json, []);
  const have = await verifiedKeys(p.capability_target_id, (await masteredByEl([p.el_id])).get(p.el_id) || new Set(), skills.map(s => s.key));
  const readiness = Math.round(jobMatch({ skills }, k => have.has(k)) * 100);
  const open = OPEN_STAGES.includes(p.stage);
  const share = parse(p.share_json, {});
  const granted = share.granted || (p.stage === 'applied' ? SHARE_ITEMS : []);
  const base = {
    id: p.id, code: candidateCode(employerId, p.el_id), role: { id: p.role_id, title: p.role_title, bar: p.bar }, stage: p.stage, stage_label: STAGE_LABEL[p.stage],
    college: p.college, city: p.city, readiness, band_label: BAND_LABEL[bandOf(readiness)], interview_promised: !!p.interview_promised,
    skills: skills.map(s => ({ name: s.name, required: s.required, verified: have.has(s.key) })), open, shared: granted, asked: share.asked || SHARE_ITEMS
  };
  if (!open) return base;
  const cred = await activeCredential('el_id = ?', p.el_id);
  const lines = granted.includes('skills') ? (await skillLines(p.el_id, await skillFacts(p.el_id))).map(({ nodes, ...s }) => ({ ...s, nodes: nodes.map(n => ({ node: n.node, last_demonstrated: n.last_demonstrated, freshness: n.freshness })) })) : [];
  const resume = granted.includes('resume') && (p.headline || p.about) ? { headline: p.headline, summary: p.about } : null;
  return {
    ...base, name: p.name, evidence_id: granted.includes('skills') ? cred?.evidence_id || null : null, evidence: lines,
    resume: resume || null, contact: granted.includes('contact') ? { email: p.email || null, phone: p.phone || null } : null,
    dayone: { status: p.stage === 'dayone' ? 'invited' : 'not_scheduled' }
  };
}

// ─── The student's side (L5, L8) ───────────────────────────────────────────────
export async function learnerRequests(learnerId) {
  const rows = await dal.all(`SELECT p.id, p.stage, p.share_json, p.interview_promised, p.created_at, p.updated_at, r.title AS role_title, r.city, em.name AS employer
    FROM employer_pipeline p JOIN employer_roles r ON r.id = p.role_id JOIN employers em ON em.id = p.employer_id
    WHERE p.learner_id = ? AND p.stage != 'watching' ORDER BY p.updated_at DESC`, learnerId);
  return rows.map(r => { const s = parse(r.share_json, {}); return { id: r.id, employer: r.employer, role_title: r.role_title, city: r.city, stage: r.stage, stage_label: STAGE_LABEL[r.stage], interview_promised: !!r.interview_promised, asked: s.asked || SHARE_ITEMS, shared: s.granted || [], created_at: r.created_at, updated_at: r.updated_at }; });
}

/** Yes or no, per item. A yes is a level-4 consent scoped to this employer and role. */
export async function respond(user, pipelineId, { yes, items = [] }) {
  const p = await dal.one('SELECT p.*, em.name AS employer FROM employer_pipeline p JOIN employers em ON em.id = p.employer_id WHERE p.id = ? AND p.learner_id = ?', pipelineId, user.id);
  if (!p) return null;
  if (p.stage !== 'requested') throw err(409, 'This request was already answered.');
  const share = parse(p.share_json, {});
  const granted = yes ? SHARE_ITEMS.filter(k => items.includes(k) && (share.asked || SHARE_ITEMS).includes(k)) : [];
  if (yes && !granted.length) throw err(400, 'Choose at least one thing to share, or say no.');
  const institution = (await dal.one('SELECT institution_id FROM engagements WHERE id = ?', user.engagement_id))?.institution_id;
  let consentId = null;
  if (yes) consentId = await grant({ learnerId: user.id, institutionId: institution, level: LEVELS.EMPLOYER_ACCESS, purpose: `Share ${granted.join(', ')} with ${p.employer}`, textVersion: TEXT_VERSION, scope: { employer_id: p.employer_id, role_id: p.role_id, items: granted } });
  await dal.run('UPDATE employer_pipeline SET stage = ?, share_json = ?, updated_at = ? WHERE id = ?', yes ? 'access_granted' : 'declined', JSON.stringify({ ...share, granted, consent_id: consentId }), dal.nowIso(), p.id);
  await notify({ to: { type: 'employer', id: p.employer_id }, kind: yes ? 'candidate_yes' : 'candidate_no', title: yes ? 'A candidate said yes' : 'A candidate said no thanks', body: yes ? `Shared: ${granted.join(', ')}.` : '', href: yes ? `/employer/candidates/${p.id}` : '/employer/pipeline' });
  return true;
}

/** Withdraw from an employer: their access ends now. */
export async function withdrawFrom(user, pipelineId) {
  const p = await dal.one('SELECT * FROM employer_pipeline WHERE id = ? AND learner_id = ?', pipelineId, user.id);
  if (!p) return null;
  const share = parse(p.share_json, {});
  if (share.consent_id) await withdraw(share.consent_id);
  await dal.run("UPDATE employer_pipeline SET stage = 'withdrawn', updated_at = ? WHERE id = ?", dal.nowIso(), p.id);
  await notify({ to: { type: 'employer', id: p.employer_id }, kind: 'candidate_withdrew', title: 'A candidate withdrew', body: 'Their details are no longer visible to you.', href: '/employer/pipeline' });
  return true;
}

/** Apply to an employer's published role: shares skills, résumé and contact. */
export async function applyToRole(user, roleId) {
  const role = await dal.one("SELECT r.*, em.name AS employer FROM employer_roles r JOIN employers em ON em.id = r.employer_id WHERE r.id = ? AND r.published = 1 AND r.status = 'open'", roleId);
  if (!role) throw err(404, 'This job is no longer open.');
  const institution = (await dal.one('SELECT institution_id FROM engagements WHERE id = ?', user.engagement_id))?.institution_id;
  const consentId = await grant({ learnerId: user.id, institutionId: institution, level: LEVELS.EMPLOYER_ACCESS, purpose: `Apply to ${role.title} at ${role.employer}`, textVersion: TEXT_VERSION, scope: { employer_id: role.employer_id, role_id: role.id, items: SHARE_ITEMS } });
  const now = dal.nowIso();
  const cur = await dal.one('SELECT id FROM employer_pipeline WHERE role_id = ? AND el_id = ?', role.id, user.el_id);
  const share = JSON.stringify({ asked: SHARE_ITEMS, granted: SHARE_ITEMS, consent_id: consentId });
  if (cur) await dal.run("UPDATE employer_pipeline SET stage = 'applied', share_json = ?, updated_at = ? WHERE id = ?", share, now, cur.id);
  else {
    await dal.run(`INSERT INTO employer_pipeline (id, employer_id, role_id, el_id, learner_id, stage, share_json, interview_promised, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'applied', ?, ?, ?, ?)`, ulid(), role.employer_id, role.id, user.el_id, user.id, share, role.interview_promise ? 1 : 0, now, now);
  }
  await notify({ to: { type: 'employer', id: role.employer_id }, kind: 'candidate_applied', title: `New application for ${role.title}`, href: '/employer/pipeline' });
  return true;
}

/** Jobs that fit: employers' published roles, with readiness, points short of their bar, and the interview promise. */
export async function matchedRoles(user, { city = '' } = {}) {
  const roles = await dal.all(`SELECT r.*, em.name AS employer FROM employer_roles r JOIN employers em ON em.id = r.employer_id
    WHERE r.published = 1 AND r.status = 'open' AND em.kyb_status = 'verified' ${city ? 'AND (r.city = ? OR r.city IS NULL)' : ''} ORDER BY r.created_at DESC LIMIT 50`, ...(city ? [city] : []));
  if (!roles.length) return [];
  const e = await dal.one('SELECT capability_target_id FROM engagements WHERE id = ?', user.engagement_id);
  const mastered = (await masteredByEl([user.el_id])).get(user.el_id) || new Set();
  const mine = new Map((await dal.all('SELECT role_id, stage FROM employer_pipeline WHERE el_id = ?', user.el_id)).map(r => [r.role_id, r.stage]));
  return (await mapSeq(roles, async (r) => {
    const skills = parse(r.skills_json, []);
    const have = await verifiedKeys(e.capability_target_id, mastered, skills.map(s => s.key));
    const readiness = Math.round(jobMatch({ skills }, k => have.has(k)) * 100);
    return { id: r.id, title: r.title, employer: r.employer, city: r.city, bar: r.bar, readiness, points_short: Math.max(0, r.bar - readiness), interview_promise: !!r.interview_promise,
      missing: skills.filter(s => s.required && !have.has(s.key)).map(s => s.name), stage: mine.get(r.id) || null };
  })).sort((a, b) => a.points_short - b.points_short || b.readiness - a.readiness);
}

// ─── Sponsor a cohort (E7) ─────────────────────────────────────────────────────
export async function sponsor(employer, b) {
  const inst = await dal.one('SELECT id, name FROM institutions WHERE id = ?', b.institution_id);
  if (!inst) throw err(404, 'College not found.');
  const seats = Math.round(Number(b.seats));
  if (!(seats >= 1 && seats <= 500)) throw err(400, 'Seats must be between 1 and 500.');
  const role = b.role_id ? await dal.one('SELECT id, title FROM employer_roles WHERE id = ? AND employer_id = ?', b.role_id, employer.id) : null;
  const id = ulid();
  await dal.run(`INSERT INTO sponsorships (id, employer_id, institution_id, role_id, seats, interview_promise, message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    id, employer.id, inst.id, role?.id || null, seats, b.interview_promise === false ? 0 : 1, b.message ? String(b.message).slice(0, 1000) : null, dal.nowIso());
  await notify({ to: { type: 'institution', id: inst.id }, kind: 'sponsorship', title: `${employer.name} offers to sponsor ${seats} seat${seats === 1 ? '' : 's'}`, body: role ? `For ${role.title}${b.interview_promise === false ? '' : ', with an interview for each student who reaches the bar'}.` : '', href: '/institution/placements' });
  return id;
}

// ─── Colleges & insights (E10) ─────────────────────────────────────────────────
export async function collegeInsights(roles) {
  const students = await discoverable();
  const skills = roles.length ? [...new Map(roles.flatMap(r => parse(r.skills_json, [])).map(s => [s.key, s])).values()] : market.JOBS[0].skills.map(s => ({ key: s.key, name: s.name, required: s.required }));
  const scored = await scoreAll(students, skills);
  const groups = new Map();
  scored.forEach(s => {
    const g = groups.get(s.institution_id) || { institution_id: s.institution_id, college: s.college, city: s.college_city, n: 0, ready: 0, nearly: 0, building: 0, gaps: new Map() };
    g.n += 1; g[s.band] += 1; s.missing.forEach(m => g.gaps.set(m, (g.gaps.get(m) || 0) + 1));
    groups.set(s.institution_id, g);
  });
  const colleges = [...groups.values()].map(g => (g.n < MIN_GROUP
    ? { institution_id: g.institution_id, college: g.college, city: g.city, too_few: true }
    : { institution_id: g.institution_id, college: g.college, city: g.city, n: g.n, ready: g.ready, nearly: g.nearly, building: g.building, small: g.n < 20, top_gap: [...g.gaps.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null }))
    .sort((a, b) => (b.ready || 0) - (a.ready || 0));
  const skillSupply = skills.map(s => ({ name: s.name, verified: scored.filter(x => x.verified.includes(s.name)).length, market_share: shareOf.get(s.key) ?? null }));
  return { colleges, skills: scored.length >= MIN_GROUP ? skillSupply : [], total: scored.length, roles_used: roles.map(r => r.title) };
}

export { candidateCode, STAGE_LABEL };
