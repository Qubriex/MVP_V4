// api/routes/learnerJourney.js — the learner journey screens, mounted at /api/learner.
//   GET  /journey                         stage (S0–S12), its name and the one next step
//   GET  /baseline                        the starting check: status, questions, placement
//   POST /baseline/start | /answer | /finish | /skip
//   GET  /skill/:nodeId                   the five tabs: concept, practice, apply (work task), progress
//   POST /skill/:nodeId/practice          { kind: quick|written|code|task, item_key, answer, provenance }
//   POST /skill/:nodeId/task              open (or keep) the 30-day work task
//   POST /skill/:nodeId/challenge         the spoken challenge after a passed check
//   POST /challenge/:id/answer            { answer, mode: voice|typed }
//   POST /skill/:nodeId/help              ask my professor after a check that did not pass
//   GET  /history                         every attempt, newest first
//   GET  /readiness?role=                 readiness for a role: three bars per skill
//   POST /plan  DELETE /plan              add or remove a skill in my plan
//   GET  /assigned                        bridge programmes from the college, with "Did it work?"
//   GET  /dayone   POST /dayone/:step     Day-One Simulation: precheck | practice | scored
//   GET  /apply/:roleId  POST /apply/:roleId   what an application shares, then send it
//   GET  /requests/:id  POST /requests/:id/decide   an employer request: approve items, decline, ask
//   GET  /notification-prefs  PUT /notification-prefs
//   GET  /resume/claims  POST /resume/claims   what the résumé says vs what is proven
//   GET  /account-deletion  POST /account-deletion/request | /confirm | /cancel
import express from 'express';
import * as dal from '../../core/db/dal.js';
import { authenticateToken, requireRole, requireActiveLearner } from '../middleware/auth.js';
import { journeyStage } from '../../core/journey/stage.js';
import { skillView, answerPractice, workTask, nodeFor, startChallenge, answerChallenge, attemptHistory, baselineState, startBaseline, answerBaseline, finishBaseline } from '../../core/journey/skills.js';
import { readinessView, addToPlan, removeFromPlan } from '../../core/journey/readiness.js';
import { dayoneView, dayoneStep, assignedView, notificationPrefs, setNotificationPrefs, setResumeClaims, resumeClaimsView, deletionState, requestDeletion, confirmDeletion, cancelDeletion } from '../../core/journey/extras.js';
import { applyToRole, learnerRequest, respond, askEmployer, SHARE_ITEMS } from '../../core/hiringLoop.js';
import { activeCredential } from '../../core/return/credentialEngine.js';
import { notify } from '../../core/notify.js';
import { ulid } from '../../core/db/ulid.js';
import { nowIsoFor } from '../../core/requestContext.js';

const router = express.Router();
router.use(authenticateToken, requireRole('learner'), requireActiveLearner);

const fail = (res, e) => res.status(e.status || 500).json({ error: e.status ? e.message : 'Something went wrong. Please try again.' });
const wrap = (fn) => async (req, res) => { try { await fn(req, res); } catch (e) { if (!e.status) req.log?.error?.('learner_journey.failed', { error: e }); fail(res, e); } };
const lang = (req) => req.user.language || 'telugu';

async function enrolment(req) {
  return dal.one(`SELECT el.id AS el_id, el.learner_id, el.engagement_id, e.capability_target_id, e.institution_id
    FROM engagement_learners el JOIN engagements e ON e.id = el.engagement_id WHERE el.id = ?`, req.user.el_id);
}

router.get('/journey', wrap(async (req, res) => {
  const j = await journeyStage(req.user.el_id);
  const { facts, ...rest } = j;
  res.json({ ...rest, facts: { mastered: facts.mastered, total: facts.total, requests_waiting: facts.requested.length, failed_check: facts.failed_check, group_done: facts.group_done, baseline: facts.baseline, passport: facts.passport } });
}));

