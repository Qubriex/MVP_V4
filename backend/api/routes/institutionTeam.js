// api/routes/institutionTeam.js — staff profile (/me) and Team & roles (/team).
// Mounted at /api/institution. Admins invite professors and viewers by email;
// each accepts the invite (auth.js), sets a password, then fills in a profile
// whose public part (name, photo, designation, specialisation, office hours)
// is what their students see.
import express from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { legacyHandle as getDb } from '../../core/db/dal.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { staffMiddleware, requireStaffRole } from '../middleware/staff.js';
import { newToken, hashToken, inviteExpiry } from '../../core/access.js';
import { queueEmail, appUrl } from '../../core/outboundMail.js';
import * as dal from '../../core/db/dal.js';
import params from '../../config/params.js';
import { eachSeq, mapSeq } from '../../core/util/seq.js';

const router = express.Router();
router.use(authenticateToken);
router.use(requireRole('institution'));
router.use(...staffMiddleware);

const ROLES = ['admin', 'professor', 'viewer'];
const LANGS = ['english', 'telugu', 'hindi'];
const parse = (t, f) => { try { return t ? JSON.parse(t) : f; } catch { return f; } };
const clean = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const cleanList = (v, max = 20) => (Array.isArray(v) ? v.map(x => clean(String(x), 120)).filter(Boolean).slice(0, max) : []);

async function cohortsOf(db, staffId) {
  return await db.prepare(`
    SELECT e.id, e.title, e.language, e.status, sc.cohort_role,
      (SELECT COUNT(*) FROM engagement_learners el WHERE el.engagement_id = e.id AND COALESCE(el.access_status, 'active') != 'removed') as students
    FROM staff_cohorts sc JOIN engagements e ON e.id = sc.engagement_id WHERE sc.staff_id = ? ORDER BY e.title
  `).all(staffId);
}

function publicStaff(row) {
  if (!row) return null;
  const { password_hash, invite_token_hash, ...rest } = row;
  return {
    ...rest,
    specialisations: parse(row.specialisations, []), teaching_languages: parse(row.teaching_languages, []),
    subjects: parse(row.subjects, []), target_roles: parse(row.target_roles, []), notification_prefs: parse(row.notification_prefs, {}),
    profile_completed: !!row.profile_completed
  };
}

// ─── My profile ────────────────────────────────────────────────────────────────
router.get('/me', async (req, res) => {
  if (!req.staff.id) return res.status(404).json({ error: 'Sign in again to use staff profiles.' });
  const db = getDb();
  const row = await db.prepare('SELECT * FROM institution_users WHERE id = ?').get(req.staff.id);
  const inst = await db.prepare('SELECT name FROM institutions WHERE id = ?').get(req.user.id);
  const cohorts = await cohortsOf(db, req.staff.id);
  db.close();
  res.json({ ...publicStaff(row), institution_name: inst ? inst.name : null, cohorts });
});

router.put('/me', async (req, res) => {
  if (!req.staff.id) return res.status(404).json({ error: 'Sign in again to use staff profiles.' });
  const b = req.body || {};
  if (b.photo_data_url && !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(b.photo_data_url)) {
    return res.status(400).json({ error: 'Photo must be a PNG, JPEG or WebP image.' });
  }
  if (b.photo_data_url && b.photo_data_url.length > 400000) return res.status(400).json({ error: 'Photo is too large — use one under 300 KB.' });

  const db = getDb();
  const cur = publicStaff(await db.prepare('SELECT * FROM institution_users WHERE id = ?').get(req.staff.id));
  const pick = (k, fn) => (k in b ? fn(b[k]) : cur[k]);
  const years = pick('years_teaching', v => (v === '' || v == null ? null : Math.max(0, Math.min(60, parseInt(v, 10) || 0))));
  await db.prepare(`
    UPDATE institution_users SET name = ?, title = ?, designation = ?, department = ?, employee_id = ?, phone = ?,
      qualification = ?, years_teaching = ?, specialisations = ?, teaching_languages = ?, subjects = ?, office_hours = ?,
      target_roles = ?, photo_data_url = ?, notification_prefs = ?, profile_completed = ?
    WHERE id = ?
  `).run(
    pick('name', v => clean(v, 120)) || cur.name, pick('title', v => clean(v, 20)), pick('designation', v => clean(v, 120)),
    pick('department', v => clean(v, 120)), pick('employee_id', v => clean(v, 40)), pick('phone', v => clean(v, 30)),
    pick('qualification', v => clean(v, 160)), years,
    JSON.stringify(pick('specialisations', cleanList)), JSON.stringify(pick('teaching_languages', v => cleanList(v).filter(x => LANGS.includes(x)))),
    JSON.stringify(pick('subjects', cleanList)), pick('office_hours', v => clean(v, 160)), JSON.stringify(pick('target_roles', cleanList)),
    'photo_data_url' in b ? (b.photo_data_url || null) : cur.photo_data_url,
    JSON.stringify({ ...cur.notification_prefs, ...(b.notification_prefs || {}) }),
    ('profile_completed' in b ? !!b.profile_completed : cur.profile_completed) ? 1 : 0,
    req.staff.id
  );
  const row = await db.prepare('SELECT * FROM institution_users WHERE id = ?').get(req.staff.id);
  const cohorts = await cohortsOf(db, req.staff.id);
  db.close();
  res.json({ ...publicStaff(row), cohorts });
});

