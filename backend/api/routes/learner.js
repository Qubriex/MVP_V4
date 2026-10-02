// api/routes/learner.js — Learner Portal
// All routes require JWT authentication. Learner payload: id (learner_id),
// el_id (engagement_learner_id), engagement_id, language.
import express from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { legacyHandle as getDb } from '../../core/db/dal.js';
import { aiRateLimitPosts } from '../middleware/rateLimit.js';
import { authenticateToken, requireRole, requireActiveLearner } from '../middleware/auth.js';
import * as orchestrator from '../../core/orchestrator.js';
import { calculateMasteryAttainment, calculateConfidenceIndicator, selectNextApproach } from '../../core/instructionEngine.js';
import { nodeConfidence } from '../../core/masteryLog.js';
import crypto from 'crypto';
import { ulid } from '../../core/db/ulid.js';
import { emit } from '../../core/events/outbox.js';
import { issueInstance } from '../../core/evidence/checkWriter.js';
import { authenticityGate } from '../../core/evidence/assurance.js';
import { assessConcept, resolveTheta } from '../../core/evidence/assess.js';
import { enqueueReview } from '../../core/evidence/calibration.js';
import { recordAttempt as recordVocabulary, vocabularyLevel } from '../../core/learner/vocabulary.js';
import { heartbeat } from '../../core/learner/activeTime.js';
import { scheduleFirstReview } from '../../core/retention/schedule.js';

const sha256 = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');
import { transcribeAudio } from '../../core/portfolio.js';
import { isValidPin, hashPin, logEvent } from '../../core/access.js';
import { eachSeq, mapSeq } from '../../core/util/seq.js';
import { aiNotConfigured, AI_NOT_CONFIGURED, synthesize } from '../../core/ai/gateway.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const confidenceLabel = (c) => (c >= 0.75 ? 'high' : c >= 0.55 ? 'solid' : 'building');

router.use(authenticateToken);
router.use(requireRole('learner', 'admin'));
router.use(requireActiveLearner);
// AI-calling routes are POSTs; limited per learner and per institution (v4.3 §22).
// (Mounted before portfolio.js on /api/learner, so this also covers it.)
router.use(aiRateLimitPosts);

// ─── Streak logic (doc section 11.4) ──────────────────────────────────────────
async function updateStreak(db, elId) {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const existing = await db.prepare('SELECT * FROM streaks WHERE engagement_learner_id = ?').get(elId);

  if (!existing) {
    await db.prepare(`
      INSERT INTO streaks (id, engagement_learner_id, current_streak, longest_streak, total_session_days, last_session_date)
      VALUES (?, ?, 1, 1, 1, ?)
    `).run(uuidv4(), elId, today);
    return;
  }
  if (existing.last_session_date === today) return; // already counted today

  const newStreak = existing.last_session_date === yesterday ? existing.current_streak + 1 : 1;
  await db.prepare(`
    UPDATE streaks SET current_streak = ?, longest_streak = GREATEST(longest_streak, ?),
      total_session_days = total_session_days + 1, last_session_date = ?
    WHERE engagement_learner_id = ?
  `).run(newStreak, newStreak, today, elId);
}

async function getNodeWithCluster(db, nodeId) {
  return await db.prepare(`
    SELECT sn.*, sc.cluster_label, sc.mastery_threshold AS cluster_threshold, ct.institution_id
    FROM skill_nodes sn
    JOIN skill_clusters sc ON sc.id = sn.cluster_id
    JOIN capability_targets ct ON ct.id = sc.capability_target_id
    WHERE sn.id = ?
  `).get(nodeId);
}

// ─── GET dashboard ─────────────────────────────────────────────────────────────
router.get('/dashboard', async (req, res) => {
  const db = getDb();
  const el = await db.prepare(`
    SELECT el.*, e.title as engagement_title, e.language,
      (SELECT COUNT(*) FROM node_mastery nm WHERE nm.engagement_learner_id = el.id AND nm.advanced_at IS NOT NULL) as nodes_mastered,
      sn.node_label as current_node_label,
      sc.cluster_label as current_cluster_label
    FROM engagement_learners el
    JOIN engagements e ON e.id = el.engagement_id
    LEFT JOIN skill_nodes sn ON sn.id = el.current_node_id
    LEFT JOIN skill_clusters sc ON sc.id = el.current_cluster_id
    WHERE el.id = ?
  `).get(req.user.el_id);
  if (!el) { db.close(); return res.status(404).json({ error: 'Not found' }); }

  const totalNodes = await db.prepare(`
    SELECT COUNT(*) as cnt FROM skill_nodes sn
    JOIN skill_clusters sc ON sc.id = sn.cluster_id
    JOIN capability_targets ct ON ct.id = sc.capability_target_id
    JOIN engagements e ON e.capability_target_id = ct.id
    WHERE e.id = ?
  `).get(req.user.engagement_id);

  const streak = await db.prepare('SELECT current_streak, longest_streak FROM streaks WHERE engagement_learner_id = ?').get(req.user.el_id);

  // "Continue learning" card: where the current node sits in the path, its
  // estimated time, and how the last session on it went.
  const pathNodes = await db.prepare(`
    SELECT sn.id, sn.estimated_minutes, sc.id as cluster_id FROM skill_nodes sn
    JOIN skill_clusters sc ON sc.id = sn.cluster_id
    WHERE sc.capability_target_id = (SELECT capability_target_id FROM engagements WHERE id = ?)
    ORDER BY sc.sequence_order, sn.sequence_order
  `).all(req.user.engagement_id);
  const currentIndex = pathNodes.findIndex(n => n.id === el.current_node_id);
  const lastSession = el.current_node_id ? await db.prepare(`
    SELECT current_approach, loop_count FROM learning_sessions
    WHERE engagement_learner_id = ? AND skill_node_id = ? ORDER BY started_at DESC LIMIT 1
  `).get(req.user.el_id, el.current_node_id) : null;
  const mastered = new Set((await db.prepare('SELECT skill_node_id FROM node_mastery WHERE engagement_learner_id = ? AND advanced_at IS NOT NULL')
    .all(req.user.el_id)).map(r => r.skill_node_id));
  const clusterIds = [...new Set(pathNodes.map(n => n.cluster_id))];
  const clustersDone = clusterIds.filter(cid => pathNodes.filter(n => n.cluster_id === cid).every(n => mastered.has(n.id))).length;
  const week = await db.prepare(`
    SELECT COALESCE(SUM(active_minutes), 0) as minutes FROM learning_sessions
    WHERE engagement_learner_id = ? AND started_at >= datetime('now', '-7 days')
  `).get(req.user.el_id);
  const recent = (await db.prepare(`
    SELECT sn.node_label FROM node_mastery nm JOIN skill_nodes sn ON sn.id = nm.skill_node_id
    WHERE nm.engagement_learner_id = ? AND nm.advanced_at IS NOT NULL ORDER BY nm.advanced_at DESC LIMIT 8
  `).all(req.user.el_id)).map(r => r.node_label);

  db.close();
  res.json({
    ...el,
    total_nodes: totalNodes.cnt,
    progress_pct: totalNodes.cnt > 0 ? Math.round((el.nodes_mastered / totalNodes.cnt) * 100) : 0,
    streak: streak || { current_streak: 0, longest_streak: 0 },
    current_node_index: currentIndex >= 0 ? currentIndex + 1 : null,
    current_node_minutes: currentIndex >= 0 ? pathNodes[currentIndex].estimated_minutes : null,
    last_approach: lastSession ? lastSession.current_approach : null,
    last_loop_count: lastSession ? lastSession.loop_count : 0,
    clusters_done: clustersDone,
    total_clusters: clusterIds.length,
    week_minutes: Math.round(week.minutes),
    recently_mastered: recent
  });
});

