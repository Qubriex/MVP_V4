// api/routes/learnerCourses.js — topics (courses), mounted at /api/learner.
//   GET  /courses                          the catalog, with my progress per course
//   GET  /courses/mine                     My topics: added courses, progress, next lesson
//   GET  /courses/:id                      a course page: modules and lessons in order, with status
//   POST /courses/:id/add  DELETE /courses/:id   add or remove from My topics
//   GET  /lessons/:id                      a lesson in my learning language (all ten parts) + my progress
//   POST /lessons/:id/step                 { step: learn | code | practise | check } — where I am
//   POST /lessons/:id/ask                  { question } — answered within the lesson
//   POST /lessons/:id/hint                 { solution? } — next hint; the solution after three tries
//   POST /lessons/:id/practice             { results, hints_used, code } — test results from the browser runner
//   POST /lessons/:id/check                start the check (a fresh question)
//   POST /lessons/:id/check/answer         { answer, provenance }
//   POST /lessons/:id/challenge            { answer, mode } — the spoken challenge after a pass
//   GET  /lessons/:id/testout   POST /lessons/:id/testout   "I already know this"
//   POST /lessons/:id/feedback             { part, vote, comment } — "Was this clear?"
//   GET  /modules/:id/test   POST /modules/:id/test   the module test
//   GET  /modules/:id/project  POST /modules/:id/project  the module project
//   GET  /learning-language  PUT /learning-language   { value }
import express from 'express';
import * as dal from '../../core/db/dal.js';
import { ulid } from '../../core/db/ulid.js';
import { authenticateToken, requireRole, requireActiveLearner } from '../middleware/auth.js';
import { courseById, lessonById, courseOutline, lessonView, LESSON_PARTS } from '../../core/courses/catalog.js';
import {
  allCourses, learningLanguage, setLearningLanguage, addCourse, removeCourse, courseProgress, myCourses, openLesson, setStep,
  recordPractice, nextHint, startCheck, answerCheck, answerChallenge, testOut, testOutQuestions,
  moduleTest, answerModuleTest, moduleProject, submitProject, lessonLabel
} from '../../core/courses/learning.js';
import { askLesson } from '../../core/courses/ask.js';
import { lessonReviewBadge } from '../../core/courses/review.js';
import { issueCredential } from '../../core/return/credentialEngine.js';

const router = express.Router();
router.use(authenticateToken, requireRole('learner'), requireActiveLearner);

const wrap = (fn) => async (req, res) => {
  try { await fn(req, res); } catch (e) {
    if (!e.status) req.log?.error?.('courses.failed', { error: e });
    res.status(e.status || 500).json({ error: e.status ? e.message : 'Something went wrong. Please try again.' });
  }
};
const lang = (req) => learningLanguage(req.user.id);

// After a module is completed, the Passport is reissued with that skill group.
async function refreshPassport(req) {
  try { await issueCredential(req.user.el_id, { reason: 'module_completed' }); } catch (e) { req.log?.warn?.('courses.passport_refresh_failed', { error: e.message }); }
}

router.get('/learning-language', wrap(async (req, res) => res.json({ value: await lang(req) })));
router.put('/learning-language', wrap(async (req, res) => res.json({ value: await setLearningLanguage(req.user.id, String(req.body?.value || '')) })));

router.get('/courses', wrap(async (req, res) => {
  const l = await lang(req);
  const courses = [];
  for (const c of allCourses()) {
    const o = courseOutline(c, l);
    const p = await courseProgress(req.user.id, c.id);
    courses.push({ id: o.id, title: o.title, title_en: o.title_en, summary: o.summary, level: o.level, hours: o.hours, status: o.status, language: o.language,
      modules: o.modules.length, lessons: o.modules.reduce((a, m) => a + m.lessons.length, 0), added: p.added, pct: p.pct, next_lesson_id: p.next_lesson_id });
  }
  res.json({ language: l, courses });
}));
router.get('/courses/mine', wrap(async (req, res) => res.json({ courses: await myCourses(req.user.id) })));
router.get('/courses/:id', wrap(async (req, res) => {
  const c = courseById(req.params.id);
  if (!c) return res.status(404).json({ error: 'No such course.' });
  const l = await lang(req);
  res.json({ ...courseOutline(c, l), language_setting: l, progress: await courseProgress(req.user.id, c.id) });
}));
router.post('/courses/:id/add', wrap(async (req, res) => { await addCourse(req.user.id, req.params.id); res.json({ ok: true, progress: await courseProgress(req.user.id, req.params.id) }); }));
router.delete('/courses/:id', wrap(async (req, res) => { await removeCourse(req.user.id, req.params.id); res.json({ ok: true }); }));

