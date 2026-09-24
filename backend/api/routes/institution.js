// api/routes/institution.js — Institution Portal
const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../../db/init');
const { authenticateToken, requireRole } = require('../middleware/auth');
const currBrain = require('../../core/brains/currBrain');
const { writeNodeSpec } = require('../../core/stores/briefStore');
const { produceEngagementMasteryLogs } = require('../../core/masteryLog');

const router = express.Router();
router.use(authenticateToken);
router.use(requireRole('institution', 'admin'));

// A 6-digit login PIN, distributed to the learner alongside their engagement
// ID. This is the secret factor: engagement_id is shared across a whole
// cohort, so it alone can never be sufficient to authenticate one learner.
// The plaintext PIN is returned exactly once, in the creation response —
// only its bcrypt hash is ever persisted.
function generatePin() {
  return String(crypto.randomInt(100000, 1000000));
}

// ─── GET institution profile ──────────────────────────────────────────────────
router.get('/profile', (req, res) => {
  const db = getDb();
  const inst = db.prepare('SELECT id, name, type, contact_name, contact_email, contact_phone, city, created_at FROM institutions WHERE id = ?').get(req.user.id);
  db.close();
  if (!inst) return res.status(404).json({ error: 'Not found' });
  res.json(inst);
});

// ─── List learners ────────────────────────────────────────────────────────────
router.get('/learners', (req, res) => {
  const db = getDb();
  const learners = db.prepare('SELECT * FROM learners WHERE institution_id = ? ORDER BY created_at DESC').all(req.user.id);
  db.close();
  res.json(learners);
});