// ─── GET full node-by-node progress map ───────────────────────────────────────
router.get('/progress', async (req, res) => {
  const db = getDb();
  const records = await mapSeq(await db.prepare(`
    SELECT nm.*, sn.node_label, sc.cluster_label
    FROM node_mastery nm
    JOIN skill_nodes sn ON sn.id = nm.skill_node_id
    JOIN skill_clusters sc ON sc.id = sn.cluster_id
    WHERE nm.engagement_learner_id = ?
    ORDER BY nm.advanced_at
  `).all(req.user.el_id), async r => ({ ...r, confidence_indicator: await nodeConfidence(db, req.user.el_id, r.skill_node_id) }));
  db.close();
  res.json(records.map(r => ({ ...r, confidence_label: confidenceLabel(r.confidence_indicator) })));
});

// ─── GET mastered nodes only (dashboard "Recently mastered", resume) ──────────
router.get('/mastery-record', async (req, res) => {
  const db = getDb();
  const records = await mapSeq(await db.prepare(`
    SELECT nm.skill_node_id, sn.node_label, sc.cluster_label, nm.mastery_attainment, nm.attempt_count,
           nm.time_to_mastery_minutes, nm.advanced_at
    FROM node_mastery nm
    JOIN skill_nodes sn ON sn.id = nm.skill_node_id
    JOIN skill_clusters sc ON sc.id = sn.cluster_id
    WHERE nm.engagement_learner_id = ? AND nm.advanced_at IS NOT NULL
    ORDER BY nm.advanced_at DESC
  `).all(req.user.el_id), async r => ({ ...r, confidence_indicator: await nodeConfidence(db, req.user.el_id, r.skill_node_id) }));
  db.close();
  res.json(records.map(r => ({ ...r, confidence_label: confidenceLabel(r.confidence_indicator) })));
});

// ─── GET the learner's own skill path & record (/learn/record) ────────────────
// The learner-facing view of what the institution sees in the Mastery Log:
// every cluster and node with its status, plus evidence for mastered nodes.
// Session content, check questions and evaluations stay proprietary.
router.get('/path', async (req, res) => {
  const db = getDb();
  const el = await db.prepare(`
    SELECT el.current_node_id, el.overall_status, e.title as engagement_title
    FROM engagement_learners el JOIN engagements e ON e.id = el.engagement_id WHERE el.id = ?
  `).get(req.user.el_id);
  if (!el) { db.close(); return res.status(404).json({ error: 'Not found' }); }

  const rows = await mapSeq(await db.prepare(`
    SELECT sc.id as cluster_id, sc.cluster_label, sc.cluster_ref, sn.id as node_id, sn.node_label, sn.estimated_minutes,
           nm.mastery_attainment, nm.attempt_count, nm.time_to_mastery_minutes, nm.advanced_at
    FROM skill_clusters sc
    JOIN skill_nodes sn ON sn.cluster_id = sc.id
    LEFT JOIN node_mastery nm ON nm.skill_node_id = sn.id AND nm.engagement_learner_id = ?
    WHERE sc.capability_target_id = (SELECT capability_target_id FROM engagements WHERE id = ?)
    ORDER BY sc.sequence_order, sn.sequence_order
  `).all(req.user.el_id, req.user.engagement_id), async r => ({ ...r, confidence_indicator: r.advanced_at ? await nodeConfidence(db, req.user.el_id, r.node_id) : null }));
  const time = await db.prepare('SELECT COALESCE(SUM(active_minutes), 0) as minutes FROM learning_sessions WHERE engagement_learner_id = ?').get(req.user.el_id);
  db.close();

  const clusters = [];
  rows.forEach(r => {
    let c = clusters.find(x => x.id === r.cluster_id);
    if (!c) { c = { id: r.cluster_id, label: r.cluster_label, ref: r.cluster_ref, nodes: [] }; clusters.push(c); }
    c.nodes.push({
      id: r.node_id, label: r.node_label, estimated_minutes: r.estimated_minutes,
      status: r.advanced_at ? 'mastered' : r.node_id === el.current_node_id ? 'current' : 'upcoming',
      mastery_pct: r.advanced_at ? Math.round((r.mastery_attainment || 0) * 100) : null,
      attempt_count: r.advanced_at ? r.attempt_count : null,
      time_minutes: r.advanced_at ? Math.round(r.time_to_mastery_minutes || 0) : null,
      confidence_label: r.advanced_at ? confidenceLabel(r.confidence_indicator) : null,
      advanced_at: r.advanced_at
    });
  });
  clusters.forEach(c => {
    const done = c.nodes.filter(n => n.status === 'mastered').length;
    c.mastered = done;
    c.total = c.nodes.length;
    c.status = done === c.total ? 'done' : c.nodes.some(n => n.status !== 'upcoming') ? 'now' : 'next';
  });

  const masteredNodes = clusters.flatMap(c => c.nodes.filter(n => n.status === 'mastered').map(n => ({ ...n, cluster: c.label })));
  res.json({
    engagement_title: el.engagement_title,
    overall_status: el.overall_status,
    summary: {
      nodes_mastered: masteredNodes.length,
      total_nodes: rows.length,
      average_mastery_pct: masteredNodes.length ? Math.round(masteredNodes.reduce((sum, n) => sum + n.mastery_pct, 0) / masteredNodes.length) : null,
      active_minutes: Math.round(time.minutes),
      cluster_certificates: clusters.filter(c => c.status === 'done').length
    },
    clusters,
    evidence: masteredNodes.sort((a, b) => String(b.advanced_at).localeCompare(String(a.advanced_at)))
  });
});

