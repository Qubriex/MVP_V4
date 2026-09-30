// api/middleware/rateLimit.js
// Rate limits and login lockout (spec §10).
//
// rateLimit({ name, limit, windowMs, key }) — fixed-window counter per key.
//   key(req) returns the thing being limited (IP, account, institution); a
//   null key skips the check. Counters are in memory: one process in Phase 0
//   (docs/decisions.md D-007). Exceeding answers 429 with Retry-After.
//
// Login lockout — persisted in login_failures so it survives restarts:
//   5 failures in 15 minutes locks the account, and 5 failures in 15 minutes
//   from one IP locks that IP, for password logins (staff, employer, admin).
//   Learner PINs keep their own per-enrolment lock (core/access.js).
import params from '../../config/params.js';
import * as dal from '../../core/db/dal.js';
import { ulid } from '../../core/db/ulid.js';
import { logger } from '../../core/logger.js';

const buckets = new Map(); // name -> Map(key -> { count, resetAt })

export const clientIp = (req) => req.ip || req.socket?.remoteAddress || 'unknown';

/** Count one hit; returns { allowed, remaining, retryAfterS }. */
export function hit(name, key, limit, windowMs, now = Date.now()) {
  if (!buckets.has(name)) buckets.set(name, new Map());
  const bucket = buckets.get(name);
  let entry = bucket.get(key);
  if (!entry || entry.resetAt <= now) { entry = { count: 0, resetAt: now + windowMs }; bucket.set(key, entry); }
  entry.count += 1;
  if (bucket.size > 50000) for (const [k, v] of bucket) if (v.resetAt <= now) bucket.delete(k);
  return { allowed: entry.count <= limit, remaining: Math.max(0, limit - entry.count), retryAfterS: Math.ceil((entry.resetAt - now) / 1000) };
}

/** Current count without counting a hit. */
export function peek(name, key, now = Date.now()) {
  const entry = buckets.get(name)?.get(key);
  return !entry || entry.resetAt <= now ? 0 : entry.count;
}

export function resetRateLimits() {
  buckets.clear();
}

export function rateLimit({ name, limit, windowMs, key = clientIp, message = 'Too many requests. Please wait and try again.', legacyErrors = true }) {
  return (req, res, next) => {
    const k = key(req);
    if (k == null) return next();
    const lim = typeof limit === 'function' ? limit() : limit;
    const r = hit(name, String(k), lim, windowMs);
    if (r.allowed) return next();
    logger.warn('rate_limited', { name, key: String(k).slice(0, 64), path: req.originalUrl });
    res.set('Retry-After', String(r.retryAfterS));
    return res.status(429).json({ error: legacyErrors ? message : { code: 'rate_limited', message } });
  };
}

// ─── Login lockout ───────────────────────────────────────────────────────────
const windowStart = () => new Date(Date.now() - params.get('security.lockout.windowMinutes') * 60000).toISOString();

export function isLockedOut(actorType, account, ip) {
  const max = params.get('security.lockout.maxFailures');
  const since = windowStart();
  const byAccount = dal.one('SELECT COUNT(*) AS n FROM login_failures WHERE actor_type = ? AND account_key = ? AND created_at >= ?',
    actorType, String(account || '').toLowerCase(), since).n;
  const byIp = dal.one('SELECT COUNT(*) AS n FROM login_failures WHERE ip = ? AND created_at >= ?', ip, since).n;
  return byAccount >= max || byIp >= max;
}

export function recordLoginFailure(actorType, account, ip) {
  dal.run('INSERT INTO login_failures (id, actor_type, account_key, ip, created_at) VALUES (?, ?, ?, ?, ?)',
    ulid(), actorType, String(account || '').toLowerCase(), ip, dal.nowIso());
  logger.warn('login.failed', { actorType, ip });
}

export function clearLoginFailures(actorType, account) {
  dal.run('DELETE FROM login_failures WHERE actor_type = ? AND account_key = ?', actorType, String(account || '').toLowerCase());
}

// ─── AI calls (v4.3 §22): per account and per institution ───────────────────
const actorKey = (req) => (req.session ? `${req.session.actor_type}:${req.session.actor_id}` : null);
const institutionKey = (req) => req.session?.institution_id || null;

/** Rate limits for routes that call the AI gateway. Mount after authentication. */
export const aiRateLimits = [
  rateLimit({ name: 'ai:account', limit: () => params.get('security.rateLimits.ai.perAccountPerMinute'), windowMs: 60000, key: actorKey,
    message: 'You are going a little fast. Wait a moment and try again.' }),
  rateLimit({ name: 'ai:institution', limit: () => params.get('security.rateLimits.ai.perInstitutionPerMinute'), windowMs: 60000, key: institutionKey,
    message: 'Qubirex is busy for your institution right now. Try again in a minute.' })
];

/** Apply aiRateLimits to POST requests only (the routes that call the model). */
export function aiRateLimitPosts(req, res, next) {
  if (req.method !== 'POST') return next();
  let i = 0;
  const step = (err) => (err || i >= aiRateLimits.length ? next(err) : aiRateLimits[i++](req, res, step));
  return step();
}

const loginWindowMs = () => params.get('security.rateLimits.login.windowMinutes') * 60000;

/** Per-IP and per-account request limits in front of every login route. */
export const loginRateLimits = (accountField = 'email') => [
  rateLimit({ name: 'login:ip', limit: () => params.get('security.rateLimits.login.perIp'), windowMs: loginWindowMs() }),
  rateLimit({
    name: 'login:account',
    limit: () => params.get('security.rateLimits.login.perAccount'),
    windowMs: loginWindowMs(),
    key: (req) => (req.body?.[accountField] ? String(req.body[accountField]).trim().toLowerCase() : null)
  })
];
