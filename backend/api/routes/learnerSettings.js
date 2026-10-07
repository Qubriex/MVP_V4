// api/routes/learnerSettings.js — the learner's Settings page. Mounted at /api/learner.
// ─────────────────────────────────────────────────────────────────────────────
//   GET    /settings                    devices, parent-sharing consent, notifications
//   POST   /devices/sign-out-others     end every other session of this learner
//   DELETE /devices/:id                 end one other session
//   PUT    /consents/parent-share       { on } — level-2 consent: the institution
//                                       may share my progress report with my parents
//   GET    /my-data                     everything Qubirex holds about me, as JSON
//   POST   /delete-request              ask my institution to delete my data
//
// Voice, speed, captions, language and low-bandwidth are profile/device
// settings (PUT /profile voice_prefs, ui_language; low-bandwidth is local).
// The PIN is changed with PUT /pin (learner.js).
// ─────────────────────────────────────────────────────────────────────────────
import express from 'express';
import * as dal from '../../core/db/dal.js';
import { ulid } from '../../core/db/ulid.js';
import { authenticateToken, requireRole, requireActiveLearner } from '../middleware/auth.js';
import { activeDevices } from '../../core/devices.js';
import { grant, withdraw, LEVELS } from '../../core/consent/levels.js';

const router = express.Router();
router.use(authenticateToken, requireRole('learner'), requireActiveLearner);

const PARENT_SHARE_TEXT = 'parent-share-v1';
const institutionOf = async (req) => (await dal.one('SELECT institution_id FROM engagements WHERE id = ?', req.user.engagement_id))?.institution_id;

router.get('/settings', async (req, res) => {
  const [devices, consent, learner] = await Promise.all([
    activeDevices(req.user.id, req.session?.id),
    dal.one('SELECT id, granted_at FROM consents WHERE learner_id = ? AND level = ? AND withdrawn_at IS NULL ORDER BY granted_at DESC LIMIT 1', req.user.id, LEVELS.INSTITUTION_SHARE),
    dal.one('SELECT notification_prefs, pin_set_at, age_status, is_discoverable, city FROM learners WHERE id = ?', req.user.id)
  ]);
  let notifications = {};
  try { notifications = JSON.parse(learner?.notification_prefs || '{}'); } catch { notifications = {}; }
  const pending = await dal.one("SELECT created_at FROM access_events WHERE learner_id = ? AND event = 'deletion_requested' AND resolved = 0 ORDER BY created_at DESC LIMIT 1", req.user.id);
  res.json({
    devices, notifications, pin_set_at: learner?.pin_set_at || null, age_status: learner?.age_status || 'unknown',
    parent_share: { on: !!consent, since: consent?.granted_at || null },
    discoverable: !!learner?.is_discoverable, city: learner?.city || null,
    deletion_requested_at: pending?.created_at || null
  });
});

router.post('/devices/sign-out-others', async (req, res) => {
  const r = await dal.run("UPDATE auth_sessions SET revoked_at = ?, revoked_reason = 'signed_out_by_learner' WHERE actor_type = 'learner' AND actor_id = ? AND id != ? AND revoked_at IS NULL",
    dal.nowIso(), req.user.id, req.session.id);
  res.json({ signed_out: r.changes });
});

router.delete('/devices/:id', async (req, res) => {
  if (req.params.id === req.session.id) return res.status(400).json({ error: 'Use Log out to sign out of this device.' });
  const r = await dal.run("UPDATE auth_sessions SET revoked_at = ?, revoked_reason = 'signed_out_by_learner' WHERE id = ? AND actor_type = 'learner' AND actor_id = ? AND revoked_at IS NULL",
    dal.nowIso(), req.params.id, req.user.id);
  if (!r.changes) return res.status(404).json({ error: 'Not found' });
  res.json({ signed_out: 1 });
});

router.put('/consents/parent-share', async (req, res) => {
  const on = !!req.body?.on;
  const current = await dal.one('SELECT id FROM consents WHERE learner_id = ? AND level = ? AND withdrawn_at IS NULL', req.user.id, LEVELS.INSTITUTION_SHARE);
  if (on && !current) {
    await grant({ learnerId: req.user.id, institutionId: await institutionOf(req), level: LEVELS.INSTITUTION_SHARE, purpose: 'Share my progress report with my parents or guardians', textVersion: PARENT_SHARE_TEXT });
  } else if (!on && current) {
    await withdraw(current.id);
  }
  res.json({ on });
});

