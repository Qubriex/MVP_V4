// core/devices.js
// One device at a time for learners (paid seats are personal). Signing in on
// a new device ends the learner's other sessions; the old device is told why
// on its next request. The same account signing in from two different cities
// on one day is written to the student's access history for the institution.
//
// Why this is enough: sharing an account cannot give a friend a record in
// their own name, because the spoken explain-your-answer checks have to come
// from the person who learned.
import * as dal from './db/dal.js';
import { ulid } from './db/ulid.js';

export const OTHER_DEVICE = 'other_device';
export const OTHER_DEVICE_MESSAGE = 'You were signed out because your account was used on another device.';

/** "Chrome on Android", "Safari on iPhone"… from the User-Agent. */
export function deviceLabel(ua = '') {
  const s = String(ua);
  const os = /iPhone/.test(s) ? 'iPhone' : /iPad/.test(s) ? 'iPad' : /Android/.test(s) ? 'Android' : /Windows/.test(s) ? 'Windows' : /Mac OS X|Macintosh/.test(s) ? 'Mac' : /Linux/.test(s) ? 'Linux' : 'a device';
  const br = /Edg\//.test(s) ? 'Edge' : /OPR\//.test(s) ? 'Opera' : /SamsungBrowser/.test(s) ? 'Samsung Internet' : /CriOS|Chrome\//.test(s) ? 'Chrome' : /FxiOS|Firefox\//.test(s) ? 'Firefox' : /Safari\//.test(s) ? 'Safari' : 'a browser';
  return `${br} on ${os}`;
}

/** City from Vercel's edge headers (URL-encoded), when present. */
export function cityOf(req) {
  const raw = req?.headers?.['x-vercel-ip-city'];
  if (!raw) return null;
  try { return decodeURIComponent(String(raw)).slice(0, 80); } catch { return String(raw).slice(0, 80); }
}

const istDay = (iso) => new Date(Date.parse(iso) + 5.5 * 3600000).toISOString().slice(0, 10);

/**
 * After a learner signs in: label the new session, end their other sessions,
 * and flag two cities in one day.
 */
export async function afterLearnerSignIn({ sessionId, learnerId, elId, institutionId, req }) {
  const city = cityOf(req);
  await dal.run('UPDATE auth_sessions SET device_label = ?, city = ? WHERE id = ?', deviceLabel(req?.headers?.['user-agent']), city, sessionId);
  const ended = await dal.run(`UPDATE auth_sessions SET revoked_at = ?, revoked_reason = ?
    WHERE actor_type = 'learner' AND actor_id = ? AND id != ? AND revoked_at IS NULL AND expires_at > ?`,
  dal.nowIso(), OTHER_DEVICE, learnerId, sessionId, dal.nowIso());
  if (!city) return { ended: ended.changes };
  const today = istDay(new Date().toISOString());
  const cities = new Set((await dal.all(`SELECT city, created_at FROM auth_sessions WHERE actor_type = 'learner' AND actor_id = ? AND city IS NOT NULL AND created_at > ?`,
    learnerId, new Date(Date.now() - 36 * 3600000).toISOString())).filter(r => istDay(r.created_at) === today).map(r => r.city));
  if (cities.size > 1) {
    const already = await dal.one(`SELECT 1 FROM access_events WHERE learner_id = ? AND event = 'shared_account_suspected' AND created_at > ?`,
      learnerId, new Date(Date.now() - 20 * 3600000).toISOString());
    if (!already) {
      await dal.run(`INSERT INTO access_events (id, institution_id, learner_id, engagement_learner_id, event, detail, created_at) VALUES (?, ?, ?, ?, 'shared_account_suspected', ?, ?)`,
        ulid(), institutionId, learnerId, elId, `Signed in from ${[...cities].join(' and ')} on the same day`, dal.nowIso());
    }
  }
  return { ended: ended.changes };
}

/** The learner's sessions that are still signed in (Settings → Active devices). */
export async function activeDevices(learnerId, currentSid) {
  return (await dal.all(`SELECT id, device_label, city, created_at FROM auth_sessions
    WHERE actor_type = 'learner' AND actor_id = ? AND revoked_at IS NULL AND expires_at > ? ORDER BY created_at DESC`, learnerId, dal.nowIso()))
    .map(r => ({ id: r.id, device: r.device_label || 'This device', city: r.city, signed_in_at: r.created_at, current: r.id === currentSid }));
}
