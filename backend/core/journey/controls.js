// core/journey/controls.js — the /dev time and state controls for a test
// learner (api/routes/dev.js POST /journey/control). Each one first proves the
// learner is in the test tenant; nothing here can touch a real learner.
//   time        move this learner's clock forward 1, 7 or 30 days (a per-learner
//               offset that only test-tenant requests read; the real clock never moves)
//   next_check  the next check passes or fails without grading
//   tutor       scripted or live tutor for this learner
//   request     a verified test employer asks to see the Passport (interview promised)
//   bridge      the college assigns a bridge programme of the next two skills
//   ready       fill the evidence for the rest of the programme, so the learner is Ready
import crypto from 'crypto';
import * as dal from '../db/dal.js';
import { ulid } from '../db/ulid.js';
import { notify } from '../notify.js';
import { createBridge } from '../collegeLoop.js';
import { saveMasteryLog, produceLearnerMasteryLog } from '../masteryLog.js';
import { issueCredential } from '../return/credentialEngine.js';
import { TEST_INSTITUTION_ID } from '../testTenant.js';

const EMPLOYER = 'test-employer-0002';
const ROLES = ['test-role-0001', 'test-role-0002'];
const PROFESSOR = 'test-staff-prof-0001';
const DAY = 86400000;
const err = (status, message) => Object.assign(new Error(message), { status });

/** The test learner behind an enrolment, or a 403. */
export async function testLearner(elId) {
  const r = await dal.one(`SELECT el.id AS el_id, el.learner_id, el.engagement_id, e.capability_target_id, e.institution_id, l.language
    FROM engagement_learners el JOIN engagements e ON e.id = el.engagement_id JOIN institutions i ON i.id = e.institution_id JOIN learners l ON l.id = el.learner_id
    WHERE el.id = ? AND e.institution_id = ? AND i.is_test = 1`, elId, TEST_INSTITUTION_ID);
  if (!r) throw err(403, 'These controls work only for test learners.');
  return r;
}

async function upsertControl(elId, set) {
  await dal.run('INSERT INTO test_learner_controls (el_id, updated_at) VALUES (?, ?) ON CONFLICT (el_id) DO NOTHING', elId, dal.nowIso());
  const cols = Object.keys(set);
  await dal.run(`UPDATE test_learner_controls SET ${cols.map(c => `${c} = ?`).join(', ')}, updated_at = ? WHERE el_id = ?`, ...cols.map(c => set[c]), dal.nowIso(), elId);
}

export async function controlsFor(elId) {
  const c = await dal.one('SELECT time_offset_days, next_check, tutor FROM test_learner_controls WHERE el_id = ?', elId);
  return { time_offset_days: Number(c?.time_offset_days) || 0, next_check: c?.next_check || null, tutor: c?.tutor || (process.env.TEST_TUTOR === 'live' ? 'live' : 'scripted') };
}

const offsetMs = async (elId) => (await controlsFor(elId)).time_offset_days * DAY;

async function moveTime(l, days) {
  if (![1, 7, 30].includes(days)) throw err(400, 'Move time forward by 1, 7 or 30 days.');
  const c = await controlsFor(l.el_id);
  await upsertControl(l.el_id, { time_offset_days: Math.min(730, c.time_offset_days + days) });
  return `Moved this learner's clock forward ${days} day${days === 1 ? '' : 's'}.`;
}

async function sendRequest(l) {
  const now = new Date(Date.now() + await offsetMs(l.el_id)).toISOString();
  const rows = await dal.all('SELECT id, role_id, stage FROM employer_pipeline WHERE el_id = ? AND employer_id = ?', l.el_id, EMPLOYER);
  const free = ROLES.find(r => !rows.some(p => p.role_id === r));
  const role = free || ROLES[0];
  const cur = rows.find(p => p.role_id === role);
  const share = JSON.stringify({ asked: ['skills', 'resume', 'contact'] });
  const history = JSON.stringify([{ stage: 'requested', at: now }]);
  if (cur) await dal.run("UPDATE employer_pipeline SET stage = 'requested', share_json = ?, history_json = ?, interview_promised = 1, source = 'request', updated_at = ? WHERE id = ?", share, history, now, cur.id);
  else {
    await dal.run(`INSERT INTO employer_pipeline (id, employer_id, role_id, el_id, learner_id, stage, share_json, interview_promised, created_at, updated_at, source, history_json)
      VALUES (?, ?, ?, ?, ?, 'requested', ?, 1, ?, ?, 'request', ?)`, ulid(), EMPLOYER, role, l.el_id, l.learner_id, share, now, now, history);
  }
  const title = (await dal.one('SELECT title FROM employer_roles WHERE id = ?', role))?.title || 'a role';
  await notify({ to: { type: 'learner', id: l.learner_id }, kind: 'employer_request', title: '[Company name] verified (test) would like to see your Passport', body: `For ${title} · interview promised if you say yes. You choose what to share.`, href: '/learn/jobs' });
  return `A test employer asked to see this learner's Passport (${title}).`;
}

async function unmastered(l) {
  return dal.all(`SELECT sn.id, sn.node_label, sn.cluster_id FROM skill_nodes sn JOIN skill_clusters sc ON sc.id = sn.cluster_id
    WHERE sc.capability_target_id = ? AND NOT EXISTS (SELECT 1 FROM node_mastery nm WHERE nm.engagement_learner_id = ? AND nm.skill_node_id = sn.id AND nm.advanced_at IS NOT NULL)
    ORDER BY sc.sequence_order, sn.sequence_order`, l.capability_target_id, l.el_id);
}

