// core/journey/notifyPrefs.js — a learner's notification preferences, per event and channel.
// Kept apart from the other journey modules: core/notify.js imports it, and
// notify is reached from employer routes (tests/structural/walls.js).
import * as dal from '../db/dal.js';

export const NOTIFY_EVENTS = ['review_due', 'check_result', 'employer_request', 'application_update', 'bridge_assigned', 'passport_renewal'];
export const NOTIFY_CHANNELS = ['in_app', 'whatsapp', 'email'];
// Required: always in the app (they need a decision or tell you a result).
export const REQUIRED = { employer_request: ['in_app'], application_update: ['in_app'], check_result: ['in_app'] };
const DEFAULTS = {
  review_due: { in_app: 1, whatsapp: 1, email: 0 }, check_result: { in_app: 1, whatsapp: 0, email: 0 },
  employer_request: { in_app: 1, whatsapp: 1, email: 1 }, application_update: { in_app: 1, whatsapp: 1, email: 1 },
  bridge_assigned: { in_app: 1, whatsapp: 1, email: 0 }, passport_renewal: { in_app: 1, whatsapp: 0, email: 1 }
};
// Which notification kinds belong to which event.
export const EVENT_OF_KIND = (kind) => (/^employer_request$/.test(kind) ? 'employer_request'
  : /^employer_/.test(kind) ? 'application_update' : kind === 'bridge' ? 'bridge_assigned'
    : /review/.test(kind) ? 'review_due' : /renew/.test(kind) ? 'passport_renewal' : /check/.test(kind) ? 'check_result' : null);

export async function notificationPrefs(learnerId) {
  const rows = await dal.all('SELECT event, channel, enabled FROM notification_prefs WHERE learner_id = ?', learnerId);
  const set = new Map(rows.map(r => [`${r.event}|${r.channel}`, !!r.enabled]));
  return NOTIFY_EVENTS.map(event => ({
    event, required: REQUIRED[event] || [],
    channels: Object.fromEntries(NOTIFY_CHANNELS.map(c => [c, (REQUIRED[event] || []).includes(c) ? true : set.has(`${event}|${c}`) ? set.get(`${event}|${c}`) : !!DEFAULTS[event][c]]))
  }));
}

export async function setNotificationPrefs(learnerId, prefs = []) {
  const now = dal.nowIso();
  for (const p of Array.isArray(prefs) ? prefs : []) {
    if (!NOTIFY_EVENTS.includes(p?.event)) continue;
    for (const c of NOTIFY_CHANNELS) {
      if (p.channels?.[c] === undefined || (REQUIRED[p.event] || []).includes(c)) continue;
      await dal.run(`INSERT INTO notification_prefs (learner_id, event, channel, enabled, updated_at) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT (learner_id, event, channel) DO UPDATE SET enabled = excluded.enabled, updated_at = excluded.updated_at`, learnerId, p.event, c, p.channels[c] ? 1 : 0, now);
    }
  }
  return notificationPrefs(learnerId);
}

/** Is this channel on for a learner's notification kind? Unknown kinds: yes. */
export async function channelOn(learnerId, kind, channel) {
  const event = EVENT_OF_KIND(kind);
  if (!event) return true;
  if ((REQUIRED[event] || []).includes(channel)) return true;
  const r = await dal.one('SELECT enabled FROM notification_prefs WHERE learner_id = ? AND event = ? AND channel = ?', learnerId, event, channel);
  return r ? !!r.enabled : !!DEFAULTS[event][channel];
}

