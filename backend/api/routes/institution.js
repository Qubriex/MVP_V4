// api/routes/institution.js — Institution portal: capability targets, cohorts,
// mastery logs and the Home overview. Team (staff) lives in institutionTeam.js,
// Students & access in institutionStudents.js, market insight in
// institutionInsights.js — all mounted at /api/institution.
//
// Every route runs as a staff member (api/middleware/staff.js): admins see
// the whole institution, professors only their assigned cohorts, viewers
// everything read-only. Cohort ("engagement") routes always check the cohort
// belongs to the caller's institution AND is in their scope.
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../../db/init');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { staffMiddleware, requireStaffRole, findScopedEngagement, scopeClause } = require('../middleware/staff');
const currBrain = require('../../core/brains/currBrain');
const { writeNodeSpec } = require('../../core/stores/briefStore');
const { produceEngagementMasteryLogs, getMasteryLog } = require('../../core/masteryLog');
const { generateJoinCode, accessState } = require('../../core/access');
const { curriculumCoverage, cohortStanding } = require('../../core/insights');

const router = express.Router();
router.use(authenticateToken);
router.use(requireRole('institution', 'admin'));
router.use(...staffMiddleware);

const LANGUAGES = ['telugu', 'hindi'];

// ─── GET institution profile ──────────────────────────────────────────────────
router.get('/profile', (req, res) => {
  const db = getDb();
  const inst = db.prepare('SELECT id, name, type, contact_name, contact_email, contact_phone, city, created_at FROM institutions WHERE id = ?').get(req.user.id);
  db.close();
  if (!inst) return res.status(404).json({ error: 'Not found' });
  res.json(inst);
});