router.put('/me/password', async (req, res) => {
  const { current_password, new_password } = req.body;
  const min = params.get('security.passwordMinLength');
  if (!new_password || String(new_password).length < min) return res.status(400).json({ error: `Choose a password of at least ${min} characters.` });
  const db = getDb();
  const row = await db.prepare('SELECT password_hash FROM institution_users WHERE id = ?').get(req.staff.id);
  if (!row || !bcrypt.compareSync(String(current_password || ''), row.password_hash || '')) { db.close(); return res.status(401).json({ error: 'Current password is wrong.' }); }
  await db.prepare('UPDATE institution_users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(new_password, 10), req.staff.id);
  // Sign out every other session of this staff member; keep the current one.
  await dal.run("UPDATE auth_sessions SET revoked_at = ? WHERE actor_type = 'staff' AND actor_id = ? AND id != ? AND revoked_at IS NULL",
    dal.nowIso(), req.staff.id, req.session.id);
  db.close();
  res.json({ message: 'Password changed' });
});

// ─── Team & roles (admin) ──────────────────────────────────────────────────────
async function teamRow(db, u) {
  const expired = u.status === 'invited' && u.invite_expires_at && u.invite_expires_at < new Date().toISOString();
  return {
    id: u.id, name: u.name, title: u.title, email: u.email, role: u.role, department: u.department,
    status: expired ? 'expired' : u.status, last_login_at: u.last_login_at, created_at: u.created_at,
    photo_data_url: u.photo_data_url, cohorts: await cohortsOf(db, u.id)
  };
}

router.get('/team', requireStaffRole('admin'), async (req, res) => {
  const db = getDb();
  const rows = await mapSeq(await db.prepare('SELECT * FROM institution_users WHERE institution_id = ? ORDER BY status = \'active\' DESC, name').all(req.user.id), async u => await teamRow(db, u));
  db.close();
  res.json(rows);
});

async function assignCohorts(db, req, staffId, engagementIds) {
  if (!Array.isArray(engagementIds)) return;
  await db.prepare('DELETE FROM staff_cohorts WHERE staff_id = ?').run(staffId);
  const ins = db.prepare('INSERT OR IGNORE INTO staff_cohorts (staff_id, engagement_id, cohort_role) VALUES (?, ?, ?)');
  await eachSeq(engagementIds, async x => {
    const id = typeof x === 'string' ? x : x.id;
    if (await db.prepare('SELECT 1 FROM engagements WHERE id = ? AND institution_id = ?').get(id, req.user.id)) await ins.run(staffId, id, x.cohort_role === 'lead' ? 'lead' : 'co');
  });
}

async function issueStaffInvite(db, req, staff) {
  const token = newToken();
  await db.prepare('UPDATE institution_users SET invite_token_hash = ?, invite_expires_at = ?, invited_by = ? WHERE id = ?')
    .run(hashToken(token), inviteExpiry(), req.staff.id, staff.id);
  const inst = await db.prepare('SELECT name FROM institutions WHERE id = ?').get(req.user.id);
  const url = `${appUrl()}/institution/invite/${token}`;
  await queueEmail(db, {
    institutionId: req.user.id, to: staff.email, kind: 'staff_invite',
    subject: `${req.staff.name || 'Your admin'} invited you to Qubirex at ${inst.name}`,
    body: `You've been invited as ${staff.role} at ${inst.name}.\n\nSet your password and profile here (link expires in 7 days):\n${url}`
  });
  return url;
}

router.post('/team/invites', requireStaffRole('admin'), async (req, res) => {
  const email = clean(req.body.email, 200).toLowerCase();
  const role = ROLES.includes(req.body.role) ? req.body.role : 'professor';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });

  const db = getDb();
  try {
    let staff = await db.prepare('SELECT * FROM institution_users WHERE lower(email) = ?').get(email);
    if (staff && staff.institution_id !== req.user.id) return res.status(409).json({ error: 'That email already has a Qubirex staff account at another institution.' });
    if (staff && staff.status === 'active') return res.status(409).json({ error: 'That person already has an active account. Edit their role instead.' });
    const url = await db.transaction(async () => {
      if (!staff) {
        const id = uuidv4();
        await db.prepare(`
          INSERT INTO institution_users (id, institution_id, email, role, status, name, department, invited_by)
          VALUES (?, ?, ?, ?, 'invited', ?, ?, ?)
        `).run(id, req.user.id, email, role, clean(req.body.name, 120) || null, clean(req.body.department, 120) || null, req.staff.id);
        staff = await db.prepare('SELECT * FROM institution_users WHERE id = ?').get(id);
      } else {
        await db.prepare("UPDATE institution_users SET role = ?, department = COALESCE(?, department), status = 'invited' WHERE id = ?")
          .run(role, clean(req.body.department, 120) || null, staff.id);
        staff = await db.prepare('SELECT * FROM institution_users WHERE id = ?').get(staff.id);
      }
      await assignCohorts(db, req, staff.id, req.body.engagement_ids);
      return await issueStaffInvite(db, req, staff);
    })();
    res.status(201).json({ ...await teamRow(db, await db.prepare('SELECT * FROM institution_users WHERE id = ?').get(staff.id)), invite_url: url });
  } finally {
    db.close();
  }
});