// ─── Session: start or resume ─────────────────────────────────────────────────
router.post('/session/start', async (req, res) => {
  const db = getDb();
  const el = await db.prepare('SELECT * FROM engagement_learners WHERE id = ?').get(req.user.el_id);
  if (!el || !el.current_node_id) { db.close(); return res.status(400).json({ error: 'No active skill node' }); }

  const node = await getNodeWithCluster(db, el.current_node_id);

  let session = await db.prepare(`
    SELECT * FROM learning_sessions
    WHERE engagement_learner_id = ? AND skill_node_id = ? AND status = 'active'
    ORDER BY started_at DESC LIMIT 1
  `).get(el.id, el.current_node_id);

  const approachesUsed = (await db.prepare(`
    SELECT approach FROM loop_approaches_used WHERE engagement_learner_id = ? AND skill_node_id = ?
  `).all(el.id, el.current_node_id)).map(r => r.approach);

  if (!session) {
    const sessionId = uuidv4();
    const approach = approachesUsed.length === 0 ? 'native_concept' : selectNextApproach(approachesUsed);
    await db.prepare(`
      INSERT INTO learning_sessions (id, engagement_learner_id, skill_node_id, session_number, language, loop_count, current_approach, behaviour_signal)
      VALUES (?, ?, ?, 1, ?, 0, ?, 'engaged')
    `).run(sessionId, el.id, el.current_node_id, req.user.language, approach);
    session = await db.prepare('SELECT * FROM learning_sessions WHERE id = ?').get(sessionId);
  }

  const history = await db.prepare(`
    SELECT role, content, message_type, caption_en, mermaid, code, input_mode FROM session_messages WHERE session_id = ? ORDER BY created_at, seq
  `).all(session.id);
  db.close();

  if (history.length > 0) {
    return res.json({
      session_id: session.id, node_label: node.node_label, cluster_label: node.cluster_label,
      language: req.user.language, approach: session.current_approach, loop_count: session.loop_count, history
    });
  }

  try {
    const result = await orchestrator.processMessage({
      requestType: 'SESSION_START',
      learnerId: req.user.id, engagementLearnerId: el.id, sessionId: session.id,
      nodeId: node.id, nodeLabel: node.node_label, clusterLabel: node.cluster_label,
      language: req.user.language,
      sessionState: { clusterId: node.cluster_id, approachesUsed }
    });

    const msgDb = getDb();
    await msgDb.prepare(`
      INSERT INTO session_messages (id, session_id, role, content, message_type, caption_en)
      VALUES (?, ?, 'ai', ?, 'diagnosis', ?)
    `).run(uuidv4(), session.id, result.message, result.captionEn || null);
    msgDb.close();

    res.json({
      session_id: session.id, node_label: node.node_label, cluster_label: node.cluster_label,
      language: req.user.language, approach: session.current_approach, loop_count: session.loop_count,
      message: result.message, caption_en: result.captionEn || null, decision: 'DIAGNOSE',
      history: [{ role: 'ai', content: result.message, message_type: 'diagnosis', caption_en: result.captionEn || null }]
    });
  } catch (err) {
    if (aiNotConfigured(err)) return res.status(503).json({ error: AI_NOT_CONFIGURED });
    res.status(500).json({ error: 'Failed to start session', detail: err.message });
  }
});

// ─── Session: primary interaction endpoint ────────────────────────────────────
// Routes to DIAGNOSIS_RESPONSE, LEARNER_MESSAGE, or CHECK_RESPONSE based on
// the session state. Optional body fields: input_mode ('voice' | 'text') is
// stored with the learner's message; request_check: true is the "I'm ready
// for the check" button — TEACH decides to check this turn (content may be
// empty). A check answer carries `provenance` (v4.3 §7.11): mode, pasted
// characters, paste events, largest paste, transcript edit ratio.
//
// Checks (v4.3 §7): TEACH only decides WHEN. The question is written by
// core/evidence/checkWriter from the node spec with a per-learner seed; the
// answer goes through the authenticity gate (A0 stops, A1 proceeds), EVAL
// (blind, with the borderline second pass), and the result, its evidence
// record, demonstration, review-queue entry and outbox events are written in
// one transaction.
const HOLD_MESSAGE = {
  telugu: 'ఈ సమాధానం మీ సొంత మాటల్లో ఉండాలి. దయచేసి మళ్లీ చెప్పండి — మాట్లాడి గానీ, కాపీ చేయకుండా టైప్ చేసి గానీ.',
  hindi: 'यह जवाब आपके अपने शब्दों में होना चाहिए। कृपया फिर से बताइए — बोलकर, या बिना कॉपी किए टाइप करके।'
};
const HOLD_CAPTION = 'This answer needs to be in your own words. Please answer again — by voice, or by typing without pasting.';

