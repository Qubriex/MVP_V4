// api/middleware/employerAuth.js
// Runs after authenticate({ errors: 'v2' }) + requireActor('employer').
// Loads the employer user and company on every request, so disabling a user
// or suspending a company takes effect immediately. Sets req.employer and
// req.employerUser; every employer query filters by req.tenant.employerId.
//
// Employer modules never touch session data: this file, api/routes/employer.js
// and core/match/* must not import session, memory, provenance, CKB-usage or
// evaluation stores (enforced by tests/structural/walls.test.js).
import * as dal from '../../core/db/dal.js';

const deny = (res, status, code, message) => res.status(status).json({ error: { code, message } });

export function loadEmployer(req, res, next) {
  if (!req.tenant || req.tenant.kind !== 'employer') return deny(res, 403, 'forbidden', 'Not allowed');
  const user = dal.one('SELECT id, employer_id, email, name, role, status FROM employer_users WHERE id = ? AND employer_id = ?',
    req.tenant.employerUserId, req.tenant.employerId);
  if (!user || user.status !== 'active') return deny(res, 401, 'account_inactive', 'Your employer account is not active.');
  const employer = dal.one('SELECT id, name, domain, website, kyb_status, domain_verified_at FROM employers WHERE id = ?', user.employer_id);
  if (!employer || ['suspended', 'rejected'].includes(employer.kyb_status)) return deny(res, 403, 'account_inactive', 'This employer account is not active.');
  req.employerUser = user;
  req.employer = employer;
  next();
}

/** Routes that need a KYB-verified company (search, access requests, …). */
export function requireKybVerified(req, res, next) {
  if (req.employer?.kyb_status !== 'verified') return deny(res, 403, 'kyb_pending', 'Your company verification is still pending.');
  next();
}

export function requireEmployerRole(...roles) {
  return (req, res, next) => (roles.includes(req.employerUser?.role) ? next() : deny(res, 403, 'forbidden', `This needs the ${roles.join(' or ')} role.`));
}
