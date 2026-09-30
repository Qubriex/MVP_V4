// core/learner/activeTime.js
// Active minutes (v4.3 §6): session heartbeats every 30 s while the tab is
// visible AND the learner gave input within the last 3 minutes. Calendar time
// never counts. Each valid heartbeat credits one interval; heartbeats closer
// together than 25 s (by their own timestamp) credit nothing, so neither a
// fast client nor a replayed offline queue can inflate time. Offline-queued
// heartbeats carry their original timestamps (§19).
import * as dal from '../db/dal.js';
import params from '../../config/params.js';

/**
 * @param {{sessionId: string, elId: string, occurredAt?: string, lastInputAt?: string, visible?: boolean}} hb
 * @returns {{credited: number, reason: string|null}} seconds credited
 */
export async function heartbeat({ sessionId, elId, occurredAt, lastInputAt, visible = true }) {
  const { intervalSeconds, inputWithinMinutes } = params.get('learner.heartbeat');
  const session = await dal.one("SELECT id, last_heartbeat_at FROM learning_sessions WHERE id = ? AND engagement_learner_id = ? AND status = 'active'", sessionId, elId);
  if (!session) return { credited: 0, reason: 'no_active_session' };
  const now = Date.now();
  let at = Date.parse(occurredAt || '');
  if (!Number.isFinite(at) || at > now + 60000 || at < now - 7 * 86400000) at = now; // clamp client clocks
  if (!visible) return { credited: 0, reason: 'hidden' };
  const input = Date.parse(lastInputAt || '');
  if (!Number.isFinite(input) || at - input > inputWithinMinutes * 60000) return { credited: 0, reason: 'idle' };
  const last = Date.parse(session.last_heartbeat_at || '');
  if (Number.isFinite(last) && Math.abs(at - last) < (intervalSeconds - 5) * 1000) return { credited: 0, reason: 'too_soon' };
  await dal.run(`UPDATE learning_sessions SET active_minutes = active_minutes + ?,
    last_heartbeat_at = CASE WHEN last_heartbeat_at IS NULL OR last_heartbeat_at < ? THEN ? ELSE last_heartbeat_at END WHERE id = ?`,
  intervalSeconds / 60, new Date(at).toISOString(), new Date(at).toISOString(), sessionId);
  return { credited: intervalSeconds, reason: null };
}