async function pendingCheckFor(db, sessionId) {
  return await db.prepare(`
    SELECT mc.*, fi.params_json, fi.family_id, fi.family_version, fi.purpose AS instance_purpose
    FROM mastery_checks mc LEFT JOIN family_instances fi ON fi.id = mc.instance_id
    WHERE mc.session_id = ? AND mc.passed IS NULL ORDER BY mc.created_at DESC, mc.seq DESC LIMIT 1
  `).get(sessionId);
}

async function handleSessionMessage(req, res) {
  const requestCheck = req.body.request_check === true || req.body.request_check === 'true';
  const inputMode = ['voice', 'text'].includes(req.body.input_mode) ? req.body.input_mode : 'text';
  const content = (req.body.content || '').trim() || (requestCheck ? "I'm ready for the mastery check." : '');
  let { session_id } = req.body;
  if (!content) return res.status(400).json({ error: 'content required' });

  const db = getDb();

  if (!session_id) {
    const el = await db.prepare('SELECT * FROM engagement_learners WHERE id = ?').get(req.user.el_id);
    const active = el && el.current_node_id
      ? await db.prepare(`SELECT * FROM learning_sessions WHERE engagement_learner_id = ? AND skill_node_id = ? AND status = 'active' ORDER BY started_at DESC LIMIT 1`).get(el.id, el.current_node_id)
      : null;
    session_id = active ? active.id : null;
  }

  const session = session_id
    ? await db.prepare('SELECT * FROM learning_sessions WHERE id = ? AND engagement_learner_id = ?').get(session_id, req.user.el_id)
    : null;
  if (!session) { db.close(); return res.status(404).json({ error: 'No active session found — call /session/start first' }); }

  const node = await getNodeWithCluster(db, session.skill_node_id);
  const lastAiMsg = await db.prepare(`
    SELECT * FROM session_messages WHERE session_id = ? AND role = 'ai' ORDER BY created_at DESC, seq DESC LIMIT 1
  `).get(session.id);
  const approachesUsed = (await db.prepare(`
    SELECT approach FROM loop_approaches_used WHERE engagement_learner_id = ? AND skill_node_id = ?
  `).all(req.user.el_id, session.skill_node_id)).map(r => r.approach);
  const pendingCheck = await pendingCheckFor(db, session.id);

  await db.prepare(`
    INSERT INTO session_messages (id, session_id, role, content, message_type, input_mode)
    VALUES (?, ?, 'learner', ?, 'response', ?)
  `).run(uuidv4(), session.id, content, inputMode);
  db.close();

  let requestType;
  if (pendingCheck && lastAiMsg && ['mastery_check', 'feedback'].includes(lastAiMsg.message_type)) requestType = 'CHECK_RESPONSE';
  else if (!lastAiMsg || lastAiMsg.message_type === 'diagnosis') requestType = 'DIAGNOSIS_RESPONSE';
  else requestType = 'LEARNER_MESSAGE';

  const sessionState = {
    clusterId: node.cluster_id, loopCount: session.loop_count, currentApproach: session.current_approach,
    approachesUsed, behaviourSignal: session.behaviour_signal,
    checkQuestion: pendingCheck ? pendingCheck.question_text : null,
    learnerRequestedCheck: requestCheck && requestType === 'LEARNER_MESSAGE',
    vocabularyLevel: await vocabularyLevel(req.user.id)
  };

  try {
    let gate = null;
    let assessment = null;
    if (requestType === 'CHECK_RESPONSE') {
      // 1. Authenticity gate (v4.3 §7.11): A0 stops, never a demonstration.
      gate = authenticityGate(req.body.provenance || null, content);
      if (gate.assurance === 'A0') return await holdForAuthenticity({ req, res, session, node, pendingCheck, gate, answer: content });
      // 2. Blind EVAL with θ, borderline second pass and persistence (§4.3, §7.3).
      assessment = await assessConcept({
        nodeLabel: node.node_label, language: req.user.language, question: pendingCheck.question_text, answer: content,
        theta: resolveTheta(node.mastery_threshold, node.cluster_threshold), loops: session.loop_count
      });
      sessionState.evaluation = {
        ...assessment.evaluation, passed: assessment.passed, score: assessment.r_c
      };
    }

    const result = await orchestrator.processMessage({
      requestType, learnerId: req.user.id, engagementLearnerId: req.user.el_id, sessionId: session.id,
      nodeId: node.id, nodeLabel: node.node_label, clusterLabel: node.cluster_label,
      language: req.user.language, learnerMessage: content, sessionState
    });

    if (requestType === 'CHECK_RESPONSE') {
      return await handleCheckResult({ req, res, session, node, result, learnerResponse: content, pendingCheck, gate, assessment });
    }
    return await handleInstructionResult({ req, res, session, node, result });
  } catch (err) {
    if (aiNotConfigured(err)) return res.status(503).json({ error: AI_NOT_CONFIGURED });
    req.log?.error('session.message_failed', { error: err });
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}

// A0: record the attempt (learning progress only), keep the check open, and
// ask for the answer again in the learner's own words.
async function holdForAuthenticity({ req, res, session, node, pendingCheck, gate, answer }) {
  const db = getDb();
  const message = HOLD_MESSAGE[req.user.language] || HOLD_CAPTION;
  await db.transaction(async () => {
    const evidenceId = ulid();
    await db.prepare(`INSERT INTO evidence_records (id, el_id, node_id, family_id, instance_id, purpose, answer_hash, passed, assurance, authentic, flags_json, theta, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 'A0', 0, ?, ?, ?)`).run(evidenceId, session.engagement_learner_id, node.id, pendingCheck.family_id || null,
      pendingCheck.instance_id || null, pendingCheck.purpose || 'check', sha256(answer), JSON.stringify([gate.reason]),
      resolveTheta(node.mastery_threshold, node.cluster_threshold), new Date().toISOString());
    await insertProvenance(db, evidenceId, gate.provenance);
    await insertAnswer(db, evidenceId, answer);
    await db.prepare(`INSERT INTO session_messages (id, session_id, role, content, message_type, caption_en) VALUES (?, ?, 'ai', ?, 'feedback', ?)`)
      .run(uuidv4(), session.id, message, HOLD_CAPTION);
  })();
  db.close();
  res.json({
    session_id: session.id, result: 'hold', decision: 'HOLD', reason: gate.reason,
    message, caption_en: HOLD_CAPTION, check_question: pendingCheck.question_text
  });
}

async function insertAnswer(db, evidenceId, text) {
  await db.prepare('INSERT INTO check_answers (evidence_id, answer_text, created_at) VALUES (?, ?, ?)').run(evidenceId, String(text).slice(0, 20000), new Date().toISOString());
}

async function insertProvenance(db, evidenceId, p) {
  await db.prepare(`INSERT INTO answer_provenance (evidence_id, mode, answer_chars, pasted_chars, paste_events, largest_paste, edit_ratio, tab_hidden_ms, device_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(evidenceId, p.mode, p.answer_chars ?? null, p.pasted_chars ?? null, p.paste_events ?? null,
    p.largest_paste ?? null, p.edit_ratio ?? null, p.tab_hidden_ms ?? null, p.device_id ?? null);
}

async function handleInstructionResult({ req, res, session, node, result }) {
  const isCheck = result.decision === 'CHECK';
  // v4.3 §7: the check is written outside TEACH, from the node spec.
  const instance = isCheck ? await issueInstance({
    elId: session.engagement_learner_id, learnerId: req.user.id, nodeId: session.skill_node_id,
    language: req.user.language, purpose: 'check', institutionId: node.institution_id
  }) : null;

  const db = getDb();
  await db.transaction(async () => {
    await db.prepare(`
      INSERT INTO session_messages (id, session_id, role, content, message_type, caption_en, mermaid, code)
      VALUES (?, ?, 'ai', ?, 'instruction', ?, ?, ?)
    `).run(uuidv4(), session.id, result.message, result.captionEn || null, result.mermaid || null, result.code || null);

    if (result.approach) {
      await db.prepare(`
        INSERT OR IGNORE INTO loop_approaches_used (id, engagement_learner_id, skill_node_id, approach)
        VALUES (?, ?, ?, ?)
      `).run(uuidv4(), session.engagement_learner_id, session.skill_node_id, result.approach);
      await db.prepare(`UPDATE learning_sessions SET current_approach = ?, behaviour_signal = ? WHERE id = ?`)
        .run(result.approach, result.behaviourSignal || session.behaviour_signal, session.id);
    } else {
      await db.prepare(`UPDATE learning_sessions SET behaviour_signal = ? WHERE id = ?`)
        .run(result.behaviourSignal || session.behaviour_signal, session.id);
    }

    if (instance) {
      const checkCount = (await db.prepare('SELECT COUNT(*) as cnt FROM mastery_checks WHERE session_id = ?').get(session.id)).cnt;
      await db.prepare(`
        INSERT INTO mastery_checks (id, session_id, skill_node_id, engagement_learner_id, check_number, question_text, instance_id, purpose)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'check')
      `).run(uuidv4(), session.id, session.skill_node_id, session.engagement_learner_id, checkCount + 1, instance.question_text, instance.id);
      await db.prepare(`INSERT INTO session_messages (id, session_id, role, content, message_type) VALUES (?, ?, 'ai', ?, 'mastery_check')`)
        .run(uuidv4(), session.id, instance.question_text);
    }
  })();
  db.close();

  res.json({
    session_id: session.id, message: result.message, caption_en: result.captionEn || null, decision: result.decision,
    check_question: instance ? instance.question_text : null, mermaid: result.mermaid || null, code: result.code || null,
    behaviour_signal: result.behaviourSignal, approach: result.approach || session.current_approach
  });
}

async function handleCheckResult({ req, res, session, node, result, learnerResponse, pendingCheck, gate, assessment }) {
  const db = getDb();
  const evaluation = result.evaluation;
  const passed = assessment.passed;
  const now = new Date().toISOString();
  const elId = session.engagement_learner_id;
  const vocabGap = evaluation.loopApproachIfFailed === 'vocabulary_barrier'
    || (evaluation.understandingGaps || []).some(g => /vocabulary_barrier/i.test(String(g)));
  let advanceTo = null;
  let masteryAttainment = null;
  let confidenceIndicator = null;
  let review = null;

  const nextNodeAfter = async () => {
    const nextNode = await db.prepare(`
      SELECT sn.* FROM skill_nodes sn
      WHERE sn.cluster_id = (SELECT cluster_id FROM skill_nodes WHERE id = ?)
      AND sn.sequence_order > (SELECT sequence_order FROM skill_nodes WHERE id = ?)
      ORDER BY sn.sequence_order LIMIT 1
    `).get(session.skill_node_id, session.skill_node_id);
    if (nextNode) return nextNode;
    const currentCluster = await db.prepare('SELECT cluster_id FROM skill_nodes WHERE id = ?').get(session.skill_node_id);
    const nextCluster = await db.prepare(`
      SELECT sc.id FROM skill_clusters sc
      WHERE sc.capability_target_id = (SELECT capability_target_id FROM skill_clusters WHERE id = ?)
      AND sc.sequence_order > (SELECT sequence_order FROM skill_clusters WHERE id = ?)
      ORDER BY sc.sequence_order LIMIT 1
    `).get(currentCluster.cluster_id, currentCluster.cluster_id);
    return nextCluster ? await db.prepare('SELECT * FROM skill_nodes WHERE cluster_id = ? ORDER BY sequence_order LIMIT 1').get(nextCluster.id) : null;
  };

  await db.transaction(async () => {
    await db.prepare(`
      UPDATE mastery_checks SET learner_response = ?, passed = ?, score = ?, ai_evaluation = ?, evaluated_at = datetime('now')
      WHERE id = ?
    `).run(learnerResponse, passed ? 1 : 0, assessment.r_c, evaluation.evaluation, pendingCheck.id);

    // Evidence record + provenance (v4.3 §7, §20).
    const evidenceId = ulid();
    await db.prepare(`INSERT INTO evidence_records (id, el_id, node_id, family_id, instance_id, purpose, answer_hash, per_point_json, r_c, fused_score,
        passed, level, assurance, authentic, flags_json, provisional, theta, model_id, prompt_version, rubric_version, family_version, active_ms, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      evidenceId, elId, node.id, pendingCheck.family_id || null, pendingCheck.instance_id || null, pendingCheck.purpose || 'check',
      sha256(learnerResponse), JSON.stringify({ gaps: evaluation.understandingGaps || [], second_pass: assessment.second ? assessment.second.score : null }),
      assessment.r_c, assessment.r_c, passed ? 1 : 0, assessment.level, gate.assurance, JSON.stringify(assessment.flags),
      assessment.provisional ? 1 : 0, assessment.theta, 'gateway', 'EVAL.mastery.v1', evaluation.rubricVersion || 'default',
      pendingCheck.family_version || null, Math.round((session.active_minutes || 0) * 60000), now);
    await insertProvenance(db, evidenceId, gate.provenance);
    await insertAnswer(db, evidenceId, learnerResponse);

    // Faculty review: decision stratum (persistence, borderline disagreement) or calibration sample (§7.8).
    review = await enqueueReview({ evidenceId, elId, nodeId: node.id, institutionId: node.institution_id, engagementId: req.user.engagement_id, decision: assessment.review });

    // Vocabulary level (§6).
    await recordVocabulary(req.user.id, { passed, vocabGap });

    await db.prepare(`
      INSERT INTO session_messages (id, session_id, role, content, message_type, caption_en, mermaid, code)
      VALUES (?, ?, 'ai', ?, ?, ?, ?, ?)
    `).run(uuidv4(), session.id, result.message, passed ? 'advance_trigger' : 'loop_trigger',
      result.captionEn || null, result.mermaid || null, result.code || null);

    await emit('CHECK_EVALUATED', { aggregateType: 'enrolment', aggregateId: elId, payload: { evidenceId, nodeId: node.id, passed, assurance: gate.assurance, provisional: assessment.provisional } }, db);

    if (passed) {
      const allChecks = (await db.prepare(`
        SELECT score, passed FROM mastery_checks
        WHERE engagement_learner_id = ? AND skill_node_id = ? AND passed IS NOT NULL ORDER BY created_at
      `).all(elId, session.skill_node_id)).map(c => ({ score: c.score, passed: !!c.passed }));
      masteryAttainment = calculateMasteryAttainment(allChecks);
      // Computed for the response only; never stored (sign facts, compute labels).
      confidenceIndicator = calculateConfidenceIndicator(allChecks, session.loop_count);
      const timeToMastery = (Date.now() - new Date(session.started_at).getTime()) / 60000;

      await db.prepare(`
        INSERT INTO node_mastery (id, engagement_learner_id, skill_node_id, mastery_attainment, time_to_mastery_minutes, attempt_count, advanced_at,
          theta, evidence_level, persistence, provisional, recheck_required, loops, active_minutes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'L1', ?, ?, 0, ?, ?)
        ON CONFLICT(engagement_learner_id, skill_node_id) DO UPDATE SET
          mastery_attainment = excluded.mastery_attainment, time_to_mastery_minutes = excluded.time_to_mastery_minutes,
          attempt_count = excluded.attempt_count, advanced_at = excluded.advanced_at, theta = excluded.theta,
          evidence_level = excluded.evidence_level, persistence = excluded.persistence, provisional = excluded.provisional,
          recheck_required = 0, loops = excluded.loops, active_minutes = excluded.active_minutes
      `).run(uuidv4(), elId, session.skill_node_id, masteryAttainment, timeToMastery, allChecks.length, now,
        assessment.theta, assessment.persistence ? 1 : 0, assessment.provisional ? 1 : 0, session.loop_count, session.active_minutes || 0);

      // The mastery pass is the first dated demonstration (§9.1).
      await db.prepare(`INSERT INTO demonstrations (id, el_id, node_id, kind, date, passed, score, level, assurance, evidence_id, created_at)
        VALUES (?, ?, ?, 'mastery', ?, 1, ?, 'L1', ?, ?, ?)`).run(ulid(), elId, node.id, now, assessment.r_c, gate.assurance, evidenceId, now);
      await scheduleFirstReview(db, elId, node.id, now);

      await db.prepare(`UPDATE learning_sessions SET status = 'completed', completed_at = datetime('now'), behaviour_signal = 'accelerating' WHERE id = ?`).run(session.id);
      advanceTo = await nextNodeAfter();
      if (advanceTo) {
        await db.prepare(`UPDATE engagement_learners SET current_node_id = ?, current_cluster_id = ? WHERE id = ?`)
          .run(advanceTo.id, advanceTo.cluster_id, elId);
      } else {
        await db.prepare(`UPDATE engagement_learners SET overall_status = 'completed' WHERE id = ?`).run(elId);
        await emit('CURRICULUM_COMPLETE', { aggregateType: 'enrolment', aggregateId: elId, payload: {} }, db);
      }
      await updateStreak(db, elId);
      await emit('NODE_ADVANCED', { aggregateType: 'enrolment', aggregateId: elId, payload: { nodeId: node.id, evidenceId, provisional: assessment.provisional } }, db);
    } else {
      await db.prepare(`
        INSERT OR IGNORE INTO loop_approaches_used (id, engagement_learner_id, skill_node_id, approach)
        VALUES (?, ?, ?, ?)
      `).run(uuidv4(), elId, session.skill_node_id, session.current_approach);
      await db.prepare(`
        UPDATE learning_sessions SET loop_count = loop_count + 1, current_approach = ?, behaviour_signal = 'confused' WHERE id = ?
      `).run(result.nextApproach, session.id);
      await emit('NODE_LOOPED', { aggregateType: 'enrolment', aggregateId: elId, payload: { nodeId: node.id, evidenceId, loops: session.loop_count + 1 } }, db);
    }
  })();
  db.close();

  // Scores are never shown to the learner (v4.3 §2A.2); a provisional pass says so.
  const common = {
    session_id: session.id, feedback: evaluation.feedbackForLearner, message: result.message, caption_en: result.captionEn || null,
    mermaid: result.mermaid || null, code: result.code || null, provisional: assessment.provisional,
    review_pending: !!(review && review.stratum === 'decision')
  };
  if (passed) {
    return res.json({
      ...common, result: 'advance', decision: 'ADVANCE', passed: true,
      mastery_increment: result.masteryIncrement, mastery_attainment: Math.round(masteryAttainment * 100),
      confidence_indicator: parseFloat(confidenceIndicator.toFixed(2)),
      next_node: advanceTo ? { id: advanceTo.id, label: advanceTo.node_label } : null,
      programme_complete: !advanceTo
    });
  }
  return res.json({
    ...common, result: 'loop', decision: 'LOOP', passed: false, understanding_gaps: evaluation.understandingGaps,
    next_approach: result.nextApproach, loop_count: session.loop_count + 1
  });
}

