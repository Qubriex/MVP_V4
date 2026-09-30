// api/middleware/employerAuth.js
// Employer authentication (v4.3 §14.1): a portal session (24 h cookie/JWT),
// or the X-QBX-API-Key header for ATS integrations, with scopes
// search · verify · passport.read · webhooks.
// Loads the employer user and company on every request, so disabling a user,
// revoking a key or suspending a company takes effect immediately. Every
// employer query filters by req.tenant.employerId.
//
// Employer modules never touch session data: this file, api/routes/employer.js
// and core/match/* must not import session, memory, provenance, CKB-usage or
// evaluation stores (enforced by tests/structural/walls.test.js).
import * as dal from '../../core/db/dal.js';
import { authenticate, requireActor } from './auth.js';
import { authenticateKey } from '../../core/employer/apiKeys.js';

const deny = (res, status, code, message) => res.status(status).json({ error: { code, message } });
const sessionAuth = [authenticate({ errors: 'v2' }), requireActor('employer')];

function loadCompany(req, res) {
  const employer = dal.one(`SELECT id, name, domain, website, kyb_status, domain_verified_at, gstin, gst_state_code, contact_name, contact_phone, city, kyb_note
    FROM employers WHERE id = ?`, req.tenant.employerId);
  if (!employer || ['suspended', 'rejected'].includes(employer.kyb_status)) { deny(res, 403, 'account_inactive', 'This employer account is not active.'); return null; }
  return employer;
}

export function loadEmployer(req, res, next) {
  if (!req.tenant || req.tenant.kind !== 'employer') return deny(res, 403, 'forbidden', 'Not allowed');
  const user = dal.one('SELECT id, employer_id, email, name, role, status FROM employer_users WHERE id = ? AND employer_id = ?',
    req.tenant.employerUserId, req.tenant.employerId);
  if (!user || user.status !== 'active') return deny(res, 401, 'account_inactive', 'Your employer account is not active.');
  const employer = loadCompany(req, res);
  if (!employer) return undefined;
  req.employerUser = user;
  req.employer = employer;
  next();
}

/**
 * Session or API key. `scope` is required only when an API key is used.
 * Routes that change the account (users, keys, company) accept sessions only.
 */
export function employerAuth({ scope = null, sessionOnly = false } = {}) {
  return (req, res, next) => {
    const presented = req.headers['x-qbx-api-key'];
    if (presented && !sessionOnly) {
      const r = authenticateKey(presented);
      if (!r) return deny(res, 401, 'invalid_api_key', 'Invalid or revoked API key.');
      if (scope && !r.key.scopes.includes(scope)) return deny(res, 403, 'insufficient_scope', `This key needs the ${scope} scope.`);
      req.tenant = { kind: 'employer', employerId: r.employerId, apiKeyId: r.key.id };
      req.apiKey = r.key;
      req.employerUser = null;
      const employer = loadCompany(req, res);
      if (!employer) return undefined;
      req.employer = employer;
      return next();
    }
    if (presented && sessionOnly) return deny(res, 403, 'session_required', 'Sign in to the employer portal for this action.');
    let i = 0;
    const chain = [...sessionAuth, loadEmployer];
    const step = (err) => (err || i >= chain.length ? next(err) : chain[i++](req, res, step));
    return step();
  };
}

/** Routes that need a KYB-approved company. v4.3 §14.1: until approved an
 *  employer can search but cannot request access, so this guards access
 *  requests (and anything that releases learner data), not search. */
export function requireKybVerified(req, res, next) {
  if (req.employer?.kyb_status !== 'verified') return deny(res, 403, 'kyb_pending', 'Your company verification is still pending.');
  next();
}

export function requireEmployerRole(...roles) {
  return (req, res, next) => (req.employerUser && roles.includes(req.employerUser.role) ? next() : deny(res, 403, 'forbidden', `This needs the ${roles.join(' or ')} role.`));
}