// ─── Capability targets (admin) ───────────────────────────────────────────────
router.get('/capability-targets', (req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT ct.id, ct.title, ct.version, ct.path, ct.status, ct.confirmed, ct.created_at,
      (SELECT COUNT(*) FROM skill_nodes sn JOIN skill_clusters sc ON sc.id = sn.cluster_id WHERE sc.capability_target_id = ct.id) as node_count,
      (SELECT COUNT(*) FROM skill_clusters sc WHERE sc.capability_target_id = ct.id) as cluster_count
    FROM capability_targets ct WHERE ct.institution_id = ? ORDER BY ct.created_at DESC
  `).all(req.user.id);
  db.close();
  res.json(rows);
});

// Upload / submit a capability target (Path A structured / Path B any format).
// Extraction is language-neutral; the pathway language is chosen later, when
// the pathway is built.
router.post('/capability-targets', requireStaffRole('admin'), async (req, res) => {
  const { title, path, raw_input, time_window_weeks, cohort_size } = req.body;
  if (!raw_input) return res.status(400).json({ error: 'raw_input required' });

  const db = getDb();
  const id = uuidv4();

  if (path === 'A') {
    db.prepare(`
      INSERT INTO capability_targets (id, institution_id, version, title, path, raw_input, time_window_weeks, cohort_size)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, req.user.id, '1.0', title || 'Capability Target', 'A', raw_input, time_window_weeks, cohort_size);
    db.close();
    return res.status(201).json({ id, path: 'A', message: 'Capability target stored' });
  }

  try {
    // Extraction is language-neutral ('any' is only the brief-store template key).
    const extracted = await currBrain.extractCapabilityTargets({ rawInput: raw_input, language: 'any', institutionId: req.user.id });
    db.prepare(`
      INSERT INTO capability_targets (id, institution_id, version, title, path, domain, raw_input, extracted_targets, time_window_weeks, cohort_size)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, req.user.id, '1.0', title || extracted.title || 'Capability Target',
      'B', extracted.domain, raw_input, JSON.stringify(extracted), time_window_weeks, cohort_size);
    db.close();
    return res.status(201).json({ id, path: 'B', extraction: extracted, message: 'Targets extracted. Please review and confirm before instruction begins.' });
  } catch (err) {
    db.close();
    return res.status(500).json({ error: 'Extraction failed', detail: err.message });
  }
});

router.post('/capability-targets/:id/confirm', requireStaffRole('admin'), (req, res) => {
  const db = getDb();
  const ct = db.prepare('SELECT * FROM capability_targets WHERE id = ? AND institution_id = ?').get(req.params.id, req.user.id);
  if (!ct) { db.close(); return res.status(404).json({ error: 'Not found' }); }
  db.prepare(`UPDATE capability_targets SET confirmed = 1, confirmed_at = datetime('now'), status = 'confirmed' WHERE id = ?`).run(req.params.id);
  db.close();
  const extracted = ct.extracted_targets ? JSON.parse(ct.extracted_targets) : null;
  if (extracted && extracted.briefId) currBrain.confirmBrief(extracted.briefId);
  res.json({ message: 'Capability target confirmed.' });
});

// Build skill nodes from clusters, in the cohort's language (required — it
// used to default to Telugu before a language had been chosen).
router.post('/capability-targets/:id/build-pathway', requireStaffRole('admin'), async (req, res) => {
  const { language } = req.body;
  if (!LANGUAGES.includes(language)) return res.status(400).json({ error: 'Pick the teaching language (telugu or hindi) before building the pathway.' });
  const db = getDb();
  const ct = db.prepare('SELECT * FROM capability_targets WHERE id = ? AND institution_id = ?').get(req.params.id, req.user.id);
  if (!ct) { db.close(); return res.status(404).json({ error: 'Capability target not found' }); }
  if (ct.path === 'B' && !ct.confirmed) { db.close(); return res.status(400).json({ error: 'Confirm the extracted targets first.' }); }
  const existing = db.prepare('SELECT COUNT(*) as n FROM skill_clusters WHERE capability_target_id = ?').get(ct.id).n;
  if (existing) { db.close(); return res.status(409).json({ error: 'This pathway is already built.' }); }

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
      const decomposed = await currBrain.decomposeClusterToNodes({
        clusterLabel: c.label, clusterDescription: c.description, proficiencyLevel: c.required_proficiency, language
      });
      const skillNodeIds = decomposed.nodes.map(() => uuidv4());
      decomposed.nodes.forEach((n, j) => {
        const prereqIds = (n.prerequisite_indices || []).map(pi => skillNodeIds[pi]).filter(Boolean);
        insertNode.run(skillNodeIds[j], clusterId, n.label, n.description, JSON.stringify(prereqIds), j,
          n.difficulty_level || 1, n.node_type || 'concept', n.phase || 1, n.estimated_minutes || 20,
          JSON.stringify(n.concept_tags || []), n.mastery_threshold ?? 0.70);
      });
      decomposed.nodes.forEach((n, j) => {
        writeNodeSpec(skillNodeIds[j], {
          nodeLabel: n.label, clusterLabel: c.label, learningObjectives: n.learning_objectives || [],
          prerequisiteLabels: (n.prerequisite_indices || []).map(pi => decomposed.nodes[pi] ? decomposed.nodes[pi].label : null).filter(Boolean),
          masteryThreshold: n.mastery_threshold ?? 0.70, phase: n.phase ?? 1, difficultyLevel: n.difficulty_level ?? 1,
          estimatedMinutes: n.estimated_minutes ?? 20, conceptTags: n.concept_tags || []
        });
      });
      results.push({ cluster: c.label, nodes_created: decomposed.nodes.length });
    } catch (err) {
      results.push({ cluster: c.label, error: err.message });
    }
  }
  db.close();
  res.json({ message: 'Pathway built', language, results });
});

// ─── Cohorts (engagements) ─────────────────────────────────────────────────────
function firstNode(db, capabilityTargetId) {
  const cluster = db.prepare('SELECT id FROM skill_clusters WHERE capability_target_id = ? ORDER BY sequence_order LIMIT 1').get(capabilityTargetId);
  const node = cluster ? db.prepare('SELECT id FROM skill_nodes WHERE cluster_id = ? ORDER BY sequence_order LIMIT 1').get(cluster.id) : null;
  return { clusterId: cluster ? cluster.id : null, nodeId: node ? node.id : null };
}

function setProfessors(db, req, engagementId, professors) {
  if (!Array.isArray(professors)) return;
  db.prepare('DELETE FROM staff_cohorts WHERE engagement_id = ?').run(engagementId);
  const ins = db.prepare('INSERT OR IGNORE INTO staff_cohorts (staff_id, engagement_id, cohort_role) VALUES (?, ?, ?)');
  professors.forEach(p => {
    const id = typeof p === 'string' ? p : p.id;
    const staff = db.prepare('SELECT id FROM institution_users WHERE id = ? AND institution_id = ?').get(id, req.user.id);
    if (staff) ins.run(staff.id, engagementId, p.cohort_role === 'lead' ? 'lead' : 'co');
  });
}

// Create a cohort on a confirmed target whose pathway is built. Students are
// added separately (Students → Add students), in one server step.
router.post('/engagements', requireStaffRole('admin'), (req, res) => {
  const { capability_target_id, title, language, professors } = req.body;
  if (!capability_target_id || !LANGUAGES.includes(language)) return res.status(400).json({ error: 'capability_target_id and language (telugu or hindi) required' });

  const db = getDb();
  try {
    // Security: the target must belong to the caller's institution.
    const ct = db.prepare('SELECT * FROM capability_targets WHERE id = ? AND institution_id = ?').get(capability_target_id, req.user.id);
    if (!ct) return res.status(404).json({ error: 'Capability target not found' });
    if (ct.path === 'B' && !ct.confirmed) return res.status(400).json({ error: 'Capability target not confirmed' });
    const start = firstNode(db, ct.id);
    if (!start.nodeId) return res.status(400).json({ error: 'Build the pathway before creating the cohort.' });

    const engId = uuidv4();
    const cohortTitle = (title || ct.title).trim();
    const joinCode = generateJoinCode(db, cohortTitle);
    db.transaction(() => {
      db.prepare(`
        INSERT INTO engagements (id, institution_id, capability_target_id, title, language, status, started_at, join_code)
        VALUES (?, ?, ?, ?, ?, 'active', datetime('now'), ?)
      `).run(engId, req.user.id, ct.id, cohortTitle, language, joinCode);
      db.prepare("UPDATE capability_targets SET status = 'active' WHERE id = ?").run(ct.id);
      setProfessors(db, req, engId, professors);
    })();
    res.status(201).json({ engagement_id: engId, join_code: joinCode, message: 'Cohort created' });
  } finally {
    db.close();
  }
});

function cohortSummaries(db, req) {
  const scope = scopeClause(db, req, 'e.id');
  const rows = db.prepare(`
    SELECT e.id, e.title, e.language, e.status, e.join_code, e.started_at, e.created_at, e.capability_target_id,
      ct.title as ct_title, ct.version as ct_version,
      (SELECT COUNT(*) FROM skill_nodes sn JOIN skill_clusters sc ON sc.id = sn.cluster_id WHERE sc.capability_target_id = e.capability_target_id) as total_nodes
    FROM engagements e JOIN capability_targets ct ON ct.id = e.capability_target_id
    WHERE e.institution_id = ? ${scope.sql} ORDER BY e.created_at DESC
  `).all(req.user.id, ...scope.params);

  return rows.map(e => {
    const s = db.prepare(`
      SELECT COUNT(*) as students,
        SUM(CASE WHEN el.last_login_at IS NULL THEN 1 ELSE 0 END) as not_signed_in,
        SUM(CASE WHEN el.overall_status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN EXISTS (SELECT 1 FROM learning_sessions ls WHERE ls.engagement_learner_id = el.id AND ls.started_at >= datetime('now', '-7 days')) THEN 1 ELSE 0 END) as active_week,
        SUM(CASE WHEN EXISTS (SELECT 1 FROM learning_sessions ls WHERE ls.engagement_learner_id = el.id AND ls.status = 'active' AND ls.loop_count >= 3) THEN 1 ELSE 0 END) as stuck,
        AVG((SELECT COUNT(*) FROM node_mastery nm WHERE nm.engagement_learner_id = el.id AND nm.advanced_at IS NOT NULL)) as avg_mastered
      FROM engagement_learners el WHERE el.engagement_id = ? AND COALESCE(el.access_status, 'active') != 'removed'
    `).get(e.id);
    const professors = db.prepare(`
      SELECT u.id, u.name, u.title, sc.cohort_role FROM staff_cohorts sc JOIN institution_users u ON u.id = sc.staff_id
      WHERE sc.engagement_id = ? ORDER BY sc.cohort_role = 'lead' DESC
    `).all(e.id);
    return {
      ...e,
      learner_count: s.students || 0,
      completed_count: s.completed || 0,
      not_signed_in: s.not_signed_in || 0,
      active_week: s.active_week || 0,
      stuck: s.stuck || 0,
      avg_progress: e.total_nodes && s.students ? Math.round(((s.avg_mastered || 0) / e.total_nodes) * 100) : 0,
      professors
    };
  });
}

router.get('/engagements', (req, res) => {
  const db = getDb();
  const rows = cohortSummaries(db, req);
  db.close();
  res.json(rows);
});

// Cohort detail. Structural progress only — session conversations, doubts,
// study plans and learner memory are never surfaced to institutions.
router.get('/engagements/:id', (req, res) => {
  const db = getDb();
  try {
    const e = findScopedEngagement(db, req, req.params.id);
    if (!e) return res.status(404).json({ error: 'Not found' });
    const summary = cohortSummaries(db, req).find(x => x.id === e.id);
    const ct = db.prepare('SELECT id, title, version, extracted_targets FROM capability_targets WHERE id = ?').get(e.capability_target_id);

    const learners = db.prepare(`
      SELECT l.id as learner_id, l.name, l.learner_ref, l.language, l.pin_hash, el.id as el_id, el.overall_status, el.current_node_id,
        el.current_cluster_id, el.access_status, el.locked_at, el.last_login_at,
        (SELECT sn.node_label FROM skill_nodes sn WHERE sn.id = el.current_node_id) as current_node_label,
        (SELECT COUNT(*) FROM node_mastery nm WHERE nm.engagement_learner_id = el.id AND nm.advanced_at IS NOT NULL) as nodes_mastered
      FROM engagement_learners el JOIN learners l ON l.id = el.learner_id
      WHERE el.engagement_id = ? ORDER BY l.name
    `).all(e.id).map(({ pin_hash, ...l }) => ({ ...l, access: accessState({ ...l, pin_hash }) }));
    const current = learners.filter(l => l.access !== 'removed');

    const clusters = db.prepare('SELECT id, cluster_label, sequence_order FROM skill_clusters WHERE capability_target_id = ? ORDER BY sequence_order').all(e.capability_target_id)
      .map(c => {
        const nodes = db.prepare(`
          SELECT sn.id, sn.node_label, sn.estimated_minutes,
            (SELECT COUNT(*) FROM node_mastery nm JOIN engagement_learners el ON el.id = nm.engagement_learner_id
              WHERE nm.skill_node_id = sn.id AND el.engagement_id = ? AND nm.advanced_at IS NOT NULL) as mastered_by
          FROM skill_nodes sn WHERE sn.cluster_id = ? ORDER BY sn.sequence_order
        `).all(e.id, c.id);
        return { id: c.id, label: c.cluster_label, nodes, students_here: current.filter(l => l.current_cluster_id === c.id && l.overall_status !== 'completed').length };
      });
    const finishedCluster = current.filter(l => clusters.some(c => c.nodes.length && c.nodes.every(n =>
      db.prepare('SELECT 1 FROM node_mastery WHERE engagement_learner_id = ? AND skill_node_id = ? AND advanced_at IS NOT NULL').get(l.el_id, n.id)))).length;

    const hardest = db.prepare(`
      SELECT sn.id as node_id, sn.node_label, AVG(ls.loop_count) as avg_loops,
        SUM(CASE WHEN ls.status = 'active' AND ls.loop_count >= 3 THEN 1 ELSE 0 END) as stuck, COUNT(*) as sessions
      FROM learning_sessions ls
      JOIN engagement_learners el ON el.id = ls.engagement_learner_id
      JOIN skill_nodes sn ON sn.id = ls.skill_node_id
      WHERE el.engagement_id = ? GROUP BY ls.skill_node_id HAVING AVG(ls.loop_count) > 0
      ORDER BY avg_loops DESC LIMIT 6
    `).all(e.id).map(h => ({ ...h, avg_loops: Math.round(h.avg_loops * 10) / 10 }));

    const mastery = db.prepare(`
      SELECT AVG(nm.mastery_attainment) as avg FROM node_mastery nm JOIN engagement_learners el ON el.id = nm.engagement_learner_id
      WHERE el.engagement_id = ? AND nm.advanced_at IS NOT NULL
    `).get(e.id).avg;
    const weekMinutes = db.prepare(`
      SELECT COALESCE(SUM(ls.active_minutes), 0) as m FROM learning_sessions ls JOIN engagement_learners el ON el.id = ls.engagement_learner_id
      WHERE el.engagement_id = ? AND ls.started_at >= datetime('now', '-7 days')
    `).get(e.id).m;

    res.json({
      ...e,
      ct_title: ct.title, ct_version: ct.version, extracted_targets: ct.extracted_targets,
      professors: summary.professors,
      kpis: {
        students: current.length,
        signed_in: current.filter(l => l.last_login_at).length,
        avg_progress: summary.avg_progress,
        avg_mastery: mastery != null ? Math.round(mastery * 100) : null,
        active_minutes_per_student_week: current.length ? Math.round(weekMinutes / current.length) : 0,
        finished_a_cluster: finishedCluster
      },
      total_nodes: summary.total_nodes,
      clusters, hardest, learners
    });
  } finally {
    db.close();
  }
});

// Rename, change status, (re)assign professors — admin only.
router.put('/engagements/:id', requireStaffRole('admin'), (req, res) => {
  const db = getDb();
  try {
    const e = findScopedEngagement(db, req, req.params.id);
    if (!e) return res.status(404).json({ error: 'Not found' });
    const { title, status, professors } = req.body;
    db.transaction(() => {
      if (title && title.trim()) db.prepare('UPDATE engagements SET title = ? WHERE id = ?').run(title.trim(), e.id);
      if (['setup', 'active', 'completed', 'on_hold'].includes(status)) db.prepare('UPDATE engagements SET status = ? WHERE id = ?').run(status, e.id);
      setProfessors(db, req, e.id, professors);
    })();
    res.json({ message: 'Cohort updated' });
  } finally {
    db.close();
  }
});

// New join code (e.g. after it was shared too widely). Old code stops working.
router.post('/engagements/:id/join-code', requireStaffRole('admin', 'professor'), (req, res) => {
  const db = getDb();
  try {
    const e = findScopedEngagement(db, req, req.params.id);
    if (!e) return res.status(404).json({ error: 'Not found' });
    const code = generateJoinCode(db, e.title);
    db.prepare('UPDATE engagements SET join_code = ? WHERE id = ?').run(code, e.id);
    res.json({ join_code: code });
  } finally {
    db.close();
  }
});

// ─── Skill requests from learners (the institution owns the pathway) ─────────
router.get('/engagements/:id/skill-requests', (req, res) => {
  const db = getDb();
  if (!findScopedEngagement(db, req, req.params.id)) { db.close(); return res.status(404).json({ error: 'Not found' }); }
  const rows = db.prepare(`
    SELECT skill_name, COUNT(*) as learner_count, MIN(created_at) as first_requested_at,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
    FROM skill_requests WHERE engagement_id = ?
    GROUP BY skill_name ORDER BY learner_count DESC
  `).all(req.params.id);
  db.close();
  res.json(rows);
});

// ─── Mastery logs ──────────────────────────────────────────────────────────────
// Security: the cohort must belong to the caller (it used to accept any id).
// Body: { complete?: boolean, learner_ids?: [] }. Producing part-way leaves
// the cohort active; complete: true also marks it completed.
router.post('/engagements/:id/produce-mastery-logs', requireStaffRole('admin', 'professor'), (req, res) => {
  const db = getDb();
  const e = findScopedEngagement(db, req, req.params.id);
  db.close();
  if (!e) return res.status(404).json({ error: 'Not found' });
  try {
    const logs = produceEngagementMasteryLogs(e.id, {
      complete: req.body.complete === true,
      learnerIds: Array.isArray(req.body.learner_ids) ? req.body.learner_ids : null
    });
    res.json({ message: `${logs.length} Mastery Logs produced`, log_ids: logs.map(l => l.log_id) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function logSummaries(db, engagementId) {
  return db.prepare(`
    SELECT ml.id, ml.produced_at, ml.capability_target_ref, ml.log_data, l.name as learner_name, l.learner_ref
    FROM mastery_logs ml JOIN learners l ON l.id = ml.learner_id
    WHERE ml.engagement_id = ? ORDER BY l.name
  `).all(engagementId).map(log => {
    const data = JSON.parse(log.log_data || '{}');
    const done = (data.clusters || []).filter(c => c.nodes && c.nodes.length && c.nodes.every(n => n.advanced)).map(c => c.cluster);
    return { ...log, log_data: data, clusters_complete: done };
  });
}

router.get('/engagements/:id/mastery-logs', (req, res) => {
  const db = getDb();
  if (!findScopedEngagement(db, req, req.params.id)) { db.close(); return res.status(404).json({ error: 'Not found' }); }
  const logs = logSummaries(db, req.params.id);
  db.close();
  res.json(logs);
});

// One row per learner per node — the structured fields of each Mastery Log.
router.get('/engagements/:id/mastery-logs.csv', (req, res) => {
  const db = getDb();
  const e = findScopedEngagement(db, req, req.params.id);
  if (!e) { db.close(); return res.status(404).json({ error: 'Not found' }); }
  const logs = logSummaries(db, e.id);
  db.close();
  const esc = (v) => (v == null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  const lines = [['learner_reference', 'learner_name', 'cluster', 'skill_node', 'mastery_attainment', 'time_to_mastery_minutes', 'attempt_count', 'confidence_indicator', 'advanced', 'produced_at'].join(',')];
  logs.forEach(l => (l.log_data.clusters || []).forEach(c => (c.nodes || []).forEach(n => lines.push([
    l.learner_ref, l.learner_name, c.cluster, n.skill_node, n.mastery_attainment, n.time_to_mastery_minutes, n.attempt_count, n.confidence_indicator, n.advanced ? 'yes' : 'no', l.produced_at
  ].map(esc).join(',')))));
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="mastery-logs-${e.join_code || e.id}.csv"`);
  res.send(lines.join('\n'));
});