router.post('/session/message', handleSessionMessage);
router.post('/session/check', handleSessionMessage); // alias for backwards compatibility

// ─── Session: voice turn ───────────────────────────────────────────────────────
// Speech in: multipart "audio" (webm/ogg/mp4/wav) + optional session_id and
// request_check. Transcribed server-side, then handled exactly like a typed
// message (input_mode 'voice'); the response adds `transcript`. Browsers with
// on-device speech recognition skip this and post text to /session/message.
// Speech out is synthesised in the browser from `message` — no audio is sent.
// ─── Professor Qubirex's voice (docs/AI-VOICE-SPEC.md) ──────────────────────
// POST /tts { text, variant?: 'A'|'B' } → audio/wav. The page speaks a lesson
// in sentence groups, so each request stays short. 503 when no model key is
// configured: the page then falls back to the browser's own voice.
router.post('/tts', async (req, res) => {
  const text = String(req.body?.text || '').trim();
  if (!text) return res.status(400).json({ error: 'Nothing to say' });
  if (text.length > 1200) return res.status(413).json({ error: 'Too long: send at most 1200 characters per request' });
  try {
    const out = await synthesize({ text, variant: req.body?.variant === 'B' ? 'B' : 'A', institutionId: req.user.institution_id || null });
    res.set('Content-Type', out.mimeType);
    res.set('Cache-Control', 'private, max-age=86400');
    res.send(out.audio);
  } catch (err) {
    if (aiNotConfigured(err)) return res.status(503).json({ error: AI_NOT_CONFIGURED });
    req.log?.warn('tts.failed', { error: err.cause?.message || err.message });
    res.status(502).json({ error: 'The voice is unavailable right now.' });
  }
});

