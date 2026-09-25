// api/routes/institutionStudents.js — Students & access. Mounted at /api/institution.
// ─────────────────────────────────────────────────────────────────────────────
// One place to add students to a cohort, give them a way in, reset PINs, move
// them and remove access. Replaces the old "create learners, then create the
// engagement" flow that left students created but never enrolled.
//
//   POST /students/enrol  — ONE transaction: create (or reuse) learners, enrol
//     them in the cohort, and issue access: an email invite (the student sets
//     their own PIN) or a printed slip with a one-time PIN they must change.
//     One-time PINs and invite links are returned once and never stored in
//     plain text.
//   POST /students/actions — resend_invite | reset_pin | move | remove | restore
//
// Professors act only on their assigned cohorts; viewers are read-only.
// ─────────────────────────────────────────────────────────────────────────────
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../../db/init');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { staffMiddleware, requireStaffRole, findScopedEngagement, scopeClause } = require('../middleware/staff');
const { generatePin, hashPin, createLearnerInvite, logEvent, accessState } = require('../../core/access');
const { queueEmail, appUrl } = require('../../core/outbox');

const router = express.Router();
router.use(authenticateToken);
router.use(requireRole('institution'));
router.use(...staffMiddleware);

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const clean = (v, max = 160) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function firstNode(db, capabilityTargetId) {
  const cluster = db.prepare('SELECT id FROM skill_clusters WHERE capability_target_id = ? ORDER BY sequence_order LIMIT 1').get(capabilityTargetId);
  const node = cluster ? db.prepare('SELECT id FROM skill_nodes WHERE cluster_id = ? ORDER BY sequence_order LIMIT 1').get(cluster.id) : null;
  return { clusterId: cluster ? cluster.id : null, nodeId: node ? node.id : null };
}

// ─── Roster ────────────────────────────────────────────────────────────────────
const ROSTER_SQL = `
  SELECT el.id as el_id, el.engagement_id, el.access_status, el.locked_at, el.last_login_at, el.delivery, el.enrolled_at,
    el.overall_status, el.current_node_id,
    l.id as learner_id, l.name, l.learner_ref, l.email, l.pin_hash, l.pin_must_change, l.language,
    e.title as cohort_title, e.join_code, e.capability_target_id,
    (SELECT COUNT(*) FROM node_mastery nm WHERE nm.engagement_learner_id = el.id AND nm.advanced_at IS NOT NULL) as mastered,
    (SELECT COUNT(*) FROM skill_nodes sn JOIN skill_clusters sc ON sc.id = sn.cluster_id WHERE sc.capability_target_id = e.capability_target_id) as total_nodes,
    EXISTS (SELECT 1 FROM access_events ae WHERE ae.engagement_learner_id = el.id AND ae.event = 'pin_reset_requested' AND ae.resolved = 0) as reset_requested,
    EXISTS (SELECT 1 FROM learner_invites li WHERE li.engagement_learner_id = el.id AND li.used_at IS NULL AND li.expires_at >= ?) as invite_pending
  FROM engagement_learners el
  JOIN learners l ON l.id = el.learner_id
  JOIN engagements e ON e.id = el.engagement_id
  WHERE e.institution_id = ?`;

function rosterRow(r) {
  const { pin_hash, ...rest } = r;
  return {
    ...rest,
    reset_requested: !!r.reset_requested, invite_pending: !!r.invite_pending,
    access: accessState(r),
    pin_status: !pin_hash ? (r.invite_pending ? 'Not set · invite pending' : 'Not set') : r.pin_must_change ? 'One-time PIN · must change at first sign-in' : 'Hidden · set by student',
    progress: r.total_nodes ? Math.round((r.mastered / r.total_nodes) * 100) : 0
  };
}

function loadRoster(db, req, extra = '', params = []) {
  const scope = scopeClause(db, req, 'el.engagement_id');
  return db.prepare(`${ROSTER_SQL} ${scope.sql} ${extra} ORDER BY l.name`)
    .all(new Date().toISOString(), req.user.id, ...scope.params, ...params).map(rosterRow);
}

