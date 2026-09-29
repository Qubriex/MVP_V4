// core/events/worker.js
// Outbox worker (spec §7):
//   - polls every outbox.pollMs (2 s);
//   - delivers in created_at order per aggregate: an event waits while an
//     earlier event of the same aggregate is still undelivered;
//   - retries with backoff outbox.backoffMinutes (1m, 5m, 30m, 2h, 12h), then
//     dead-letters;
//   - subscribers are idempotent on event id: each successful (event,
//     subscriber) pair is recorded in event_consumptions and never re-run.
// One worker per process in Phase 0 (docs/decisions.md D-007).
import * as dal from '../db/dal.js';
import params from '../../config/params.js';
import { logger } from '../logger.js';
import { subscribersFor } from './subscribers.js';

const log = logger.child({ component: 'outbox' });

// Undelivered events with nothing earlier pending on the same aggregate.
const HEADS_SQL = `
  SELECT e.* FROM domain_events e
  WHERE e.delivered_at IS NULL AND e.dead_lettered_at IS NULL
    AND (e.next_attempt_at IS NULL OR e.next_attempt_at <= ?)
    AND NOT EXISTS (
      SELECT 1 FROM domain_events p
      WHERE p.aggregate_type = e.aggregate_type AND p.aggregate_id = e.aggregate_id
        AND p.delivered_at IS NULL AND p.dead_lettered_at IS NULL
        AND (p.created_at < e.created_at OR (p.created_at = e.created_at AND p.id < e.id))
    )
  ORDER BY e.created_at, e.id
  LIMIT ?`;

async function deliver(event, nowIso) {
  const parsed = { ...event, payload: JSON.parse(event.payload_json || '{}') };
  for (const [name, handler] of subscribersFor(event.type)) {
    const done = dal.one('SELECT 1 FROM event_consumptions WHERE event_id = ? AND subscriber = ?', event.id, name);
    if (done) continue;
    await handler(parsed);
    dal.run('INSERT OR IGNORE INTO event_consumptions (event_id, subscriber, consumed_at) VALUES (?, ?, ?)', event.id, name, nowIso());
  }
}

/**
 * @param {{ now?: () => number, pollMs?: number, batch?: number, backoffMinutes?: number[] }} [opts]
 */
export function createWorker(opts = {}) {
  const now = opts.now || Date.now;
  const nowIso = () => new Date(now()).toISOString();
  const pollMs = opts.pollMs ?? params.get('outbox.pollMs');
  const batch = opts.batch ?? params.get('outbox.batch');
  const backoff = opts.backoffMinutes ?? params.get('outbox.backoffMinutes');
  let timer = null;
  let running = false;

  /** Deliver everything currently due. Returns counts for tests and metrics. */
  async function tick() {
    if (running) return { delivered: 0, failed: 0, deadLettered: 0, skipped: true };
    running = true;
    const out = { delivered: 0, failed: 0, deadLettered: 0 };
    const blocked = new Set(); // aggregates that failed during this tick
    try {
      for (let guard = 0; guard < batch; guard += 1) {
        const heads = dal.all(HEADS_SQL, nowIso(), batch).filter(e => !blocked.has(`${e.aggregate_type}:${e.aggregate_id}`));
        if (!heads.length) break;
        for (const event of heads) {
          try {
            await deliver(event, nowIso);
            dal.run('UPDATE domain_events SET delivered_at = ?, attempts = attempts + 1, last_error = NULL WHERE id = ?', nowIso(), event.id);
            out.delivered += 1;
          } catch (err) {
            blocked.add(`${event.aggregate_type}:${event.aggregate_id}`);
            const attempts = event.attempts + 1;
            if (attempts > backoff.length) {
              dal.run('UPDATE domain_events SET attempts = ?, last_error = ?, dead_lettered_at = ? WHERE id = ?',
                attempts, String(err?.message || err).slice(0, 500), nowIso(), event.id);
              out.deadLettered += 1;
              log.error('event.dead_lettered', { eventId: event.id, type: event.type, attempts, error: err?.message });
            } else {
              const next = new Date(now() + backoff[attempts - 1] * 60000).toISOString();
              dal.run('UPDATE domain_events SET attempts = ?, last_error = ?, next_attempt_at = ? WHERE id = ?',
                attempts, String(err?.message || err).slice(0, 500), next, event.id);
              out.failed += 1;
              log.warn('event.retry_scheduled', { eventId: event.id, type: event.type, attempts, next });
            }
          }
        }
        if (out.delivered + out.failed + out.deadLettered >= batch) break;
      }
    } finally {
      running = false;
    }
    return out;
  }

  return {
    tick,
    start() {
      if (timer) return;
      timer = setInterval(() => { tick().catch(err => log.error('outbox.tick_failed', { error: err.message })); }, pollMs);
      timer.unref?.();
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
    }
  };
}
