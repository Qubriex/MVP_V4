// api/routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../../db/init');
const { MAX_PIN_ATTEMPTS, normaliseJoinCode, hashToken, hashPin, isValidPin, logEvent } = require('../../core/access');
require('dotenv').config();

const router = express.Router();

// ─── Staff login (admins, professors, viewers) ───────────────────────────────
// Staff sign in with their own email and password. The institution's contact
// email still works: on first use it becomes an admin staff row with the same
// password, so every signed-in staff member has a staff_id from then on.
function staffToken(staff) {
  return jwt.sign(
    { id: staff.institution_id, staff_id: staff.id, role: 'institution', name: staff.name },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}
function staffResponse(db, staff) {
  const inst = db.prepare('SELECT id, name, type FROM institutions WHERE id = ?').get(staff.institution_id);
  db.prepare("UPDATE institution_users SET last_login_at = datetime('now') WHERE id = ?").run(staff.id);
  return {
    token: staffToken(staff),
    institution: inst,
    staff: { id: staff.id, name: staff.name, title: staff.title, role: staff.role, department: staff.department, profile_completed: !!staff.profile_completed }
  };
}

router.post('/institution/login', (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const { password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const db = getDb();
  try {
    const staff = db.prepare('SELECT * FROM institution_users WHERE lower(email) = ?').get(email);
    if (staff && staff.status === 'active' && staff.password_hash) {
      if (!bcrypt.compareSync(password, staff.password_hash)) return res.status(401).json({ error: 'Invalid credentials' });
      return res.json(staffResponse(db, staff));
    }
    if (staff && staff.status === 'invited') return res.status(401).json({ error: 'Your invite hasn’t been accepted yet. Open the link from your invite email, or use “I have an invite”.' });
    if (staff && staff.status === 'disabled') return res.status(401).json({ error: 'Your staff account is disabled. Ask your institution admin.' });

    const institution = db.prepare('SELECT * FROM institutions WHERE lower(contact_email) = ?').get(email);
    if (!institution || !bcrypt.compareSync(password, institution.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const id = uuidv4();
    db.prepare(`
      INSERT INTO institution_users (id, institution_id, email, password_hash, role, status, name)
      VALUES (?, ?, ?, ?, 'admin', 'active', ?)
    `).run(id, institution.id, institution.contact_email, institution.password_hash, institution.contact_name || institution.name);
    return res.json(staffResponse(db, db.prepare('SELECT * FROM institution_users WHERE id = ?').get(id)));
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
  if (!password || String(password).length < 10) return res.status(400).json({ error: 'Choose a password of at least 10 characters.' });
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
    res.json(staffResponse(db, db.prepare('SELECT * FROM institution_users WHERE id = ?').get(invite.id)));
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

function learnerToken(data) {
  return jwt.sign(
    { id: data.id, el_id: data.el_id, engagement_id: data.engagement_id, role: 'learner', language: data.language },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

router.post('/learner/login', (req, res) => {
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

    res.json({
      token: learnerToken(data),
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
    res.json({
      token: learnerToken(data),
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
      const open = db.prepare("SELECT 1 FROM access_events WHERE engagement_learner_id = ? AND event = 'pin_reset_requested' AND resolved = 0").get(data.el_id);
      if (!open) logEvent(db, { institutionId: data.eng_institution_id, learnerId: data.id, elId: data.el_id, event: 'pin_reset_requested', detail: 'From the learner login page' });
    }
  } finally {
    db.close();
  }
  res.json({ message: 'If those details match a student, your professor has been asked to reset your PIN.' });
});

// ─── Admin login ──────────────────────────────────────────────────────────────
router.post('/admin/login', (req, res) => {
  const { email, password } = req.body;
  const db = getDb();
  const admin = db.prepare('SELECT * FROM admin_users WHERE email = ?').get(email);
  db.close();

  if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { id: admin.id, role: 'admin', email: admin.email },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  );
  res.json({ token });
});

module.exports = router;
