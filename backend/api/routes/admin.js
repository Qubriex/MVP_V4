// api/routes/admin.js — Inferexaa admin portal (Qubirex platform)
import express from 'express';
import { legacyHandle as getDb } from '../../core/db/dal.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { getMasteryLog, nodeConfidence } from '../../core/masteryLog.js';
import { calibrationRegister } from '../../config/params.js';
import * as dal from '../../core/db/dal.js';
import { listSkills, addAlias, createSkill, getSkill, addPrereq } from '../../core/graph/ontology.js';
import { mapPathway } from '../../core/graph/coverage.js';

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
    SELECT nm.skill_node_id, sn.node_label, sc.cluster_label,
      COUNT(DISTINCT nm.engagement_learner_id) as learners_attempted,
      AVG(nm.mastery_attainment) as avg_mastery,
      AVG(nm.attempt_count) as avg_attempts,
      AVG(nm.time_to_mastery_minutes) as avg_time_minutes
    FROM node_mastery nm
    JOIN skill_nodes sn ON sn.id = nm.skill_node_id
    JOIN skill_clusters sc ON sc.id = sn.cluster_id
    GROUP BY nm.skill_node_id
    ORDER BY avg_attempts DESC
  `).all().map(row => {
    // Confidence is computed from the checks, never stored.
    const els = db.prepare('SELECT engagement_learner_id FROM node_mastery WHERE skill_node_id = ?').all(row.skill_node_id);
    const avg = els.reduce((sum, r) => sum + nodeConfidence(db, r.engagement_learner_id, row.skill_node_id), 0) / (els.length || 1);
    return { ...row, avg_confidence: avg };
  });

  const loopStats = db.prepare(`
    SELECT current_approach, COUNT(*) as usage_count,
      AVG(loop_count) as avg_loops
    FROM learning_sessions GROUP BY current_approach
  `).all();

  db.close();
  res.json({
    node_difficulty_ranking: nodeStats,
    approach_effectiveness: loopStats,
    calibration_register: calibrationRegister(),   // v4.3 Appendix A.1
    note: 'High avg_attempts on a node signals a potential explanation-architecture issue, not learner failure'
  });
});

// ─── Capability Graph: ontology and review queue (v4.3 §3) ──────────────────
router.get('/skills', (req, res) => {
  res.json({ skills: listSkills() });
});

router.get('/ontology-review', (req, res) => {
  const status = ['pending', 'aliased', 'created', 'rejected'].includes(req.query.status) ? req.query.status : 'pending';
  const items = dal.all('SELECT * FROM ontology_review_queue WHERE status = ? ORDER BY occurrences DESC, created_at LIMIT 200', status)
    .map(r => ({ ...r, context: r.context_json ? JSON.parse(r.context_json) : null, context_json: undefined }));
  const counts = Object.fromEntries(dal.all('SELECT status, COUNT(*) n FROM ontology_review_queue GROUP BY status').map(r => [r.status, r.n]));
  res.json({ items, counts });
});

// Resolve one queued text: make it an alias of an existing skill, create a
// new skill (optionally under a parent), or reject it. Approved text becomes
// a permanent part of the ontology, and unmapped pathway nodes are re-mapped.
router.post('/ontology-review/:id', (req, res) => {
  const item = dal.one('SELECT * FROM ontology_review_queue WHERE id = ?', req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  if (item.status !== 'pending') return res.status(409).json({ error: 'Already resolved' });
  const { action } = req.body;
  try {
    let skillId = null;
    dal.tx(() => {
      if (action === 'alias') {
        if (!getSkill(req.body.skill_id)) throw Object.assign(new Error('Pick an existing skill'), { status: 400 });
        addAlias(item.text, req.body.skill_id, 'review');
        skillId = req.body.skill_id;
      } else if (action === 'create') {
        skillId = createSkill({ id: req.body.skill_id || undefined, name: String(req.body.name || item.text).trim(), domain: req.body.domain || 'general', parent: req.body.parent || null, hours: req.body.hours ? Number(req.body.hours) : null });
        if (item.text.trim().toLowerCase() !== String(req.body.name || item.text).trim().toLowerCase()) addAlias(item.text, skillId, 'review');
        (req.body.prereqs || []).forEach(p => addPrereq(skillId, p));
      } else if (action !== 'reject') {
        throw Object.assign(new Error('action must be alias, create or reject'), { status: 400 });
      }
      dal.run('UPDATE ontology_review_queue SET status = ?, resolved_skill_id = ?, resolved_by = ?, resolved_at = ? WHERE id = ?',
        action === 'alias' ? 'aliased' : action === 'create' ? 'created' : 'rejected', skillId, req.user.id, dal.nowIso(), item.id);
    });
    let remapped = 0;
    if (skillId) {
      dal.all('SELECT id FROM capability_targets').forEach(t => {
        const before = dal.one(`SELECT COUNT(*) n FROM skill_nodes sn JOIN skill_clusters sc ON sc.id = sn.cluster_id
          WHERE sc.capability_target_id = ? AND NOT EXISTS (SELECT 1 FROM node_skill_map m WHERE m.node_id = sn.id)`, t.id).n;
        if (before) remapped += before - mapPathway(t.id).unmapped.length;
      });
    }
    res.json({ ok: true, skill_id: skillId, remapped_nodes: remapped });
  } catch (err) {
    res.status(err.status || (err.code === 'cycle' ? 400 : 400)).json({ error: err.message });
  }
});

// ─── Employer KYB (v4.3 §14.1): manual approval after domain verification ─────
router.get('/employers', (req, res) => {
  const status = ['pending', 'verified', 'rejected', 'suspended'].includes(req.query.status) ? req.query.status : null;
  const rows = dal.all(`SELECT e.*, (SELECT COUNT(*) FROM employer_users u WHERE u.employer_id = e.id) AS users,
      (SELECT email FROM employer_users u WHERE u.employer_id = e.id AND u.role = 'owner' ORDER BY created_at LIMIT 1) AS owner_email
    FROM employers e ${status ? 'WHERE e.kyb_status = ?' : ''} ORDER BY e.created_at DESC LIMIT 200`, ...(status ? [status] : []));
  const counts = Object.fromEntries(dal.all('SELECT kyb_status, COUNT(*) n FROM employers GROUP BY kyb_status').map(r => [r.kyb_status, r.n]));
  res.json({ employers: rows, counts });
});

router.post('/employers/:id/kyb', (req, res) => {
  const e = dal.one('SELECT * FROM employers WHERE id = ?', req.params.id);
  if (!e) return res.status(404).json({ error: 'Not found' });
  const decision = req.body.decision;
  const allowed = { pending: ['verified', 'rejected'], verified: ['suspended'], suspended: ['verified'], rejected: ['pending'] };
  if (!(allowed[e.kyb_status] || []).includes(decision)) return res.status(400).json({ error: `Cannot move from ${e.kyb_status} to ${decision}.` });
  if (decision === 'verified' && !e.domain_verified_at) return res.status(400).json({ error: 'The company domain email has not been verified yet.' });
  dal.run('UPDATE employers SET kyb_status = ?, kyb_note = ?, kyb_decided_by = ?, kyb_decided_at = ?, updated_at = ? WHERE id = ?',
    decision, req.body.note ? String(req.body.note).slice(0, 500) : null, req.user.id, dal.nowIso(), dal.nowIso(), e.id);
  if (decision === 'suspended' || decision === 'rejected') {
    dal.run(`UPDATE auth_sessions SET revoked_at = ? WHERE actor_type = 'employer' AND employer_id = ? AND revoked_at IS NULL`, dal.nowIso(), e.id);
  }
  res.json({ ok: true, kyb_status: decision });
});

export default router;