// api/routes/institutionLoop.js — mounted at /api/institution (v4.3 canvas I1, I3, I5, I8, I9).
//   GET  /command-centre                       action cards, setup checklist, MoU scoreboard, AI time
//   PUT  /settings/mou-target                  { pct, label, date } (admin)
//   GET  /board-report                         numbers for the board report (printed as PDF)
//   GET  /engagements/:id/grid[.csv]           cohort × skill grid with readiness and live light
//   GET  /engagements/:id/students/:elId/why   why this student is not ready yet
//   POST /engagements/:id/mastery-logs/send    tell students their Mastery Log is ready
//   GET  /bridges · POST /bridges · GET /bridges/:id · POST /bridges/:id/close
//   GET  /placements · POST /placements · PUT /placements/:id · DELETE /placements/:id
import express from 'express';
import * as dal from '../../core/db/dal.js';
import { legacyHandle as getDb } from '../../core/db/dal.js';
import { ulid } from '../../core/db/ulid.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { staffMiddleware, requireStaffRole, findScopedEngagement, scopedEngagementIds } from '../middleware/staff.js';
import { commandCentre, setMouTarget, cohortGrid, whyNotReady, createBridge, bridgeOutcome, placementSummary } from '../../core/collegeLoop.js';
import { cohortReadiness, summarise } from '../../core/readiness/cohort.js';
import { mapSeq, eachSeq } from '../../core/util/seq.js';
import { notify } from '../../core/notify.js';
import { logEvent } from '../../core/access.js';

const router = express.Router();
router.use(authenticateToken);
router.use(requireRole('institution'));
router.use(...staffMiddleware);

