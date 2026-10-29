// core/devLogin.js — configuration and passcode for the developer login
// (api/routes/dev.js, docs/DEPLOY-VERCEL.md "Developer login").
//
//   DEV_LOGIN_ENABLED=true   turns it on for this deployment; anything else
//                            leaves /api/dev/* answering 404 as if absent.
//   DEV_LOGIN_SECRET         the passcode, checked only here on the server,
//                            32+ characters or the deployment refuses to start.
//   DEV_LOGIN_ALLOWED_IPS    optional comma-separated client IPs; others get 404.
//
// The passcode is never logged, stored or sent to the browser. A correct one
// earns a "dev unlock" token (httpOnly cookie, 8 hours) signed with a key
// derived from JWT_SECRET and the passcode, so changing the passcode ends
// every unlock at once. The unlock only lets the holder open the fixed test
// accounts in core/testTenant.js.
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

export const DEV_HOURS = 8;
export const DEV_UNLOCK_COOKIE = 'qbx_dev_unlock';
export const MIN_SECRET_LENGTH = 32;
const AUDIENCE = 'qubirex-dev-unlock';

export const devLoginEnabled = (env = process.env) => env.DEV_LOGIN_ENABLED === 'true';

/** Why an enabled developer login cannot run (names only, never values), or null. */
export function devLoginConfigError(env = process.env) {
  if (!devLoginEnabled(env)) return null;
  if (String(env.DEV_LOGIN_SECRET || '').length < MIN_SECRET_LENGTH) {
    return `DEV_LOGIN_SECRET must be at least ${MIN_SECRET_LENGTH} characters when DEV_LOGIN_ENABLED=true`;
  }
  if (!env.JWT_SECRET) return 'JWT_SECRET is not set';
  return null;
}

/** On, configured, and (if an allowlist is set) asked from an allowed IP. */
export function devLoginAvailable(ip, env = process.env) {
  if (!devLoginEnabled(env) || devLoginConfigError(env)) return false;
  const allowed = String(env.DEV_LOGIN_ALLOWED_IPS || '').split(',').map(s => s.trim()).filter(Boolean);
  return !allowed.length || allowed.includes(String(ip || '').replace(/^::ffff:/, ''));
}

const sha256 = (v) => crypto.createHash('sha256').update(String(v)).digest();

/** Constant-time passcode check (both sides hashed to equal length first). */
export function passcodeMatches(given, env = process.env) {
  const want = String(env.DEV_LOGIN_SECRET || '');
  if (want.length < MIN_SECRET_LENGTH || typeof given !== 'string' || !given) return false;
  return crypto.timingSafeEqual(sha256(given), sha256(want));
}

const unlockKey = (env) => crypto.createHmac('sha256', String(env.JWT_SECRET)).update(`dev-unlock:${env.DEV_LOGIN_SECRET}`).digest('base64url');

export function signUnlock(env = process.env) {
  const expiresAt = new Date(Date.now() + DEV_HOURS * 3600000);
  const token = jwt.sign({ typ: 'dev_unlock', jti: crypto.randomUUID() }, unlockKey(env), { audience: AUDIENCE, expiresIn: `${DEV_HOURS}h` });
  return { token, expiresAt: expiresAt.toISOString() };
}

/** @returns {{ exp: number } | null} */
export function verifyUnlock(token, env = process.env) {
  if (!token) return null;
  try {
    const p = jwt.verify(token, unlockKey(env), { audience: AUDIENCE });
    return p.typ === 'dev_unlock' ? p : null;
  } catch {
    return null;
  }
}
