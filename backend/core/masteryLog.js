// core/masteryLog.js
// ─────────────────────────────────────────────────────────────────────────────
// MASTERY LOG PRODUCTION LOGIC
//
// The Mastery Log is Qubirex's primary output — the verified record of what a
// learner can and cannot do, produced after the learner completes their
// engagement. It is the ONLY learner-specific document shared with institutions.
//
// CRITICAL BOUNDARY RULE:
// - readiness_classification: ALWAYS NULL — owned by the commissioning client
// - external_score: ALWAYS NULL — owned by the commissioning client / assessment platform
// These two fields are ALWAYS BLANK in every version of the Mastery Log.
// ─────────────────────────────────────────────────────────────────────────────

const { getDb } = require('../db/init');
const { calculateSimulationReadiness } = require('./instructionEngine');
const { v4: uuidv4 } = require('uuid');

function confidenceLabel(confidenceIndicator, hasRecord) {
  if (!hasRecord) return 'not_started';
  if (confidenceIndicator >= 0.75) return 'high';
  if (confidenceIndicator >= 0.55) return 'solid';
  return 'building';
}

/**
 * Produce the Mastery Log for a learner in an engagement
 */
function produceLearnerMasteryLog(engagementId, learnerId) {
  const db = getDb();

  // ─── Fetch core data ─────────────────────────────────────────────────────
  const engagement = db.prepare(`
    SELECT e.*, ct.version as ct_version, ct.title as ct_title,
           ct.extracted_targets, i.name as institution_name
    FROM engagements e
    JOIN capability_targets ct ON e.capability_target_id = ct.id
    JOIN institutions i ON e.institution_id = i.id
    WHERE e.id = ?
  `).get(engagementId);

  const learner = db.prepare(`
    SELECT l.*, el.id as el_id, el.overall_status
    FROM learners l
    JOIN engagement_learners el ON el.learner_id = l.id
    WHERE l.id = ? AND el.engagement_id = ?
  `).get(learnerId, engagementId);

  if (!engagement || !learner) {
    db.close();
    throw new Error('Engagement or learner not found');
  }

  // ─── Fetch clusters for this engagement ──────────────────────────────────
  const clusters = db.prepare(`
    SELECT sc.* FROM skill_clusters sc
    WHERE sc.capability_target_id = ?
    ORDER BY sc.sequence_order
  `).all(engagement.capability_target_id);

  const clusterLogs = [];

  for (const cluster of clusters) {
    // ─── Fetch skill nodes for this cluster ────────────────────────────────
    const nodes = db.prepare(`
      SELECT sn.* FROM skill_nodes sn
      WHERE sn.cluster_id = ?
      ORDER BY sn.sequence_order
    `).all(cluster.id);

    const nodeLogs = [];

    for (const node of nodes) {
      const masteryRecord = db.prepare(`
        SELECT nm.* FROM node_mastery nm
        WHERE nm.engagement_learner_id = ? AND nm.skill_node_id = ?
      `).get(learner.el_id, node.id);

      const checkResults = db.prepare(`
        SELECT mc.* FROM mastery_checks mc
        WHERE mc.engagement_learner_id = ? AND mc.skill_node_id = ?
        ORDER BY mc.created_at
      `).all(learner.el_id, node.id);

      nodeLogs.push({
        skill_node: node.node_label,
        mastery_attainment: masteryRecord ? Math.round((masteryRecord.mastery_attainment || 0) * 100) : null,
        time_to_mastery_minutes: masteryRecord ? Math.round(masteryRecord.time_to_mastery_minutes || 0) : null,
        attempt_count: masteryRecord ? (masteryRecord.attempt_count || 0) : (checkResults.length || 0),
        confidence_indicator: confidenceLabel(masteryRecord ? masteryRecord.confidence_indicator || 0 : 0, !!masteryRecord),
        advanced: !!(masteryRecord && masteryRecord.advanced_at)
      });
    }

    const simulationReadiness = calculateSimulationReadiness(
      nodes.map(n => {
        const mr = db.prepare(`SELECT * FROM node_mastery WHERE engagement_learner_id = ? AND skill_node_id = ?`).get(learner.el_id, n.id);
        return { mastery_attainment: mr ? mr.mastery_attainment || 0 : 0, confidence_indicator: mr ? mr.confidence_indicator || 0 : 0 };
      })
    );

    const masteredNodes = nodeLogs.filter(n => n.mastery_attainment !== null);
    const clusterMasteryAverage = masteredNodes.length > 0
      ? Math.round(masteredNodes.reduce((s, n) => s + n.mastery_attainment, 0) / masteredNodes.length)
      : null;

    clusterLogs.push({
      cluster: cluster.cluster_label,
      cluster_ref: cluster.cluster_ref || null,
      nodes: nodeLogs,
      cluster_mastery_average: clusterMasteryAverage,
      simulation_readiness_flag: simulationReadiness,
      // ─── BLANK FIELDS — always present, always blank ─────────────────
      readiness_classification: null,  // OWNED BY COMMISSIONING CLIENT — ALWAYS BLANK
      external_score: null             // OWNED BY COMMISSIONING CLIENT — ALWAYS BLANK
    });
  }

  // ─── Compile full Mastery Log ─────────────────────────────────────────────
  const masteryLog = {
    learner_reference: learner.learner_ref,
    learner_name: learner.name,
    capability_target_reference: `${engagement.ct_title} v${engagement.ct_version}`,
    engagement_title: engagement.title,
    language_of_instruction: learner.language,
    produced_at: new Date().toISOString(),

    clusters: clusterLogs,

    // ─── PERMANENT BLANK FIELDS ─────────────────────────────────────────
    // Always blank — presence is intentional. Qubirex produces evidence and
    // stops there. Readiness and scoring belong to the commissioning client.
    readiness_classification: null,
    external_score: null,

    qubirex_note: 'Readiness Classification and External Score are owned by the commissioning client. Qubirex does not populate these fields.'
  };

  db.close();
  return masteryLog;
}

