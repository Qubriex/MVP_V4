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
 *          employerId?: string|null, claims?: object, req?: import('express').Request}} s
 * @returns {{token: string, csrfToken: string, sessionId: string}}
 */
export async function issueSession(res, { actorType, actorId, institutionId = null, employerId = null, claims = {}, req = null }) {
  const hours = params.get(`security.session.${actorType}Hours`);
  const sid = ulid();
  const csrfToken = crypto.randomBytes(32).toString('base64url');
  const now = new Date();
  await dal.run(`INSERT INTO auth_sessions (id, actor_type, actor_id, institution_id, employer_id, csrf_hash, ip, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, sid, actorType, actorId, institutionId, employerId, sha256(csrfToken),
  req ? clientIp(req) : null, now.toISOString(), new Date(now.getTime() + hours * 3600000).toISOString());
  const token = jwt.sign({ ...claims, role: ROLE_OF[actorType], actor: actorType, sid }, secret(), { expiresIn: `${hours}h` });
  res.cookie(SESSION_COOKIE, token, cookieOptions(hours * 3600000, true));
  res.cookie(CSRF_COOKIE, csrfToken, cookieOptions(hours * 3600000, false));
  return { token, csrfToken, sessionId: sid };
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
export function authenticate({ errors = 'legacy' } = {}) {
  const fail = (res, status, code, message) => res.status(status).json({ error: errors === 'v2' ? { code, message } : message });
  return async (req, res, next) => {
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
    req.user = payload;
    req.session = session;
    req.tenant = tenantFor(session, payload);
    req.authVia = viaCookie ? 'cookie' : 'bearer';
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
    SELECT el.access_status, el.engagement_id, l.is_active, l.age_status FROM engagement_learners el JOIN learners l ON l.id = el.learner_id
    WHERE el.id = ? AND l.id = ?
  `, req.user.el_id, req.user.id);
  if (!row || row.access_status === 'removed' || !row.is_active) {
    return res.status(401).json({ error: 'Your access to this cohort was removed. Please contact your institution.' });
  }
  if (row.engagement_id !== req.user.engagement_id) {
    return res.status(401).json({ error: 'You were moved to another cohort. Sign in again with its join code.' });
  }
  req.learnerAgeStatus = row.age_status || 'unknown';
  next();
}