async function assignBridge(l) {
  const next = (await unmastered(l)).slice(0, 2);
  if (!next.length) throw err(409, 'This learner has every skill already.');
  const engagement = await dal.one('SELECT * FROM engagements WHERE id = ?', l.engagement_id);
  await createBridge({
    engagement, title: `Practice: ${next.map(n => n.node_label).join(' and ')}`, nodeIds: next.map(n => n.id), scope: 'students', elIds: [l.el_id],
    retestAt: new Date(Date.now() + 14 * DAY).toISOString().slice(0, 10), note: 'Assigned from the developer bar (test)', staffId: PROFESSOR
  });
  return `Your college assigned a bridge programme: ${next.map(n => n.node_label).join(', ')}.`;
}

// Mastery, a practice item and a review for every remaining skill, dated in the
// last few days of this learner's clock; then a new Mastery Log and Passport.
async function makeReady(l) {
  const todo = await unmastered(l);
  const base = Date.now() + await offsetMs(l.el_id);
  const at = (d) => new Date(base - d * DAY).toISOString();
  await dal.tx(async () => {
    for (const [i, n] of todo.entries()) {
      const d = 3 + (todo.length - i) * 0.2;
      const ev = ulid();
      await dal.run(`INSERT INTO evidence_records (id, el_id, node_id, family_id, purpose, answer_hash, r_c, passed, level, assurance, authentic, provisional, theta, created_at)
        VALUES (?, ?, ?, ?, 'check', ?, 0.88, 1, 'L1', 'A1', 1, 0, 0.7, ?)`, ev, l.el_id, n.id, `gen:${n.id}`, crypto.createHash('sha256').update(ev).digest('hex'), at(d));
      await dal.run(`INSERT INTO node_mastery (id, engagement_learner_id, skill_node_id, mastery_attainment, attempt_count, time_to_mastery_minutes, advanced_at, theta, evidence_level, loops, active_minutes, provisional, persistence)
        VALUES (?, ?, ?, 0.88, 1, 22, ?, 0.7, 'L1', 0, 22, 0, 0)
        ON CONFLICT (engagement_learner_id, skill_node_id) DO UPDATE SET advanced_at = excluded.advanced_at`, ulid(), l.el_id, n.id, at(d));
      await dal.run(`INSERT INTO demonstrations (id, el_id, node_id, kind, date, passed, score, level, assurance, evidence_id, created_at) VALUES (?, ?, ?, 'mastery', ?, 1, 0.88, 'L1', 'A1', ?, ?)`, ulid(), l.el_id, n.id, at(d), ev, at(d));
      await dal.run(`INSERT INTO demonstrations (id, el_id, node_id, kind, date, passed, score, level, assurance, created_at) VALUES (?, ?, ?, 'practice', ?, 1, 0.9, 'L2', 'A1', ?)`, ulid(), l.el_id, n.id, at(d - 1), at(d - 1));
      await dal.run(`INSERT INTO node_retention (el_id, node_id, interval_days, due_at, reviews_passed, reviews_failed, updated_at) VALUES (?, ?, 3, ?, 0, 0, ?)
        ON CONFLICT (el_id, node_id) DO NOTHING`, l.el_id, n.id, new Date(base + 5 * DAY).toISOString(), at(d));
    }
    const last = (await dal.all(`SELECT sn.id, sn.cluster_id FROM skill_nodes sn JOIN skill_clusters sc ON sc.id = sn.cluster_id WHERE sc.capability_target_id = ? ORDER BY sc.sequence_order DESC, sn.sequence_order DESC LIMIT 1`, l.capability_target_id))[0];
    if (last) await dal.run("UPDATE engagement_learners SET current_node_id = ?, current_cluster_id = ?, overall_status = 'completed' WHERE id = ?", last.id, last.cluster_id, l.el_id);
  });
  await saveMasteryLog(l.engagement_id, l.learner_id, await produceLearnerMasteryLog(l.engagement_id, l.learner_id));
  await issueCredential(l.el_id, { reason: 'dev_make_ready' });
  return todo.length ? `Filled the evidence for ${todo.length} skill${todo.length === 1 ? '' : 's'}: this learner is Ready.` : 'This learner already had every skill; Passport refreshed.';
}

/**
 * Run one control for a test learner.
 * @returns {Promise<{ ok: true, message: string, controls: object }>}
 */
export async function runControl(elId, { action, days, result, mode } = {}) {
  const l = await testLearner(elId);
  let message;
  if (action === 'time') message = await moveTime(l, Number(days));
  else if (action === 'next_check') {
    if (!['pass', 'fail'].includes(result)) throw err(400, 'Choose pass or fail.');
    await upsertControl(l.el_id, { next_check: result });
    message = `The next check will ${result === 'pass' ? 'pass' : 'not pass'} without grading.`;
  } else if (action === 'tutor') {
    if (!['scripted', 'live'].includes(mode)) throw err(400, 'Choose scripted or live.');
    await upsertControl(l.el_id, { tutor: mode });
    message = mode === 'live' ? 'This learner now uses the live AI tutor (needs a model key).' : 'This learner now uses the scripted tutor.';
  } else if (action === 'request') message = await sendRequest(l);
  else if (action === 'bridge') message = await assignBridge(l);
  else if (action === 'ready') message = await makeReady(l);
  else throw err(400, 'Unknown control.');
  return { ok: true, message, controls: await controlsFor(l.el_id) };
}
