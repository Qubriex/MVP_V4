// api/routes/admin.js — Inferexaa admin portal (Qubirex platform)
const express = require('express');
const { getDb } = require('../../db/init');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { getMasteryLog } = require('../../core/masteryLog');

const router = express.Router();

// The first admin account is created via `node scripts/seed-admin.js`
// (server shell access only) — never as an HTTP route. An HTTP bootstrap
// route, even one gated by comparing a request-body value to JWT_SECRET,
// means anyone who can guess or intercept that secret can mint themselves
// an admin account over the network.

router.use(authenticateToken);
router.use(requireRole('admin'));

// ─── Dashboard stats ──────────────────────────────────────────────────────────
router.get('/stats', (req, res) => {
  const db = getDb();
  const stats = {
    institutions: db.prepare('SELECT COUNT(*) as cnt FROM institutions').get().cnt,
    learners: db.prepare('SELECT COUNT(*) as cnt FROM learners').get().cnt,
    engagements: db.prepare('SELECT COUNT(*) as cnt FROM engagements').get().cnt,
    active_engagements: db.prepare("SELECT COUNT(*) as cnt FROM engagements WHERE status = 'active'").get().cnt,
    mastery_logs_produced: db.prepare('SELECT COUNT(*) as cnt FROM mastery_logs').get().cnt,
    sessions_total: db.prepare('SELECT COUNT(*) as cnt FROM learning_sessions').get().cnt,
    checks_passed: db.prepare("SELECT COUNT(*) as cnt FROM mastery_checks WHERE passed = 1").get().cnt,
    checks_failed: db.prepare("SELECT COUNT(*) as cnt FROM mastery_checks WHERE passed = 0").get().cnt,
    avg_mastery: db.prepare('SELECT AVG(mastery_attainment) as avg FROM node_mastery WHERE mastery_attainment IS NOT NULL').get().avg,
    avg_loops: db.prepare('SELECT AVG(loop_count) as avg FROM learning_sessions').get().avg
  };
  db.close();
  res.json(stats);
});

// ─── List all institutions ────────────────────────────────────────────────────
router.get('/institutions', (req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT i.*, COUNT(DISTINCT e.id) as engagement_count, COUNT(DISTINCT l.id) as learner_count
    FROM institutions i
    LEFT JOIN engagements e ON e.institution_id = i.id
    LEFT JOIN learners l ON l.institution_id = i.id
    GROUP BY i.id ORDER BY i.created_at DESC
  `).all();
  db.close();
  res.json(rows);
});

// ─── Get a Mastery Log ────────────────────────────────────────────────────────
router.get('/mastery-logs/:id', (req, res) => {
  const log = getMasteryLog(req.params.id);
  if (!log) return res.status(404).json({ error: 'Not found' });
  res.json(log);
});

// ─── Instruction quality report ───────────────────────────────────────────────
router.get('/quality-report', (req, res) => {
  const db = getDb();
  const nodeStats = db.prepare(`
    SELECT sn.node_label, sc.cluster_label,
      COUNT(DISTINCT nm.engagement_learner_id) as learners_attempted,
      AVG(nm.mastery_attainment) as avg_mastery,
      AVG(nm.attempt_count) as avg_attempts,
      AVG(nm.time_to_mastery_minutes) as avg_time_minutes,
      AVG(nm.confidence_indicator) as avg_confidence
    FROM node_mastery nm
    JOIN skill_nodes sn ON sn.id = nm.skill_node_id
    JOIN skill_clusters sc ON sc.id = sn.cluster_id
    GROUP BY nm.skill_node_id
    ORDER BY avg_attempts DESC
  `).all();

  const loopStats = db.prepare(`
    SELECT current_approach, COUNT(*) as usage_count,
      AVG(loop_count) as avg_loops
    FROM learning_sessions GROUP BY current_approach
  `).all();

  db.close();
  res.json({
    node_difficulty_ranking: nodeStats,
    approach_effectiveness: loopStats,
    note: 'High avg_attempts on a node signals a potential explanation-architecture issue, not learner failure'
  });
});

module.exports = router;