router.get('/students', (req, res) => {
  const { engagement_id, status = 'all', q = '', node_id } = req.query;
  const db = getDb();
  try {
    let extra = '';
    const params = [];
    if (engagement_id) { extra += ' AND el.engagement_id = ?'; params.push(engagement_id); }
    if (node_id) { extra += ' AND el.current_node_id = ?'; params.push(node_id); }
    const all = loadRoster(db, req, extra, params);
    const needle = q.trim().toLowerCase();
    const searched = needle ? all.filter(r => r.name.toLowerCase().includes(needle) || r.learner_ref.toLowerCase().includes(needle) || (r.email || '').toLowerCase().includes(needle)) : all;
    const counts = { all: searched.length, reset_requested: searched.filter(r => r.reset_requested).length };
    ['active', 'invited', 'never_signed_in', 'locked', 'removed'].forEach(s => { counts[s] = searched.filter(r => r.access === s).length; });
    const rows = status === 'all' ? searched : status === 'reset_requested' ? searched.filter(r => r.reset_requested) : searched.filter(r => r.access === status);
    res.json({ counts, rows });
  } finally {
    db.close();
  }
});

router.get('/students/:elId', (req, res) => {
  const db = getDb();
  try {
    const row = loadRoster(db, req, ' AND el.id = ?', [req.params.elId])[0];
    if (!row) return res.status(404).json({ error: 'Not found' });
    const history = db.prepare(`
      SELECT ae.event, ae.detail, ae.created_at, u.name as actor_name FROM access_events ae
      LEFT JOIN institution_users u ON u.id = ae.actor_staff_id
      WHERE ae.engagement_learner_id = ? OR (ae.learner_id = ? AND ae.engagement_learner_id IS NULL)
      ORDER BY ae.created_at DESC LIMIT 30
    `).all(row.el_id, row.learner_id);
    const other = db.prepare(`
      SELECT e.id, e.title FROM engagement_learners el JOIN engagements e ON e.id = el.engagement_id
      WHERE el.learner_id = ? AND el.id != ?
    `).all(row.learner_id, row.el_id);
    res.json({ ...row, history, other_cohorts: other });
  } finally {
    db.close();
  }
});

// Institution students who could be added to a cohort ("pick existing").
router.get('/students-pool', (req, res) => {
  const { exclude_engagement_id, q = '' } = req.query;
  const db = getDb();
  try {
    const scope = scopeClause(db, req, 'el.engagement_id');
    const rows = db.prepare(`
      SELECT DISTINCT l.id, l.name, l.learner_ref, l.email,
        (SELECT group_concat(e2.title, ', ') FROM engagement_learners el2 JOIN engagements e2 ON e2.id = el2.engagement_id WHERE el2.learner_id = l.id) as cohorts
      FROM learners l JOIN engagement_learners el ON el.learner_id = l.id
      WHERE l.institution_id = ? AND l.is_active = 1 ${scope.sql}
        AND NOT EXISTS (SELECT 1 FROM engagement_learners x WHERE x.learner_id = l.id AND x.engagement_id = ?)
        AND (l.name LIKE ? OR l.learner_ref LIKE ?)
      ORDER BY l.name LIMIT 200
    `).all(req.user.id, ...scope.params, exclude_engagement_id || '', `%${q}%`, `%${q}%`);
    res.json(rows);
  } finally {
    db.close();
  }
});

