// api/routes/institutionActivity.js — live status, activity, exports. Mounted at /api/institution.
// ─────────────────────────────────────────────────────────────────────────────
//   GET /engagements/:id/live                 who is learning now (green/yellow/red)
//   GET /engagements/:id/activity[.csv]       activity per student over ?from=&to=
//   GET /engagements/:id/progress.csv         one row per student per skill node
//   GET /engagements/:id/activity-days        students practising per day, last ?days= (≤ 365)
//   GET /engagements/:id/students/:elId/pathway   one student's own pathway
//   GET /engagements/:id/evidence-report      per-student evidence for ?from=&to=&el_ids=
//   POST /curriculum/upload                   text out of a curriculum file (admin), for the new-cohort brief
//
// Every download and evidence report is written to each student's access
// history (who, when, what). Nothing here reads session text or marking.
// ─────────────────────────────────────────────────────────────────────────────
import express from 'express';
import multer from 'multer';
import { legacyHandle as getDb } from '../../core/db/dal.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { staffMiddleware, findScopedEngagement, requireStaffRole } from '../middleware/staff.js';
import { extractCurriculumText, MAX_UPLOAD_BYTES } from '../../core/curriculumText.js';
import { aiNotConfigured, AI_NOT_CONFIGURED } from '../../core/ai/gateway.js';
import { logEvent } from '../../core/access.js';
import { eachSeq } from '../../core/util/seq.js';
import { liveStatus, activitySummary, activityDays, studentPathway, evidenceReport, dayRange } from '../../core/institutionActivity.js';

const router = express.Router();
router.use(authenticateToken);
router.use(requireRole('institution'));
router.use(...staffMiddleware);

const esc = (v) => (v == null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
const csv = (header, rows) => [header.join(','), ...rows.map(r => r.map(esc).join(','))].join('\n');
const elIdsOf = (q) => (q ? String(q).split(',').map(s => s.trim()).filter(Boolean).slice(0, 2000) : null);
const staffName = (req) => req.staff?.name || 'Staff';

// Wraps a handler with the scoped cohort, or 404.
const withCohort = (fn) => async (req, res) => {
  const db = getDb();
  try {
    const e = await findScopedEngagement(db, req, req.params.id);
    if (!e) return res.status(404).json({ error: 'Not found' });
    return await fn(req, res, db, e);
  } finally {
    db.close();
  }
};

/** One access-history row per student included in an export. */
async function logExport(db, req, e, rows, what) {
  await eachSeq(rows, async (r) => {
    const el = await db.prepare('SELECT learner_id FROM engagement_learners WHERE id = ?').get(r.el_id);
    await logEvent(db, { institutionId: e.institution_id, learnerId: el?.learner_id || null, elId: r.el_id, event: 'data_exported', detail: `${what} · by ${staffName(req)}`, actorStaffId: req.staff?.id || null });
  });
}

router.get('/engagements/:id/live', withCohort(async (req, res, db, e) => {
  res.set('Cache-Control', 'no-store');
  res.json(await liveStatus(db, e.id));
}));

router.get('/engagements/:id/activity', withCohort(async (req, res, db, e) => {
  const range = dayRange(req.query.from, req.query.to);
  res.json({ ...range, students: await activitySummary(db, e.id, { ...range, elIds: elIdsOf(req.query.el_ids) }) });
}));

router.get('/engagements/:id/activity.csv', withCohort(async (req, res, db, e) => {
  const range = dayRange(req.query.from, req.query.to);
  const rows = await activitySummary(db, e.id, { ...range, elIds: elIdsOf(req.query.el_ids) });
  await logExport(db, req, e, rows, `Activity data ${range.from} to ${range.to} (CSV)`);
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="activity-${e.join_code || e.id}-${range.from}-to-${range.to}.csv"`);
  res.send(csv(
    ['learner_reference', 'learner_name', 'language', 'access', 'enrolled_at', 'started_at', 'last_active_at', 'days_active', 'sessions', 'active_minutes', 'loops', 'skills_mastered_in_range', 'skills_mastered_total', 'total_skills', 'current_skill', 'completed', 'range_from', 'range_to'],
    rows.map(r => [r.learner_ref, r.name, r.language, r.access, r.enrolled_at, r.started_at, r.last_active_at, r.days_active, r.sessions, r.active_minutes, r.loops, r.nodes_mastered_in_range, r.nodes_mastered_total, r.total_nodes, r.current_node, r.completed ? 'yes' : 'no', range.from, range.to])
  ));
}));

router.get('/engagements/:id/progress.csv', withCohort(async (req, res, db, e) => {
  const ids = elIdsOf(req.query.el_ids);
  const roster = (await db.prepare(`SELECT el.id AS el_id FROM engagement_learners el WHERE el.engagement_id = ?`).all(e.id)).filter(r => !ids || ids.includes(r.el_id));
  const lines = [];
  await eachSeq(roster, async (r) => {
    const p = await studentPathway(db, e, r.el_id);
    p.clusters.forEach(c => c.nodes.forEach(n => lines.push([p.student.learner_ref, p.student.name, c.label, n.label,
      n.status === 'mastered' ? 'Mastered' : n.status === 'learning' ? 'Learning now' : 'Not started', n.pct, n.mastered_at, n.evidence_level, n.loops, n.active_minutes])));
  });
  await logExport(db, req, e, roster, 'Skill progress (CSV)');
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="skill-progress-${e.join_code || e.id}.csv"`);
  res.send(csv(['learner_reference', 'learner_name', 'cluster', 'skill', 'status', 'percent', 'mastered_at', 'evidence_level', 'loops', 'active_minutes'], lines));
}));

router.get('/engagements/:id/activity-days', withCohort(async (req, res, db, e) => {
  const days = Math.min(365, Math.max(7, Number(req.query.days) || 365));
  res.json(await activityDays(db, e.id, days));
}));

router.get('/engagements/:id/students/:elId/pathway', withCohort(async (req, res, db, e) => {
  const p = await studentPathway(db, e, req.params.elId);
  if (!p) return res.status(404).json({ error: 'Not found' });
  res.json(p);
}));

router.get('/engagements/:id/evidence-report', withCohort(async (req, res, db, e) => {
  const range = dayRange(req.query.from, req.query.to);
  const report = await evidenceReport(db, e, { ...range, elIds: elIdsOf(req.query.el_ids) });
  await logExport(db, req, e, report.students, `Evidence report ${range.from} to ${range.to}`);
  res.set('Cache-Control', 'no-store');
  res.json(report);
}));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES } });
router.post('/curriculum/upload', requireStaffRole('admin'), (req, res, next) => upload.single('file')(req, res, (err) => {
  if (err) return res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'That file is too large (4 MB at most).' : 'Upload failed.' });
  return next();
}), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Choose a file (multipart field "file")' });
  try {
    const out = await extractCurriculumText({ buffer: req.file.buffer, filename: req.file.originalname, mimeType: req.file.mimetype, institutionId: req.user.id });
    res.json({ filename: req.file.originalname, ...out });
  } catch (err) {
    if (aiNotConfigured(err)) return res.status(503).json({ error: `Reading PDFs needs the AI model. ${AI_NOT_CONFIGURED} Upload a .docx or .txt file, or paste the text.` });
    res.status(err.status && err.status < 500 ? err.status : 502).json({ error: err.status && err.status < 500 ? err.message : 'Couldn’t read that file. Try a .docx or .txt file, or paste the text.' });
  }
});

export default router;
