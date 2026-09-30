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

import { legacyHandle as getDb } from './db/dal.js';
import { calculateSimulationReadiness, calculateConfidenceIndicator } from './instructionEngine.js';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { canonicalBytes } from './return/canonical.js';
import { signBytes } from './return/signing.js';
import { newEvidenceId } from './qep/evidenceId.js';
import { emit } from './events/outbox.js';
import { mapSeq } from './util/seq.js';

// Confidence is computed from the facts (mastery checks and loops) whenever it
// is read. It is never stored: sign facts, compute labels (spec §2, §6).
async function nodeConfidence(db, elId, nodeId) {
  const checks = (await db.prepare(`
    SELECT score, passed FROM mastery_checks
    WHERE engagement_learner_id = ? AND skill_node_id = ? AND passed IS NOT NULL ORDER BY created_at
  `).all(elId, nodeId)).map(c => ({ score: c.score, passed: !!c.passed }));
  const loops = (await db.prepare('SELECT COALESCE(MAX(loop_count), 0) AS n FROM learning_sessions WHERE engagement_learner_id = ? AND skill_node_id = ?')
    .get(elId, nodeId)).n;
  return calculateConfidenceIndicator(checks, loops);
}

function confidenceLabel(confidenceIndicator, hasRecord) {
  if (!hasRecord) return 'not_started';
  if (confidenceIndicator >= 0.75) return 'high';
  if (confidenceIndicator >= 0.55) return 'solid';
  return 'building';
}

/**
 * Produce the Mastery Log for a learner in an engagement
 */
async function produceLearnerMasteryLog(engagementId, learnerId) {
  const db = getDb();

  // ─── Fetch core data ─────────────────────────────────────────────────────
  const engagement = await db.prepare(`
    SELECT e.*, ct.version as ct_version, ct.title as ct_title,
           ct.extracted_targets, i.name as institution_name
    FROM engagements e
    JOIN capability_targets ct ON e.capability_target_id = ct.id
    JOIN institutions i ON e.institution_id = i.id
    WHERE e.id = ?
  `).get(engagementId);

  const learner = await db.prepare(`
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
  const clusters = await db.prepare(`
    SELECT sc.* FROM skill_clusters sc
    WHERE sc.capability_target_id = ?
    ORDER BY sc.sequence_order
  `).all(engagement.capability_target_id);

  const clusterLogs = [];

  for (const cluster of clusters) {
    // ─── Fetch skill nodes for this cluster ────────────────────────────────
    const nodes = await db.prepare(`
      SELECT sn.* FROM skill_nodes sn
      WHERE sn.cluster_id = ?
      ORDER BY sn.sequence_order
    `).all(cluster.id);

    const nodeLogs = [];

    for (const node of nodes) {
      const masteryRecord = await db.prepare(`
        SELECT nm.* FROM node_mastery nm
        WHERE nm.engagement_learner_id = ? AND nm.skill_node_id = ?
      `).get(learner.el_id, node.id);

      const checkResults = await db.prepare(`
        SELECT mc.* FROM mastery_checks mc
        WHERE mc.engagement_learner_id = ? AND mc.skill_node_id = ?
        ORDER BY mc.created_at
      `).all(learner.el_id, node.id);

      nodeLogs.push({
        skill_node: node.node_label,
        mastery_attainment: masteryRecord ? Math.round((masteryRecord.mastery_attainment || 0) * 100) : null,
        time_to_mastery_minutes: masteryRecord ? Math.round(masteryRecord.time_to_mastery_minutes || 0) : null,
        attempt_count: masteryRecord ? (masteryRecord.attempt_count || 0) : (checkResults.length || 0),
        confidence_indicator: confidenceLabel(masteryRecord ? await nodeConfidence(db, learner.el_id, node.id) : 0, !!masteryRecord),
        advanced: !!(masteryRecord && masteryRecord.advanced_at)
      });
    }

    const simulationReadiness = calculateSimulationReadiness(
      await mapSeq(nodes, async n => {
        const mr = await db.prepare(`SELECT * FROM node_mastery WHERE engagement_learner_id = ? AND skill_node_id = ?`).get(learner.el_id, n.id);
        return { mastery_attainment: mr ? mr.mastery_attainment || 0 : 0, passed: !!(mr && mr.advanced_at) };
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
async function saveMasteryLog(engagementId, learnerId, logData) {
  const db = getDb();

  const engagement = await db.prepare('SELECT capability_target_id FROM engagements WHERE id = ?').get(engagementId);
  const ct = await db.prepare('SELECT title, version FROM capability_targets WHERE id = ?').get(engagement.capability_target_id);

  // Integrity (v4.3 §9): an Evidence ID and the SHA-256 of the canonical
  // (RFC 8785) JSON, signed. The Evidence ID is kept across re-production.
  const previous = await db.prepare('SELECT evidence_id FROM mastery_logs WHERE engagement_id = ? AND learner_id = ?').get(engagementId, learnerId);
  const evidenceId = previous?.evidence_id || newEvidenceId();
  const bytes = canonicalBytes({ ...logData, evidence_id: evidenceId });
  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  const signature = await signBytes(bytes);
  const el = await db.prepare('SELECT id FROM engagement_learners WHERE engagement_id = ? AND learner_id = ?').get(engagementId, learnerId);

  // One current log per learner per engagement: producing again replaces it.
  const id = uuidv4();
  await db.transaction(async () => {
    await db.prepare('DELETE FROM mastery_logs WHERE engagement_id = ? AND learner_id = ?').run(engagementId, learnerId);
    await db.prepare(`
      INSERT INTO mastery_logs (id, engagement_id, learner_id, capability_target_ref, log_data, evidence_id, sha256, signature_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, engagementId, learnerId, `${ct.title} v${ct.version}`, JSON.stringify({ ...logData, evidence_id: evidenceId }), evidenceId, sha256, JSON.stringify(signature));
    // MASTERY_LOG_PRODUCED → PASSPORT.issue (v4.3 §7).
    if (el) await emit('MASTERY_LOG_PRODUCED', { aggregateType: 'enrolment', aggregateId: el.id, payload: { el_id: el.id, log_id: id, evidence_id: evidenceId } }, db);
  })();

  db.close();
  return id;
}

