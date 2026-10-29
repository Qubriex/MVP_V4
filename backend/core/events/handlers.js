// core/events/handlers.js — live subscriptions for the §7 routing table.
// Imported once by server.js (and by tests that run the worker).
import { subscribe } from './subscribers.js';
import * as dal from '../db/dal.js';
import { issueCredential } from '../return/credentialEngine.js';
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

  // NODE_ADVANCED in a demo sandbox → reissue that learner's demo Passport, so
  // a visitor sees "lesson → check → Passport updates" within the demo. Real
  // and test Passports keep reissuing only with a new Mastery Log.
  subscribe('NODE_ADVANCED', 'DEMO.passportRefresh', async (event) => {
    const elId = event.aggregate_id || event.aggregateId;
    const demo = await dal.one(`SELECT 1 FROM engagement_learners el JOIN engagements e ON e.id = el.engagement_id JOIN institutions i ON i.id = e.institution_id
      WHERE el.id = ? AND i.sandbox_id IS NOT NULL AND EXISTS (SELECT 1 FROM credentials c WHERE c.el_id = el.id AND c.active = 1)`, elId);
    if (!demo) return;
    const r = await issueCredential(elId, { reason: 'demo_mastery' });
    if (r) logger.info('passport.demo_reissued', { evidenceId: r.evidence_id, version: r.version });
  });

  // CONSENT_WITHDRAWN → MATCH.dropLearner: nothing to drop until search exists (Phase 1).
  subscribe('CONSENT_WITHDRAWN', 'MATCH.dropLearner', () => {});

  // A faculty rejection of a passed check reopens the node for a recheck;
  // the learner sees it under Reviews due (no further work here).
  subscribe('FACULTY_REVIEW_DONE', 'EVIDENCE.applyReview', () => {});

  return dal;
}