// ─── Enrol: preview (row checks) and commit (one transaction) ──────────────────
function checkRows(db, req, engagement, students = [], existingIds = [], delivery = 'email') {
  const seen = new Set();
  const rows = students.map((s, i) => {
    const name = clean(s.name, 120);
    const ref = clean(s.learner_ref, 60);
    const email = clean(s.email, 200).toLowerCase();
    const base = { row: i + 1, name, learner_ref: ref, email: EMAIL_RE.test(email) ? email : '' };
    if (!name || !ref) return { ...base, ok: false, check: 'Name and ref are required' };
    if (seen.has(ref.toLowerCase())) return { ...base, ok: false, check: 'Ref repeated in this list' };
    seen.add(ref.toLowerCase());
    const existing = db.prepare('SELECT * FROM learners WHERE institution_id = ? AND learner_ref = ?').get(req.user.id, ref);
    if (existing) {
      if (db.prepare('SELECT 1 FROM engagement_learners WHERE engagement_id = ? AND learner_id = ?').get(engagement.id, existing.id)) {
        return { ...base, ok: false, check: 'Ref already in this cohort' };
      }
      if (existing.name.trim().toLowerCase() !== name.toLowerCase()) {
        return { ...base, ok: false, check: `Ref already used by ${existing.name}` };
      }
      return { ...base, ok: true, learner_id: existing.id, existing: true, has_pin: !!existing.pin_hash, check: existing.pin_hash ? 'Existing student · keeps their PIN' : 'Existing student' };
    }
    if (email && !EMAIL_RE.test(email)) return { ...base, ok: true, check: 'Email looks wrong → printed slip' };
    const way = delivery === 'email' && base.email ? 'Email invite' : delivery === 'email' ? 'No email → printed slip' : 'Printed slip';
    return { ...base, ok: true, check: way };
  });
  existingIds.forEach(id => {
    const l = db.prepare('SELECT * FROM learners WHERE id = ? AND institution_id = ?').get(id, req.user.id);
    if (!l) return;
    const already = db.prepare('SELECT 1 FROM engagement_learners WHERE engagement_id = ? AND learner_id = ?').get(engagement.id, l.id);
    rows.push({ row: rows.length + 1, name: l.name, learner_ref: l.learner_ref, email: l.email || '', learner_id: l.id, existing: true, has_pin: !!l.pin_hash,
      ok: !already, check: already ? 'Already in this cohort' : l.pin_hash ? 'Existing student · keeps their PIN' : 'Existing student' });
  });
  return rows;
}

function summarise(rows, delivery) {
  const ok = rows.filter(r => r.ok);
  const needAccess = ok.filter(r => !r.has_pin);
  const invites = delivery === 'email' ? needAccess.filter(r => r.email).length : 0;
  return { total: rows.length, adding: ok.length, skipped: rows.length - ok.length, invites, slips: needAccess.length - invites, keep_pin: ok.length - needAccess.length };
}

router.post('/students/enrol/preview', requireStaffRole('admin', 'professor'), (req, res) => {
  const db = getDb();
  try {
    const engagement = findScopedEngagement(db, req, req.body.engagement_id);
    if (!engagement) return res.status(404).json({ error: 'Cohort not found' });
    const delivery = req.body.delivery === 'slips' ? 'slips' : 'email';
    const rows = checkRows(db, req, engagement, req.body.students, req.body.existing_learner_ids || [], delivery);
    res.json({ rows, summary: summarise(rows, delivery) });
  } finally {
    db.close();
  }
});

function sendLearnerInvite(db, req, { learner, el, engagement, inst }) {
  const token = createLearnerInvite(db, { learnerId: learner.id, elId: el.id, staffId: req.staff.id });
  const url = `${appUrl()}/learner-invite/${token}`;
  queueEmail(db, {
    institutionId: req.user.id, to: learner.email, kind: 'learner_invite',
    subject: `Your Qubirex access for ${engagement.title}`,
    body: `Hello ${learner.name},\n\n${inst.name} has added you to ${engagement.title}.\nOpen this link to set your 6-digit PIN (expires in 7 days):\n${url}\n\nAfter that, sign in with:\n  Learner reference: ${learner.learner_ref}\n  Join code: ${engagement.join_code}`
  });
  return url;
}

function issueSlip(db, learner) {
  const pin = generatePin();
  db.prepare("UPDATE learners SET pin_hash = ?, pin_must_change = 1, pin_set_at = datetime('now') WHERE id = ?").run(hashPin(pin), learner.id);
  return pin;
}

