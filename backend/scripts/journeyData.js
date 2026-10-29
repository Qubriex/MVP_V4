// scripts/journeyData.js — one test learner at each stage of the learning
// journey (S0 invited … S12 going stale), in the test tenant, so every
// learner screen can be seen in its real state from /dev → Learner journey.
// Telugu for every stage; Hindi for S1, S3 and S7. Called by seedTestData()
// after the programme, cohorts, employers and roles exist.
//
// Every reset deletes these learners completely (core/demo/cleanup.js
// deleteJourneyLearners, which also clears their append-only evidence) and
// builds them again, so each stage comes back exactly. Their PIN is the
// public test PIN; never seed a real deployment.
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import * as dal from '../core/db/dal.js';
import { deleteJourneyLearners } from '../core/demo/cleanup.js';
import { issueCredential, setPublic } from '../core/return/credentialEngine.js';
import { saveMasteryLog, produceLearnerMasteryLog } from '../core/masteryLog.js';
import { JOURNEY } from '../core/journey/accounts.js';

export { JOURNEY };

export const JOURNEY_PIN = '410585';
const INSTITUTION = 'test-inst-0001';
const ENG_TE = '4a4c13c4-989e-4c03-b636-3bdba7fd1025';
const EMPLOYER = 'test-employer-0002';
const ROLE_FE = 'test-role-0001';
const ROLE_FS = 'test-role-0002';
const DAY = 86400000;
const at = (daysAgo) => new Date(Date.now() - daysAgo * DAY).toISOString();
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');

// The programme's 20 nodes in order (scripts/testData.js PROGRAMME).
export const NODE_IDS = [1, 2, 3, 4].flatMap(c => [1, 2, 3, 4, 5].map(n => `test-node-${c}-${n}`));
const CLUSTER_OF = (nodeId) => `test-cluster-${nodeId.split('-')[2]}`;

// Batched INSERT (same shape as core/demo/world.js).
async function insert(table, cols, rows) {
  for (let i = 0; i < rows.length; i += 300) {
    const chunk = rows.slice(i, i + 300);
    const one = `(${cols.map(() => '?').join(', ')})`;
    await dal.run(`INSERT INTO ${table} (${cols.join(', ')}) VALUES ${chunk.map(() => one).join(', ')}`, ...chunk.flat());
  }
}

