// core/notify.js
// Notifications for every side (v4.3 shared kit). Stored ones are written by
// notify() when something happens (an employer asks to see a Passport, a
// Mastery Log is ready, a bridge task is assigned). Live ones are counted on
// each read (reviews waiting, PIN resets asked for, reviews due), so they are
// never stale. "Mark all read" stores when the person last looked.
import * as dal from './db/dal.js';
import { ulid } from './db/ulid.js';

/**
 * @param {{ to: {type: 'learner'|'staff'|'institution'|'employer'|'admin', id: string}, kind: string, title: string, body?: string, href?: string }} n
 * 'institution' reaches every staff member of that institution; 'employer'
 * every user of that company.
 */
export async function notify({ to, kind, title, body = null, href = null }) {
  if (!to?.id) return null;
  const id = ulid();
  await dal.run('INSERT INTO notifications (id, actor_type, actor_id, kind, title, body, href, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    id, to.type, to.id, kind, String(title).slice(0, 200), body ? String(body).slice(0, 500) : null, href, dal.nowIso());
  return id;
}

/** Who a signed-in person is, for notifications: their own id plus their group. */
export function audienceOf(req) {
  const s = req.session;
  if (!s) return [];
  if (s.actor_type === 'learner') return [{ type: 'learner', id: s.actor_id }];
  if (s.actor_type === 'staff') return [{ type: 'staff', id: s.actor_id }, { type: 'institution', id: s.institution_id }];
  if (s.actor_type === 'employer') return [{ type: 'employer', id: s.employer_id }];
  if (s.actor_type === 'admin') return [{ type: 'admin', id: s.actor_id }];
  return [];
}
const selfKey = (req) => ({ type: req.session.actor_type, id: req.session.actor_id });

async function liveItems(req) {
  const s = req.session;
  const out = [];
  if (s.actor_type === 'staff' && s.institution_id) {
    const reviews = await dal.one("SELECT COUNT(*) AS n, MAX(created_at) AS at FROM review_queue WHERE institution_id = ? AND status = 'open'", s.institution_id);
    if (Number(reviews?.n)) out.push({ id: 'live:reviews', kind: 'reviews_waiting', title: `${reviews.n} review${Number(reviews.n) === 1 ? '' : 's'} waiting in faculty queue`, href: '/institution/review', created_at: reviews.at, live: true });
    const resets = await dal.one(`SELECT COUNT(*) AS n, MAX(created_at) AS at FROM access_events WHERE institution_id = ? AND event = 'pin_reset_requested' AND resolved = 0`, s.institution_id);
    if (Number(resets?.n)) out.push({ id: 'live:pins', kind: 'pin_resets', title: `${resets.n} student${Number(resets.n) === 1 ? '' : 's'} asked for a PIN reset`, href: '/institution/students?status=reset_requested', created_at: resets.at, live: true });
    const deletions = await dal.one(`SELECT COUNT(*) AS n, MAX(created_at) AS at FROM access_events WHERE institution_id = ? AND event = 'deletion_requested' AND resolved = 0`, s.institution_id);
    if (Number(deletions?.n)) out.push({ id: 'live:deletions', kind: 'deletion_requests', title: `${deletions.n} student${Number(deletions.n) === 1 ? '' : 's'} asked to delete their data`, href: '/institution/students', created_at: deletions.at, live: true });
  }
  if (s.actor_type === 'learner') {
    const el = req.user?.el_id;
    if (el) {
      const due = await dal.one('SELECT COUNT(*) AS n, MIN(due_at) AS at FROM node_retention WHERE el_id = ? AND due_at <= ?', el, dal.nowIso());
      if (Number(due?.n)) out.push({ id: 'live:reviews', kind: 'reviews_due', title: `${due.n} short review${Number(due.n) === 1 ? '' : 's'} due`, body: 'About 2 minutes each. They keep your Passport fresh.', href: '/learn/reviews', created_at: due.at, live: true });
    }
  }
  return out;
}

export async function listFor(req, { limit = 30 } = {}) {
  const who = audienceOf(req);
  if (!who.length) return { items: [], unread: 0 };
  const state = await dal.one('SELECT seen_at, channels_json FROM notification_state WHERE actor_type = ? AND actor_id = ?', req.session.actor_type, req.session.actor_id);
  const seen = state?.seen_at || '';
  const where = who.map(() => '(actor_type = ? AND actor_id = ?)').join(' OR ');
  const stored = await dal.all(`SELECT id, kind, title, body, href, created_at, read_at FROM notifications WHERE ${where} ORDER BY created_at DESC LIMIT ?`,
    ...who.flatMap(w => [w.type, w.id]), limit);
  const items = [...await liveItems(req), ...stored]
    .map(n => ({ ...n, unread: !n.read_at && String(n.created_at || '') > seen }))
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  let channels = { email: true, whatsapp: false, sms: false };
  try { channels = { ...channels, ...JSON.parse(state?.channels_json || '{}') }; } catch { /* default */ }
  return { items, unread: items.filter(n => n.unread).length, channels };
}

export async function markAllRead(req) {
  const k = selfKey(req);
  await dal.run(`INSERT INTO notification_state (actor_type, actor_id, seen_at) VALUES (?, ?, ?)
    ON CONFLICT (actor_type, actor_id) DO UPDATE SET seen_at = excluded.seen_at`, k.type, k.id, dal.nowIso());
}

export async function setChannels(req, channels) {
  const k = selfKey(req);
  const clean = { email: !!channels.email, whatsapp: !!channels.whatsapp, sms: !!channels.sms };
  await dal.run(`INSERT INTO notification_state (actor_type, actor_id, seen_at, channels_json) VALUES (?, ?, '', ?)
    ON CONFLICT (actor_type, actor_id) DO UPDATE SET channels_json = excluded.channels_json`, k.type, k.id, JSON.stringify(clean));
  return clean;
}
