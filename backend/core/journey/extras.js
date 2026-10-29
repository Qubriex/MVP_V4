// core/journey/extras.js — the rest of the learner journey screens:
//   Day-One Simulation (learner side), "Assigned by your college", notification
//   preferences, résumé claims vs proven skills, and deleting an account with
//   an OTP and a grace period.
import crypto from 'crypto';
import * as dal from '../db/dal.js';
import { ulid } from '../db/ulid.js';
import * as market from '../market/sampleMarket.js';
import { learnerBridges } from '../collegeLoop.js';
import { lessonFor, grade } from '../ai/adapters/scripted.js';
import { skillLines, skillFacts, activeCredential, revokeCredential } from '../return/credentialEngine.js';
import { nowIsoFor, isTestLearner } from '../requestContext.js';
import { forcedResult } from './forced.js';

const DAY = 86400000;
const err = (status, message) => Object.assign(new Error(message), { status });
const parse = (s, d) => { try { return JSON.parse(s); } catch { return d; } };
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');

// ─── Day-One Simulation ────────────────────────────────────────────────────────
// A role's first-day work in 45 minutes. Before starting: a quiet room, the
// camera on for supervision, 45 free minutes. An unscored practice run first;
// then the scored, supervised run (authorship A3). A pass adds a Day-One
// demonstration to the role's skills on the Passport.
async function roleNodes(el, run) {
  const role = run.pipeline_id ? await dal.one('SELECT r.skills_json FROM employer_pipeline p JOIN employer_roles r ON r.id = p.role_id WHERE p.id = ?', run.pipeline_id) : null;
  const keys = parse(role?.skills_json, []).map(s => s.key);
  const mastered = await dal.all(`SELECT nm.skill_node_id AS id, sn.node_label FROM node_mastery nm JOIN skill_nodes sn ON sn.id = nm.skill_node_id
    WHERE nm.engagement_learner_id = ? AND nm.advanced_at IS NOT NULL ORDER BY nm.advanced_at DESC`, el.el_id);
  const fits = mastered.filter(n => keys.some(k => (market.SKILLS[k]?.keywords || [k]).some(w => n.node_label.toLowerCase().includes(w.trim()))));
  return (fits.length ? fits : mastered).slice(0, 3);
}

function tasksFor(nodes, language) {
  return nodes.map(n => ({ node_id: n.id, skill: n.node_label, prompt: lessonFor(n.node_label, language).check.questions[1].replace('{context}', language === 'english' ? 'customer dashboard' : 'customer dashboard').replace('{skill}', n.node_label) }));
}

export async function dayoneView(el, language) {
  let run = await dal.one('SELECT * FROM dayone_runs WHERE el_id = ? ORDER BY created_at DESC LIMIT 1', el.el_id);
  if (!run) {
    const invited = await dal.one(`SELECT p.id, r.title FROM employer_pipeline p JOIN employer_roles r ON r.id = p.role_id WHERE p.el_id = ? AND p.stage = 'dayone' ORDER BY p.updated_at DESC LIMIT 1`, el.el_id);
    if (!invited) return { status: 'none' };
    await dal.run("INSERT INTO dayone_runs (id, el_id, pipeline_id, role_title, status, created_at) VALUES (?, ?, ?, ?, 'assigned', ?)", ulid(), el.el_id, invited.id, invited.title, nowIsoFor());
    run = await dal.one('SELECT * FROM dayone_runs WHERE el_id = ? ORDER BY created_at DESC LIMIT 1', el.el_id);
  }
  const employer = run.pipeline_id ? await dal.one('SELECT em.name FROM employer_pipeline p JOIN employers em ON em.id = p.employer_id WHERE p.id = ?', run.pipeline_id) : null;
  return {
    id: run.id, status: run.status, role: run.role_title, employer: employer?.name || null, checks: parse(run.checks_json, null),
    practice_at: run.practice_at, scored_at: run.scored_at, passed: run.passed == null ? null : !!run.passed,
    tasks: tasksFor(await roleNodes(el, run), language), minutes: 45
  };
}

