// api/routes/learner.js — Learner Portal
// All routes require JWT authentication. Learner payload: id (learner_id),
// el_id (engagement_learner_id), engagement_id, language.
const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../../db/init');
const { authenticateToken, requireRole, requireActiveLearner } = require('../middleware/auth');
const orchestrator = require('../../core/orchestrator');
const { initMemorySchema } = require('../../core/stores/learnerMemoryStore');
const { initCulturalSchema, seedInitialExamples } = require('../../core/stores/culturalStore');
const { initRubricSchema } = require('../../core/stores/rubricStore');
const { calculateMasteryAttainment, calculateConfidenceIndicator, selectNextApproach } = require('../../core/instructionEngine');
const { transcribeAudio } = require('../../core/portfolio');
const { isValidPin, hashPin, logEvent } = require('../../core/access');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const confidenceLabel = (c) => (c >= 0.75 ? 'high' : c >= 0.55 ? 'solid' : 'building');

// ─── Multi-brain store initialisation ─────────────────────────────────────────
// Runs on module load. All IF NOT EXISTS operations — safe on every startup.
(function initMultiBrainStores() {
  const db = getDb();
  initMemorySchema(db);
  initCulturalSchema(db);
  initRubricSchema(db);
  seedInitialExamples(db);
  db.close();
})();

router.use(authenticateToken);
router.use(requireRole('learner', 'admin'));
router.use(requireActiveLearner);

// ─── Streak logic (doc section 11.4) ──────────────────────────────────────────
function updateStreak(db, elId) {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const existing = db.prepare('SELECT * FROM streaks WHERE engagement_learner_id = ?').get(elId);

  if (!existing) {
    db.prepare(`
      INSERT INTO streaks (id, engagement_learner_id, current_streak, longest_streak, total_session_days, last_session_date)
      VALUES (?, ?, 1, 1, 1, ?)
    `).run(uuidv4(), elId, today);
    return;
  }
  if (existing.last_session_date === today) return; // already counted today

  const newStreak = existing.last_session_date === yesterday ? existing.current_streak + 1 : 1;
  db.prepare(`
    UPDATE streaks SET current_streak = ?, longest_streak = MAX(longest_streak, ?),
      total_session_days = total_session_days + 1, last_session_date = ?
    WHERE engagement_learner_id = ?
  `).run(newStreak, newStreak, today, elId);
}

function getNodeWithCluster(db, nodeId) {
  return db.prepare(`
    SELECT sn.*, sc.cluster_label FROM skill_nodes sn
    JOIN skill_clusters sc ON sc.id = sn.cluster_id
    WHERE sn.id = ?
  `).get(nodeId);
}

