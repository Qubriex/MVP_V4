// core/evidence/calibration.js
// Faculty review (v4.3 §7.8).
//
// Two strata, kept apart:
//   DECISION    — 100% of persistence passes, borderline disagreements,
//                 authenticity escalations and weak vivas. Decides those checks.
//                 Never used for κ.
//   CALIBRATION — a random sample at p_node = clamp(30 / expected checks at the
//                 node in the next 8 weeks, 0.10, 1.00). Only these feed κ.
// Priority when the weekly minutes cap is reached:
//   persistence > authenticity > weak viva > borderline > random.
import crypto from 'crypto';
import * as dal from '../db/dal.js';
import { ulid } from '../db/ulid.js';
import params from '../../config/params.js';

export const PRIORITY = { persistence: 1, authenticity: 2, weak_viva: 3, borderline: 4, random: 5 };
export const BANDS = ['0.0-0.49', '0.5-0.69', '0.7-0.89', '0.9-1.0'];
export const bandOf = (score) => (score < 0.5 ? BANDS[0] : score < 0.7 ? BANDS[1] : score < 0.9 ? BANDS[2] : BANDS[3]);

/** Expected checks at a node over the next `weeks` for a cohort (historical rate, else a prior of 1.5 per learner). */
export function expectedChecks(engagementId, nodeId) {
  const learners = dal.one(`SELECT COUNT(*) n FROM engagement_learners el WHERE el.engagement_id = ? AND COALESCE(el.access_status,'active') != 'removed'
    AND NOT EXISTS (SELECT 1 FROM node_mastery nm WHERE nm.engagement_learner_id = el.id AND nm.skill_node_id = ? AND nm.advanced_at IS NOT NULL)`, engagementId, nodeId).n;
  const hist = dal.one(`SELECT COUNT(*) checks, COUNT(DISTINCT el_id) learners FROM evidence_records WHERE node_id = ? AND purpose = 'check'`, nodeId);
  const perLearner = hist.learners >= 5 ? hist.checks / hist.learners : 1.5;
  return learners * perLearner;
}

export function pNode(engagementId, nodeId) {
  const f = params.get('evidence.faculty');
  const expected = expectedChecks(engagementId, nodeId);
  return Math.min(f.maxSampleRate, Math.max(f.minSampleRate, f.calibrationTarget / Math.max(1, expected)));
}

/**
 * Queue an evaluated check for faculty review when its stratum requires it.
 * `decision` = { stratum: 'decision', reason } from the assessment, or null
 * (then the calibration stratum samples it at p_node).
 * @returns {null | {id: string, stratum: string, reason: string}}
 */
export function enqueueReview({ evidenceId, elId, nodeId, institutionId, engagementId, decision, rand = () => crypto.randomInt(1e9) / 1e9 }) {
  let stratum; let reason;
  if (decision) { stratum = 'decision'; reason = decision.reason; } else {
    if (rand() >= pNode(engagementId, nodeId)) return null;
    stratum = 'calibration'; reason = 'random';
  }
  const id = ulid();
  dal.run(`INSERT OR IGNORE INTO review_queue (id, evidence_id, el_id, node_id, institution_id, engagement_id, stratum, reason, priority, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)`, id, evidenceId, elId, nodeId, institutionId, engagementId, stratum, reason, PRIORITY[reason], dal.nowIso());
  return { id, stratum, reason };
}
