// api/routes/institutionTopics.js — Topics for colleges, mounted at /api/institution.
//   GET  /topics                          the catalog: modules, lessons, hours, how students are
//                                         checked, how many of our students are on each course,
//                                         review state per language and 👍/👎 feedback
//   GET  /topics/lessons/:id?language=    one lesson to read in English, Telugu or Hindi
//   POST /topics/lessons/:id/review       { language, status: reviewed | suggested, suggestion }
//   GET  /students/:elId/extra-topics     a student's own topics (only if they share their record)
import express from 'express';
import * as dal from '../../core/db/dal.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { staffMiddleware, requireStaffRole, scopeClause } from '../middleware/staff.js';
import { collegeTopics, lessonForReview, reviewLesson, extraTopics } from '../../core/courses/review.js';

const router = express.Router();
router.use(authenticateToken, requireRole('institution'), ...staffMiddleware);
const wrap = (fn) => async (req, res) => {
  try { await fn(req, res); } catch (e) { res.status(e.status || 500).json({ error: e.status ? e.message : 'Something went wrong.' }); }
};

router.get('/topics', wrap(async (req, res) => res.json({ courses: await collegeTopics(req.user.id) })));
router.get('/topics/lessons/:id', wrap(async (req, res) => res.json(await lessonForReview(req.user.id, req.params.id, String(req.query.language || 'english')))));
router.post('/topics/lessons/:id/review', requireStaffRole('admin', 'professor'), wrap(async (req, res) => res.json(await reviewLesson(req.user.id, req.staff?.id, req.params.id, {
  language: String(req.body?.language || ''), status: String(req.body?.status || ''), suggestion: req.body?.suggestion
}))));
router.get('/students/:elId/extra-topics', wrap(async (req, res) => {
  const scope = await scopeClause(dal.legacyHandle(), req, 'el.engagement_id');
  const el = await dal.one(`SELECT el.learner_id FROM engagement_learners el JOIN engagements e ON e.id = el.engagement_id WHERE el.id = ? AND e.institution_id = ? ${scope.sql}`, req.params.elId, req.user.id, ...scope.params);
  if (!el) return res.status(404).json({ error: 'Not found' });
  res.json(await extraTopics(el.learner_id));
}));

export default router;
