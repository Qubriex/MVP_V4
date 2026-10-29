// core/events/handlers.js — live subscriptions for the §7 routing table.
// Imported once by server.js (and by tests that run the worker).
import { subscribe } from './subscribers.js';
import * as dal from '../db/dal.js';
import { issueCredential } from '../return/credentialEngine.js';
import { produceLearnerMasteryLog, saveMasteryLog } from '../masteryLog.js';
import { logger } from '../logger.js';

let registered = false;

export function registerHandlers() {
  if (registered) return;
  registered = true;

  // MASTERY_LOG_PRODUCED → PASSPORT.issue (idempotent: a newer log reissues).
  subscribe('MASTERY_LOG_PRODUCED', 'PASSPORT.issue', async (event) => {
    const { el_id: elId } = event.payload;
    const r = await issueCredential(elId, { reason: 'mastery_log' });
    if (r) logger.info('passport.issued', { evidenceId: r.evidence_id, version: r.version });
  });

  // NODE_ADVANCED that finishes a skill group → the learner's Mastery Log is
  // produced again (its MASTERY_LOG_PRODUCED reissues the Passport), so the
  // skill group certificate, the log and the Passport move together.
  // In a demo sandbox or the test tenant, every pass reissues the Passport, so
  // a visitor or tester sees "lesson → check → Passport updates" at once.
  subscribe('NODE_ADVANCED', 'JOURNEY.groupComplete', async (event) => {
    const elId = event.aggregate_id || event.aggregateId;
    const nodeId = event.payload?.nodeId;
    const row = await dal.one(`SELECT el.learner_id, el.engagement_id, i.sandbox_id, i.is_test,
        EXISTS (SELECT 1 FROM credentials c WHERE c.el_id = el.id AND c.active = 1) AS has_passport,
        (SELECT COUNT(*) FROM skill_nodes x WHERE x.cluster_id = (SELECT cluster_id FROM skill_nodes WHERE id = ?)) AS in_group,
        (SELECT COUNT(*) FROM node_mastery nm JOIN skill_nodes z ON z.id = nm.skill_node_id
          WHERE nm.engagement_learner_id = el.id AND nm.advanced_at IS NOT NULL AND z.cluster_id = (SELECT cluster_id FROM skill_nodes WHERE id = ?)) AS done_in_group
      FROM engagement_learners el JOIN engagements e ON e.id = el.engagement_id JOIN institutions i ON i.id = e.institution_id WHERE el.id = ?`, nodeId, nodeId, elId);
    if (!row) return;
    if (nodeId && Number(row.in_group) > 0 && Number(row.done_in_group) === Number(row.in_group)) {
      const log = await produceLearnerMasteryLog(row.engagement_id, row.learner_id);
      await saveMasteryLog(row.engagement_id, row.learner_id, log);
      logger.info('journey.group_complete', { elId, nodeId });
      return;
    }
    if (!row.has_passport || !(row.sandbox_id || row.is_test)) return;
    const r = await issueCredential(elId, { reason: row.sandbox_id ? 'demo_mastery' : 'test_mastery' });
    if (r) logger.info('passport.reissued_on_pass', { evidenceId: r.evidence_id, version: r.version });
  });

  // CONSENT_WITHDRAWN → MATCH.dropLearner: nothing to drop until search exists (Phase 1).
  subscribe('CONSENT_WITHDRAWN', 'MATCH.dropLearner', () => {});

  // A faculty rejection of a passed check reopens the node for a recheck;
  // the learner sees it under Reviews due (no further work here).
  subscribe('FACULTY_REVIEW_DONE', 'EVIDENCE.applyReview', () => {});

  return dal;
}