router.post('/students/enrol', requireStaffRole('admin', 'professor'), (req, res) => {
  const db = getDb();
  try {
    const engagement = findScopedEngagement(db, req, req.body.engagement_id);
    if (!engagement) return res.status(404).json({ error: 'Cohort not found' });
    const delivery = req.body.delivery === 'slips' ? 'slips' : 'email';
    const rows = checkRows(db, req, engagement, req.body.students, req.body.existing_learner_ids || [], delivery);
    const ok = rows.filter(r => r.ok);
    if (!ok.length) return res.status(400).json({ error: 'No students to add — fix the rows marked in the check column.', rows });
    const start = firstNode(db, engagement.capability_target_id);
    const inst = db.prepare('SELECT name FROM institutions WHERE id = ?').get(req.user.id);

    // Everything below commits together or not at all.
    const result = db.transaction(() => {
      const invites = [];
      const slips = [];
      const kept = [];
      ok.forEach(r => {
        let learner = r.learner_id ? db.prepare('SELECT * FROM learners WHERE id = ?').get(r.learner_id) : null;
        if (!learner) {
          const id = uuidv4();
          db.prepare(`
            INSERT INTO learners (id, institution_id, name, email, learner_ref, language, profile_type)
            VALUES (?, ?, ?, ?, ?, ?, 'college_student')
          `).run(id, req.user.id, r.name, r.email || null, r.learner_ref, engagement.language);
          learner = db.prepare('SELECT * FROM learners WHERE id = ?').get(id);
        } else if (r.email && !learner.email) {
          db.prepare('UPDATE learners SET email = ? WHERE id = ?').run(r.email, learner.id);
          learner.email = r.email;
        }
        const elId = uuidv4();
        const way = learner.pin_hash ? 'existing_pin' : delivery === 'email' && learner.email ? 'email' : 'slip';
        db.prepare(`
          INSERT INTO engagement_learners (id, engagement_id, learner_id, current_node_id, current_cluster_id, access_status, delivery)
          VALUES (?, ?, ?, ?, ?, 'active', ?)
        `).run(elId, engagement.id, learner.id, start.nodeId, start.clusterId, way);
        const el = { id: elId };
        if (way === 'email') {
          const url = sendLearnerInvite(db, req, { learner, el, engagement, inst });
          invites.push({ name: learner.name, learner_ref: learner.learner_ref, email: learner.email, invite_url: url });
          logEvent(db, { institutionId: req.user.id, learnerId: learner.id, elId, event: 'invited', detail: `Invited to ${engagement.title} by email`, actorStaffId: req.staff.id });
        } else if (way === 'slip') {
          const pin = issueSlip(db, learner);
          slips.push({ name: learner.name, learner_ref: learner.learner_ref, pin, join_code: engagement.join_code, cohort: engagement.title });
          logEvent(db, { institutionId: req.user.id, learnerId: learner.id, elId, event: 'slip_issued', detail: `Added to ${engagement.title} with a printed login slip`, actorStaffId: req.staff.id });
        } else {
          kept.push({ name: learner.name, learner_ref: learner.learner_ref });
          logEvent(db, { institutionId: req.user.id, learnerId: learner.id, elId, event: 'invited', detail: `Added to ${engagement.title}; keeps their existing PIN`, actorStaffId: req.staff.id });
        }
      });
      return { invites, slips, kept };
    })();

    res.status(201).json({
      added: ok.length, skipped: rows.filter(r => !r.ok), cohort: { id: engagement.id, title: engagement.title, join_code: engagement.join_code },
      ...result
    });
  } finally {
    db.close();
  }
});

