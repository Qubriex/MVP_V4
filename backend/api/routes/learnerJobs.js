// api/routes/learnerJobs.js — Jobs & applications (v4.3 canvas L5, L8).
// Mounted at /api/learner.
//   GET  /jobs-hub?city=          requests from employers, applications,
//                                 employers' open roles with points short of
//                                 their bar, job posts that fit, discoverable
//   PUT  /discoverable            { on, city } — "Let employers find me" (consent level 3)
//   POST /requests/:id/respond    { yes, items: ['skills','resume','contact'] }
//   POST /requests/:id/withdraw   ends that employer's access now
//   POST /roles/:id/apply         apply to an employer's role on Qubirex
//   POST /posts/:id/apply         mark a job post (from the job feed) applied
//   POST /posts/:id/withdraw      mark it withdrawn
//   GET  /today                   Home's Today list: college practice, employer requests, reviews due
import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import * as dal from '../../core/db/dal.js';
import { authenticateToken, requireRole, requireActiveLearner } from '../middleware/auth.js';
import { grant, withdraw, LEVELS } from '../../core/consent/levels.js';
import * as market from '../../core/market/sampleMarket.js';
import { getLearnerSkillState, scoreJob } from '../../core/market/skillGap.js';
import { learnerRequests, respond, withdrawFrom, applyToRole, matchedRoles } from '../../core/hiringLoop.js';
import { BANDS } from '../../core/readiness/cohort.js';
import { mapSeq } from '../../core/util/seq.js';
import { learnerBridges } from '../../core/collegeLoop.js';

const router = express.Router();
router.use(authenticateToken, requireRole('learner'), requireActiveLearner);

const fail = (res, e) => res.status(e.status || 500).json({ error: e.status ? e.message : 'Something went wrong.' });
const institutionOf = async (req) => (await dal.one('SELECT institution_id FROM engagements WHERE id = ?', req.user.engagement_id))?.institution_id;

router.get('/jobs-hub', async (req, res) => {
  const city = String(req.query.city || '');
  const db = dal.legacyHandle();
  const state = await getLearnerSkillState(db, req.user);
  const saved = await dal.all('SELECT job_id, status, created_at, applied_at, withdrawn_at FROM learner_jobs WHERE learner_id = ?', req.user.id);
  const posts = await mapSeq(market.JOBS.filter(j => !city || j.city === city), async (j) => {
    const s = await scoreJob(j, state);
    return { id: j.id, title: j.title, role: j.role, company_type: j.company_type, city: j.city, salary_min: j.salary_min, salary_max: j.salary_max, readiness: s.match, points_short: Math.max(0, BANDS.ready - s.match) };
  });
  const byId = new Map(posts.map(p => [p.id, p]));
  const applications = saved.filter(s => s.status !== 'saved').map(s => {
    const j = market.JOBS.find(x => x.id === s.job_id);
    return j ? { id: j.id, title: j.title, company_type: j.company_type, city: j.city, status: s.status, applied_at: s.applied_at || s.created_at, withdrawn_at: s.withdrawn_at, readiness: byId.get(j.id)?.readiness ?? null } : null;
  }).filter(Boolean);
  const me = await dal.one('SELECT is_discoverable, city FROM learners WHERE id = ?', req.user.id);
  res.json({
    discoverable: !!me?.is_discoverable, my_city: me?.city || null,
    cities: [...new Set(market.JOBS.map(j => j.city))],
    requests: await learnerRequests(req.user.id),
    roles: await matchedRoles(req.user, { city }),
    applications,
    posts: posts.sort((a, b) => a.points_short - b.points_short || b.readiness - a.readiness).slice(0, 12),
    bar: BANDS.ready, sample: true
  });
});

router.get('/today', async (req, res) => {
  const [bridges, waiting, due, started] = await Promise.all([
    learnerBridges(req.user.el_id),
    dal.one("SELECT COUNT(*) AS n FROM employer_pipeline WHERE learner_id = ? AND stage = 'requested'", req.user.id),
    dal.one("SELECT COUNT(*) AS n FROM node_retention WHERE el_id = ? AND due_at <= ?", req.user.el_id, dal.nowIso()),
    dal.one('SELECT COUNT(*) AS n FROM learning_sessions WHERE engagement_learner_id = ?', req.user.el_id)
  ]);
  const me = await dal.one('SELECT is_discoverable FROM learners WHERE id = ?', req.user.id);
  const profile = await dal.one('SELECT headline FROM learner_profiles WHERE learner_id = ?', req.user.id);
  res.json({
    bridges: bridges.filter(b => b.skills.some(s => !s.mastered)),
    requests_waiting: Number(waiting?.n) || 0, reviews_due: Number(due?.n) || 0,
    start_here: { profile: !!profile?.headline, first_lesson: Number(started?.n) > 0, discoverable: !!me?.is_discoverable }
  });
});

router.put('/discoverable', async (req, res) => {
  const on = !!req.body?.on;
  const current = await dal.one('SELECT id FROM consents WHERE learner_id = ? AND level = ? AND withdrawn_at IS NULL', req.user.id, LEVELS.DISCOVERABLE);
  if (on && !current) await grant({ learnerId: req.user.id, institutionId: await institutionOf(req), level: LEVELS.DISCOVERABLE, purpose: 'Let verified employers find me by my verified skills, without my name until I say yes', textVersion: 'discoverable-v1' });
  if (!on && current) await withdraw(current.id);
  const city = req.body?.city !== undefined ? (String(req.body.city || '').slice(0, 80) || null) : undefined;
  if (city !== undefined) await dal.run('UPDATE learners SET is_discoverable = ?, city = ? WHERE id = ?', on ? 1 : 0, city, req.user.id);
  else await dal.run('UPDATE learners SET is_discoverable = ? WHERE id = ?', on ? 1 : 0, req.user.id);
  res.json({ on });
});

router.post('/requests/:id/respond', async (req, res) => {
  try {
    const ok = await respond(req.user, req.params.id, { yes: !!req.body?.yes, items: Array.isArray(req.body?.items) ? req.body.items : [] });
    if (!ok) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) { fail(res, e); }
});

router.post('/requests/:id/withdraw', async (req, res) => {
  const ok = await withdrawFrom(req.user, req.params.id);
  if (!ok) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

router.post('/roles/:id/apply', async (req, res) => {
  try { await applyToRole(req.user, req.params.id); res.json({ ok: true }); } catch (e) { fail(res, e); }
});

router.post('/posts/:id/apply', async (req, res) => {
  if (!market.JOBS.some(j => j.id === req.params.id)) return res.status(404).json({ error: 'Job not found' });
  const now = dal.nowIso();
  await dal.run(`INSERT INTO learner_jobs (id, learner_id, job_id, status, applied_at) VALUES (?, ?, ?, 'applied', ?)
    ON CONFLICT(learner_id, job_id) DO UPDATE SET status = 'applied', applied_at = excluded.applied_at, withdrawn_at = NULL`, uuidv4(), req.user.id, req.params.id, now);
  res.json({ status: 'applied' });
});

router.post('/posts/:id/withdraw', async (req, res) => {
  const r = await dal.run("UPDATE learner_jobs SET status = 'withdrawn', withdrawn_at = ? WHERE learner_id = ? AND job_id = ? AND status = 'applied'", dal.nowIso(), req.user.id, req.params.id);
  if (!r.changes) return res.status(404).json({ error: 'No application to withdraw.' });
  res.json({ status: 'withdrawn' });
});

export default router;