// ─── Starting check ────────────────────────────────────────────────────────────
router.get('/baseline', wrap(async (req, res) => res.json(await baselineState(await enrolment(req)))));
router.post('/baseline/start', wrap(async (req, res) => res.json(await startBaseline(await enrolment(req), lang(req)))));
router.post('/baseline/answer', wrap(async (req, res) => res.json(await answerBaseline(await enrolment(req), { key: String(req.body?.key || ''), answer: req.body?.answer, language: lang(req) }))));
router.post('/baseline/finish', wrap(async (req, res) => res.json(await finishBaseline(await enrolment(req)))));
router.post('/baseline/skip', wrap(async (req, res) => res.json(await finishBaseline(await enrolment(req), { skip: true }))));

// ─── One skill: concept, practice, work task, progress ─────────────────────────
router.get('/skill/:nodeId', wrap(async (req, res) => res.json(await skillView(await enrolment(req), req.params.nodeId, lang(req)))));
router.post('/skill/:nodeId/practice', wrap(async (req, res) => {
  const kind = ['quick', 'written', 'code', 'task'].includes(req.body?.kind) ? req.body.kind : null;
  if (!kind) return res.status(400).json({ error: 'Unknown practice item.' });
  res.json(await answerPractice(await enrolment(req), req.params.nodeId, { kind, itemKey: String(req.body?.item_key || ''), answer: req.body?.answer, provenance: req.body?.provenance, language: lang(req) }));
}));
router.post('/skill/:nodeId/task', wrap(async (req, res) => {
  const el = await enrolment(req);
  const node = await nodeFor(el.el_id, req.params.nodeId);
  const t = await workTask(el, node, lang(req), { create: true });
  res.json({ brief: t.brief, guide: t.guide, assigned_at: t.assigned_at, locked_until: t.locked_until, status: t.status });
}));
router.post('/skill/:nodeId/challenge', wrap(async (req, res) => res.json(await startChallenge(await enrolment(req), req.params.nodeId, lang(req)))));
router.post('/challenge/:id/answer', wrap(async (req, res) => res.json(await answerChallenge(await enrolment(req), req.params.id, { answer: req.body?.answer, mode: req.body?.mode, language: lang(req) }))));
router.post('/skill/:nodeId/help', wrap(async (req, res) => {
  const el = await enrolment(req);
  const node = await nodeFor(el.el_id, req.params.nodeId);
  const message = String(req.body?.message || '').trim().slice(0, 1000);
  const ev = await dal.one('SELECT id FROM evidence_records WHERE el_id = ? AND node_id = ? AND passed = 0 ORDER BY created_at DESC LIMIT 1', el.el_id, node.id);
  const open = await dal.one("SELECT id FROM check_help_requests WHERE el_id = ? AND node_id = ? AND status = 'open'", el.el_id, node.id);
  if (!open) {
    await dal.run(`INSERT INTO check_help_requests (id, el_id, node_id, institution_id, evidence_id, message, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'open', ?)`,
      ulid(), el.el_id, node.id, el.institution_id, ev?.id || null, message || null, dal.nowIso());
    await notify({ to: { type: 'institution', id: el.institution_id }, kind: 'help_request', title: `A student asked for help with ${node.node_label}`, body: message || null, href: '/institution/review?tab=help' });
  }
  res.json({ ok: true, already_open: !!open });
}));

router.get('/history', wrap(async (req, res) => res.json({ attempts: await attemptHistory(req.user.el_id, { nodeId: req.query.node || null }) })));

// ─── Readiness and plan ────────────────────────────────────────────────────────
router.get('/readiness', wrap(async (req, res) => res.json(await readinessView(req.user, { roleId: req.query.role ? String(req.query.role) : null }))));
router.post('/plan', wrap(async (req, res) => res.json({ plan: await addToPlan(req.user.id, req.body?.skill, req.body?.source) })));
router.delete('/plan', wrap(async (req, res) => res.json({ plan: await removeFromPlan(req.user.id, req.body?.skill || req.query.skill) })));

router.get('/assigned', wrap(async (req, res) => res.json({ bridges: await assignedView(await enrolment(req)) })));

// ─── Day-One Simulation ────────────────────────────────────────────────────────
router.get('/dayone', wrap(async (req, res) => res.json(await dayoneView(await enrolment(req), lang(req)))));
router.post('/dayone/:step', wrap(async (req, res) => res.json(await dayoneStep(await enrolment(req), {
  step: req.params.step, checks: req.body?.checks, answers: req.body?.answers, supervision: req.body?.supervision, language: lang(req)
}))));