router.post('/session/voice', upload.single('audio'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'audio file required (multipart field "audio")' });
  let transcript;
  try {
    transcript = await transcribeAudio({
      audioBase64: req.file.buffer.toString('base64'),
      mimeType: req.file.mimetype || 'audio/webm',
      language: req.user.language
    });
  } catch (err) {
    return res.status(502).json({ error: 'Transcription failed', detail: err.message });
  }
  if (!transcript) return res.status(422).json({ error: 'No speech heard — try again or type instead' });

  // A check answer must be reviewed and submitted explicitly (v4.3 §19): while
  // a check is pending, return the transcript only; the page shows it for
  // editing and the edit share feeds the authenticity gate.
  if (req.body.session_id) {
    const db = getDb();
    const session = await db.prepare('SELECT id FROM learning_sessions WHERE id = ? AND engagement_learner_id = ?').get(req.body.session_id, req.user.el_id);
    const pending = session ? await pendingCheckFor(db, session.id) : null;
    db.close();
    if (pending) return res.json({ transcript, check_pending: true });
  }

  // Reuse the text path; wrap res.json so the transcript rides along.
  req.body = { ...req.body, content: transcript, input_mode: 'voice', provenance: { mode: 'voice', edit_ratio: 0 } };
  const json = res.json.bind(res);
  res.json = (body) => json({ ...body, transcript });
  return await handleSessionMessage(req, res);
});