// ─── GET dashboard ─────────────────────────────────────────────────────────────
router.get('/dashboard', (req, res) => {
  const db = getDb();
  const el = db.prepare(`
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

  const totalNodes = db.prepare(`
    SELECT COUNT(*) as cnt FROM skill_nodes sn
    JOIN skill_clusters sc ON sc.id = sn.cluster_id
    JOIN capability_targets ct ON ct.id = sc.capability_target_id
    JOIN engagements e ON e.capability_target_id = ct.id
    WHERE e.id = ?
  `).get(req.user.engagement_id);

  const streak = db.prepare('SELECT current_streak, longest_streak FROM streaks WHERE engagement_learner_id = ?').get(req.user.el_id);

  // "Continue learning" card: where the current node sits in the path, its
  // estimated time, and how the last session on it went.
  const pathNodes = db.prepare(`
    SELECT sn.id, sn.estimated_minutes, sc.id as cluster_id FROM skill_nodes sn
    JOIN skill_clusters sc ON sc.id = sn.cluster_id
    WHERE sc.capability_target_id = (SELECT capability_target_id FROM engagements WHERE id = ?)
    ORDER BY sc.sequence_order, sn.sequence_order
  `).all(req.user.engagement_id);
  const currentIndex = pathNodes.findIndex(n => n.id === el.current_node_id);
  const lastSession = el.current_node_id ? db.prepare(`
    SELECT current_approach, loop_count FROM learning_sessions
    WHERE engagement_learner_id = ? AND skill_node_id = ? ORDER BY started_at DESC LIMIT 1
  `).get(req.user.el_id, el.current_node_id) : null;
  const mastered = new Set(db.prepare('SELECT skill_node_id FROM node_mastery WHERE engagement_learner_id = ? AND advanced_at IS NOT NULL')
    .all(req.user.el_id).map(r => r.skill_node_id));
  const clusterIds = [...new Set(pathNodes.map(n => n.cluster_id))];
  const clustersDone = clusterIds.filter(cid => pathNodes.filter(n => n.cluster_id === cid).every(n => mastered.has(n.id))).length;
  const week = db.prepare(`
    SELECT COALESCE(SUM(active_minutes), 0) as minutes FROM learning_sessions
    WHERE engagement_learner_id = ? AND started_at >= datetime('now', '-7 days')
  `).get(req.user.el_id);
  const recent = db.prepare(`
    SELECT sn.node_label FROM node_mastery nm JOIN skill_nodes sn ON sn.id = nm.skill_node_id
    WHERE nm.engagement_learner_id = ? AND nm.advanced_at IS NOT NULL ORDER BY nm.advanced_at DESC LIMIT 8
  `).all(req.user.el_id).map(r => r.node_label);

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
router.get('/progress', (req, res) => {
  const db = getDb();
  const records = db.prepare(`
    SELECT nm.*, sn.node_label, sc.cluster_label
    FROM node_mastery nm
    JOIN skill_nodes sn ON sn.id = nm.skill_node_id
    JOIN skill_clusters sc ON sc.id = sn.cluster_id
    WHERE nm.engagement_learner_id = ?
    ORDER BY nm.advanced_at
  `).all(req.user.el_id);
  db.close();
  res.json(records.map(r => ({ ...r, confidence_label: confidenceLabel(r.confidence_indicator) })));
});

// ─── GET mastered nodes only (dashboard "Recently mastered", resume) ──────────
router.get('/mastery-record', (req, res) => {
  const db = getDb();
  const records = db.prepare(`
    SELECT sn.node_label, sc.cluster_label, nm.mastery_attainment, nm.attempt_count,
           nm.time_to_mastery_minutes, nm.confidence_indicator, nm.advanced_at
    FROM node_mastery nm
    JOIN skill_nodes sn ON sn.id = nm.skill_node_id
    JOIN skill_clusters sc ON sc.id = sn.cluster_id
    WHERE nm.engagement_learner_id = ? AND nm.advanced_at IS NOT NULL
    ORDER BY nm.advanced_at DESC
  `).all(req.user.el_id);
  db.close();
  res.json(records.map(r => ({ ...r, confidence_label: confidenceLabel(r.confidence_indicator) })));
});

// ─── GET the learner's own skill path & record (/learn/record) ────────────────
// The learner-facing view of what the institution sees in the Mastery Log:
// every cluster and node with its status, plus evidence for mastered nodes.
// Session content, check questions and evaluations stay proprietary.
router.get('/path', (req, res) => {
  const db = getDb();
  const el = db.prepare(`
    SELECT el.current_node_id, el.overall_status, e.title as engagement_title
    FROM engagement_learners el JOIN engagements e ON e.id = el.engagement_id WHERE el.id = ?
  `).get(req.user.el_id);
  if (!el) { db.close(); return res.status(404).json({ error: 'Not found' }); }

  const rows = db.prepare(`
    SELECT sc.id as cluster_id, sc.cluster_label, sc.cluster_ref, sn.id as node_id, sn.node_label, sn.estimated_minutes,
           nm.mastery_attainment, nm.attempt_count, nm.time_to_mastery_minutes, nm.confidence_indicator, nm.advanced_at
    FROM skill_clusters sc
    JOIN skill_nodes sn ON sn.cluster_id = sc.id
    LEFT JOIN node_mastery nm ON nm.skill_node_id = sn.id AND nm.engagement_learner_id = ?
    WHERE sc.capability_target_id = (SELECT capability_target_id FROM engagements WHERE id = ?)
    ORDER BY sc.sequence_order, sn.sequence_order
  `).all(req.user.el_id, req.user.engagement_id);
  const time = db.prepare('SELECT COALESCE(SUM(active_minutes), 0) as minutes FROM learning_sessions WHERE engagement_learner_id = ?').get(req.user.el_id);
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
  const el = db.prepare('SELECT * FROM engagement_learners WHERE id = ?').get(req.user.el_id);
  if (!el || !el.current_node_id) { db.close(); return res.status(400).json({ error: 'No active skill node' }); }

  const node = getNodeWithCluster(db, el.current_node_id);

  let session = db.prepare(`
    SELECT * FROM learning_sessions
    WHERE engagement_learner_id = ? AND skill_node_id = ? AND status = 'active'
    ORDER BY started_at DESC LIMIT 1
  `).get(el.id, el.current_node_id);

  const approachesUsed = db.prepare(`
    SELECT approach FROM loop_approaches_used WHERE engagement_learner_id = ? AND skill_node_id = ?
  `).all(el.id, el.current_node_id).map(r => r.approach);

  if (!session) {
    const sessionId = uuidv4();
    const approach = approachesUsed.length === 0 ? 'native_concept' : selectNextApproach(approachesUsed);
    db.prepare(`
      INSERT INTO learning_sessions (id, engagement_learner_id, skill_node_id, session_number, language, loop_count, current_approach, behaviour_signal)
      VALUES (?, ?, ?, 1, ?, 0, ?, 'engaged')
    `).run(sessionId, el.id, el.current_node_id, req.user.language, approach);
    session = db.prepare('SELECT * FROM learning_sessions WHERE id = ?').get(sessionId);
  }

  const history = db.prepare(`
    SELECT role, content, message_type, caption_en, mermaid, code, input_mode FROM session_messages WHERE session_id = ? ORDER BY created_at
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
    msgDb.prepare(`
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
    res.status(500).json({ error: 'Failed to start session', detail: err.message });
  }
});

// ─── Session: primary interaction endpoint ────────────────────────────────────
// Routes to DIAGNOSIS_RESPONSE, LEARNER_MESSAGE, or CHECK_RESPONSE based on
// the last AI message's type in this session.
// Optional body fields: input_mode ('voice' | 'text') is stored with the
// learner's message; request_check: true is the "I'm ready for the check"
// button — TEACH is told to set the check this turn (content may be empty).
async function handleSessionMessage(req, res) {
  const requestCheck = req.body.request_check === true || req.body.request_check === 'true';
  const inputMode = ['voice', 'text'].includes(req.body.input_mode) ? req.body.input_mode : 'text';
  const content = (req.body.content || '').trim() || (requestCheck ? "I'm ready for the mastery check." : '');
  let { session_id } = req.body;
  if (!content) return res.status(400).json({ error: 'content required' });

  const db = getDb();

  if (!session_id) {
    const el = db.prepare('SELECT * FROM engagement_learners WHERE id = ?').get(req.user.el_id);
    const active = el && el.current_node_id
      ? db.prepare(`SELECT * FROM learning_sessions WHERE engagement_learner_id = ? AND skill_node_id = ? AND status = 'active' ORDER BY started_at DESC LIMIT 1`).get(el.id, el.current_node_id)
      : null;
    session_id = active ? active.id : null;
  }

  const session = session_id
    ? db.prepare('SELECT * FROM learning_sessions WHERE id = ? AND engagement_learner_id = ?').get(session_id, req.user.el_id)
    : null;
  if (!session) { db.close(); return res.status(404).json({ error: 'No active session found — call /session/start first' }); }

  const node = getNodeWithCluster(db, session.skill_node_id);
  const lastAiMsg = db.prepare(`
    SELECT * FROM session_messages WHERE session_id = ? AND role = 'ai' ORDER BY created_at DESC LIMIT 1
  `).get(session.id);
  const approachesUsed = db.prepare(`
    SELECT approach FROM loop_approaches_used WHERE engagement_learner_id = ? AND skill_node_id = ?
  `).all(req.user.el_id, session.skill_node_id).map(r => r.approach);
  const pendingCheck = db.prepare(`
    SELECT * FROM mastery_checks WHERE session_id = ? AND passed IS NULL ORDER BY created_at DESC LIMIT 1
  `).get(session.id);

  db.prepare(`
    INSERT INTO session_messages (id, session_id, role, content, message_type, input_mode)
    VALUES (?, ?, 'learner', ?, 'response', ?)
  `).run(uuidv4(), session.id, content, inputMode);
  db.close();

  let requestType;
  if (!lastAiMsg || lastAiMsg.message_type === 'diagnosis') requestType = 'DIAGNOSIS_RESPONSE';
  else if (lastAiMsg.message_type === 'mastery_check' && pendingCheck) requestType = 'CHECK_RESPONSE';
  else requestType = 'LEARNER_MESSAGE';

  const sessionState = {
    clusterId: node.cluster_id, loopCount: session.loop_count, currentApproach: session.current_approach,
    approachesUsed, behaviourSignal: session.behaviour_signal,
    checkQuestion: pendingCheck ? pendingCheck.question_text : null,
    learnerRequestedCheck: requestCheck && requestType === 'LEARNER_MESSAGE'
  };

  try {
    const result = await orchestrator.processMessage({
      requestType, learnerId: req.user.id, engagementLearnerId: req.user.el_id, sessionId: session.id,
      nodeId: node.id, nodeLabel: node.node_label, clusterLabel: node.cluster_label,
      language: req.user.language, learnerMessage: content, sessionState
    });

    if (requestType === 'CHECK_RESPONSE') return handleCheckResult({ res, session, result, learnerResponse: content, pendingCheck });
    return handleInstructionResult({ res, session, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

function handleInstructionResult({ res, session, result }) {
  const db = getDb();
  const msgType = result.decision === 'CHECK' ? 'mastery_check' : 'instruction';

  db.prepare(`
    INSERT INTO session_messages (id, session_id, role, content, message_type, caption_en, mermaid, code)
    VALUES (?, ?, 'ai', ?, ?, ?, ?, ?)
  `).run(uuidv4(), session.id, result.message, msgType, result.captionEn || null, result.mermaid || null, result.code || null);

  if (result.approach) {
    db.prepare(`
      INSERT OR IGNORE INTO loop_approaches_used (id, engagement_learner_id, skill_node_id, approach)
      VALUES (?, ?, ?, ?)
    `).run(uuidv4(), session.engagement_learner_id, session.skill_node_id, result.approach);
    db.prepare(`UPDATE learning_sessions SET current_approach = ?, behaviour_signal = ? WHERE id = ?`)
      .run(result.approach, result.behaviourSignal || session.behaviour_signal, session.id);
  } else {
    db.prepare(`UPDATE learning_sessions SET behaviour_signal = ? WHERE id = ?`)
      .run(result.behaviourSignal || session.behaviour_signal, session.id);
  }

  if (msgType === 'mastery_check' && result.checkQuestion) {
    const checkCount = db.prepare('SELECT COUNT(*) as cnt FROM mastery_checks WHERE session_id = ?').get(session.id).cnt;
    db.prepare(`
      INSERT INTO mastery_checks (id, session_id, skill_node_id, engagement_learner_id, check_number, question_text)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), session.id, session.skill_node_id, session.engagement_learner_id, checkCount + 1, result.checkQuestion);
  }

  db.close();
  res.json({
    session_id: session.id, message: result.message, caption_en: result.captionEn || null, decision: result.decision,
    check_question: result.checkQuestion || null, mermaid: result.mermaid || null, code: result.code || null,
    behaviour_signal: result.behaviourSignal, approach: result.approach || session.current_approach
  });
}

