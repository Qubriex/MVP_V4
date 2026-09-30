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

  // CONSENT_WITHDRAWN → MATCH.dropLearner: nothing to drop until search exists (Phase 1).
  subscribe('CONSENT_WITHDRAWN', 'MATCH.dropLearner', () => {});

  // A faculty rejection of a passed check reopens the node for a recheck;
  // the learner sees it under Reviews due (no further work here).
  subscribe('FACULTY_REVIEW_DONE', 'EVIDENCE.applyReview', () => {});

  return dal;
}