// ─── Session: active-time heartbeat (v4.3 §6) ─────────────────────────────────
// Posted every 30 s by the session page: { session_id, visible, last_input_at,
// occurred_at }. Time counts only while the tab is visible and the learner gave
// input in the last 3 minutes. Offline-queued heartbeats keep their original
// occurred_at (low-bandwidth mode, §19); a batch may be posted as { beats: [...] }.
router.post('/session/heartbeat', async (req, res) => {
  const beats = Array.isArray(req.body.beats) ? req.body.beats.slice(0, 200) : [req.body];
  let credited = 0;
  const reasons = [];
  await eachSeq(beats, async b => {
    const r = await heartbeat({ sessionId: b.session_id || req.body.session_id, elId: req.user.el_id, occurredAt: b.occurred_at, lastInputAt: b.last_input_at, visible: b.visible !== false });
    credited += r.credited;
    if (r.reason) reasons.push(r.reason);
  });
  res.json({ updated: credited > 0, credited_seconds: credited, ignored: reasons.length, reasons: [...new Set(reasons)] });
});

// ─── Session history ───────────────────────────────────────────────────────────
router.get('/session/:sessionId/history', async (req, res) => {
  const db = getDb();
  const session = await db.prepare('SELECT id FROM learning_sessions WHERE id = ? AND engagement_learner_id = ?').get(req.params.sessionId, req.user.el_id);
  if (!session) { db.close(); return res.status(404).json({ error: 'Session not found' }); }
  const messages = await db.prepare(`SELECT * FROM session_messages WHERE session_id = ? ORDER BY created_at, seq`).all(req.params.sessionId);
  db.close();
  res.json(messages);
});

// ─── Doubts ─────────────────────────────────────────────────────────────────────
router.get('/doubts', async (req, res) => {
  const db = getDb();
  const doubts = await db.prepare('SELECT * FROM doubts WHERE engagement_learner_id = ? ORDER BY created_at DESC').all(req.user.el_id);
  db.close();
  res.json(doubts);
});

