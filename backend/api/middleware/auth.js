// api/middleware/auth.js
// Authentication for the four actor types (staff, learner, employer, admin)
// and tenancy scoping.
//
// Sessions: every login creates an auth_sessions row and a signed token that
// names it (sid). The token travels in an httpOnly SameSite=Strict cookie
// (qbx_session). Until the frontend moves to cookies the same token is also
// returned in the login body and accepted as a Bearer header
// (docs/decisions.md D-002); the cookieOnlyAuth flag turns that off.
// Because the session row is checked on every request, logout, disabling a
// user or revoking access takes effect at once.
//
// CSRF: a cookie-authenticated state-changing request must carry
// X-CSRF-Token matching the session's token (stored as a sha256). Bearer
// requests are not CSRF-prone (a browser never attaches them by itself).
//
// Tenancy: authenticate() sets req.tenant from the session, and requireTenant()
// refuses a route to any other kind of actor. Queries filter by req.tenant.
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import 'dotenv/config';
import { OTHER_DEVICE, OTHER_DEVICE_MESSAGE } from '../../core/devices.js';
import * as dal from '../../core/db/dal.js';
import { ulid } from '../../core/db/ulid.js';
import params from '../../config/params.js';
import { clientIp } from './rateLimit.js';
import { DEV_HOURS } from '../../core/devLogin.js';
import { withContext } from '../../core/requestContext.js';

export const DEMO_IDLE_MS = 2 * 3600000;

export const SESSION_COOKIE = 'qbx_session';
export const CSRF_COOKIE = 'qbx_csrf';
export const CSRF_HEADER = 'x-csrf-token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const ROLE_OF = { staff: 'institution', learner: 'learner', employer: 'employer', admin: 'admin' };

const sha256 = (v) => crypto.createHash('sha256').update(String(v)).digest('hex');
const secret = () => {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET is not set');
  return s;
};