// ─── Add learner ──────────────────────────────────────────────────────────────
router.post('/learners', (req, res) => {
  const { name, email, learner_ref, language, profile_type, current_capability_level } = req.body;
  if (!name || !learner_ref || !language) {
    return res.status(400).json({ error: 'name, learner_ref, and language required' });
  }
  const db = getDb();
  const id = uuidv4();
  const pin = generatePin();
  const pin_hash = bcrypt.hashSync(pin, 10);
  db.prepare(`
    INSERT INTO learners (id, institution_id, name, email, learner_ref, pin_hash, language, profile_type, current_capability_level)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.user.id, name, email, learner_ref, pin_hash, language, profile_type, current_capability_level);
  db.close();
  res.status(201).json({ id, pin, message: 'Learner added — share this PIN with the learner now, it will not be shown again' });
});

// ─── Bulk add learners ────────────────────────────────────────────────────────
router.post('/learners/bulk', (req, res) => {
  const { learners } = req.body;
  if (!Array.isArray(learners)) return res.status(400).json({ error: 'learners array required' });
  const db = getDb();
  const insert = db.prepare(`
    INSERT OR IGNORE INTO learners (id, institution_id, name, email, learner_ref, pin_hash, language, profile_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const results = db.transaction((rows) => rows.map(l => {
    const pin = generatePin();
    const info = insert.run(uuidv4(), req.user.id, l.name, l.email || null, l.learner_ref, bcrypt.hashSync(pin, 10), l.language || 'telugu', l.profile_type || 'college_student');
    // insert.run() was OR IGNORE — a duplicate learner_ref means no PIN was actually set
    return info.changes === 0 ? { learner_ref: l.learner_ref, skipped: true } : { learner_ref: l.learner_ref, pin };
  }))(learners);
  db.close();
  res.status(201).json({ message: `${learners.length} learners processed`, learners: results });
});

// ─── Upload / submit capability target (Path A / Path B) ─────────────────────
router.post('/capability-targets', async (req, res) => {
  const { title, path, raw_input, language, time_window_weeks, cohort_size } = req.body;
  if (!raw_input) return res.status(400).json({ error: 'raw_input required' });

  const db = getDb();
  const id = uuidv4();

  if (path === 'A') {
    // Structured input — store directly
    db.prepare(`
      INSERT INTO capability_targets (id, institution_id, version, title, path, raw_input, time_window_weeks, cohort_size)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, req.user.id, '1.0', title || 'Capability Target', 'A', raw_input, time_window_weeks, cohort_size);
    db.close();
    return res.status(201).json({ id, path: 'A', message: 'Capability target stored' });
  }

  // Path B — CURR brain extraction (RAG over confirmed past briefs)
  try {
    const extracted = await currBrain.extractCapabilityTargets({ rawInput: raw_input, language: language || 'telugu', institutionId: req.user.id });
    db.prepare(`
      INSERT INTO capability_targets (id, institution_id, version, title, path, domain, raw_input, extracted_targets, time_window_weeks, cohort_size)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, req.user.id, '1.0', title || extracted.title || 'Capability Target',
      'B', extracted.domain, raw_input, JSON.stringify(extracted), time_window_weeks, cohort_size);
    db.close();
    return res.status(201).json({
      id, path: 'B', extraction: extracted,
      message: 'Targets extracted. Please review and confirm before instruction begins.'
    });
  } catch (err) {
    db.close();
    return res.status(500).json({ error: 'Extraction failed', detail: err.message });
  }
});

// ─── Confirm Path B target ────────────────────────────────────────────────────
router.post('/capability-targets/:id/confirm', (req, res) => {
  const db = getDb();
  const ct = db.prepare('SELECT * FROM capability_targets WHERE id = ? AND institution_id = ?').get(req.params.id, req.user.id);
  if (!ct) { db.close(); return res.status(404).json({ error: 'Not found' }); }

  db.prepare(`
    UPDATE capability_targets SET confirmed = 1, confirmed_at = datetime('now'), status = 'confirmed'
    WHERE id = ?
  `).run(req.params.id);
  db.close();

  // Confirming here also confirms CURR's brief-store template, so future
  // extractions in this domain/language can use it as a RAG template.
  const extracted = ct.extracted_targets ? JSON.parse(ct.extracted_targets) : null;
  if (extracted && extracted.briefId) currBrain.confirmBrief(extracted.briefId);

  res.json({ message: 'Capability target confirmed. Instruction can now begin.' });
});

// ─── Build skill nodes from clusters (pathway design via CURR) ───────────────
router.post('/capability-targets/:id/build-pathway', async (req, res) => {
  const { language } = req.body;
  const db = getDb();
  const ct = db.prepare('SELECT * FROM capability_targets WHERE id = ? AND institution_id = ?').get(req.params.id, req.user.id);
  if (!ct) { db.close(); return res.status(404).json({ error: 'Capability target not found' }); }

  const extracted = ct.extracted_targets ? JSON.parse(ct.extracted_targets) : null;
  const clusters = extracted ? extracted.clusters : [];

  if (!clusters || clusters.length === 0) { db.close(); return res.status(400).json({ error: 'No clusters found. Run extraction first.' }); }

  const insertCluster = db.prepare(`
    INSERT OR IGNORE INTO skill_clusters (id, capability_target_id, cluster_label, cluster_ref, description, required_proficiency, mastery_threshold, priority, evidence_type, estimated_hours, sequence_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertNode = db.prepare(`
    INSERT OR IGNORE INTO skill_nodes (id, cluster_id, node_label, description, prerequisite_node_ids, sequence_order, difficulty_level, node_type, phase, estimated_minutes, concept_tags, mastery_threshold)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const results = [];
  for (let i = 0; i < clusters.length; i++) {
    const c = clusters[i];
    const clusterId = uuidv4();
    insertCluster.run(clusterId, ct.id, c.label, c.cluster_ref || null, c.description || null,
      c.required_proficiency, c.mastery_threshold || 0.75, c.priority || 'normal', c.evidence_type || null,
      c.estimated_hours || null, i);

    try {
      const skillNodeIds = [];
      // skillNodeIds intentionally omitted here — node ids don't exist yet.
      // Node specs are written explicitly below, once they're minted.
      const decomposed = await currBrain.decomposeClusterToNodes({
        clusterLabel: c.label,
        clusterDescription: c.description,
        proficiencyLevel: c.required_proficiency,
        language: language || 'telugu'
      });

      // Mint node IDs first so prerequisite_indices and node specs can reference them.
      for (let j = 0; j < decomposed.nodes.length; j++) skillNodeIds.push(uuidv4());

      decomposed.nodes.forEach((n, j) => {
        const prereqIds = (n.prerequisite_indices || []).map(pi => skillNodeIds[pi]).filter(Boolean);
        insertNode.run(
          skillNodeIds[j], clusterId, n.label, n.description, JSON.stringify(prereqIds), j,
          n.difficulty_level || 1, n.node_type || 'concept', n.phase || 1,
          n.estimated_minutes || 20, JSON.stringify(n.concept_tags || []), n.mastery_threshold ?? 0.70
        );
      });

      // Write node specs now that skill_node ids exist — this is the CURR
      // store TEACH retrieves from at SESSION_START.
      decomposed.nodes.forEach((n, j) => {
        writeNodeSpec(skillNodeIds[j], {
          nodeLabel: n.label, clusterLabel: c.label,
          learningObjectives: n.learning_objectives || [],
          prerequisiteLabels: (n.prerequisite_indices || []).map(pi => decomposed.nodes[pi] ? decomposed.nodes[pi].label : null).filter(Boolean),
          masteryThreshold: n.mastery_threshold ?? 0.70, phase: n.phase ?? 1,
          difficultyLevel: n.difficulty_level ?? 1, estimatedMinutes: n.estimated_minutes ?? 20,
          conceptTags: n.concept_tags || []
        });
      });

      results.push({ cluster: c.label, nodes_created: decomposed.nodes.length });
    } catch (err) {
      results.push({ cluster: c.label, error: err.message });
    }
  }

  db.close();
  res.json({ message: 'Pathway built', results });
});

// ─── Create engagement ────────────────────────────────────────────────────────
router.post('/engagements', (req, res) => {
  const { capability_target_id, title, language, learner_ids } = req.body;
  if (!capability_target_id || !language) return res.status(400).json({ error: 'capability_target_id and language required' });

  const db = getDb();
  const ct = db.prepare('SELECT * FROM capability_targets WHERE id = ? AND (confirmed = 1 OR path = ?)').get(capability_target_id, 'A');
  if (!ct) { db.close(); return res.status(400).json({ error: 'Capability target not confirmed' }); }

  const engId = uuidv4();
  db.prepare(`
    INSERT INTO engagements (id, institution_id, capability_target_id, title, language, status, started_at)
    VALUES (?, ?, ?, ?, ?, 'active', datetime('now'))
  `).run(engId, req.user.id, capability_target_id, title || ct.title, language);

  const firstCluster = db.prepare('SELECT id FROM skill_clusters WHERE capability_target_id = ? ORDER BY sequence_order LIMIT 1').get(capability_target_id);
  const firstNode = firstCluster
    ? db.prepare('SELECT id FROM skill_nodes WHERE cluster_id = ? ORDER BY sequence_order LIMIT 1').get(firstCluster.id)
    : null;

  if (Array.isArray(learner_ids)) {
    const insertEl = db.prepare(`
      INSERT OR IGNORE INTO engagement_learners (id, engagement_id, learner_id, current_node_id, current_cluster_id)
      VALUES (?, ?, ?, ?, ?)
    `);
    learner_ids.forEach(lid => insertEl.run(uuidv4(), engId, lid, firstNode ? firstNode.id : null, firstCluster ? firstCluster.id : null));
  }

  db.close();
  res.status(201).json({ engagement_id: engId, message: 'Engagement started' });
});

// ─── List engagements ─────────────────────────────────────────────────────────
router.get('/engagements', (req, res) => {
  const db = getDb();
  const engagements = db.prepare(`
    SELECT e.*, ct.title as ct_title,
      (SELECT COUNT(*) FROM engagement_learners WHERE engagement_id = e.id) as learner_count,
      (SELECT COUNT(*) FROM engagement_learners WHERE engagement_id = e.id AND overall_status = 'completed') as completed_count
    FROM engagements e
    JOIN capability_targets ct ON e.capability_target_id = ct.id
    WHERE e.institution_id = ? ORDER BY e.created_at DESC
  `).all(req.user.id);
  db.close();
  res.json(engagements);
});

// ─── Get engagement detail + cohort progress ──────────────────────────────────
// NOTE: session_messages, doubts, study_plans, streaks, and learner_memory are
// never surfaced here — only cohort-level structural progress.
router.get('/engagements/:id', (req, res) => {
  const db = getDb();
  const engagement = db.prepare(`
    SELECT e.*, ct.title as ct_title, ct.extracted_targets
    FROM engagements e JOIN capability_targets ct ON e.capability_target_id = ct.id
    WHERE e.id = ? AND e.institution_id = ?
  `).get(req.params.id, req.user.id);
  if (!engagement) { db.close(); return res.status(404).json({ error: 'Not found' }); }

  const learners = db.prepare(`
    SELECT l.name, l.learner_ref, l.language, el.overall_status, el.current_node_id,
      (SELECT sn.node_label FROM skill_nodes sn WHERE sn.id = el.current_node_id) as current_node_label,
      (SELECT COUNT(*) FROM node_mastery nm WHERE nm.engagement_learner_id = el.id AND nm.advanced_at IS NOT NULL) as nodes_mastered
    FROM engagement_learners el
    JOIN learners l ON l.id = el.learner_id
    WHERE el.engagement_id = ?
  `).all(req.params.id);

  db.close();
  res.json({ ...engagement, learners });
});

// ─── Produce Mastery Logs ─────────────────────────────────────────────────────
// ─── Skill requests from learners (the institution owns the pathway) ─────────
router.get('/engagements/:id/skill-requests', (req, res) => {
  const db = getDb();
  const engagement = db.prepare('SELECT id FROM engagements WHERE id = ? AND institution_id = ?').get(req.params.id, req.user.id);
  if (!engagement) { db.close(); return res.status(404).json({ error: 'Not found' }); }
  const rows = db.prepare(`
    SELECT skill_name, COUNT(*) as learner_count, MIN(created_at) as first_requested_at,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
    FROM skill_requests WHERE engagement_id = ?
    GROUP BY skill_name ORDER BY learner_count DESC
  `).all(req.params.id);
  db.close();
  res.json(rows);
});

router.post('/engagements/:id/produce-mastery-logs', (req, res) => {
  try {
    const logs = produceEngagementMasteryLogs(req.params.id);
    res.json({ message: `${logs.length} Mastery Logs produced`, log_ids: logs.map(l => l.log_id) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Get Mastery Logs for engagement ─────────────────────────────────────────
router.get('/engagements/:id/mastery-logs', (req, res) => {
  const db = getDb();
  const logs = db.prepare(`
    SELECT ml.*, l.name as learner_name, l.learner_ref
    FROM mastery_logs ml
    JOIN learners l ON l.id = ml.learner_id
    WHERE ml.engagement_id = ?
  `).all(req.params.id);
  db.close();
  res.json(logs.map(log => ({ ...log, log_data: JSON.parse(log.log_data || '{}') })));
});

module.exports = router;