const esc = (v) => (v == null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
async function scopedCohorts(req) {
  const rows = await dal.all('SELECT id, title, capability_target_id, institution_id, created_at FROM engagements WHERE institution_id = ? ORDER BY created_at DESC', req.user.id);
  const db = getDb();
  const ids = await scopedEngagementIds(db, req);
  db.close();
  return ids ? rows.filter(r => ids.includes(r.id)) : rows;
}
const withCohort = (fn) => async (req, res) => {
  const db = getDb();
  const e = await findScopedEngagement(db, req, req.params.id);
  db.close();
  if (!e) return res.status(404).json({ error: 'Not found' });
  return fn(req, res, e);
};

// ─── I1 ────────────────────────────────────────────────────────────────────────
router.get('/command-centre', async (req, res) => {
  res.json(await commandCentre(req.user.id, await scopedCohorts(req)));
});
router.put('/settings/mou-target', requireStaffRole('admin'), async (req, res) => {
  await setMouTarget(req.user.id, req.body || {});
  res.json({ ok: true });
});

router.get('/board-report', async (req, res) => {
  const cohorts = await scopedCohorts(req);
  const inst = await dal.one('SELECT name, city, mou_target_pct, mou_target_label, mou_target_date FROM institutions WHERE id = ?', req.user.id);
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const rows = await mapSeq(cohorts, async (c) => {
    const sum = summarise(await cohortReadiness(c));
    const active = Number((await dal.one(`SELECT COUNT(DISTINCT ls.engagement_learner_id) AS n FROM learning_sessions ls JOIN engagement_learners el ON el.id = ls.engagement_learner_id
      WHERE el.engagement_id = ? AND ls.started_at >= ?`, c.id, since)).n);
    const logs = Number((await dal.one('SELECT COUNT(*) AS n FROM mastery_logs WHERE engagement_id = ?', c.id)).n);
    return { cohort: c.title, students: sum.total, ready: sum.counts.ready, nearly: sum.counts.nearly, building: sum.counts.building, active_30d: active, mastery_logs: logs, top_gap: sum.top_gap?.skill || null };
  });
  const placements = await placementSummary(req.user.id);
  res.json({ institution: inst, generated_at: new Date().toISOString(), cohorts: rows, placements: placements.summary });
});

// ─── I3 ────────────────────────────────────────────────────────────────────────
router.get('/engagements/:id/grid', withCohort(async (req, res, e) => res.json(await cohortGrid(e))));
router.get('/engagements/:id/grid.csv', withCohort(async (req, res, e) => {
  const g = await cohortGrid(e);
  const lines = [['learner_reference', 'learner_name', 'readiness', 'band', 'best_role', 'last_active_at', ...g.clusters.map(c => `${c.label} (% mastered)`)].map(esc).join(',')];
  g.students.forEach(s => lines.push([s.learner_ref, s.name, s.readiness, s.band_label, s.role, s.last_active_at, ...s.cells].map(esc).join(',')));
  const db = getDb();
  await eachSeq(g.students, async (s) => logEvent(db, { institutionId: e.institution_id, elId: s.el_id, event: 'data_exported', detail: `Cohort grid (CSV) · by ${req.staff?.name || 'staff'}`, actorStaffId: req.staff?.id || null }));
  db.close();
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="cohort-grid-${e.join_code || e.id}.csv"`);
  res.send(lines.join('\n'));
}));
router.get('/engagements/:id/students/:elId/why', withCohort(async (req, res, e) => {
  const w = await whyNotReady(e, req.params.elId);
  if (!w) return res.status(404).json({ error: 'Not found' });
  res.json(w);
}));

// ─── I5 ────────────────────────────────────────────────────────────────────────
router.post('/engagements/:id/mastery-logs/send', requireStaffRole('admin', 'professor'), withCohort(async (req, res, e) => {
  const logs = await dal.all('SELECT DISTINCT learner_id FROM mastery_logs WHERE engagement_id = ?', e.id);
  const only = Array.isArray(req.body?.learner_ids) ? new Set(req.body.learner_ids) : null;
  const to = logs.filter(l => !only || only.has(l.learner_id));
  await eachSeq(to, async (l) => notify({ to: { type: 'learner', id: l.learner_id }, kind: 'mastery_log', title: 'Your Mastery Log is ready', body: `From ${e.title}. It lists every skill you proved, with dates.`, href: '/learn/record' }));
  res.json({ sent: to.length });
}));

// ─── I8 ────────────────────────────────────────────────────────────────────────
router.get('/bridges', async (req, res) => {
  const cohorts = await scopedCohorts(req);
  if (!cohorts.length) return res.json([]);
  const rows = await dal.all(`SELECT bp.*, e.title AS cohort, (SELECT COUNT(*) FROM bridge_assignments ba WHERE ba.bridge_id = bp.id) AS students
    FROM bridge_programmes bp JOIN engagements e ON e.id = bp.engagement_id
    WHERE bp.engagement_id IN (${cohorts.map(() => '?').join(',')}) ORDER BY bp.created_at DESC`, ...cohorts.map(c => c.id));
  res.json(await mapSeq(rows, async (b) => {
    const ids = JSON.parse(b.node_ids_json);
    const nodes = await dal.all(`SELECT node_label FROM skill_nodes WHERE id IN (${ids.map(() => '?').join(',')})`, ...ids);
    return { id: b.id, title: b.title, cohort: b.cohort, engagement_id: b.engagement_id, scope: b.scope, students: Number(b.students), skills: nodes.map(n => n.node_label), retest_at: b.retest_at, status: b.status, created_at: b.created_at };
  }));
});

router.post('/bridges', requireStaffRole('admin', 'professor'), async (req, res) => {
  const b = req.body || {};
  const db = getDb();
  const e = await findScopedEngagement(db, req, b.engagement_id);
  db.close();
  if (!e) return res.status(404).json({ error: 'Cohort not found' });
  const retest = /^\d{4}-\d{2}-\d{2}$/.test(b.retest_at || '') ? b.retest_at : new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
  try {
    const id = await createBridge({ engagement: e, title: b.title, nodeIds: Array.isArray(b.node_ids) ? b.node_ids.slice(0, 20) : [], scope: b.scope === 'cohort' ? 'cohort' : 'students',
      elIds: Array.isArray(b.el_ids) ? b.el_ids : [], retestAt: retest, note: b.note, staffId: req.staff?.id });
    res.status(201).json({ id });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/bridges/:id', async (req, res) => {
  const b = await dal.one('SELECT * FROM bridge_programmes WHERE id = ? AND institution_id = ?', req.params.id, req.user.id);
  if (!b) return res.status(404).json({ error: 'Not found' });
  const db = getDb();
  const e = await findScopedEngagement(db, req, b.engagement_id);
  db.close();
  if (!e) return res.status(404).json({ error: 'Not found' });
  res.json({ id: b.id, title: b.title, cohort: { id: e.id, title: e.title }, scope: b.scope, note: b.note, retest_at: b.retest_at, status: b.status, created_at: b.created_at, ...await bridgeOutcome(b, e) });
});

router.post('/bridges/:id/close', requireStaffRole('admin', 'professor'), async (req, res) => {
  const r = await dal.run("UPDATE bridge_programmes SET status = 'closed' WHERE id = ? AND institution_id = ?", req.params.id, req.user.id);
  if (!r.changes) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

// ─── I9 ────────────────────────────────────────────────────────────────────────
router.get('/placements', async (req, res) => {
  const cohorts = await scopedCohorts(req);
  const out = await placementSummary(req.user.id, req.query.engagement_id || null);
  const ids = new Set(cohorts.map(c => c.id));
  out.rows = out.rows.filter(r => !r.engagement_id || ids.has(r.engagement_id));
  res.json(out);
});

const cleanPlacement = (b) => ({
  employer_name: String(b.employer_name || '').trim().slice(0, 160),
  role_title: b.role_title ? String(b.role_title).slice(0, 160) : null,
  status: ['offer', 'placed', 'declined'].includes(b.status) ? b.status : 'offer',
  salary_lpa: Number(b.salary_lpa) > 0 && Number(b.salary_lpa) < 200 ? Number(b.salary_lpa) : null,
  offer_date: /^\d{4}-\d{2}-\d{2}$/.test(b.offer_date || '') ? b.offer_date : null,
  joined_date: /^\d{4}-\d{2}-\d{2}$/.test(b.joined_date || '') ? b.joined_date : null
});

router.post('/placements', requireStaffRole('admin', 'professor'), async (req, res) => {
  const p = cleanPlacement(req.body || {});
  if (!p.employer_name) return res.status(400).json({ error: 'Employer name is required.' });
  const el = await dal.one(`SELECT el.id, el.learner_id, el.engagement_id FROM engagement_learners el JOIN engagements e ON e.id = el.engagement_id
    WHERE el.id = ? AND e.institution_id = ?`, req.body?.el_id, req.user.id);
  if (!el) return res.status(400).json({ error: 'Choose a student.' });
  const id = ulid();
  await dal.run(`INSERT INTO placements (id, institution_id, engagement_id, el_id, learner_id, employer_name, role_title, status, salary_lpa, offer_date, joined_date, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, id, req.user.id, el.engagement_id, el.id, el.learner_id, p.employer_name, p.role_title, p.status, p.salary_lpa, p.offer_date, p.joined_date, dal.nowIso());
  res.status(201).json({ id });
});

router.put('/placements/:id', requireStaffRole('admin', 'professor'), async (req, res) => {
  const cur = await dal.one('SELECT * FROM placements WHERE id = ? AND institution_id = ?', req.params.id, req.user.id);
  if (!cur) return res.status(404).json({ error: 'Not found' });
  const p = cleanPlacement({ ...cur, ...req.body });
  const rating = req.body?.rating_90d == null ? cur.rating_90d : Math.min(5, Math.max(1, Math.round(Number(req.body.rating_90d)))) || null;
  await dal.run(`UPDATE placements SET employer_name = ?, role_title = ?, status = ?, salary_lpa = ?, offer_date = ?, joined_date = ?, rating_90d = ?, rating_note = ?, rated_at = ? WHERE id = ?`,
    p.employer_name || cur.employer_name, p.role_title, p.status, p.salary_lpa, p.offer_date, p.joined_date, rating,
    req.body?.rating_note != null ? String(req.body.rating_note).slice(0, 500) : cur.rating_note, rating && rating !== cur.rating_90d ? dal.nowIso() : cur.rated_at, cur.id);
  res.json({ ok: true });
});

router.delete('/placements/:id', requireStaffRole('admin'), async (req, res) => {
  const r = await dal.run('DELETE FROM placements WHERE id = ? AND institution_id = ?', req.params.id, req.user.id);
  if (!r.changes) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

export default router;