router.post('/doubts', async (req, res) => {
  const { skill_node_id, question_text } = req.body;
  if (!question_text) return res.status(400).json({ error: 'question_text required' });

  const db = getDb();
  const el = await db.prepare('SELECT * FROM engagement_learners WHERE id = ?').get(req.user.el_id);
  const nodeId = skill_node_id || (el ? el.current_node_id : null);
  const node = nodeId ? await getNodeWithCluster(db, nodeId) : null;
  db.close();

  try {
    const result = await orchestrator.processMessage({
      requestType: 'DOUBT_QUERY', learnerId: req.user.id, engagementLearnerId: req.user.el_id,
      nodeId: node ? node.id : nodeId, nodeLabel: node ? node.node_label : 'General',
      clusterLabel: node ? node.cluster_label : 'General', language: req.user.language,
      learnerMessage: question_text, sessionState: { clusterId: node ? node.cluster_id : null }
    });

    const writeDb = getDb();
    const doubtId = uuidv4();
    await writeDb.prepare(`
      INSERT INTO doubts (id, engagement_learner_id, skill_node_id, question_text, ai_answer, status)
      VALUES (?, ?, ?, ?, ?, 'answered')
    `).run(doubtId, req.user.el_id, nodeId || null, question_text, result.answer);
    writeDb.close();

    res.status(201).json({ id: doubtId, question_text, ai_answer: result.answer, status: 'answered' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/doubts/:id/escalate', async (req, res) => {
  const db = getDb();
  const doubt = await db.prepare('SELECT * FROM doubts WHERE id = ? AND engagement_learner_id = ?').get(req.params.id, req.user.el_id);
  if (!doubt) { db.close(); return res.status(404).json({ error: 'Not found' }); }
  await db.prepare(`UPDATE doubts SET status = 'escalated' WHERE id = ?`).run(req.params.id);
  db.close();
  res.json({ message: 'Doubt escalated for human review' });
});

// ─── Study plans ────────────────────────────────────────────────────────────────
router.get('/study-plans', async (req, res) => {
  const db = getDb();
  const plans = await db.prepare('SELECT * FROM study_plans WHERE engagement_learner_id = ? ORDER BY planned_date').all(req.user.el_id);
  db.close();
  res.json(plans);
});

router.post('/study-plans', async (req, res) => {
  const { planned_date, planned_duration_minutes, notes } = req.body;
  if (!planned_date) return res.status(400).json({ error: 'planned_date required' });
  const db = getDb();
  const id = uuidv4();
  await db.prepare(`
    INSERT INTO study_plans (id, engagement_learner_id, planned_date, planned_duration_minutes, notes)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, req.user.el_id, planned_date, planned_duration_minutes || 30, notes || null);
  db.close();
  res.status(201).json({ id, message: 'Study plan created' });
});

// ─── Streak ─────────────────────────────────────────────────────────────────────
router.get('/streak', async (req, res) => {
  const db = getDb();
  const streak = await db.prepare('SELECT * FROM streaks WHERE engagement_learner_id = ?').get(req.user.el_id);
  db.close();
  res.json(streak || { current_streak: 0, longest_streak: 0, total_session_days: 0 });
});

// ─── Certificates (derived — no dedicated table) ───────────────────────────────
router.get('/certificates', async (req, res) => {
  const db = getDb();
  const el = await db.prepare('SELECT * FROM engagement_learners WHERE id = ?').get(req.user.el_id);
  const clusters = await db.prepare(`
    SELECT sc.id, sc.cluster_label,
      COUNT(sn.id) as total_nodes,
      SUM(CASE WHEN nm.advanced_at IS NOT NULL THEN 1 ELSE 0 END) as nodes_mastered
    FROM skill_clusters sc
    JOIN skill_nodes sn ON sn.cluster_id = sc.id
    LEFT JOIN node_mastery nm ON nm.skill_node_id = sn.id AND nm.engagement_learner_id = ?
    WHERE sc.capability_target_id = (SELECT capability_target_id FROM engagements WHERE id = ?)
    GROUP BY sc.id
  `).all(req.user.el_id, req.user.engagement_id);
  db.close();

  const clusterCertificates = clusters
    .filter(c => c.total_nodes > 0 && c.nodes_mastered === c.total_nodes)
    .map(c => ({ cluster_label: c.cluster_label, type: 'cluster_certificate' }));

  res.json({
    cluster_certificates: clusterCertificates,
    programme_certificate: el && el.overall_status === 'completed'
  });
});

// ─── Profile ────────────────────────────────────────────────────────────────────
// GET/PUT /profile, resume and skill requests live in portfolio.js.
// ─── Change PIN (required after a printed slip or a reset) ─────────────────────
router.put('/pin', async (req, res) => {
  const { new_pin } = req.body;
  if (!isValidPin(new_pin)) return res.status(400).json({ error: 'Your PIN must be exactly 6 digits.' });
  const db = getDb();
  await db.prepare("UPDATE learners SET pin_hash = ?, pin_must_change = 0, pin_set_at = datetime('now') WHERE id = ?").run(hashPin(new_pin), req.user.id);
  const e = await db.prepare('SELECT institution_id FROM engagements WHERE id = ?').get(req.user.engagement_id);
  if (e) await logEvent(db, { institutionId: e.institution_id, learnerId: req.user.id, elId: req.user.el_id, event: 'pin_set', detail: 'Chose a new PIN after a one-time PIN' });
  db.close();
  res.json({ message: 'PIN updated' });
});

// ─── The learner's professors (what the professor profile preview shows) ──────
router.get('/professors', async (req, res) => {
  const db = getDb();
  const rows = await db.prepare(`
    SELECT u.name, u.title, u.designation, u.department, u.specialisations, u.office_hours, u.photo_data_url, sc.cohort_role
    FROM staff_cohorts sc JOIN institution_users u ON u.id = sc.staff_id
    WHERE sc.engagement_id = ? AND u.status = 'active' AND u.role = 'professor'
    ORDER BY sc.cohort_role = 'lead' DESC, u.name
  `).all(req.user.engagement_id);
  db.close();
  res.json(rows.map(r => ({ ...r, specialisations: r.specialisations ? JSON.parse(r.specialisations) : [] })));
});

router.put('/notifications', async (req, res) => {
  const db = getDb();
  await db.prepare('UPDATE learners SET notification_prefs = ? WHERE id = ?').run(JSON.stringify(req.body || {}), req.user.id);
  db.close();
  res.json({ message: 'Notification preferences updated' });
});

export default router;