/** Rows for one learner, collected and then written table by table. */
function builder(j) {
  const rows = new Map();
  const add = (table, cols, row) => {
    const key = `${table}|${cols.join(',')}`;
    if (!rows.has(key)) rows.set(key, { table, cols, list: [] });
    rows.get(key).list.push(row);
  };
  let seq = 0;
  const id = (p) => `${j.learnerId}-${p}-${++seq}`;

  // One mastered node: its session and passed check, the evidence and the
  // mastery demonstration, and a review schedule.
  function master(nodeId, { daysAgo, score = 0.86, loops = 0, minutes = 24, dueInDays = 5 }) {
    const sid = id('ls');
    add('learning_sessions', ['id', 'engagement_learner_id', 'skill_node_id', 'language', 'status', 'started_at', 'completed_at', 'loop_count', 'active_minutes'],
      [sid, j.elId, nodeId, j.language, 'completed', at(daysAgo + 0.05), at(daysAgo), loops, minutes]);
    const fi = id('fi'); const ev = id('ev');
    add('family_instances', ['id', 'el_id', 'learner_id', 'node_id', 'family_id', 'purpose', 'attempt_no', 'seed', 'params_json', 'question_text', 'generator', 'created_at'],
      [fi, j.elId, j.learnerId, nodeId, `gen:${nodeId}`, 'check', 1, 'seed', '{}', 'In your own words: how would you use this in a small project?', 'scripted', at(daysAgo)]);
    add('mastery_checks', ['id', 'session_id', 'skill_node_id', 'engagement_learner_id', 'check_number', 'question_text', 'passed', 'score', 'evaluated_at', 'created_at', 'instance_id', 'purpose'],
      [id('mc'), sid, nodeId, j.elId, 1, 'In your own words: how would you use this in a small project?', 1, score, at(daysAgo), at(daysAgo), fi, 'check']);
    add('evidence_records', ['id', 'el_id', 'node_id', 'family_id', 'instance_id', 'purpose', 'answer_hash', 'r_c', 'passed', 'level', 'assurance', 'authentic', 'provisional', 'theta', 'active_ms', 'created_at'],
      [ev, j.elId, nodeId, `gen:${nodeId}`, fi, 'check', sha(ev), score, 1, 'L1', 'A1', 1, 0, 0.7, minutes * 60000, at(daysAgo)]);
    add('answer_provenance', ['evidence_id', 'mode', 'answer_chars', 'pasted_chars', 'paste_events', 'largest_paste', 'edit_ratio'], [ev, 'typed', 260, 0, 0, 0, 0.1]);
    add('node_mastery', ['id', 'engagement_learner_id', 'skill_node_id', 'mastery_attainment', 'attempt_count', 'time_to_mastery_minutes', 'advanced_at', 'theta', 'evidence_level', 'loops', 'active_minutes', 'provisional', 'persistence'],
      [id('nm'), j.elId, nodeId, score, loops + 1, minutes, at(daysAgo), 0.7, 'L1', loops, minutes, 0, 0]);
    demo(nodeId, 'mastery', { daysAgo, score, evidenceId: ev });
    add('node_retention', ['el_id', 'node_id', 'interval_days', 'due_at', 'last_review_at', 'last_result', 'reviews_passed', 'reviews_failed', 'updated_at'],
      [j.elId, nodeId, 3, new Date(Date.now() + dueInDays * DAY).toISOString(), null, null, 0, 0, at(daysAgo)]);
  }
  function demo(nodeId, kind, { daysAgo, score = 0.88, level = 'L1', assurance = 'A1', evidenceId = null, passed = 1 }) {
    add('demonstrations', ['id', 'el_id', 'node_id', 'kind', 'date', 'passed', 'score', 'level', 'assurance', 'evidence_id', 'created_at'],
      [id('dm'), j.elId, nodeId, kind, at(daysAgo), passed, score, level, assurance, evidenceId, at(daysAgo)]);
  }
  // A Confirmed node: mastery, a review, the spoken challenge (A2), a work
  // task (L2) and a later review; optionally a supervised Day-One (A3).
  function confirmed(nodeId, start, { dayone = false } = {}) {
    master(nodeId, { daysAgo: start, score: 0.88, dueInDays: 30 });
    demo(nodeId, 'review', { daysAgo: start - 4, score: 0.86 });
    demo(nodeId, 'challenge', { daysAgo: start - 8, score: 0.9, assurance: 'A2' });
    demo(nodeId, 'task', { daysAgo: start - 12, score: 0.9, level: 'L2', assurance: 'A2' });
    demo(nodeId, 'review', { daysAgo: start - 20, score: 0.92 });
    if (dayone) demo(nodeId, 'dayone', { daysAgo: 3, score: 0.9, level: 'L3', assurance: 'A3' });
  }
  return { add, master, demo, confirmed, id, rows };
}

async function writeRows(rows) {
  for (const { table, cols, list } of rows.values()) await insert(table, cols, list);
}

