// api/routes/auth.js
import express from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { legacyHandle as getDb } from '../../core/db/dal.js';
import * as dal from '../../core/db/dal.js';
import { ulid } from '../../core/db/ulid.js';
import { emit } from '../../core/events/outbox.js';
import params from '../../config/params.js';
import { issueSession, revokeSession, clearSessionCookies, rotateCsrf, authenticate } from '../middleware/auth.js';
import { loginRateLimits, rateLimit, clientIp, isLockedOut, recordLoginFailure, clearLoginFailures } from '../middleware/rateLimit.js';
import { MAX_PIN_ATTEMPTS, normaliseJoinCode, hashToken, hashPin, isValidPin, logEvent, openResetRequest } from '../../core/access.js';
import 'dotenv/config';
const router = express.Router();

const minPassword = () => params.get('security.passwordMinLength');
const LOCKED_MSG = 'Too many failed sign-ins. Wait 15 minutes and try again.';

// ─── Staff login (admins, professors, viewers) ───────────────────────────────
// Staff sign in with their own email and password. The institution's contact
// email still works: on first use it becomes an admin staff row with the same
// password, so every signed-in staff member has a staff_id from then on.
function staffResponse(req, res, db, staff) {
  const inst = db.prepare('SELECT id, name, type FROM institutions WHERE id = ?').get(staff.institution_id);
  db.prepare("UPDATE institution_users SET last_login_at = datetime('now') WHERE id = ?").run(staff.id);
  const session = issueSession(res, {
    actorType: 'staff', actorId: staff.id, institutionId: staff.institution_id, req,
    claims: { id: staff.institution_id, staff_id: staff.id, name: staff.name }
  });
  return {
    token: session.token,
    csrf_token: session.csrfToken,
    institution: inst,
    staff: { id: staff.id, name: staff.name, title: staff.title, role: staff.role, department: staff.department, profile_completed: !!staff.profile_completed }
  };
}

