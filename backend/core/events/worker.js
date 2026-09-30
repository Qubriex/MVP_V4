// core/events/worker.js
// Outbox worker (spec §7):
//   - polls every outbox.pollMs (2 s);
//   - delivers in created_at order per aggregate: an event waits while an
//     earlier event of the same aggregate is still undelivered;
//   - retries with backoff outbox.backoffMinutes (1m, 5m, 30m, 2h, 12h), then
//     dead-letters;
//   - subscribers are idempotent on event id: each successful (event,
//     subscriber) pair is recorded in event_consumptions and never re-run.
// Several processes may drain at once (serverless instances, a cron call):
// each event is claimed with FOR UPDATE SKIP LOCKED and delivered inside that
// transaction, so a subscriber's writes and the delivery mark commit together
// and no event is delivered twice.
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

// Each subscriber runs in its own savepoint: its writes and its consumption
// record commit together, and a later subscriber's failure does not undo them.
// Returns the first error, or null when every subscriber has consumed it.
async function deliver(event, nowIso) {
  const parsed = { ...event, payload: JSON.parse(event.payload_json || '{}') };
  for (const [name, handler] of subscribersFor(event.type)) {
    const done = await dal.one('SELECT 1 FROM event_consumptions WHERE event_id = ? AND subscriber = ?', event.id, name);
    if (done) continue;
    try {
      await dal.tx(async () => {
        await handler(parsed);
        await dal.run('INSERT OR IGNORE INTO event_consumptions (event_id, subscriber, consumed_at) VALUES (?, ?, ?)', event.id, name, nowIso());
      });
    } catch (err) {
      return err;
    }
  }
  return null;
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
        const heads = (await dal.all(HEADS_SQL, nowIso(), batch)).filter(e => !blocked.has(`${e.aggregate_type}:${e.aggregate_id}`));
        if (!heads.length) break;
        for (const event of heads) {
          const result = await dal.tx(async () => {
            const row = await dal.one(`SELECT * FROM domain_events WHERE id = ? AND delivered_at IS NULL AND dead_lettered_at IS NULL
              FOR UPDATE SKIP LOCKED`, event.id);
            if (!row) return 'skipped';
            const err = await deliver(row, nowIso);
            if (!err) {
              await dal.run('UPDATE domain_events SET delivered_at = ?, attempts = attempts + 1, last_error = NULL WHERE id = ?', nowIso(), row.id);
              return 'delivered';
            }
            blocked.add(`${row.aggregate_type}:${row.aggregate_id}`);
            const attempts = row.attempts + 1;
            const message = String(err?.message || err).slice(0, 500);
            if (attempts > backoff.length) {
              await dal.run('UPDATE domain_events SET attempts = ?, last_error = ?, dead_lettered_at = ? WHERE id = ?', attempts, message, nowIso(), row.id);
              log.error('event.dead_lettered', { eventId: row.id, type: row.type, attempts, error: err?.message });
              return 'deadLettered';
            }
            const next = new Date(now() + backoff[attempts - 1] * 60000).toISOString();
            await dal.run('UPDATE domain_events SET attempts = ?, last_error = ?, next_attempt_at = ? WHERE id = ?', attempts, message, next, row.id);
            log.warn('event.retry_scheduled', { eventId: row.id, type: row.type, attempts, next });
            return 'failed';
          });
          if (result !== 'skipped') out[result] += 1;
          else blocked.add(`${event.aggregate_type}:${event.aggregate_id}`);
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