// What each stage holds, written into the builder.
function build(j, b) {
  const s = j.stage;
  const n = NODE_IDS;
  const pipe = (stage, extra = {}) => b.add('employer_pipeline',
    ['id', 'employer_id', 'role_id', 'el_id', 'learner_id', 'stage', 'share_json', 'interview_promised', 'note', 'created_at', 'updated_at', 'source', 'history_json', 'interview_at'],
    [`${j.learnerId}-pipe`, EMPLOYER, extra.role || ROLE_FE, j.elId, j.learnerId, stage, JSON.stringify(extra.share || { asked: ['skills', 'resume', 'contact'], granted: [] }),
      1, null, at(extra.createdDaysAgo ?? 2), at(0.1), extra.source || 'request', JSON.stringify(extra.history || []), extra.interviewAt || null]);

  if (s === 'S2') {
    b.add('baseline_runs', ['id', 'el_id', 'status', 'items_json', 'answers_json', 'placement_json', 'started_at', 'completed_at'],
      [`${j.learnerId}-baseline`, j.elId, 'done', JSON.stringify([]), JSON.stringify([]),
        JSON.stringify({ known_nodes: [n[0], n[1]], start_node: n[2], groups: { 'test-cluster-1': 'some', 'test-cluster-2': 'new', 'test-cluster-3': 'new', 'test-cluster-4': 'new' } }), at(0.2), at(0.15)]);
  }
  if (s === 'S3') {
    n.slice(0, 6).forEach((node, i) => b.master(node, { daysAgo: 20 - i * 3, dueInDays: i < 2 ? -1 : 4 + i }));
    b.add('learning_sessions', ['id', 'engagement_learner_id', 'skill_node_id', 'language', 'status', 'started_at', 'loop_count', 'active_minutes'],
      [`${j.learnerId}-active`, j.elId, n[6], j.language, 'active', at(0.1), 0, 6]);
  }
  if (s === 'S4') {
    n.slice(0, 7).forEach((node, i) => b.master(node, { daysAgo: 22 - i * 3 }));
    const sid = `${j.learnerId}-active`;
    b.add('learning_sessions', ['id', 'engagement_learner_id', 'skill_node_id', 'language', 'status', 'started_at', 'loop_count', 'active_minutes', 'current_approach', 'behaviour_signal'],
      [sid, j.elId, n[7], j.language, 'active', at(0.2), 1, 18, 'analogy', 'confused']);
    const fi = `${j.learnerId}-fi-fail`; const ev = `${j.learnerId}-ev-fail`;
    const q = 'తరగతి మార్కుల లెక్క సందర్భంలో map, filter, reduce మధ్య తేడా ఒక ఉదాహరణతో చెప్పండి.';
    b.add('family_instances', ['id', 'el_id', 'learner_id', 'node_id', 'family_id', 'purpose', 'attempt_no', 'seed', 'params_json', 'question_text', 'generator', 'created_at'],
      [fi, j.elId, j.learnerId, n[7], `gen:${n[7]}`, 'check', 1, 'seed', '{}', q, 'scripted', at(0.15)]);
    b.add('mastery_checks', ['id', 'session_id', 'skill_node_id', 'engagement_learner_id', 'check_number', 'question_text', 'learner_response', 'passed', 'score', 'evaluated_at', 'created_at', 'instance_id', 'purpose'],
      [`${j.learnerId}-mc-fail`, sid, n[7], j.elId, 1, q, 'map తో ఏదో చేస్తాం అనుకుంటా', 0, 0.38, at(0.15), at(0.16), fi, 'check']);
    b.add('evidence_records', ['id', 'el_id', 'node_id', 'family_id', 'instance_id', 'purpose', 'answer_hash', 'r_c', 'passed', 'level', 'assurance', 'authentic', 'provisional', 'theta', 'created_at'],
      [ev, j.elId, n[7], `gen:${n[7]}`, fi, 'check', sha(ev), 0.38, 0, null, 'A1', 1, 0, 0.7, at(0.15)]);
    const msgs = [
      ['ai', 'నమస్కారం! ఈ రోజు array methods నేర్చుకుందాం. మొత్తం తరగతి మార్కులు ఉంటే ఎవరు pass అయ్యారో ఎలా కనుక్కుంటారు?', 'diagnosis'],
      ['learner', 'loop రాస్తాను అనుకుంటా', 'response'],
      ['ai', 'ఒక టీచర్ దగ్గర జవాబు పత్రాల కట్ట ఊహించుకోండి. map అంటే ప్రతి పత్రానికి ఐదు grace marks ఇవ్వడం. filter అంటే pass అయిన పత్రాలను మాత్రమే ఎంచుకోవడం. reduce అంటే అన్ని మార్కులు కలిపి ఒక్క మొత్తం చేయడం.', 'instruction'],
      ['ai', q, 'mastery_check'],
      ['learner', 'map తో ఏదో చేస్తాం అనుకుంటా', 'response'],
      ['ai', 'మంచి ప్రయత్నం. దీన్ని మరో కోణం నుండి చూద్దాం.', 'loop_trigger']
    ];
    msgs.forEach(([role, content, type], i) => b.add('session_messages', ['id', 'session_id', 'role', 'content', 'message_type', 'created_at'],
      [`${j.learnerId}-msg-${i}`, sid, role, content, type, at(0.2 - i * 0.008)]));
    b.add('check_help_requests', ['id', 'el_id', 'node_id', 'institution_id', 'evidence_id', 'message', 'status', 'created_at'],
      [`${j.learnerId}-help`, j.elId, n[7], INSTITUTION, ev, 'reduce ఎలా పనిచేస్తుందో అర్థం కాలేదు. ఇంకో ఉదాహరణ ఇవ్వగలరా?', 'open', at(0.1)]);
  }
  if (s === 'S5') {
    n.slice(0, 5).forEach((node, i) => {
      const d = 14 - i * 2;
      b.master(node, { daysAgo: d, dueInDays: 4 + i });
      if (d > 4) b.demo(node, 'review', { daysAgo: Math.max(1, d - 4), score: 0.9 });
    });
  }
  if (s === 'S6') {
    n.slice(0, 17).forEach((node, i) => {
      const d = 40 - i * 2;
      b.master(node, { daysAgo: d, dueInDays: 6 + i });
      b.demo(node, 'review', { daysAgo: d - 3, score: 0.86 });
      b.demo(node, 'review', { daysAgo: Math.max(1, d - 14), score: 0.88 });
    });
    b.add('learner_plan', ['id', 'learner_id', 'skill_name', 'source', 'created_at'], [`${j.learnerId}-plan-1`, j.learnerId, 'SQL', 'readiness', at(1)]);
  }
  if (['S7', 'S8', 'S9', 'S10', 'S11'].includes(s)) {
    n.forEach((node, i) => b.confirmed(node, 60 - i, { dayone: i % 5 === 0 }));
  }
  if (s === 'S8') pipe('requested', { createdDaysAgo: 1 });
  if (s === 'S9') {
    pipe('dayone', { share: { asked: ['skills', 'resume', 'contact'], granted: ['skills', 'resume'] }, history: [{ stage: 'requested', at: at(9) }, { stage: 'access_granted', at: at(8) }, { stage: 'dayone', at: at(3) }] });
    b.add('dayone_runs', ['id', 'el_id', 'pipeline_id', 'role_title', 'status', 'checks_json', 'practice_at', 'created_at'],
      [`${j.learnerId}-dayone`, j.elId, `${j.learnerId}-pipe`, 'Frontend developer (test)', 'practice_done', JSON.stringify({ quiet_room: true, camera: true, minutes: 45 }), at(1), at(3)]);
  }
  if (s === 'S10') {
    pipe('offer', { role: ROLE_FS, source: 'apply', createdDaysAgo: 14, interviewAt: at(4), share: { asked: ['skills', 'resume', 'contact'], granted: ['skills', 'resume', 'contact'] },
      history: [{ stage: 'applied', at: at(14) }, { stage: 'shortlisted', at: at(10) }, { stage: 'interview', at: at(6), interview_at: at(4) }, { stage: 'offer', at: at(1) }] });
  }
  if (s === 'S11') {
    pipe('hired', { source: 'apply', createdDaysAgo: 120, share: { asked: ['skills', 'resume', 'contact'], granted: ['skills', 'resume', 'contact'] },
      history: [{ stage: 'applied', at: at(120) }, { stage: 'interview', at: at(112) }, { stage: 'offer', at: at(105) }, { stage: 'hired', at: at(100) }] });
    b.add('placements', ['id', 'institution_id', 'engagement_id', 'el_id', 'learner_id', 'employer_name', 'employer_id', 'role_title', 'status', 'salary_lpa', 'offer_date', 'joined_date', 'rating_90d', 'rating_note', 'rated_at', 'source', 'created_at'],
      [`${j.learnerId}-placement`, INSTITUTION, j.engagementId, j.elId, j.learnerId, '[Company name] verified (test)', EMPLOYER, 'Frontend developer (test)', 'placed', 4.2, at(105).slice(0, 10), at(100).slice(0, 10), 4, 'Reliable, learns fast; React work is strong.', at(8), 'employer', at(100)]);
    NODE_IDS.slice(0, 5).forEach(node => b.demo(node, 'employer', { daysAgo: 8, score: 0.9, level: 'L3', assurance: 'A3' }));
  }
  if (s === 'S12') {
    n.forEach((node, i) => {
      b.master(node, { daysAgo: 260 - i, dueInDays: -120 });
      b.demo(node, 'review', { daysAgo: 230 - i, score: 0.84 });
      b.demo(node, 'task', { daysAgo: 220 - i, score: 0.86, level: 'L2', assurance: 'A2' });
    });
  }
}