router.post('/institution/login', loginRateLimits(), (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const { password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  const ip = clientIp(req);
  if (isLockedOut('staff', email, ip)) return res.status(429).json({ error: LOCKED_MSG });
  const bad = () => { recordLoginFailure('staff', email, ip); return res.status(401).json({ error: 'Invalid credentials' }); };
  const ok = (db, staff) => { clearLoginFailures('staff', email); return res.json(staffResponse(req, res, db, staff)); };

  const db = getDb();
  try {
    const staff = db.prepare('SELECT * FROM institution_users WHERE lower(email) = ?').get(email);
    if (staff && staff.status === 'active' && staff.password_hash) {
      if (!bcrypt.compareSync(String(password), staff.password_hash)) return bad();
      return ok(db, staff);
    }
    if (staff && staff.status === 'invited') return res.status(401).json({ error: 'Your invite hasn’t been accepted yet. Open the link from your invite email, or use “I have an invite”.' });
    if (staff && staff.status === 'disabled') return res.status(401).json({ error: 'Your staff account is disabled. Ask your institution admin.' });

    const institution = db.prepare('SELECT * FROM institutions WHERE lower(contact_email) = ?').get(email);
    if (!institution || !bcrypt.compareSync(String(password), institution.password_hash)) return bad();
    const id = uuidv4();
    db.prepare(`
      INSERT INTO institution_users (id, institution_id, email, password_hash, role, status, name)
      VALUES (?, ?, ?, ?, 'admin', 'active', ?)
    `).run(id, institution.id, institution.contact_email, institution.password_hash, institution.contact_name || institution.name);
    return ok(db, db.prepare('SELECT * FROM institution_users WHERE id = ?').get(id));
  } finally {
    db.close();
  }
});

// ─── Staff invite: look up and accept ─────────────────────────────────────────
function findStaffInvite(db, token) {
  return db.prepare(`
    SELECT u.*, i.name as institution_name, inv.name as inviter_name
    FROM institution_users u
    JOIN institutions i ON i.id = u.institution_id
    LEFT JOIN institution_users inv ON inv.id = u.invited_by
    WHERE u.invite_token_hash = ? AND u.status = 'invited'
  `).get(hashToken(token));
}

router.get('/staff/invite/:token', (req, res) => {
  const db = getDb();
  const invite = findStaffInvite(db, req.params.token);
  if (!invite || invite.invite_expires_at < new Date().toISOString()) {
    db.close();
    return res.status(404).json({ error: 'This invite link is invalid or has expired. Ask your admin to resend it.' });
  }
  const cohorts = db.prepare(`
    SELECT e.title FROM staff_cohorts sc JOIN engagements e ON e.id = sc.engagement_id WHERE sc.staff_id = ?
  `).all(invite.id).map(r => r.title);
  db.close();
  res.json({
    email: invite.email, name: invite.name, role: invite.role, department: invite.department,
    institution_name: invite.institution_name, invited_by: invite.inviter_name, cohorts, expires_at: invite.invite_expires_at
  });
});

router.post('/staff/invite/:token/accept', (req, res) => {
  const { password } = req.body;
  if (!password || String(password).length < minPassword()) return res.status(400).json({ error: `Choose a password of at least ${minPassword()} characters.` });
  const db = getDb();
  try {
    const invite = findStaffInvite(db, req.params.token);
    if (!invite || invite.invite_expires_at < new Date().toISOString()) {
      return res.status(404).json({ error: 'This invite link is invalid or has expired. Ask your admin to resend it.' });
    }
    db.prepare(`
      UPDATE institution_users SET password_hash = ?, status = 'active', invite_token_hash = NULL, invite_expires_at = NULL
      WHERE id = ?
    `).run(bcrypt.hashSync(password, 10), invite.id);
    res.json(staffResponse(req, res, db, db.prepare('SELECT * FROM institution_users WHERE id = ?').get(invite.id)));
  } finally {
    db.close();
  }
});

// ─── Institution register ─────────────────────────────────────────────────────
router.post('/institution/register', (req, res) => {
  const { name, type, contact_name, contact_email, contact_phone, city, password } = req.body;
  if (!name || !contact_email || !password) {
    return res.status(400).json({ error: 'Name, email and password required' });
  }
  if (String(password).length < minPassword()) return res.status(400).json({ error: `Choose a password of at least ${minPassword()} characters.` });

  const db = getDb();
  const existing = db.prepare('SELECT id FROM institutions WHERE contact_email = ?').get(contact_email);
  if (existing) { db.close(); return res.status(409).json({ error: 'Email already registered' }); }

  const id = uuidv4();
  const password_hash = bcrypt.hashSync(password, 10);
  db.prepare(`
    INSERT INTO institutions (id, name, type, contact_name, contact_email, contact_phone, city, password_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, type || 'other', contact_name, contact_email, contact_phone, city || 'Hyderabad', password_hash);
  db.close();

  res.status(201).json({ message: 'Institution registered successfully', id });
});

// ─── Learner login (learner_ref + join code + PIN) ───────────────────────────
// The join code (QX-FSA-7K2) and learner_ref are both shared across a cohort,
// so neither is a secret on its own — the PIN is the factor that makes this a
// real login. The old 36-character engagement ID is still accepted.
// Five wrong PINs lock the enrolment until staff reset the PIN; a removed
// enrolment (or deactivated learner) can never sign in.
function findEnrolment(db, learnerRef, cohort) {
  const code = normaliseJoinCode(cohort);
  const engagement = db.prepare('SELECT * FROM engagements WHERE id = ? OR join_code = ?').get(String(cohort || '').trim(), code);
  if (!engagement) return null;
  return db.prepare(`
    SELECT l.*, el.id as el_id, el.engagement_id, el.access_status, el.locked_at, el.failed_pin_attempts,
           el.last_login_at, e.language, e.institution_id as eng_institution_id
    FROM learners l
    JOIN engagement_learners el ON el.learner_id = l.id
    JOIN engagements e ON e.id = el.engagement_id
    WHERE l.learner_ref = ? AND el.engagement_id = ? AND l.institution_id = e.institution_id
  `).get(String(learnerRef || '').trim(), engagement.id);
}

function learnerSession(req, res, data) {
  return issueSession(res, {
    actorType: 'learner', actorId: data.id, institutionId: data.eng_institution_id, req,
    claims: { id: data.id, el_id: data.el_id, engagement_id: data.engagement_id, language: data.language }
  });
}

// PINs are locked per enrolment after MAX_PIN_ATTEMPTS; this per-IP limit
// stops one client from walking a whole roster.
const learnerLoginLimit = rateLimit({
  name: 'login:learner:ip',
  limit: () => params.get('security.rateLimits.login.perIp'),
  windowMs: 15 * 60000
});

router.post('/learner/login', learnerLoginLimit, (req, res) => {
  const { learner_ref, pin } = req.body;
  const cohort = req.body.join_code || req.body.engagement_id;
  if (!learner_ref || !cohort || !pin) {
    return res.status(400).json({ error: 'Learner reference, join code and PIN required' });
  }

  const db = getDb();
  try {
    const data = findEnrolment(db, learner_ref, cohort);
    if (!data) return res.status(401).json({ error: 'We couldn’t find that learner reference in this cohort. Check the join code.' });
    if (data.access_status === 'removed' || !data.is_active) {
      return res.status(403).json({ error: 'Your access to this cohort was removed. Please contact your institution.' });
    }
    if (data.locked_at) return res.status(423).json({ error: 'Too many wrong PINs. Ask your professor to reset your PIN.', locked: true });
    if (!data.pin_hash) return res.status(401).json({ error: 'You haven’t set a PIN yet. Open the invite link your institution sent you.' });

    if (!bcrypt.compareSync(String(pin), data.pin_hash)) {
      const attempts = (data.failed_pin_attempts || 0) + 1;
      if (attempts >= MAX_PIN_ATTEMPTS) {
        db.prepare("UPDATE engagement_learners SET failed_pin_attempts = ?, locked_at = datetime('now') WHERE id = ?").run(attempts, data.el_id);
        logEvent(db, { institutionId: data.eng_institution_id, learnerId: data.id, elId: data.el_id, event: 'locked', detail: `${attempts} wrong PINs` });
        return res.status(423).json({ error: 'Too many wrong PINs. Ask your professor to reset your PIN.', locked: true });
      }
      db.prepare('UPDATE engagement_learners SET failed_pin_attempts = ? WHERE id = ?').run(attempts, data.el_id);
      return res.status(401).json({ error: `Invalid PIN. ${MAX_PIN_ATTEMPTS - attempts} attempt${MAX_PIN_ATTEMPTS - attempts === 1 ? '' : 's'} left.` });
    }

    db.prepare("UPDATE engagement_learners SET failed_pin_attempts = 0, last_login_at = datetime('now') WHERE id = ?").run(data.el_id);
    if (!data.last_login_at) logEvent(db, { institutionId: data.eng_institution_id, learnerId: data.id, elId: data.el_id, event: 'signed_in', detail: 'First sign-in' });

    const session = learnerSession(req, res, data);
    res.json({
      token: session.token,
      csrf_token: session.csrfToken,
      learner: { id: data.id, name: data.name, language: data.language, learner_ref: data.learner_ref },
      must_change_pin: !!data.pin_must_change
    });
  } finally {
    db.close();
  }
});

// ─── Learner invite: the student sets their own PIN ───────────────────────────
function findLearnerInvite(db, token) {
  return db.prepare(`
    SELECT li.*, l.name, l.learner_ref, l.is_active, el.engagement_id, el.access_status, e.title as cohort_title,
           e.join_code, e.language, e.institution_id, i.name as institution_name
    FROM learner_invites li
    JOIN learners l ON l.id = li.learner_id
    JOIN engagement_learners el ON el.id = li.engagement_learner_id
    JOIN engagements e ON e.id = el.engagement_id
    JOIN institutions i ON i.id = e.institution_id
    WHERE li.token_hash = ? AND li.used_at IS NULL
  `).get(hashToken(token));
}
const inviteUsable = (inv) => inv && inv.expires_at >= new Date().toISOString() && inv.access_status !== 'removed' && inv.is_active;

router.get('/learner/invite/:token', (req, res) => {
  const db = getDb();
  const inv = findLearnerInvite(db, req.params.token);
  db.close();
  if (!inviteUsable(inv)) return res.status(404).json({ error: 'This invite link is invalid or has expired. Ask your professor to resend it.' });
  res.json({
    name: inv.name, learner_ref: inv.learner_ref, cohort_title: inv.cohort_title, join_code: inv.join_code,
    language: inv.language, institution_name: inv.institution_name, expires_at: inv.expires_at
  });
});

router.post('/learner/invite/:token/accept', (req, res) => {
  const { pin } = req.body;
  if (!isValidPin(pin)) return res.status(400).json({ error: 'Your PIN must be exactly 6 digits.' });
  const db = getDb();
  try {
    const inv = findLearnerInvite(db, req.params.token);
    if (!inviteUsable(inv)) return res.status(404).json({ error: 'This invite link is invalid or has expired. Ask your professor to resend it.' });
    db.transaction(() => {
      db.prepare("UPDATE learners SET pin_hash = ?, pin_must_change = 0, pin_set_at = datetime('now') WHERE id = ?").run(hashPin(pin), inv.learner_id);
      db.prepare("UPDATE learner_invites SET used_at = datetime('now') WHERE id = ?").run(inv.id);
      db.prepare("UPDATE engagement_learners SET locked_at = NULL, failed_pin_attempts = 0, last_login_at = datetime('now') WHERE id = ?").run(inv.engagement_learner_id);
      logEvent(db, { institutionId: inv.institution_id, learnerId: inv.learner_id, elId: inv.engagement_learner_id, event: 'pin_set', detail: 'Set their own PIN from the invite' });
    })();
    const data = findEnrolment(db, inv.learner_ref, inv.engagement_id);
    const session = learnerSession(req, res, data);
    res.json({
      token: session.token,
      csrf_token: session.csrfToken,
      learner: { id: data.id, name: data.name, language: data.language, learner_ref: data.learner_ref },
      join_code: inv.join_code
    });
  } finally {
    db.close();
  }
});

// ─── "Forgot PIN?" — records a request for staff; never reveals whether the
// learner exists, so it can't be used to probe rosters.
router.post('/learner/pin-reset-request', (req, res) => {
  const db = getDb();
  try {
    const data = findEnrolment(db, req.body.learner_ref, req.body.join_code || req.body.engagement_id);
    if (data && data.access_status !== 'removed') {
      const open = db.prepare(`SELECT 1 FROM access_events ae WHERE ae.engagement_learner_id = ? AND ${openResetRequest('ae')}`).get(data.el_id);
      if (!open) logEvent(db, { institutionId: data.eng_institution_id, learnerId: data.id, elId: data.el_id, event: 'pin_reset_requested', detail: 'From the learner login page' });
    }
  } finally {
    db.close();
  }
  res.json({ message: 'If those details match a student, your professor has been asked to reset your PIN.' });
});

// ─── Admin login (Inferexaa platform staff) ───────────────────────────────────
router.post('/admin/login', loginRateLimits(), (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const { password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  const ip = clientIp(req);
  if (isLockedOut('admin', email, ip)) return res.status(429).json({ error: LOCKED_MSG });
  const admin = dal.one('SELECT * FROM admin_users WHERE lower(email) = ?', email);
  if (!admin || !bcrypt.compareSync(String(password), admin.password_hash)) {
    recordLoginFailure('admin', email, ip);
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  clearLoginFailures('admin', email);
  const session = issueSession(res, { actorType: 'admin', actorId: admin.id, req, claims: { id: admin.id, email: admin.email } });
  res.json({ token: session.token, csrf_token: session.csrfToken });
});

// ─── Employer register (KYB pending) and login ───────────────────────────────
// New routes use the v4.3.1 error shape {error: {code, message}} (spec §9).
const v2 = (res, status, code, message) => res.status(status).json({ error: { code, message } });
const EMAIL_RE = /^[^\s@]+@([^\s@]+\.[^\s@]+)$/;

router.post('/employer/register', rateLimit({ name: 'employer:register:ip', limit: 10, windowMs: 3600000, legacyErrors: false }), (req, res) => {
  const companyName = String(req.body.company_name || '').trim();
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const website = req.body.website ? String(req.body.website).trim() : null;
  const m = EMAIL_RE.exec(email);
  if (!companyName || !name || !m) return v2(res, 400, 'invalid_request', 'Company name, your name and a work email are required.');
  if (password.length < minPassword()) return v2(res, 400, 'weak_password', `Choose a password of at least ${minPassword()} characters.`);
  if (dal.one('SELECT 1 FROM employer_users WHERE email = ?', email)) return v2(res, 409, 'email_taken', 'That email is already registered. Sign in instead.');

  const now = dal.nowIso();
  const employerId = ulid();
  const userId = ulid();
  dal.tx(() => {
    dal.run(`INSERT INTO employers (id, name, domain, website, kyb_status, created_at, updated_at) VALUES (?, ?, ?, ?, 'pending', ?, ?)`,
      employerId, companyName, m[1], website, now, now);
    dal.run(`INSERT INTO employer_users (id, employer_id, email, password_hash, name, role, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'owner', 'active', ?, ?)`, userId, employerId, email,
    bcrypt.hashSync(password, params.get('security.bcryptRounds')), name, now, now);
    emit('EMPLOYER_REGISTERED', { aggregateType: 'employer', aggregateId: employerId, payload: { domain: m[1] } });
  });
  res.status(201).json({ employer: { id: employerId, name: companyName, domain: m[1], kyb_status: 'pending' } });
});

router.post('/employer/login', loginRateLimits(), (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (!email || !password) return v2(res, 400, 'invalid_request', 'Email and password required');
  const ip = clientIp(req);
  if (isLockedOut('employer', email, ip)) return v2(res, 429, 'locked_out', LOCKED_MSG);
  const user = dal.one(`SELECT u.*, e.kyb_status FROM employer_users u JOIN employers e ON e.id = u.employer_id WHERE u.email = ?`, email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    recordLoginFailure('employer', email, ip);
    return v2(res, 401, 'invalid_credentials', 'Invalid credentials');
  }
  if (user.status !== 'active' || user.kyb_status === 'suspended' || user.kyb_status === 'rejected') {
    return v2(res, 403, 'account_inactive', 'This employer account is not active.');
  }
  clearLoginFailures('employer', email);
  dal.run('UPDATE employer_users SET last_login_at = ? WHERE id = ?', dal.nowIso(), user.id);
  const session = issueSession(res, { actorType: 'employer', actorId: user.id, employerId: user.employer_id, req, claims: { id: user.id, employer_id: user.employer_id } });
  res.json({ token: session.token, csrf_token: session.csrfToken, employer: { id: user.employer_id, kyb_status: user.kyb_status } });
});

// ─── Session: logout and CSRF token refresh (any actor) ──────────────────────
router.post('/logout', authenticate(), (req, res) => {
  revokeSession(req.session.id);
  clearSessionCookies(res);
  res.json({ ok: true });
});

router.get('/csrf', authenticate(), (req, res) => {
  res.json({ csrf_token: rotateCsrf(req, res) });
});

export default router;