// A single Mastery Log, for staff whose scope includes its cohort. (The page
// used to call the platform-admin route, so institutions only saw mock data.)
router.get('/mastery-logs/:id', (req, res) => {
  const log = getMasteryLog(req.params.id);
  if (!log) return res.status(404).json({ error: 'Not found' });
  const db = getDb();
  const e = findScopedEngagement(db, req, log.engagement_id);
  db.close();
  if (!e) return res.status(404).json({ error: 'Not found' });
  res.json({ ...log, engagement_title: e.title, join_code: e.join_code });
});

// ─── Home overview ─────────────────────────────────────────────────────────────
router.get('/overview', (req, res) => {
  const db = getDb();
  try {
    const cohorts = cohortSummaries(db, req);
    const ids = cohorts.map(c => c.id);
    const inList = ids.length ? `(${ids.map(() => '?').join(',')})` : '(NULL)';
    const students = cohorts.reduce((a, c) => a + c.learner_count, 0);

    const stuckNode = ids.length ? db.prepare(`
      SELECT sn.node_label, e.id as engagement_id, e.title, COUNT(DISTINCT ls.engagement_learner_id) as n
      FROM learning_sessions ls JOIN engagement_learners el ON el.id = ls.engagement_learner_id
      JOIN engagements e ON e.id = el.engagement_id JOIN skill_nodes sn ON sn.id = ls.skill_node_id
      WHERE el.engagement_id IN ${inList} AND ls.status = 'active' AND ls.loop_count >= 3
      GROUP BY ls.skill_node_id ORDER BY n DESC LIMIT 1
    `).get(...ids) : null;
    const resetRequests = ids.length ? db.prepare(`
      SELECT COUNT(*) as n FROM access_events ae JOIN engagement_learners el ON el.id = ae.engagement_learner_id
      WHERE ae.event = 'pin_reset_requested' AND ae.resolved = 0 AND el.engagement_id IN ${inList}
    `).get(...ids).n : 0;
    const neverSignedIn = cohorts.reduce((a, c) => a + c.not_signed_in, 0);
    const logsReady = ids.length ? db.prepare(`
      SELECT COUNT(DISTINCT el.id) as n FROM engagement_learners el
      JOIN engagements e ON e.id = el.engagement_id
      JOIN skill_clusters sc ON sc.capability_target_id = e.capability_target_id
      WHERE el.engagement_id IN ${inList} AND NOT EXISTS (
        SELECT 1 FROM skill_nodes sn WHERE sn.cluster_id = sc.id AND NOT EXISTS (
          SELECT 1 FROM node_mastery nm WHERE nm.engagement_learner_id = el.id AND nm.skill_node_id = sn.id AND nm.advanced_at IS NOT NULL))
      AND EXISTS (SELECT 1 FROM skill_nodes sn WHERE sn.cluster_id = sc.id)
    `).get(...ids).n : 0;

    const alerts = [];
    if (neverSignedIn) alerts.push({ kind: 'never_signed_in', title: `${neverSignedIn} student${neverSignedIn > 1 ? 's' : ''} never signed in`, body: 'Resend their invites, or print login slips for students without email.', cta: 'See who', href: '/institution/students?status=never_signed_in' });
    if (stuckNode) alerts.push({ kind: 'stuck', title: `${stuckNode.n} student${stuckNode.n > 1 ? 's' : ''} stuck on “${stuckNode.node_label}”`, body: 'Three or more loops each. A short class session on this node may help.', cta: 'Open cohort', href: `/institution/cohorts/${stuckNode.engagement_id}` });
    if (resetRequests) alerts.push({ kind: 'pin_reset', title: `${resetRequests} PIN reset request${resetRequests > 1 ? 's' : ''}`, body: 'Raised from the learner login page.', cta: 'Reset PINs', href: '/institution/students?status=reset_requested' });

    // Market cards use the most recent cohort in scope.
    const primary = cohorts.find(c => c.status === 'active') || cohorts[0];
    let pulse = [];
    let fit = null;
    let standing = null;
    if (primary) {
      const cov = curriculumCoverage(db, { capabilityTargetId: primary.capability_target_id, engagementId: primary.id });
      fit = cov.kpis.fit_pct;
      pulse = cov.skills.slice(0, 5).map(s => ({ name: s.name, share: s.share, coverage: s.coverage }));
      let ready = 0; let mid = 0; let low = 0; let total = 0;
      cohorts.forEach(c => {
        const eng = db.prepare('SELECT * FROM engagements WHERE id = ?').get(c.id);
        const st = cohortStanding(db, eng);
        ready += st.bands[0].ours_count; mid += st.bands[1].ours_count; low += st.bands[2].ours_count + st.bands[3].ours_count; total += st.students;
      });
      standing = { ready, mid, low, total };
    }

    const me = req.staff.id ? db.prepare('SELECT name, title, department, profile_completed, role FROM institution_users WHERE id = ?').get(req.staff.id) : null;
    const signedIn = cohorts.reduce((a, c) => a + (c.learner_count - c.not_signed_in), 0);
    res.json({
      me: me || { name: req.staff.name, role: req.staff.role },
      cohorts, alerts,
      kpis: {
        students, active_students: signedIn,
        avg_progress: cohorts.length ? Math.round(cohorts.reduce((a, c) => a + c.avg_progress * c.learner_count, 0) / Math.max(students, 1)) : 0,
        logs_ready: logsReady,
        curriculum_fit: fit
      },
      pulse, standing, sample_market: true
    });
  } finally {
    db.close();
  }
});

module.exports = router;
