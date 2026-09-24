// api/routes/learner.js — Learner Portal
// All routes require JWT authentication. Learner payload: id (learner_id),
// el_id (engagement_learner_id), engagement_id, language.
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../../db/init');
const { authenticateToken, requireRole } = require('../middleware/auth');
const orchestrator = require('../../core/orchestrator');
const { initMemorySchema } = require('../../core/stores/learnerMemoryStore');
const { initCulturalSchema, seedInitialExamples } = require('../../core/stores/culturalStore');
const { initRubricSchema } = require('../../core/stores/rubricStore');
const { calculateMasteryAttainment, calculateConfidenceIndicator, selectNextApproach } = require('../../core/instructionEngine');

const router = express.Router();

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

  db.close();
  res.json({
    ...el,
    total_nodes: totalNodes.cnt,
    progress_pct: totalNodes.cnt > 0 ? Math.round((el.nodes_mastered / totalNodes.cnt) * 100) : 0,
    streak: streak || { current_streak: 0, longest_streak: 0 }
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
  res.json(records.map(r => ({
    ...r,
    confidence_label: r.confidence_indicator >= 0.75 ? 'high' : r.confidence_indicator >= 0.55 ? 'solid' : 'building'
  })));
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
    SELECT role, content, message_type FROM session_messages WHERE session_id = ? ORDER BY created_at
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
      INSERT INTO session_messages (id, session_id, role, content, message_type)
      VALUES (?, ?, 'ai', ?, 'diagnosis')
    `).run(uuidv4(), session.id, result.message);
    msgDb.close();

    res.json({
      session_id: session.id, node_label: node.node_label, cluster_label: node.cluster_label,
      language: req.user.language, approach: session.current_approach, loop_count: session.loop_count,
      message: result.message, decision: 'DIAGNOSE',
      history: [{ role: 'ai', content: result.message, message_type: 'diagnosis' }]
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to start session', detail: err.message });
  }
});

// ─── Session: primary interaction endpoint ────────────────────────────────────
// Routes to DIAGNOSIS_RESPONSE, LEARNER_MESSAGE, or CHECK_RESPONSE based on
// the last AI message's type in this session.
async function handleSessionMessage(req, res) {
  const { content } = req.body;
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
    INSERT INTO session_messages (id, session_id, role, content, message_type)
    VALUES (?, ?, 'learner', ?, 'response')
  `).run(uuidv4(), session.id, content);
  db.close();

  let requestType;
  if (!lastAiMsg || lastAiMsg.message_type === 'diagnosis') requestType = 'DIAGNOSIS_RESPONSE';
  else if (lastAiMsg.message_type === 'mastery_check' && pendingCheck) requestType = 'CHECK_RESPONSE';
  else requestType = 'LEARNER_MESSAGE';

  const sessionState = {
    clusterId: node.cluster_id, loopCount: session.loop_count, currentApproach: session.current_approach,
    approachesUsed, behaviourSignal: session.behaviour_signal,
    checkQuestion: pendingCheck ? pendingCheck.question_text : null
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
    INSERT INTO session_messages (id, session_id, role, content, message_type)
    VALUES (?, ?, 'ai', ?, ?)
  `).run(uuidv4(), session.id, result.message, msgType);

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
    session_id: session.id, message: result.message, decision: result.decision,
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
    INSERT INTO session_messages (id, session_id, role, content, message_type)
    VALUES (?, ?, 'ai', ?, ?)
  `).run(uuidv4(), session.id, result.message, result.decision === 'ADVANCE' ? 'advance_trigger' : 'loop_trigger');

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
      feedback: evaluation.feedbackForLearner, message: result.message,
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
    message: result.message, next_approach: result.nextApproach, loop_count: session.loop_count + 1
  });
}

router.post('/session/message', handleSessionMessage);
router.post('/session/check', handleSessionMessage); // alias for backwards compatibility

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
router.get('/profile', (req, res) => {
  const db = getDb();
  const learner = db.prepare(`
    SELECT l.id, l.name, l.email, l.learner_ref, l.language, l.profile_type, l.notification_prefs,
           e.title as engagement_title
    FROM learners l
    JOIN engagement_learners el ON el.learner_id = l.id
    JOIN engagements e ON e.id = el.engagement_id
    WHERE l.id = ? AND el.id = ?
  `).get(req.user.id, req.user.el_id);
  db.close();
  if (!learner) return res.status(404).json({ error: 'Not found' });
  res.json({ ...learner, notification_prefs: learner.notification_prefs ? JSON.parse(learner.notification_prefs) : {} });
});

router.put('/notifications', (req, res) => {
  const db = getDb();
  db.prepare('UPDATE learners SET notification_prefs = ? WHERE id = ?').run(JSON.stringify(req.body || {}), req.user.id);
  db.close();
  res.json({ message: 'Notification preferences updated' });
});

module.exports = router;