// Everything held about the learner, in one file: their profile, education,
// projects, enrolments, sessions and messages (their own words), mastery,
// reviews, consents, skill requests and sign-ins. Nothing about other people.
router.get('/my-data', async (req, res) => {
  const id = req.user.id;
  const els = await dal.all('SELECT * FROM engagement_learners WHERE learner_id = ?', id);
  // Rows of any of the learner's enrolments.
  const inEls = (sql) => dal.all(sql, id);
  const learner = await dal.one('SELECT id, name, email, learner_ref, language, city, age_status, created_at FROM learners WHERE id = ?', id);
  const data = {
    exported_at: new Date().toISOString(),
    learner,
    profile: await dal.one('SELECT * FROM learner_profiles WHERE learner_id = ?', id),
    education: await dal.all('SELECT degree, institution_name, city, start_year, end_year, grade FROM learner_education WHERE learner_id = ? ORDER BY sequence_order', id),
    projects: await dal.all('SELECT title, description, tools, link_url FROM learner_projects WHERE learner_id = ? ORDER BY sequence_order', id),
    enrolments: els.map(({ failed_pin_attempts, ...e }) => e),
    sessions: await inEls('SELECT id, skill_node_id, status, started_at, completed_at, active_minutes, loop_count FROM learning_sessions WHERE engagement_learner_id IN (SELECT el.id FROM engagement_learners el WHERE el.learner_id = ?) ORDER BY started_at'),
    messages: await inEls(`SELECT sm.session_id, sm.role, sm.content, sm.message_type, sm.created_at FROM session_messages sm
      JOIN learning_sessions ls ON ls.id = sm.session_id WHERE ls.engagement_learner_id IN (SELECT el.id FROM engagement_learners el WHERE el.learner_id = ?) ORDER BY sm.created_at`),
    mastery: await inEls(`SELECT nm.skill_node_id, sn.node_label, nm.advanced_at, nm.evidence_level, nm.attempt_count FROM node_mastery nm
      JOIN skill_nodes sn ON sn.id = nm.skill_node_id WHERE nm.engagement_learner_id IN (SELECT el.id FROM engagement_learners el WHERE el.learner_id = ?)`),
    reviews: await inEls('SELECT node_id, due_at, last_review_at, last_result, reviews_passed, reviews_failed FROM node_retention WHERE el_id IN (SELECT el.id FROM engagement_learners el WHERE el.learner_id = ?)'),
    consents: await dal.all('SELECT level, purpose, granted_by, granted_at, withdrawn_at FROM consents WHERE learner_id = ?', id),
    skill_requests: await inEls('SELECT skill_name, status, created_at FROM skill_requests WHERE engagement_learner_id IN (SELECT el.id FROM engagement_learners el WHERE el.learner_id = ?)'),
    resume_versions: await dal.all('SELECT version, template, created_at FROM resume_versions WHERE learner_id = ? ORDER BY version', id),
    sign_ins: await dal.all("SELECT device_label, city, created_at, revoked_at FROM auth_sessions WHERE actor_type = 'learner' AND actor_id = ? ORDER BY created_at DESC LIMIT 100", id)
  };
  res.set('Content-Type', 'application/json; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="qubirex-my-data-${learner?.learner_ref || 'me'}.json"`);
  res.send(JSON.stringify(data, null, 2));
});

// Deleting a learner's record is the institution's decision (it holds the
// enrolment); the request goes to their access history to act on.
router.post('/delete-request', async (req, res) => {
  const institutionId = await institutionOf(req);
  const open = await dal.one("SELECT 1 FROM access_events WHERE learner_id = ? AND event = 'deletion_requested' AND resolved = 0", req.user.id);
  if (!open) {
    await dal.run(`INSERT INTO access_events (id, institution_id, learner_id, engagement_learner_id, event, detail, created_at)
      VALUES (?, ?, ?, ?, 'deletion_requested', ?, ?)`, ulid(), institutionId, req.user.id, req.user.el_id,
    String(req.body?.reason || 'Asked to delete my data').slice(0, 300), dal.nowIso());
  }
  res.status(202).json({ message: 'Your request was sent to your institution. They will contact you before deleting anything.' });
});

export default router;
