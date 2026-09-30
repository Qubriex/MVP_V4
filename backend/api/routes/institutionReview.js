// api/routes/institutionReview.js — faculty review (v4.3 §7.8), mounted at /api/institution.
//
//   GET  /review-queue            open items in the caller's cohorts, blind:
//                                 no AI score, no stratum, learner hidden
//   GET  /review-queue/:id        one item (learner revealed once reviewed)
//   POST /review-queue/:id/verdict { verdict: pass|fail, band, notes }
//   GET  /calibration             weighted κ per node with its 90% interval
//   GET  /review-load             weekly minutes forecast vs the contract
//   PUT  /review-contract         contracted review minutes per 100 learners (admin)
import express from 'express';
import * as dal from '../../core/db/dal.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { staffMiddleware, requireStaffRole, findScopedEngagement, scopeClause } from '../middleware/staff.js';
import { applyVerdict, nodeCalibration, loadForecast } from '../../core/evidence/faculty.js';
import { BANDS } from '../../core/evidence/calibration.js';
import { retrieveRubric } from '../../core/stores/rubricStore.js';
import params from '../../config/params.js';
import { mapSeq } from '../../core/util/seq.js';

const router = express.Router();
router.use(authenticateToken, requireRole('institution', 'admin'), ...staffMiddleware);

async function blindItem(q, { reveal = false } = {}) {
  const node = await dal.one(`SELECT sn.node_label, sc.cluster_label, e.language FROM skill_nodes sn JOIN skill_clusters sc ON sc.id = sn.cluster_id
    JOIN engagements e ON e.id = ? WHERE sn.id = ?`, q.engagement_id, q.node_id);
  const ev = await dal.one('SELECT instance_id, purpose, created_at FROM evidence_records WHERE id = ?', q.evidence_id);
  const inst = ev.instance_id ? await dal.one('SELECT question_text FROM family_instances WHERE id = ?', ev.instance_id) : null;
  const answer = await dal.one('SELECT answer_text FROM check_answers WHERE evidence_id = ?', q.evidence_id);
  const rubric = await retrieveRubric(node.node_label, node.language);
  const review = await dal.one('SELECT verdict, band, notes, created_at FROM faculty_reviews WHERE queue_id = ?', q.id);
  const learner = reveal && q.status === 'done'
    ? await dal.one('SELECT l.name, l.learner_ref FROM engagement_learners el JOIN learners l ON l.id = el.learner_id WHERE el.id = ?', q.el_id)
    : null;
  return {
    id: q.id, status: q.status, created_at: q.created_at, purpose: ev.purpose,
    node: node.node_label, cluster: node.cluster_label, language: node.language,
    question: inst ? inst.question_text : null,
    answer: answer ? answer.answer_text : null,
    rubric: { passing: rubric.passingCriteria, failing: rubric.failingIndicators },
    bands: BANDS,
    review, learner
  };
}

async function scopedQueue(req, extra = '', args = []) {
  const db = dal.legacyHandle();
  const scope = await scopeClause(db, req, 'q.engagement_id');
  return await dal.all(`SELECT q.* FROM review_queue q WHERE q.institution_id = ? ${scope.sql} ${extra}`, req.user.id, ...scope.params, ...args);
}

router.get('/review-queue', async (req, res) => {
  const { engagement_id: eng } = req.query;
  const status = req.query.status === 'done' ? 'done' : 'open';
  let rows = await scopedQueue(req, `AND q.status = ? ${eng ? 'AND q.engagement_id = ?' : ''} ORDER BY q.priority, q.created_at LIMIT 200`, eng ? [status, eng] : [status]);
  // Weekly minutes cap (§7.8): once reached, the random calibration sample waits.
  const forecasts = await mapSeq([...new Set(rows.map(r => r.engagement_id))], async id => [id, await loadForecast(id)]);
  const capped = new Set(forecasts.filter(([, f]) => f && f.contracted_minutes_per_week != null && f.minutes_used_this_week >= f.contracted_minutes_per_week).map(([id]) => id));
  if (status === 'open') rows = rows.filter(r => !(capped.has(r.engagement_id) && r.reason === 'random'));
  res.json({ items: await mapSeq(rows, async q => await blindItem(q, { reveal: status === 'done' })), cap_reached: capped.size > 0, minutes_per_review: params.get('evidence.faculty.minutesPerReview') });
});

router.get('/review-queue/:id', async (req, res) => {
  const q = (await scopedQueue(req, 'AND q.id = ?', [req.params.id]))[0];
  if (!q) return res.status(404).json({ error: 'Not found' });
  res.json(await blindItem(q, { reveal: true }));
});

router.post('/review-queue/:id/verdict', requireStaffRole('admin', 'professor'), async (req, res) => {
  const q = (await scopedQueue(req, 'AND q.id = ?', [req.params.id]))[0];
  if (!q) return res.status(404).json({ error: 'Not found' });
  try {
    const outcome = await applyVerdict({ queueId: q.id, staffId: req.staff.id, verdict: req.body.verdict, band: req.body.band, notes: req.body.notes || null, secondsSpent: req.body.seconds_spent || null });
    res.json({ ok: true, outcome, item: await blindItem(await dal.one('SELECT * FROM review_queue WHERE id = ?', q.id), { reveal: true }) });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Could not save the verdict' });
  }
});

router.get('/calibration', async (req, res) => {
  const e = await findScopedEngagement(dal.legacyHandle(), req, req.query.engagement_id);
  if (!e) return res.status(404).json({ error: 'Cohort not found' });
  const nodes = await dal.all(`SELECT sn.id, sn.node_label, sc.cluster_label FROM skill_nodes sn JOIN skill_clusters sc ON sc.id = sn.cluster_id
    WHERE sc.capability_target_id = ? ORDER BY sc.sequence_order, sn.sequence_order`, e.capability_target_id);
  const k = params.get('evidence.faculty.kappa');
  res.json({
    rule: { min_n: k.minN, min_lower: k.minLower, min_point: k.minPoint, ci: k.ci },
    nodes: await mapSeq(nodes, async n => ({ node_id: n.id, node: n.node_label, cluster: n.cluster_label, ...await nodeCalibration(n.id) }))
  });
});

router.get('/review-load', async (req, res) => {
  const e = await findScopedEngagement(dal.legacyHandle(), req, req.query.engagement_id);
  if (!e) return res.status(404).json({ error: 'Cohort not found' });
  res.json(await loadForecast(e.id));
});

router.put('/review-contract', requireStaffRole('admin'), async (req, res) => {
  const v = Number(req.body.review_minutes_per_100);
  if (!Number.isFinite(v) || v < 0 || v > 100000) return res.status(400).json({ error: 'Enter minutes per 100 learners per week.' });
  await dal.run('UPDATE institutions SET review_minutes_per_100 = ? WHERE id = ?', Math.round(v), req.user.id);
  res.json({ ok: true, review_minutes_per_100: Math.round(v) });
});

export default router;
