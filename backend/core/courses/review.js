// core/courses/review.js — colleges and the topic content.
//   lessonReviewBadge   "Reviewed by [college] faculty" for a learner of that college
//   collegeTopics       the catalog for the college's Topics page: modules,
//                       lessons, hours, how students are checked, how many of
//                       the college's students are on each course, review
//                       state per language and the 👍/👎 feedback
//   reviewLesson        a professor marks a lesson Reviewed or suggests an edit
//   extraTopics         a student's self-chosen courses, shown to the college
//                       only when the student shares their record with it
import * as dal from '../db/dal.js';
import { ulid } from '../db/ulid.js';
import { catalog, lessonById, courseOutline, lessonView, lessonLanguages } from './catalog.js';

const err = (status, message) => Object.assign(new Error(message), { status });
const LANGS = ['english', 'telugu', 'hindi'];

export async function lessonReviewBadge(institutionId, lessonId) {
  if (!institutionId) return null;
  const r = await dal.one(`SELECT i.name FROM content_reviews cr JOIN institutions i ON i.id = cr.institution_id
    WHERE cr.institution_id = ? AND cr.lesson_id = ? AND cr.status = 'reviewed' LIMIT 1`, institutionId, lessonId);
  return r ? { college: r.name } : null;
}

export async function collegeTopics(institutionId) {
  const counts = new Map((await dal.all(`SELECT lc.course_id, COUNT(DISTINCT lc.learner_id) AS n FROM learner_courses lc JOIN learners l ON l.id = lc.learner_id
    WHERE l.institution_id = ? GROUP BY lc.course_id`, institutionId)).map(r => [r.course_id, Number(r.n)]));
  const reviews = await dal.all('SELECT lesson_id, language, status FROM content_reviews WHERE institution_id = ?', institutionId);
  const reviewed = new Set(reviews.filter(r => r.status === 'reviewed').map(r => `${r.lesson_id}|${r.language}`));
  const suggested = new Map();
  reviews.filter(r => r.status === 'suggested').forEach(r => suggested.set(r.lesson_id, (suggested.get(r.lesson_id) || 0) + 1));
  const fb = new Map((await dal.all(`SELECT lesson_id, SUM(CASE WHEN vote = 1 THEN 1 ELSE 0 END) AS up, SUM(CASE WHEN vote = -1 THEN 1 ELSE 0 END) AS down
    FROM content_feedback GROUP BY lesson_id`)).map(r => [r.lesson_id, { up: Number(r.up), down: Number(r.down) }]));
  return catalog().courses.map(c => {
    const o = courseOutline(c, 'english');
    return {
      ...o, students: counts.get(c.id) || 0,
      modules: o.modules.map(m => ({
        ...m,
        lessons: m.lessons.map(l => ({
          ...l, feedback: fb.get(l.id) || { up: 0, down: 0 }, suggestions: suggested.get(l.id) || 0,
          reviewed: Object.fromEntries(LANGS.map(x => [x, reviewed.has(`${l.id}|${x}`)]))
        }))
      })),
      checked_by: ['practice code run against tests', 'a fresh check question per attempt', 'a spoken challenge', 'module test', 'module project']
    };
  });
}

/** One lesson in one language for a professor to read, with its feedback comments. */
export async function lessonForReview(institutionId, lessonId, language) {
  const lesson = lessonById(lessonId);
  if (!lesson) throw err(404, 'No such lesson.');
  const view = lessonView(lesson, LANGS.includes(language) ? language : 'english');
  const comments = await dal.all("SELECT part, vote, comment, language, created_at FROM content_feedback WHERE lesson_id = ? AND (institution_id = ? OR institution_id IS NULL) ORDER BY created_at DESC LIMIT 50", lessonId, institutionId);
  const history = await dal.all('SELECT language, status, suggestion, created_at FROM content_reviews WHERE institution_id = ? AND lesson_id = ? ORDER BY created_at DESC LIMIT 30', institutionId, lessonId);
  return { lesson: { ...view, task_solution: lesson.task?.solution || null, check_questions: lesson.check?.questions || [] }, languages: lessonLanguages(lesson), feedback: comments, reviews: history };
}

export async function reviewLesson(institutionId, staffId, lessonId, { language, status, suggestion }) {
  if (!lessonById(lessonId)) throw err(404, 'No such lesson.');
  if (!LANGS.includes(language)) throw err(400, 'Choose English, Telugu or Hindi.');
  if (!['reviewed', 'suggested'].includes(status)) throw err(400, 'Mark it Reviewed, or suggest an edit.');
  const text = String(suggestion || '').trim().slice(0, 2000);
  if (status === 'suggested' && !text) throw err(400, 'Write the edit you suggest.');
  await dal.run('INSERT INTO content_reviews (id, institution_id, lesson_id, language, status, suggestion, staff_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ulid(), institutionId, lessonId, language, status, text || null, staffId || null, dal.nowIso());
  return { ok: true };
}

/** Self-chosen topics of a student, for the college, only with the student's consent to share. */
export async function extraTopics(learnerId) {
  const share = await dal.one('SELECT share_with_institution FROM learner_profiles WHERE learner_id = ?', learnerId);
  if (!share?.share_with_institution) return { shared: false, courses: [] };
  const rows = await dal.all("SELECT course_id, added_at, last_at FROM learner_courses WHERE learner_id = ? AND source = 'self'", learnerId);
  const done = await dal.all("SELECT course_id, COUNT(*) AS n FROM lesson_progress WHERE learner_id = ? AND status IN ('done','known') GROUP BY course_id", learnerId);
  const byCourse = new Map(done.map(d => [d.course_id, Number(d.n)]));
  return {
    shared: true,
    courses: rows.map(r => {
      const c = catalog().byId.get(r.course_id);
      if (!c) return null;
      const total = c.modules.reduce((a, m) => a + m.lessons.length, 0);
      return { course_id: r.course_id, title: c.title.en, lessons_done: byCourse.get(r.course_id) || 0, lessons_total: total, last_at: r.last_at || r.added_at };
    }).filter(Boolean)
  };
}