router.post('/team/:id/resend', requireStaffRole('admin'), async (req, res) => {
  const db = getDb();
  try {
    const staff = await db.prepare('SELECT * FROM institution_users WHERE id = ? AND institution_id = ?').get(req.params.id, req.user.id);
    if (!staff) return res.status(404).json({ error: 'Not found' });
    // Resending to an active member doubles as a password reset link.
    if (staff.status === 'active') await db.prepare("UPDATE institution_users SET status = 'invited' WHERE id = ?").run(staff.id);
    const url = await issueStaffInvite(db, req, { ...staff, status: 'invited' });
    res.json({ invite_url: url, message: staff.status === 'active' ? 'Password reset link created. Their current password stops working.' : 'Invite resent.' });
  } finally {
    db.close();
  }
});

router.put('/team/:id', requireStaffRole('admin'), async (req, res) => {
  const db = getDb();
  try {
    const staff = await db.prepare('SELECT * FROM institution_users WHERE id = ? AND institution_id = ?').get(req.params.id, req.user.id);
    if (!staff) return res.status(404).json({ error: 'Not found' });
    const { role, department, status, engagement_ids } = req.body;
    const losingAdmin = staff.role === 'admin' && ((role && role !== 'admin') || status === 'disabled');
    if (losingAdmin) {
      const admins = (await db.prepare("SELECT COUNT(*) as n FROM institution_users WHERE institution_id = ? AND role = 'admin' AND status = 'active'").get(req.user.id)).n;
      if (admins <= 1) return res.status(400).json({ error: 'Keep at least one active admin.' });
    }
    await db.transaction(async () => {
      if (ROLES.includes(role)) await db.prepare('UPDATE institution_users SET role = ? WHERE id = ?').run(role, staff.id);
      if (typeof department === 'string') await db.prepare('UPDATE institution_users SET department = ? WHERE id = ?').run(clean(department, 120), staff.id);
      if (status === 'disabled') await db.prepare("UPDATE institution_users SET status = 'disabled', invite_token_hash = NULL WHERE id = ?").run(staff.id);
      if (status === 'active' && staff.status === 'disabled' && staff.password_hash) await db.prepare("UPDATE institution_users SET status = 'active' WHERE id = ?").run(staff.id);
      await assignCohorts(db, req, staff.id, engagement_ids);
    })();
    res.json(await teamRow(db, await db.prepare('SELECT * FROM institution_users WHERE id = ?').get(staff.id)));
  } finally {
    db.close();
  }
});

export default router;