// ─── Apply to a role on Qubirex ─────────────────────────────────────────────────
router.get('/apply/:roleId', wrap(async (req, res) => {
  const role = await dal.one(`SELECT r.id, r.title, r.city, r.interview_promise, em.name AS employer, em.kyb_status FROM employer_roles r JOIN employers em ON em.id = r.employer_id
    WHERE r.id = ? AND r.published = 1 AND r.status = 'open'`, req.params.roleId);
  if (!role) return res.status(404).json({ error: 'This job is no longer open.' });
  const cred = await activeCredential('el_id = ?', req.user.el_id);
  const me = await dal.one('SELECT name, email FROM learners WHERE id = ?', req.user.id);
  const mine = await dal.one('SELECT id, stage FROM employer_pipeline WHERE role_id = ? AND el_id = ?', role.id, req.user.el_id);
  res.json({
    role: { id: role.id, title: role.title, city: role.city, employer: role.employer, verified: role.kyb_status === 'verified', interview_promise: !!role.interview_promise },
    shares: SHARE_ITEMS, evidence_id: cred?.evidence_id || null, name: me?.name, has_email: !!me?.email,
    current: mine ? { id: mine.id, stage: mine.stage } : null
  });
}));
router.post('/apply/:roleId', wrap(async (req, res) => {
  if (req.body?.confirm !== true) return res.status(400).json({ error: 'Confirm what you share first.' });
  await applyToRole(req.user, req.params.roleId);
  const p = await dal.one('SELECT id, stage FROM employer_pipeline WHERE role_id = ? AND el_id = ?', req.params.roleId, req.user.el_id);
  res.json({ ok: true, id: p?.id, stage: p?.stage });
}));

// ─── Employer request detail ───────────────────────────────────────────────────
router.get('/requests/:id', wrap(async (req, res) => {
  const r = await learnerRequest(req.user, req.params.id);
  if (!r) return res.status(404).json({ error: 'Not found' });
  res.json(r);
}));
router.post('/requests/:id/decide', wrap(async (req, res) => {
  const d = String(req.body?.decision || '');
  if (d === 'question') { await askEmployer(req.user, req.params.id, req.body?.note); return res.json(await learnerRequest(req.user, req.params.id)); }
  if (!['approve', 'decline'].includes(d)) return res.status(400).json({ error: 'Choose approve, decline or ask a question.' });
  const ok = await respond(req.user, req.params.id, { yes: d === 'approve', items: Array.isArray(req.body?.items) ? req.body.items : [], expiresDays: req.body?.expires_days });
  if (!ok) return res.status(404).json({ error: 'Not found' });
  res.json(await learnerRequest(req.user, req.params.id));
}));

// ─── Notification preferences ──────────────────────────────────────────────────
router.get('/notification-prefs', wrap(async (req, res) => res.json({ prefs: await notificationPrefs(req.user.id) })));
router.put('/notification-prefs', wrap(async (req, res) => res.json({ prefs: await setNotificationPrefs(req.user.id, req.body?.prefs) })));

// ─── Résumé claims ─────────────────────────────────────────────────────────────
router.get('/resume/claims', wrap(async (req, res) => res.json(await resumeClaimsView(await enrolment(req)))));
router.post('/resume/claims', wrap(async (req, res) => {
  await setResumeClaims(req.user.id, req.body?.text);
  res.json(await resumeClaimsView(await enrolment(req)));
}));

// ─── Delete my account ─────────────────────────────────────────────────────────
router.get('/account-deletion', wrap(async (req, res) => res.json(await deletionState(req.user.id))));
router.post('/account-deletion/request', wrap(async (req, res) => res.json(await requestDeletion(req.user.id))));
router.post('/account-deletion/confirm', wrap(async (req, res) => res.json(await confirmDeletion(req.user.id, req.body?.otp))));
router.post('/account-deletion/cancel', wrap(async (req, res) => res.json(await cancelDeletion(req.user.id))));

// Used by the shifted test clock (/dev): today as this learner's page sees it.
router.get('/clock', (req, res) => res.json({ now: nowIsoFor() }));

export default router;