router.get('/lessons/:id', wrap(async (req, res) => {
  const lesson = lessonById(req.params.id);
  if (!lesson) return res.status(404).json({ error: 'No such lesson.' });
  const l = await lang(req);
  const progress = await openLesson(req.user.id, lesson.id);
  const course = courseById(lesson.course_id);
  const all = course.modules.flatMap(m => m.lessons);
  const i = all.findIndex(x => x.id === lesson.id);
  // Suggested, never locked: the lesson before this one, if it is not done yet.
  const prev = all[i - 1];
  const prevDone = prev ? (await dal.one("SELECT 1 FROM lesson_progress WHERE learner_id = ? AND lesson_id = ? AND status IN ('done','known')", req.user.id, prev.id)) : true;
  res.json({
    ...lessonView(lesson, l), parts_order: LESSON_PARTS,
    progress: { step: progress.step, status: progress.status, practice_passed: !!progress.practice_passed, practice_tries: progress.practice_tries, hints_used: progress.hints_used },
    label: await lessonLabel(req.user.id, lesson.id),
    prev: prev ? { id: prev.id, title: prev.title.en, done: !!prevDone } : null,
    next: all[i + 1] ? { id: all[i + 1].id } : null,
    reviewed_by: await lessonReviewBadge(req.user.institution_id, lesson.id)
  });
}));
router.post('/lessons/:id/step', wrap(async (req, res) => { const p = await setStep(req.user.id, req.params.id, String(req.body?.step || '')); res.json({ step: p.step, status: p.status }); }));
router.post('/lessons/:id/ask', wrap(async (req, res) => {
  const lesson = lessonById(req.params.id);
  if (!lesson) return res.status(404).json({ error: 'No such lesson.' });
  const q = String(req.body?.question || '').trim().slice(0, 500);
  if (!q) return res.status(400).json({ error: 'Ask a question first.' });
  res.json(await askLesson(lesson, q, await lang(req)));
}));
router.post('/lessons/:id/hint', wrap(async (req, res) => res.json(await nextHint(req.user.id, req.params.id, { language: await lang(req), solution: req.body?.solution === true }))));
router.post('/lessons/:id/practice', wrap(async (req, res) => res.json(await recordPractice(req.user.id, req.params.id, { results: req.body?.results, hintsUsed: req.body?.hints_used, code: String(req.body?.code || '').slice(0, 20000) }))));
// The runner needs every test, hidden ones included; their content is never shown on the page.
router.get('/lessons/:id/practice/tests', wrap(async (req, res) => {
  const lesson = lessonById(req.params.id);
  if (!lesson?.task) return res.status(404).json({ error: 'No such practice.' });
  res.json({ tests: lesson.task.tests, setup: lesson.task.setup || '', language: courseById(lesson.course_id).language });
}));
router.post('/lessons/:id/check', wrap(async (req, res) => res.json(await startCheck(req.user.id, req.params.id, await lang(req)))));
router.post('/lessons/:id/check/answer', wrap(async (req, res) => res.json(await answerCheck(req.user.id, req.params.id, { answer: String(req.body?.answer || '').slice(0, 5000), provenance: req.body?.provenance, language: await lang(req) }))));
router.post('/lessons/:id/challenge', wrap(async (req, res) => res.json(await answerChallenge(req.user.id, req.params.id, { answer: String(req.body?.answer || '').slice(0, 5000), mode: req.body?.mode, language: await lang(req) }))));
router.get('/lessons/:id/testout', wrap(async (req, res) => res.json({ questions: testOutQuestions(req.params.id, await lang(req)) })));
router.post('/lessons/:id/testout', wrap(async (req, res) => res.json(await testOut(req.user.id, req.params.id, { answers: Array.isArray(req.body?.answers) ? req.body.answers.map(a => String(a || '').slice(0, 5000)) : [], language: await lang(req) }))));
router.post('/lessons/:id/feedback', wrap(async (req, res) => {
  const lesson = lessonById(req.params.id);
  const part = String(req.body?.part || '');
  const vote = Number(req.body?.vote);
  if (!lesson || ![...LESSON_PARTS, 'lesson'].includes(part) || ![1, -1].includes(vote)) return res.status(400).json({ error: 'Choose a part and 👍 or 👎.' });
  await dal.run('INSERT INTO content_feedback (id, learner_id, institution_id, lesson_id, part, language, vote, comment, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ulid(), req.user.id, req.user.institution_id || null, lesson.id, part, await lang(req), vote, String(req.body?.comment || '').trim().slice(0, 500) || null, dal.nowIso());
  res.json({ ok: true });
}));

router.get('/modules/:id/test', wrap(async (req, res) => res.json(moduleTest(req.params.id, await lang(req)))));
router.post('/modules/:id/test', wrap(async (req, res) => {
  const out = await answerModuleTest(req.user.id, req.params.id, { answers: req.body?.answers || [], language: await lang(req) });
  if (out.module.completed_now) await refreshPassport(req);
  res.json(out);
}));
router.get('/modules/:id/project', wrap(async (req, res) => {
  const p = moduleProject(req.params.id, await lang(req));
  const { all_tests: allTests, ...shown } = p;
  res.json({ ...shown, runner_tests: allTests });
}));
router.post('/modules/:id/project', wrap(async (req, res) => {
  const out = await submitProject(req.user.id, req.params.id, { results: req.body?.results, code: String(req.body?.code || '').slice(0, 40000) });
  if (out.module.completed_now) await refreshPassport(req);
  res.json(out);
}));

export default router;