export async function dayoneStep(el, { step, checks, answers, supervision, language }) {
  const run = await dal.one("SELECT * FROM dayone_runs WHERE el_id = ? ORDER BY created_at DESC LIMIT 1", el.el_id);
  if (!run) throw err(404, 'No Day-One Simulation has been assigned to you.');
  const now = nowIsoFor();
  if (step === 'precheck') {
    const c = { quiet_room: !!checks?.quiet_room, camera: !!checks?.camera, minutes: !!checks?.minutes };
    await dal.run('UPDATE dayone_runs SET checks_json = ? WHERE id = ?', JSON.stringify(c), run.id);
    return { checks: c, ready: c.quiet_room && c.camera && c.minutes };
  }
  const nodes = await roleNodes(el, run);
  const graded = await Promise.all(tasksFor(nodes, language).map(async (t, i) => {
    const text = String(answers?.[i] || '');
    const forced = text ? await forcedResult(el.el_id, text) : null;
    return forced ? { passed: forced === 'pass', score: forced === 'pass' ? 0.9 : 0.3 } : grade({ nodeLabel: t.skill, language, answer: text, theta: 0.7 });
  }));
  const passed = graded.length > 0 && graded.every(g => g.passed);
  if (step === 'practice') {
    await dal.run("UPDATE dayone_runs SET status = CASE WHEN status = 'assigned' THEN 'practice_done' ELSE status END, practice_at = ? WHERE id = ?", now, run.id);
    return { practice: true, results: graded.map(g => (g.passed ? 'pass' : g.score >= 0.5 ? 'partial' : 'fail')) };
  }
  if (step === 'scored') {
    const c = parse(run.checks_json, {});
    if (!c.camera || !c.quiet_room || !c.minutes) throw err(409, 'Finish the check before starting: quiet room, camera on, 45 minutes.');
    if (run.status === 'scored') throw err(409, 'Your scored run is already done.');
    if (!supervision?.camera_on && !isTestLearner()) throw err(422, 'The camera must stay on for the scored run.');
    const sup = { camera_on: !!supervision?.camera_on, tab_hidden_ms: Number(supervision?.tab_hidden_ms) || 0, minutes: Number(supervision?.minutes) || null };
    const score = graded.reduce((a, g) => a + g.score, 0) / Math.max(1, graded.length);
    await dal.run("UPDATE dayone_runs SET status = 'scored', scored_at = ?, score = ?, passed = ?, checks_json = ? WHERE id = ?", now, score, passed ? 1 : 0, JSON.stringify({ ...c, supervision: sup }), run.id);
    if (passed) {
      for (const n of nodes) {
        await dal.run(`INSERT INTO demonstrations (id, el_id, node_id, kind, date, passed, score, level, assurance, created_at) VALUES (?, ?, ?, 'dayone', ?, 1, ?, 'L3', 'A3', ?)`, ulid(), el.el_id, n.id, now, score, now);
      }
    }
    if (run.pipeline_id) {
      const p = await dal.one('SELECT employer_id FROM employer_pipeline WHERE id = ?', run.pipeline_id);
      if (p) await (await import('../notify.js')).notify({ to: { type: 'employer', id: p.employer_id }, kind: 'dayone_done', title: 'A candidate finished their Day-One Simulation', href: `/employer/candidates/${run.pipeline_id}` });
    }
    return { scored: true, passed, results: graded.map(g => (g.passed ? 'pass' : g.score >= 0.5 ? 'partial' : 'fail')) };
  }
  throw err(400, 'Unknown step.');
}

// ─── Assigned by your college ──────────────────────────────────────────────────
export async function assignedView(el) {
  const bridges = await learnerBridges(el.el_id);
  const assigned = new Map((await dal.all('SELECT bridge_id, assigned_at, baseline_mastered_json FROM bridge_assignments WHERE el_id = ?', el.el_id)).map(r => [r.bridge_id, r]));
  const today = nowIsoFor().slice(0, 10);
  return bridges.map(b => {
    const a = assigned.get(b.id);
    const before = parse(a?.baseline_mastered_json, []);
    const done = b.skills.filter(s => s.mastered).length;
    const retestDue = !!b.retest_at && b.retest_at <= today;
    return {
      ...b, assigned_at: a?.assigned_at || null, done, total: b.skills.length,
      new_since: b.skills.filter(s => s.mastered && !before.includes(s.id)).map(s => s.label),
      retest_due: retestDue,
      outcome: !retestDue ? 'too_early' : done === b.skills.length ? 'worked' : done > before.length ? 'partly' : 'not_yet'
    };
  });
}

export { NOTIFY_EVENTS, NOTIFY_CHANNELS, REQUIRED, EVENT_OF_KIND, notificationPrefs, setNotificationPrefs, channelOn } from './notifyPrefs.js';

// ─── Résumé claims vs proven skills ────────────────────────────────────────────
// What a résumé says is matched to skill names; it never counts toward
// readiness. Proven skills come from the Passport labels.
export async function setResumeClaims(learnerId, text) {
  const lines = String(text || '').slice(0, 30000).split(/\r?\n|[•;]/).map(l => l.trim()).filter(Boolean);
  if (!lines.length) throw err(400, 'Paste your résumé text or upload a .txt file.');
  const found = new Map();
  for (const [key, s] of Object.entries(market.SKILLS)) {
    const words = [s.name.toLowerCase(), ...(s.keywords || [])].map(w => w.trim()).filter(w => w.length > 1);
    const line = lines.find(l => words.some(w => new RegExp(`(^|[^a-z])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`, 'i').test(l)));
    if (line) found.set(key, { name: s.name, line: line.slice(0, 200) });
  }
  await dal.run('DELETE FROM resume_claims WHERE learner_id = ?', learnerId);
  for (const [, c] of found) await dal.run('INSERT INTO resume_claims (id, learner_id, skill_name, source_line, created_at) VALUES (?, ?, ?, ?, ?)', ulid(), learnerId, c.name, c.line, dal.nowIso());
  return found.size;
}