const CURRENT = { S0: 0, S1: 0, S2: 2, S3: 6, S4: 7, S5: 5, S6: 17 };

/**
 * Delete and rebuild the journey learners (all, or only the given keys).
 * @param {{ only?: string[] }} [opts] keys like 's3' or 's7-hi'
 */
export async function seedJourney({ only = null } = {}) {
  const pick = JOURNEY.filter(j => !only || only.includes(j.key));
  const pinHash = bcrypt.hashSync(JOURNEY_PIN, 10);
  await deleteJourneyLearners(pick.map(j => j.learnerId), INSTITUTION);
  await dal.run("DELETE FROM test_learner_controls WHERE el_id = ANY(?::text[])", pick.map(j => j.elId));
  await dal.run("DELETE FROM passport_views WHERE id LIKE ANY(?::text[])", pick.map(j => `${j.learnerId}-view-%`));

  // A second test role with more skills, for "Nearly ready: 2 skills short".
  await dal.run(`INSERT INTO employer_roles (id, employer_id, title, city, jd_text, skills_json, bar, status, published, interview_promise, created_by, created_at)
    VALUES (?, ?, 'Full-stack developer (test)', 'Hyderabad', 'Test role: HTML, CSS, JavaScript, React, Node.js, SQL, REST, Git.', ?, 80, 'open', 1, 1, 'test-employer-user-0002', ?)
    ON CONFLICT (id) DO NOTHING`, ROLE_FS, EMPLOYER,
  JSON.stringify(['html_css', 'javascript', 'react', 'node', 'sql', 'rest', 'git'].map(k => ({ key: k, name: { html_css: 'HTML & CSS', javascript: 'JavaScript', react: 'React', node: 'Node.js', sql: 'SQL', rest: 'REST APIs', git: 'Git' }[k], required: true }))), dal.nowIso());
  await dal.run(`INSERT INTO bridge_programmes (id, institution_id, engagement_id, title, node_ids_json, scope, note, retest_at, status, created_by, created_at)
    VALUES ('test-bridge-j-s3', ?, ?, 'Functions and arrays practice', ?, 'students', 'Practise these before the mid-term re-test', ?, 'open', 'test-staff-prof-0001', ?)
    ON CONFLICT (id) DO NOTHING`, INSTITUTION, ENG_TE, JSON.stringify([NODE_IDS[6], NODE_IDS[7]]), new Date(Date.now() + 12 * DAY).toISOString().slice(0, 10), dal.nowIso());

  const learners = []; const els = []; const profiles = [];
  for (const j of pick) {
    const s = j.stage;
    const allDone = ['S7', 'S8', 'S9', 'S10', 'S11', 'S12'].includes(s);
    const cur = NODE_IDS[allDone ? 19 : CURRENT[s] ?? 0];
    learners.push([j.learnerId, INSTITUTION, j.name, `${j.key}@journey.test`, j.ref, s === 'S0' ? null : pinHash, j.language, 'college_student', 0, ['S7', 'S8', 'S9', 'S10', 'S11'].includes(s) ? 1 : 0, 'Hyderabad', 'adult']);
    els.push([j.elId, j.engagementId, j.learnerId, cur, CLUSTER_OF(cur), allDone ? 'completed' : 'in_progress', 'active', s === 'S0' ? null : at(1).replace('T', ' ').slice(0, 19), s === 'S0' ? 'email' : 'slip']);
    if (!['S0', 'S1'].includes(s)) {
      profiles.push([j.learnerId, j.language, s === 'S2' ? null : 'Aspiring full-stack developer', JSON.stringify(s === 'S6' || s === 'S10' ? ['Full-stack developer'] : ['Frontend developer']),
        JSON.stringify({ startInVoice: true, showEnglishCaptions: true }), 1]);
    }
  }
  await insert('learners', ['id', 'institution_id', 'name', 'email', 'learner_ref', 'pin_hash', 'language', 'profile_type', 'pin_must_change', 'is_discoverable', 'city', 'age_status'], learners);
  await insert('engagement_learners', ['id', 'engagement_id', 'learner_id', 'current_node_id', 'current_cluster_id', 'overall_status', 'access_status', 'last_login_at', 'delivery'], els);
  if (profiles.length) await insert('learner_profiles', ['learner_id', 'ui_language', 'headline', 'target_roles', 'voice_prefs', 'share_with_institution'], profiles);

  for (const j of pick) {
    const b = builder(j);
    build(j, b);
    await writeRows(b.rows);
    if (j.stage === 'S3') {
      await dal.run(`INSERT INTO bridge_assignments (id, bridge_id, el_id, baseline_readiness, baseline_mastered_json, assigned_at)
        VALUES (?, 'test-bridge-j-s3', ?, 45, ?, ?)`, `${j.learnerId}-bridge`, j.elId, JSON.stringify(NODE_IDS.slice(0, 6)), at(2));
    }
    // Discoverable stages carry the consent that makes them findable.
    if (['S7', 'S8', 'S9', 'S10', 'S11'].includes(j.stage)) {
      await dal.run(`INSERT INTO consents (id, learner_id, institution_id, level, purpose, text_version, granted_by, granted_at)
        VALUES (?, ?, ?, 3, 'Let verified employers find me by my verified skills, without my name until I say yes', 'discoverable-v1', 'learner', ?)`, `${j.learnerId}-c3`, j.learnerId, INSTITUTION, at(30));
    }
    // Mastery Logs and Passports for the stages that have them; S7 shares it publicly.
    if (['S5', 'S6', 'S7', 'S8', 'S9', 'S10', 'S11', 'S12'].includes(j.stage)) {
      const log = await produceLearnerMasteryLog(j.engagementId, j.learnerId);
      await saveMasteryLog(j.engagementId, j.learnerId, log);
      const cred = await issueCredential(j.elId, { reason: 'journey_seed' });
      if (cred && j.stage === 'S7') {
        await setPublic(cred.evidence_id, j.learnerId, true);
        // A few views of the shared Passport (type and date only).
        await insert('passport_views', ['id', 'evidence_id', 'viewer_type', 'viewed_at'],
          [['employer', 1], ['public', 3], ['employer', 6]].map(([t, d], i) => [`${j.learnerId}-view-${i}`, cred.evidence_id, t, at(d)]));
      }
    }
  }
  return pick.length;
}