/**
 * Produce Mastery Logs for ALL learners in an engagement
 */
// Produce logs for a whole cohort, or only for `learnerIds`. `complete: true`
// also marks the engagement completed (end of programme); producing logs
// part-way (e.g. after a cluster) leaves the cohort active.
async function produceEngagementMasteryLogs(engagementId, { complete = false, learnerIds = null } = {}) {
  const db = getDb();

  const engagementLearners = (await db.prepare(`
    SELECT el.learner_id FROM engagement_learners el WHERE el.engagement_id = ?
  `).all(engagementId)).filter(el => !learnerIds || learnerIds.includes(el.learner_id));

  const logs = [];
  for (const el of engagementLearners) {
    const log = await produceLearnerMasteryLog(engagementId, el.learner_id);
    const logId = await saveMasteryLog(engagementId, el.learner_id, log);
    logs.push({ learner_id: el.learner_id, log_id: logId, log });
  }

  if (complete) {
    await db.prepare(`UPDATE engagements SET status = 'completed', completed_at = datetime('now') WHERE id = ?`)
      .run(engagementId);
  }

  db.close();
  return logs;
}

/**
 * Get a saved Mastery Log
 */
async function getMasteryLog(logId) {
  const db = getDb();
  const record = await db.prepare('SELECT * FROM mastery_logs WHERE id = ?').get(logId);
  db.close();
  if (!record) return null;
  return { ...record, log_data: JSON.parse(record.log_data) };
}

export { nodeConfidence, confidenceLabel, produceLearnerMasteryLog, saveMasteryLog, produceEngagementMasteryLogs, getMasteryLog };
