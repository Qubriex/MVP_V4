// core/events/outbox.js
// Transactional outbox (spec §2, §7). A state change and its event are written
// in the same transaction: emit() refuses to run outside one, so an event can
// never be recorded for a change that rolled back, or lost for one that
// committed. core/events/worker.js delivers them afterwards.
import { ulid } from '../db/ulid.js';
import * as dal from '../db/dal.js';

export const EVENT_TYPES = new Set([
  // §7
  'NODE_ADVANCED', 'NODE_LOOPED', 'CHECK_EVALUATED', 'REVIEW_DUE', 'REVIEW_PASSED', 'REVIEW_FAILED',
  'CURRICULUM_COMPLETE', 'MASTERY_LOG_PRODUCED', 'CREDENTIAL_ISSUED', 'CREDENTIAL_REISSUED', 'CREDENTIAL_REVOKED',
  'ATTESTATION_APPENDED', 'ACCESS_REQUESTED', 'ACCESS_APPROVED', 'ACCESS_DENIED', 'ACCESS_EXPIRED',
  'PRACTICAL_GRADED', 'DAYONE_GRADED', 'FACULTY_REVIEW_DONE', 'ROLE_POSTED', 'OUTCOME_RECORDED',
  'DRIFT_ALARM', 'LEARNER_AGE_CONFIRMED', 'READINESS_THRESHOLD_CROSSED',
  // Foundation (docs/decisions.md D-006)
  'EMPLOYER_REGISTERED', 'CONSENT_GRANTED', 'CONSENT_WITHDRAWN'
]);

const inTx = (conn) => (typeof conn.inTransaction === 'function' ? conn.inTransaction() : !!conn.inTransaction);

/**
 * Record a domain event inside the caller's transaction.
 * @param {string} type one of EVENT_TYPES
 * @param {{aggregateType: string, aggregateId: string, payload?: object}} event
 * @param {object} [conn] a DAL driver or legacy handle; defaults to the shared connection
 * @returns {string} the event id
 */
export function emit(type, { aggregateType, aggregateId, payload = {} }, conn = dal.db()) {
  if (!EVENT_TYPES.has(type)) throw new Error(`Unknown event type "${type}"`);
  if (!aggregateType || !aggregateId) throw new Error('emit() needs aggregateType and aggregateId');
  if (!inTx(conn)) throw new Error(`emit(${type}) must run inside the transaction that makes the state change`);
  const id = ulid();
  const now = dal.nowIso();
  conn.prepare(`INSERT INTO domain_events (id, type, aggregate_type, aggregate_id, payload_json, created_at, next_attempt_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, type, aggregateType, String(aggregateId), JSON.stringify(payload), now, now);
  return id;
}