function handleCheckResult({ res, session, result, learnerResponse, pendingCheck }) {
  const db = getDb();
  const evaluation = result.evaluation;

  db.prepare(`
    UPDATE mastery_checks SET learner_response = ?, passed = ?, score = ?, ai_evaluation = ?, evaluated_at = datetime('now')
    WHERE id = ?
  `).run(learnerResponse, evaluation.passed ? 1 : 0, evaluation.score, evaluation.evaluation, pendingCheck.id);

  db.prepare(`
    INSERT INTO session_messages (id, session_id, role, content, message_type, caption_en, mermaid, code)
    VALUES (?, ?, 'ai', ?, ?, ?, ?, ?)
  `).run(uuidv4(), session.id, result.message, result.decision === 'ADVANCE' ? 'advance_trigger' : 'loop_trigger',
    result.captionEn || null, result.mermaid || null, result.code || null);

  if (result.decision === 'ADVANCE') {
    const allChecks = db.prepare(`
      SELECT score, passed FROM mastery_checks
      WHERE engagement_learner_id = ? AND skill_node_id = ? AND passed IS NOT NULL ORDER BY created_at
    `).all(session.engagement_learner_id, session.skill_node_id).map(c => ({ score: c.score, passed: !!c.passed }));

    const masteryAttainment = calculateMasteryAttainment(allChecks);
    const confidenceIndicator = calculateConfidenceIndicator(allChecks, session.loop_count);
    const timeToMastery = (Date.now() - new Date(session.started_at).getTime()) / 60000;

    db.prepare(`
      INSERT INTO node_mastery (id, engagement_learner_id, skill_node_id, mastery_attainment, time_to_mastery_minutes, attempt_count, confidence_indicator, advanced_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(engagement_learner_id, skill_node_id) DO UPDATE SET
        mastery_attainment = excluded.mastery_attainment, time_to_mastery_minutes = excluded.time_to_mastery_minutes,
        attempt_count = excluded.attempt_count, confidence_indicator = excluded.confidence_indicator, advanced_at = datetime('now')
    `).run(uuidv4(), session.engagement_learner_id, session.skill_node_id, masteryAttainment, timeToMastery, allChecks.length, confidenceIndicator);

    db.prepare(`UPDATE learning_sessions SET status = 'completed', completed_at = datetime('now'), behaviour_signal = 'accelerating' WHERE id = ?`).run(session.id);

    const nextNode = db.prepare(`
      SELECT sn.* FROM skill_nodes sn
      WHERE sn.cluster_id = (SELECT cluster_id FROM skill_nodes WHERE id = ?)
      AND sn.sequence_order > (SELECT sequence_order FROM skill_nodes WHERE id = ?)
      ORDER BY sn.sequence_order LIMIT 1
    `).get(session.skill_node_id, session.skill_node_id);

    let advanceTo = nextNode;
    if (!advanceTo) {
      const currentCluster = db.prepare('SELECT cluster_id FROM skill_nodes WHERE id = ?').get(session.skill_node_id);
      const nextCluster = db.prepare(`
        SELECT sc.id FROM skill_clusters sc
        WHERE sc.capability_target_id = (SELECT capability_target_id FROM skill_clusters WHERE id = ?)
        AND sc.sequence_order > (SELECT sequence_order FROM skill_clusters WHERE id = ?)
        ORDER BY sc.sequence_order LIMIT 1
      `).get(currentCluster.cluster_id, currentCluster.cluster_id);
      if (nextCluster) {
        advanceTo = db.prepare('SELECT * FROM skill_nodes WHERE cluster_id = ? ORDER BY sequence_order LIMIT 1').get(nextCluster.id);
      }
    }

    if (advanceTo) {
      db.prepare(`UPDATE engagement_learners SET current_node_id = ?, current_cluster_id = ? WHERE id = ?`)
        .run(advanceTo.id, advanceTo.cluster_id, session.engagement_learner_id);
    } else {
      db.prepare(`UPDATE engagement_learners SET overall_status = 'completed' WHERE id = ?`).run(session.engagement_learner_id);
    }

    updateStreak(db, session.engagement_learner_id);
    db.close();

    return res.json({
      result: 'advance', decision: 'ADVANCE', passed: true, score: evaluation.score,
      feedback: evaluation.feedbackForLearner, message: result.message, caption_en: result.captionEn || null,
      mermaid: result.mermaid || null, code: result.code || null,
      mastery_increment: result.masteryIncrement, mastery_attainment: Math.round(masteryAttainment * 100),
      confidence_indicator: parseFloat(confidenceIndicator.toFixed(2)),
      next_node: advanceTo ? { id: advanceTo.id, label: advanceTo.node_label } : null,
      programme_complete: !advanceTo
    });
  }

  // ── LOOP ──────────────────────────────────────────────────────────────────
  db.prepare(`
    INSERT OR IGNORE INTO loop_approaches_used (id, engagement_learner_id, skill_node_id, approach)
    VALUES (?, ?, ?, ?)
  `).run(uuidv4(), session.engagement_learner_id, session.skill_node_id, session.current_approach);

  db.prepare(`
    UPDATE learning_sessions SET loop_count = loop_count + 1, current_approach = ?, behaviour_signal = 'confused' WHERE id = ?
  `).run(result.nextApproach, session.id);

  db.close();
  res.json({
    result: 'loop', decision: 'LOOP', passed: false, score: evaluation.score,
    feedback: evaluation.feedbackForLearner, understanding_gaps: evaluation.understandingGaps,
    message: result.message, caption_en: result.captionEn || null, mermaid: result.mermaid || null, code: result.code || null,
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

  // Reuse the text path; wrap res.json so the transcript rides along.
  req.body = { ...req.body, content: transcript, input_mode: 'voice' };
  const json = res.json.bind(res);
  res.json = (body) => json({ ...body, transcript });
  return handleSessionMessage(req, res);
});

// ─── Session: active-time heartbeat ────────────────────────────────────────────
// The session page posts { session_id, minutes } about once a minute while it
// is visible, so "time this week" counts active instruction time, not
// calendar time. Capped per call so a stuck client cannot inflate it.
router.post('/session/heartbeat', (req, res) => {
  const minutes = Math.min(Math.max(parseFloat(req.body.minutes) || 0, 0), 2);
  const db = getDb();
  const r = db.prepare(`
    UPDATE learning_sessions SET active_minutes = active_minutes + ?
    WHERE id = ? AND engagement_learner_id = ? AND status = 'active'
  `).run(minutes, req.body.session_id, req.user.el_id);
  db.close();
  res.json({ updated: r.changes > 0 });
});

// ─── Session history ───────────────────────────────────────────────────────────
router.get('/session/:sessionId/history', (req, res) => {
  const db = getDb();
  const session = db.prepare('SELECT id FROM learning_sessions WHERE id = ? AND engagement_learner_id = ?').get(req.params.sessionId, req.user.el_id);
  if (!session) { db.close(); return res.status(404).json({ error: 'Session not found' }); }
  const messages = db.prepare(`SELECT * FROM session_messages WHERE session_id = ? ORDER BY created_at`).all(req.params.sessionId);
  db.close();
  res.json(messages);
});

// ─── Doubts ─────────────────────────────────────────────────────────────────────
router.get('/doubts', (req, res) => {
  const db = getDb();
  const doubts = db.prepare('SELECT * FROM doubts WHERE engagement_learner_id = ? ORDER BY created_at DESC').all(req.user.el_id);
  db.close();
  res.json(doubts);
});

router.post('/doubts', async (req, res) => {
  const { skill_node_id, question_text } = req.body;
  if (!question_text) return res.status(400).json({ error: 'question_text required' });

  const db = getDb();
  const el = db.prepare('SELECT * FROM engagement_learners WHERE id = ?').get(req.user.el_id);
  const nodeId = skill_node_id || (el ? el.current_node_id : null);
  const node = nodeId ? getNodeWithCluster(db, nodeId) : null;
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
    writeDb.prepare(`
      INSERT INTO doubts (id, engagement_learner_id, skill_node_id, question_text, ai_answer, status)
      VALUES (?, ?, ?, ?, ?, 'answered')
    `).run(doubtId, req.user.el_id, nodeId || null, question_text, result.answer);
    writeDb.close();

    res.status(201).json({ id: doubtId, question_text, ai_answer: result.answer, status: 'answered' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/doubts/:id/escalate', (req, res) => {
  const db = getDb();
  const doubt = db.prepare('SELECT * FROM doubts WHERE id = ? AND engagement_learner_id = ?').get(req.params.id, req.user.el_id);
  if (!doubt) { db.close(); return res.status(404).json({ error: 'Not found' }); }
  db.prepare(`UPDATE doubts SET status = 'escalated' WHERE id = ?`).run(req.params.id);
  db.close();
  res.json({ message: 'Doubt escalated for human review' });
});

// ─── Study plans ────────────────────────────────────────────────────────────────
router.get('/study-plans', (req, res) => {
  const db = getDb();
  const plans = db.prepare('SELECT * FROM study_plans WHERE engagement_learner_id = ? ORDER BY planned_date').all(req.user.el_id);
  db.close();
  res.json(plans);
});

router.post('/study-plans', (req, res) => {
  const { planned_date, planned_duration_minutes, notes } = req.body;
  if (!planned_date) return res.status(400).json({ error: 'planned_date required' });
  const db = getDb();
  const id = uuidv4();
  db.prepare(`
    INSERT INTO study_plans (id, engagement_learner_id, planned_date, planned_duration_minutes, notes)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, req.user.el_id, planned_date, planned_duration_minutes || 30, notes || null);
  db.close();
  res.status(201).json({ id, message: 'Study plan created' });
});

// ─── Streak ─────────────────────────────────────────────────────────────────────
router.get('/streak', (req, res) => {
  const db = getDb();
  const streak = db.prepare('SELECT * FROM streaks WHERE engagement_learner_id = ?').get(req.user.el_id);
  db.close();
  res.json(streak || { current_streak: 0, longest_streak: 0, total_session_days: 0 });
});

// ─── Certificates (derived — no dedicated table) ───────────────────────────────
router.get('/certificates', (req, res) => {
  const db = getDb();
  const el = db.prepare('SELECT * FROM engagement_learners WHERE id = ?').get(req.user.el_id);
  const clusters = db.prepare(`
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
router.put('/pin', (req, res) => {
  const { new_pin } = req.body;
  if (!isValidPin(new_pin)) return res.status(400).json({ error: 'Your PIN must be exactly 6 digits.' });
  const db = getDb();
  db.prepare("UPDATE learners SET pin_hash = ?, pin_must_change = 0, pin_set_at = datetime('now') WHERE id = ?").run(hashPin(new_pin), req.user.id);
  const e = db.prepare('SELECT institution_id FROM engagements WHERE id = ?').get(req.user.engagement_id);
  if (e) logEvent(db, { institutionId: e.institution_id, learnerId: req.user.id, elId: req.user.el_id, event: 'pin_set', detail: 'Chose a new PIN after a one-time PIN' });
  db.close();
  res.json({ message: 'PIN updated' });
});

// ─── The learner's professors (what the professor profile preview shows) ──────
router.get('/professors', (req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT u.name, u.title, u.designation, u.department, u.specialisations, u.office_hours, u.photo_data_url, sc.cohort_role
    FROM staff_cohorts sc JOIN institution_users u ON u.id = sc.staff_id
    WHERE sc.engagement_id = ? AND u.status = 'active' AND u.role = 'professor'
    ORDER BY sc.cohort_role = 'lead' DESC, u.name
  `).all(req.user.engagement_id);
  db.close();
  res.json(rows.map(r => ({ ...r, specialisations: r.specialisations ? JSON.parse(r.specialisations) : [] })));
});

router.put('/notifications', (req, res) => {
  const db = getDb();
  db.prepare('UPDATE learners SET notification_prefs = ? WHERE id = ?').run(JSON.stringify(req.body || {}), req.user.id);
  db.close();
  res.json({ message: 'Notification preferences updated' });
});

module.exports = router;