export function parseCookies(header = '') {
  const out = {};
  String(header).split(';').forEach(part => {
    const i = part.indexOf('=');
    if (i < 0) return;
    const k = part.slice(0, i).trim();
    if (k) out[k] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

function cookieOptions(maxAgeMs, httpOnly) {
  return { httpOnly, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: maxAgeMs };
}

/**
 * Create a session for a signed-in actor and set its cookies.
 * @param {import('express').Response} res
 * @param {{actorType: 'staff'|'learner'|'employer'|'admin', actorId: string, institutionId?: string|null,
 *          employerId?: string|null, claims?: object, req?: import('express').Request, dev?: boolean}} s
 *   dev: a developer session from /dev (api/routes/dev.js) — fixed 8 hours,
 *   marked is_dev in the database and actor "developer", dev: true in the token.
 *   demo: { sandboxId, expiresAt } for a /demo persona (api/routes/demo.js) —
 *   ends with its sandbox (4 hours at most, 2 hours idle), demo: true in the token.
 * @returns {{token: string, csrfToken: string, sessionId: string, expiresAt: string}}
 */
export async function issueSession(res, { actorType, actorId, institutionId = null, employerId = null, claims = {}, req = null, dev = false, demo = null }) {
  const now = new Date();
  const hours = demo ? Math.max(1 / 60, (new Date(demo.expiresAt).getTime() - now.getTime()) / 3600000)
    : dev ? DEV_HOURS : params.get(`security.session.${actorType}Hours`);
  const sid = ulid();
  const csrfToken = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(now.getTime() + hours * 3600000).toISOString();
  await dal.run(`INSERT INTO auth_sessions (id, actor_type, actor_id, institution_id, employer_id, csrf_hash, ip, created_at, expires_at, is_dev, is_demo, sandbox_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, sid, actorType, actorId, institutionId, employerId, sha256(csrfToken),
  req ? clientIp(req) : null, now.toISOString(), expiresAt, dev ? 1 : 0, demo ? 1 : 0, demo?.sandboxId || null);
  const who = dev ? { actor: 'developer', actor_type: actorType, dev: true }
    : demo ? { actor: actorType, demo: true, sandbox: demo.sandboxId } : { actor: actorType };
  const token = jwt.sign({ ...claims, role: ROLE_OF[actorType], ...who, sid }, secret(), { expiresIn: Math.max(60, Math.floor(hours * 3600)) });
  res.cookie(SESSION_COOKIE, token, cookieOptions(hours * 3600000, true));
  res.cookie(CSRF_COOKIE, csrfToken, cookieOptions(hours * 3600000, false));
  return { token, csrfToken, sessionId: sid, expiresAt };
}

export async function revokeSession(sid) {
  await dal.run('UPDATE auth_sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL', dal.nowIso(), sid);
}

/** Revoke every live session of an actor (disable, remove access, password change). */
export async function revokeActorSessions(actorType, actorId) {
  await dal.run('UPDATE auth_sessions SET revoked_at = ? WHERE actor_type = ? AND actor_id = ? AND revoked_at IS NULL', dal.nowIso(), actorType, actorId);
}

export function clearSessionCookies(res) {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.clearCookie(CSRF_COOKIE, { path: '/' });
}

/** New CSRF token for the current session (the stored one is only a hash). */
export async function rotateCsrf(req, res) {
  const csrfToken = crypto.randomBytes(32).toString('base64url');
  await dal.run('UPDATE auth_sessions SET csrf_hash = ? WHERE id = ?', sha256(csrfToken), req.session.id);
  const remaining = Math.max(0, new Date(req.session.expires_at).getTime() - Date.now());
  res.cookie(CSRF_COOKIE, csrfToken, cookieOptions(remaining, false));
  return csrfToken;
}

const timingSafeEqualHex = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * @param {{ errors?: 'legacy'|'v2' }} [opts] legacy routes answer {error: string};
 *   new routes answer {error: {code, message}} (spec §9).
 */
export function authenticate({ errors = 'legacy', optional = false } = {}) {
  return async (req, res, next) => {
    // optional: a missing, stale or revoked session is treated as signed out
    // (public forms such as Talk to us), never as an error.
    const fail = (r, status, code, message) => (optional ? next() : r.status(status).json({ error: errors === 'v2' ? { code, message } : message }));
    const header = req.headers.authorization || '';
    const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
    const cookieToken = parseCookies(req.headers.cookie)[SESSION_COOKIE] || null;
    if (bearer && params.flag('cookieOnlyAuth')) return fail(res, 401, 'unauthenticated', 'Access token required');
    const token = bearer || cookieToken;
    if (!token) return fail(res, 401, 'unauthenticated', 'Access token required');

    // Every authentication failure is a 401 (the frontend signs out on 401).
    let payload;
    try {
      payload = jwt.verify(token, secret());
    } catch {
      return fail(res, 401, 'invalid_session', 'Invalid or expired token');
    }
    if (!payload.sid) return fail(res, 401, 'invalid_session', 'Your session has ended. Please sign in again.');
    const session = await dal.one('SELECT * FROM auth_sessions WHERE id = ?', payload.sid);
    if (session?.revoked_reason === OTHER_DEVICE) return fail(res, 401, 'signed_in_elsewhere', OTHER_DEVICE_MESSAGE);
    if (!session || session.revoked_at || session.expires_at <= dal.nowIso() || ROLE_OF[session.actor_type] !== payload.role) {
      return fail(res, 401, 'invalid_session', 'Your session has ended. Please sign in again.');
    }
    const viaCookie = !bearer;
    if (viaCookie && !SAFE_METHODS.has(req.method)) {
      const sent = String(req.headers[CSRF_HEADER] || '');
      if (!sent || !timingSafeEqualHex(sha256(sent), session.csrf_hash)) {
        return fail(res, 403, 'csrf_failed', 'Security check failed. Refresh the page and try again.');
      }
    }
    // A demo session lives only as long as its sandbox, and ends after 2 hours idle.
    if (session.is_demo) {
      const sb = await dal.one('SELECT last_active_at, expires_at, deleted_at FROM demo_sandboxes WHERE id = ?', session.sandbox_id);
      const nowIso = dal.nowIso();
      if (!sb || sb.deleted_at || sb.expires_at <= nowIso || new Date(sb.last_active_at).getTime() < Date.now() - DEMO_IDLE_MS) {
        return fail(res, 401, 'demo_ended', 'This demo has ended. Start a new one at /demo.');
      }
      if (Date.now() - new Date(sb.last_active_at).getTime() > 60000) await dal.run('UPDATE demo_sandboxes SET last_active_at = ? WHERE id = ?', nowIso, session.sandbox_id);
    }
    req.user = payload;
    // Learners: everything taught (sessions, concept notes, practice, reviews,
    // topic intros, Ask Qubirex) follows the learning language they chose in
    // Settings or on any learning screen; the cohort's language is the default.
    if (session.actor_type === 'learner') {
      const ll = await dal.one('SELECT learning_language FROM learners WHERE id = ?', session.actor_id);
      req.user = { ...payload, cohort_language: payload.language };
      if (ll?.learning_language) req.user.language = String(ll.learning_language).replace(/_en$/, '');
      req.user.learning_language = ll?.learning_language || payload.language;
    }
    req.session = session;
    req.tenant = tenantFor(session, payload);
    req.authVia = viaCookie ? 'cookie' : 'bearer';
    // The demo teaches with the scripted tutor (instant and free) unless DEMO_TUTOR=live.
    if (session.sandbox_id) return withContext({ sandboxId: session.sandbox_id, tutor: process.env.DEMO_TUTOR === 'live' ? null : 'scripted' }, next);
    next();
  };
}

// Legacy name used by the existing routes.
export const authenticateToken = authenticate();

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

/** Allow only these actor types (staff | learner | employer | admin). */
export function requireActor(...types) {
  return (req, res, next) => {
    if (!req.session) return res.status(401).json({ error: { code: 'unauthenticated', message: 'Not authenticated' } });
    if (!types.includes(req.session.actor_type)) return res.status(403).json({ error: { code: 'forbidden', message: 'Not allowed' } });
    next();
  };
}

// ─── Tenancy ─────────────────────────────────────────────────────────────────
// req.tenant says whose data this request may touch:
//   { kind: 'institution', institutionId, staffId }
//   { kind: 'learner', institutionId, learnerId, elId, engagementId }
//   { kind: 'employer', employerId, employerUserId }
//   { kind: 'platform' }                                   (Qubirex admin)
export function tenantFor(session, user) {
  switch (session.actor_type) {
    case 'staff': return { kind: 'institution', institutionId: session.institution_id, staffId: session.actor_id };
    case 'learner': return { kind: 'learner', institutionId: session.institution_id, learnerId: session.actor_id, elId: user.el_id, engagementId: user.engagement_id };
    case 'employer': return { kind: 'employer', employerId: session.employer_id, employerUserId: session.actor_id };
    case 'admin': return { kind: 'platform' };
    default: return null;
  }
}

/** Refuse the route to any tenant kind not listed ('platform' = admin). */
export function requireTenant(...kinds) {
  return (req, res, next) => {
    if (!req.tenant || !kinds.includes(req.tenant.kind)) return res.status(403).json({ error: { code: 'forbidden', message: 'Not allowed' } });
    next();
  };
}

// Learner sessions last a week, so access is re-checked on every request:
// removing a student's access (or deactivating them) signs them out at once.
// Age status is loaded here too, so read paths can apply the age policy
// (unknown age is treated as a minor, spec §8.10).
export async function requireActiveLearner(req, res, next) {
  if (req.user.role !== 'learner') return next();
  const row = await dal.one(`
    SELECT el.access_status, el.engagement_id, l.is_active, l.age_status, i.is_test, c.tutor, c.time_offset_days
    FROM engagement_learners el JOIN learners l ON l.id = el.learner_id
    JOIN engagements e ON e.id = el.engagement_id JOIN institutions i ON i.id = e.institution_id
    LEFT JOIN test_learner_controls c ON c.el_id = el.id AND i.is_test = 1
    WHERE el.id = ? AND l.id = ?
  `, req.user.el_id, req.user.id);
  if (!row || row.access_status === 'removed' || !row.is_active) {
    return res.status(401).json({ error: 'Your access to this cohort was removed. Please contact your institution.' });
  }
  if (row.engagement_id !== req.user.engagement_id) {
    return res.status(401).json({ error: 'You were moved to another cohort. Sign in again with its join code.' });
  }
  req.learnerAgeStatus = row.age_status || 'unknown';
  // A test-tenant learner: the /dev journey controls (tutor, clock offset)
  // apply to everything this request does. Real learners never read them.
  if (row.is_test) {
    const tutor = row.tutor || (process.env.TEST_TUTOR === 'live' ? null : 'scripted');
    return withContext({ testLearner: true, tutor: tutor === 'live' ? null : tutor, clockOffsetDays: Number(row.time_offset_days) || 0 }, next);
  }
  next();
}
