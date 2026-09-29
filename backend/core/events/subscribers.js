// core/events/subscribers.js
// Who reacts to which event. Brains and engines couple only through these
// subscriptions (spec §2). Handlers must be idempotent on event id; the worker
// also records each (event, subscriber) pair in event_consumptions and never
// calls a handler twice for the same event once it has succeeded.
//
// ROUTES is the §7 routing table. A route becomes live when its module is
// built and calls subscribe(); until then events are recorded and delivered to
// nobody (they still count as delivered, so the log is complete for Phase 2).
export const ROUTES = {
  NODE_ADVANCED: ['RETENTION.schedule', 'READINESS.refresh', 'PASSPORT.appendDemonstration'],
  NODE_LOOPED: ['READINESS.earlyWarning'],
  CHECK_EVALUATED: ['EVIDENCE.sampleForReview', 'EVIDENCE.authenticityGate'],
  REVIEW_DUE: ['ORCH.queueWarmup'],
  REVIEW_PASSED: ['RETENTION.reschedule', 'PASSPORT.appendDemonstration'],
  REVIEW_FAILED: ['RETENTION.reschedule', 'PASSPORT.appendDemonstration'],
  CURRICULUM_COMPLETE: ['PRACTICAL.dispatch', 'MASTERYLOG.produceFinal'],
  MASTERY_LOG_PRODUCED: ['PASSPORT.issue'],
  CREDENTIAL_ISSUED: ['MATCH.reindex', 'WEBHOOKS.consentedShares'],
  CREDENTIAL_REISSUED: ['MATCH.reindex', 'WEBHOOKS.consentedShares'],
  CREDENTIAL_REVOKED: ['MATCH.reindex', 'WEBHOOKS.consentedShares'],
  ATTESTATION_APPENDED: ['MATCH.reindex', 'READINESS.refresh'],
  ACCESS_REQUESTED: ['NOTIFY.accessRequest'],
  ACCESS_APPROVED: ['NOTIFY.accessRequest', 'BILLING.meter'],
  ACCESS_DENIED: ['NOTIFY.accessRequest'],
  ACCESS_EXPIRED: ['NOTIFY.accessRequest'],
  PRACTICAL_GRADED: ['PASSPORT.appendDemonstration'],
  DAYONE_GRADED: ['PASSPORT.appendDemonstration'],
  FACULTY_REVIEW_DONE: ['EVIDENCE.applyReview', 'EVIDENCE.calibrationStats'],
  ROLE_POSTED: ['MATCH.precompute', 'OUTCOME.demand'],
  OUTCOME_RECORDED: ['OUTCOME.validity', 'INSIGHTS.institution'],
  DRIFT_ALARM: ['GATEWAY.freezeRoute', 'ADMIN.alert'],
  LEARNER_AGE_CONFIRMED: ['CONSENT.applyMinorPolicy'],
  READINESS_THRESHOLD_CROSSED: ['REVERSE.interviewTrigger'],
  CONSENT_WITHDRAWN: ['MATCH.dropLearner']
};

/** @type {Map<string, Map<string, (event: object) => any>>} */
const registry = new Map();

export function subscribe(type, name, handler) {
  if (!registry.has(type)) registry.set(type, new Map());
  registry.get(type).set(name, handler);
  return () => registry.get(type)?.delete(name);
}

/** @returns {Array<[string, Function]>} [name, handler] pairs */
export function subscribersFor(type) {
  return [...(registry.get(type)?.entries() || [])];
}

export function clearSubscribers() {
  registry.clear();
}