/**
 * Save a completed Mastery Log to the database
 */
function saveMasteryLog(engagementId, learnerId, logData) {
  const db = getDb();

  const engagement = db.prepare('SELECT capability_target_id FROM engagements WHERE id = ?').get(engagementId);
  const ct = db.prepare('SELECT title, version FROM capability_targets WHERE id = ?').get(engagement.capability_target_id);

  const id = uuidv4();
  db.prepare(`
    INSERT INTO mastery_logs (id, engagement_id, learner_id, capability_target_ref, log_data)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, engagementId, learnerId, `${ct.title} v${ct.version}`, JSON.stringify(logData));

  db.close();
  return id;
}

/**
 * Produce Mastery Logs for ALL learners in an engagement
 */
function produceEngagementMasteryLogs(engagementId) {
  const db = getDb();

  const engagementLearners = db.prepare(`
    SELECT el.learner_id FROM engagement_learners el WHERE el.engagement_id = ?
  `).all(engagementId);

  const logs = [];
  for (const el of engagementLearners) {
    const log = produceLearnerMasteryLog(engagementId, el.learner_id);
    const logId = saveMasteryLog(engagementId, el.learner_id, log);
    logs.push({ learner_id: el.learner_id, log_id: logId, log });
  }

  db.prepare(`UPDATE engagements SET status = 'completed', completed_at = datetime('now') WHERE id = ?`)
    .run(engagementId);

  db.close();
  return logs;
}

/**
 * Get a saved Mastery Log
 */
function getMasteryLog(logId) {
  const db = getDb();
  const record = db.prepare('SELECT * FROM mastery_logs WHERE id = ?').get(logId);
  db.close();
  if (!record) return null;
  return { ...record, log_data: JSON.parse(record.log_data) };
}

module.exports = {
  produceLearnerMasteryLog,
  saveMasteryLog,
  produceEngagementMasteryLogs,
  getMasteryLog
};