export async function resumeClaimsView(el) {
  const claims = await dal.all('SELECT skill_name, source_line FROM resume_claims WHERE learner_id = ? ORDER BY skill_name', el.learner_id);
  const lines = await skillLines(el.el_id, await skillFacts(el.el_id));
  const proven = lines.filter(s => s.label !== 'none').map(s => ({ name: s.name, label: s.label }));
  const norm = (x) => x.toLowerCase().replace(/[^a-z]/g, '');
  const match = (claim) => proven.find(p => norm(p.name).includes(norm(claim).slice(0, 5)) || norm(claim).includes(norm(p.name).slice(0, 5))) || null;
  return {
    claims: claims.map(c => ({ skill: c.skill_name, line: c.source_line, proven: match(c.skill_name)?.label || null })),
    proven,
    not_on_resume: proven.filter(p => !claims.some(c => match(c.skill_name)?.name === p.name)).map(p => p.name)
  };
}

// ─── Delete my account (OTP, then a 14-day grace period) ──────────────────────
const GRACE_DAYS = 14;
export async function deletionState(learnerId) {
  const d = await dal.one('SELECT * FROM account_deletions WHERE learner_id = ?', learnerId);
  if (!d || d.cancelled_at) return { status: 'none' };
  if (d.confirmed_at) return { status: 'scheduled', purge_after: d.purge_after };
  return { status: 'otp_sent', otp_expires_at: d.otp_expires_at };
}

export async function requestDeletion(learnerId) {
  const otp = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  const now = dal.nowIso();
  await dal.run(`INSERT INTO account_deletions (learner_id, otp_hash, otp_expires_at, requested_at) VALUES (?, ?, ?, ?)
    ON CONFLICT (learner_id) DO UPDATE SET otp_hash = excluded.otp_hash, otp_expires_at = excluded.otp_expires_at, requested_at = excluded.requested_at, confirmed_at = NULL, purge_after = NULL, cancelled_at = NULL`,
  learnerId, sha(`${learnerId}|${otp}`), new Date(Date.now() + 15 * 60000).toISOString(), now);
  const l = await dal.one('SELECT name, email FROM learners WHERE id = ?', learnerId);
  if (l?.email) {
    const { queueEmail } = await import('../outboundMail.js');
    await queueEmail(dal.legacyHandle(), { to: l.email, subject: 'Your Qubirex account deletion code', body: `Your code is ${otp}. It works for 15 minutes. If you did not ask to delete your account, ignore this message.`, kind: 'deletion_otp' });
  }
  // Test learners and deployments that show codes on screen get it back here.
  const echo = isTestLearner() || process.env.QBX_ECHO_EMAIL_CODES === '1';
  return { status: 'otp_sent', sent_to: l?.email ? l.email.replace(/^(.).*(@.*)$/, '$1•••$2') : null, ...(echo ? { dev_code: otp } : {}) };
}

export async function confirmDeletion(learnerId, otp) {
  const d = await dal.one('SELECT * FROM account_deletions WHERE learner_id = ? AND confirmed_at IS NULL AND cancelled_at IS NULL', learnerId);
  if (!d || d.otp_expires_at < dal.nowIso()) throw err(409, 'That code has expired. Ask for a new one.');
  if (sha(`${learnerId}|${String(otp || '').trim()}`) !== d.otp_hash) throw err(400, 'That code is not right.');
  const purge = new Date(Date.now() + GRACE_DAYS * DAY).toISOString();
  await dal.run('UPDATE account_deletions SET confirmed_at = ?, purge_after = ?, otp_hash = NULL WHERE learner_id = ?', dal.nowIso(), purge, learnerId);
  return { status: 'scheduled', purge_after: purge };
}

export async function cancelDeletion(learnerId) {
  await dal.run('UPDATE account_deletions SET cancelled_at = ? WHERE learner_id = ? AND cancelled_at IS NULL', dal.nowIso(), learnerId);
  return { status: 'none' };
}

/** After the grace period: personal details are removed and the Passport is revoked; the college keeps an anonymous record. */
export async function purgeDueDeletions({ limit = 20 } = {}) {
  const due = await dal.all('SELECT learner_id FROM account_deletions WHERE confirmed_at IS NOT NULL AND cancelled_at IS NULL AND purge_after <= ? LIMIT ?', dal.nowIso(), limit);
  for (const { learner_id: id } of due) {
    for (const c of await dal.all('SELECT DISTINCT evidence_id FROM credentials WHERE learner_id = ? AND active = 1', id)) await revokeCredential(c.evidence_id, 'account_deleted');
    await dal.run("UPDATE learners SET name = 'Deleted learner', email = NULL, pin_hash = NULL, city = NULL, is_active = 0, is_discoverable = 0 WHERE id = ?", id);
    await dal.run('DELETE FROM learner_profiles WHERE learner_id = ?', id);
    await dal.run('DELETE FROM resume_claims WHERE learner_id = ?', id);
    await dal.run("UPDATE auth_sessions SET revoked_at = ? WHERE actor_type = 'learner' AND actor_id = ? AND revoked_at IS NULL", dal.nowIso(), id);
    await dal.run('UPDATE account_deletions SET otp_hash = NULL, purge_after = NULL WHERE learner_id = ?', id);
  }
  return due.length;
}

export { activeCredential };