// ─── Bulk actions on enrolments ────────────────────────────────────────────────
router.post('/students/actions', requireStaffRole('admin', 'professor'), (req, res) => {
  const { action, el_ids, target_engagement_id } = req.body;
  const delivery = req.body.delivery === 'email' ? 'email' : 'slips';
  if (!['resend_invite', 'reset_pin', 'move', 'remove', 'restore'].includes(action)) return res.status(400).json({ error: 'Unknown action' });
  if (!Array.isArray(el_ids) || !el_ids.length) return res.status(400).json({ error: 'Select at least one student' });

  const db = getDb();
  try {
    const rows = loadRoster(db, req, ` AND el.id IN (${el_ids.map(() => '?').join(',')})`, el_ids);
    if (!rows.length) return res.status(404).json({ error: 'No matching students in your cohorts' });
    let target = null;
    if (action === 'move') {
      target = findScopedEngagement(db, req, target_engagement_id);
      if (!target) return res.status(404).json({ error: 'Target cohort not found' });
    }
    const inst = db.prepare('SELECT name FROM institutions WHERE id = ?').get(req.user.id);
    const out = { invites: [], slips: [], done: 0, skipped: [] };
    const actor = req.staff.id;

    db.transaction(() => rows.forEach(r => {
      const learner = db.prepare('SELECT * FROM learners WHERE id = ?').get(r.learner_id);
      const engagement = db.prepare('SELECT * FROM engagements WHERE id = ?').get(r.engagement_id);
      const ev = (event, detail) => logEvent(db, { institutionId: req.user.id, learnerId: r.learner_id, elId: r.el_id, event, detail, actorStaffId: actor });
      const resolveRequests = () => db.prepare("UPDATE access_events SET resolved = 1 WHERE learner_id = ? AND event = 'pin_reset_requested'").run(r.learner_id);

      if (action === 'remove') {
        if (r.access === 'removed') return out.skipped.push({ name: r.name, reason: 'Already removed' });
        db.prepare("UPDATE engagement_learners SET access_status = 'removed', removed_at = datetime('now') WHERE id = ?").run(r.el_id);
        db.prepare("UPDATE learner_invites SET used_at = 'revoked' WHERE engagement_learner_id = ? AND used_at IS NULL").run(r.el_id);
        ev('removed', `Access to ${engagement.title} removed; mastery record kept`);
      } else if (action === 'restore') {
        if (r.access !== 'removed') return out.skipped.push({ name: r.name, reason: 'Not removed' });
        db.prepare("UPDATE engagement_learners SET access_status = 'active', removed_at = NULL WHERE id = ?").run(r.el_id);
        ev('restored', `Access to ${engagement.title} restored`);
      } else if (action === 'resend_invite') {
        if (r.access === 'removed') return out.skipped.push({ name: r.name, reason: 'Access removed' });
        if (!learner.email) return out.skipped.push({ name: r.name, reason: 'No email — reset the PIN to print a slip' });
        if (learner.pin_hash && !learner.pin_must_change) return out.skipped.push({ name: r.name, reason: 'Already set their PIN — use Reset PIN' });
        const url = sendLearnerInvite(db, req, { learner, el: { id: r.el_id }, engagement, inst });
        out.invites.push({ name: learner.name, learner_ref: learner.learner_ref, email: learner.email, invite_url: url });
        ev('invite_resent', `Invite resent to ${learner.email}`);
      } else if (action === 'reset_pin') {
        if (r.access === 'removed') return out.skipped.push({ name: r.name, reason: 'Access removed' });
        // Unlock every enrolment of this learner — the PIN is per learner.
        db.prepare('UPDATE engagement_learners SET locked_at = NULL, failed_pin_attempts = 0 WHERE learner_id = ?').run(r.learner_id);
        if (delivery === 'email' && learner.email) {
          db.prepare('UPDATE learners SET pin_hash = NULL, pin_must_change = 0 WHERE id = ?').run(learner.id);
          const url = sendLearnerInvite(db, req, { learner, el: { id: r.el_id }, engagement, inst });
          out.invites.push({ name: learner.name, learner_ref: learner.learner_ref, email: learner.email, invite_url: url });
          ev('pin_reset', 'PIN reset; link sent to set a new one');
        } else {
          const pin = issueSlip(db, learner);
          out.slips.push({ name: learner.name, learner_ref: learner.learner_ref, pin, join_code: engagement.join_code, cohort: engagement.title });
          ev('pin_reset', 'PIN reset with a one-time PIN slip');
        }
        resolveRequests();
      } else if (action === 'move') {
        if (target.id === r.engagement_id) return out.skipped.push({ name: r.name, reason: 'Already in that cohort' });
        if (db.prepare('SELECT 1 FROM engagement_learners WHERE engagement_id = ? AND learner_id = ?').get(target.id, r.learner_id)) {
          return out.skipped.push({ name: r.name, reason: `Already enrolled in ${target.title}` });
        }
        const sameTarget = target.capability_target_id === engagement.capability_target_id;
        const start = firstNode(db, target.capability_target_id);
        db.prepare(`UPDATE engagement_learners SET engagement_id = ? ${sameTarget ? '' : ', current_node_id = ?, current_cluster_id = ?'} WHERE id = ?`)
          .run(...(sameTarget ? [target.id, r.el_id] : [target.id, start.nodeId, start.clusterId, r.el_id]));
        ev('moved', `Moved from ${engagement.title} to ${target.title}${sameTarget ? ' (progress kept)' : ' (starts the new pathway)'}`);
      }
      out.done += 1;
    }))();

    res.json(out);
  } finally {
    db.close();
  }
});

module.exports = router;
