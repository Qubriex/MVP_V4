// api/routes/catalog.js — "See our topics", public, no sign-in. Mounted at /api/catalog.
//   GET /                         every course: modules, lessons, hours, status
//   GET /:courseId                one course outline
//   GET /sample/:lessonId?language=   the free sample lesson of a course (its first lesson), all ten parts
import express from 'express';
import { catalog, courseById, lessonById, courseOutline, lessonView, LESSON_PARTS, LEARNING_LANGUAGES } from '../../core/courses/catalog.js';

const router = express.Router();
const langOf = (req) => (LEARNING_LANGUAGES.includes(req.query.language) ? req.query.language : 'english');
const sampleOf = (course) => course.sample || course.modules[0]?.lessons[0]?.id || null;

router.get('/', (req, res) => {
  res.set('Cache-Control', 'public, max-age=300');
  res.json({ courses: catalog().courses.map(c => ({ ...courseOutline(c, langOf(req)), sample_lesson_id: sampleOf(c) })) });
});
router.get('/sample/:lessonId', (req, res) => {
  const lesson = lessonById(req.params.lessonId);
  const course = lesson && courseById(lesson.course_id);
  if (!lesson || sampleOf(course) !== lesson.id) return res.status(404).json({ error: 'This lesson is not a free sample.' });
  res.set('Cache-Control', 'public, max-age=300');
  res.json({ ...lessonView(lesson, langOf(req)), parts_order: LESSON_PARTS, sample: true, practice_tests: (lesson.task?.tests || []).filter(t => !t.hidden) });
});
router.get('/:courseId', (req, res) => {
  const c = courseById(req.params.courseId);
  if (!c) return res.status(404).json({ error: 'No such course.' });
  res.set('Cache-Control', 'public, max-age=300');
  res.json({ ...courseOutline(c, langOf(req)), sample_lesson_id: sampleOf(c) });
});

export default router;
