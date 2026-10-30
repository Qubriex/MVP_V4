// core/courses/learning.js — a learner's courses: My topics, lesson progress
// through Learn → See the code → Practise → Check, and the evidence each step
// leaves (course_evidence). Labels are computed with the same published label
// function as the Passport (qep:label_v2), from these dated facts:
//   check / test-out → a check pass (the first one is the mastery pass)
//   practice         → code that passed its tests in the browser runner (L2)
//   challenge        → the spoken challenge on the learner's own answer (A2)
//   module test      → a check; module project → practical work (L2)
// Passing a module's test and project adds that skill group to the Capability
// Passport (core/return/credentialEngine.js courseSkillFacts).
import crypto from 'crypto';
import * as dal from '../db/dal.js';
import { ulid } from '../db/ulid.js';
import params from '../../config/params.js';
import { labelV1, missingForConfirmed } from '../qep/labelFn.js';
import { catalog, courseById, moduleById, lessonById, languagePair, LEARNING_LANGUAGES } from './catalog.js';
import { nowIsoFor, isTestLearner } from '../requestContext.js';

const err = (status, message) => Object.assign(new Error(message), { status });
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const THETA = 0.7;
const DEMO_KIND = { check: 'mastery', testout: 'mastery', practice: 'practice', challenge: 'challenge', module_test: 'review', project: 'practical', review: 'review' };

/** The learner's learning language: their own choice, else the cohort's. */
export async function learningLanguage(learnerId) {
  const l = await dal.one('SELECT learning_language, language FROM learners WHERE id = ?', learnerId);
  return LEARNING_LANGUAGES.includes(l?.learning_language) ? l.learning_language : (l?.language || 'telugu');
}

export async function setLearningLanguage(learnerId, value) {
  if (!LEARNING_LANGUAGES.includes(value)) throw err(400, 'Choose Telugu, Hindi, English, or a mix with English.');
  await dal.run('UPDATE learners SET learning_language = ?, updated_at = ? WHERE id = ?', value, dal.nowIso(), learnerId);
  return value;
}

// ─── My topics ─────────────────────────────────────────────────────────────────
export async function addCourse(learnerId, courseId, source = 'self') {
  if (!courseById(courseId)) throw err(404, 'No such course.');
  await dal.run('INSERT INTO learner_courses (learner_id, course_id, source, added_at) VALUES (?, ?, ?, ?) ON CONFLICT (learner_id, course_id) DO NOTHING', learnerId, courseId, source, dal.nowIso());
}
export async function removeCourse(learnerId, courseId) {
  await dal.run("DELETE FROM learner_courses WHERE learner_id = ? AND course_id = ? AND source = 'self'", learnerId, courseId);
}

async function evidenceFor(learnerId, where = '', ...args) {
  return dal.all(`SELECT * FROM course_evidence WHERE learner_id = ? ${where} ORDER BY created_at`, learnerId, ...args);
}

/** Dated demonstrations for one lesson, in the label function's terms. */
export async function lessonDemos(learnerId, lessonId) {
  const lesson = lessonById(lessonId);
  const rows = await dal.all(`SELECT kind, passed, score, level, assurance, created_at FROM course_evidence
    WHERE learner_id = ? AND (lesson_id = ? OR (lesson_id IS NULL AND module_id = ? AND kind IN ('module_test', 'project'))) ORDER BY created_at`, learnerId, lessonId, lesson?.module_id || '');
  return rows.map(r => ({ date: r.created_at, kind: DEMO_KIND[r.kind] || 'review', passed: !!r.passed, score: r.score, level: r.level, assurance: r.assurance }));
}

/** Label facts for one lesson (same shape as programme nodes), or null before its first pass. */
export async function lessonFacts(learnerId, lessonId) {
  const first = await dal.one("SELECT created_at, assurance FROM course_evidence WHERE learner_id = ? AND lesson_id = ? AND kind IN ('check', 'testout') AND passed = 1 ORDER BY created_at LIMIT 1", learnerId, lessonId);
  if (!first) return null;
  const lesson = lessonById(lessonId);
  return { nodeId: lessonId, label: lesson.title.en, theta: THETA, A_at_mastery: first.assurance, E: 'L1', persistence: false, masteredAt: first.created_at, codeNode: true, course: true };
}

const labelParams = () => ({ confirmed: params.get('label.confirmed'), foundational: params.get('label.foundational'), retention: params.get('retention') });

/** A lesson's label now: none, Foundational, Partial or Confirmed, and what Confirmed still needs. */
export async function lessonLabel(learnerId, lessonId, asOf = nowIsoFor()) {
  const f = await lessonFacts(learnerId, lessonId);
  if (!f) return { label: 'none', missing_for_confirmed: ['mastery'] };
  const demos = await lessonDemos(learnerId, lessonId);
  const r = labelV1(f, demos, asOf, labelParams());
  return { label: r.label, freshness: r.freshness, missing_for_confirmed: missingForConfirmed(f, demos, asOf, labelParams()) };
}

async function progressRows(learnerId, courseId) {
  return new Map((await dal.all('SELECT * FROM lesson_progress WHERE learner_id = ? AND course_id = ?', learnerId, courseId)).map(r => [r.lesson_id, r]));
}

/** Status of each lesson for the course page: not_started, in_progress, known, done, confirmed. */
export async function courseProgress(learnerId, courseId) {
  const course = courseById(courseId);
  const rows = await progressRows(learnerId, courseId);
  const results = new Map((await dal.all('SELECT * FROM module_results WHERE learner_id = ? AND course_id = ?', learnerId, courseId)).map(r => [r.module_id, r]));
  const lessons = {};
  let done = 0; let total = 0; let next = null;
  for (const m of course.modules) {
    for (const l of m.lessons) {
      total += 1;
      const p = rows.get(l.id);
      let status = p ? p.status : 'not_started';
      if (status === 'done' || status === 'known') {
        done += 1;
        if ((await lessonLabel(learnerId, l.id)).label === 'Confirmed') status = 'confirmed';
      } else if (!next) next = l.id;
      lessons[l.id] = { status, step: p?.step || null };
    }
  }
  const modules = Object.fromEntries(course.modules.map(m => {
    const r = results.get(m.id);
    const lessonsDone = m.lessons.filter(l => ['done', 'known', 'confirmed'].includes(lessons[l.id].status)).length;
    return [m.id, { lessons_done: lessonsDone, lessons_total: m.lessons.length, test_passed: !!r?.test_passed, project_passed: !!r?.project_passed, completed: !!r?.completed_at }];
  }));
  const mine = await dal.one('SELECT source, added_at, last_lesson_id FROM learner_courses WHERE learner_id = ? AND course_id = ?', learnerId, courseId);
  return { added: !!mine, source: mine?.source || null, last_lesson_id: mine?.last_lesson_id || null, lessons, modules, done, total, pct: total ? Math.round((done / total) * 100) : 0, next_lesson_id: next };
}

/** My topics: each added course with progress and the next lesson. */
export async function myCourses(learnerId) {
  const rows = await dal.all('SELECT course_id, source, added_at, last_lesson_id, last_at FROM learner_courses WHERE learner_id = ? ORDER BY COALESCE(last_at, added_at) DESC', learnerId);
  const out = [];
  for (const r of rows) {
    if (!courseById(r.course_id)) continue;
    const p = await courseProgress(learnerId, r.course_id);
    out.push({ course_id: r.course_id, source: r.source, added_at: r.added_at, last_lesson_id: r.last_lesson_id, last_at: r.last_at, done: p.done, total: p.total, pct: p.pct, next_lesson_id: r.last_lesson_id && p.lessons[r.last_lesson_id]?.status === 'in_progress' ? r.last_lesson_id : p.next_lesson_id });
  }
  return out;
}

async function touch(learnerId, lesson, set = {}) {
  const now = dal.nowIso();
  await dal.run(`INSERT INTO lesson_progress (learner_id, lesson_id, course_id, status, step, started_at, updated_at) VALUES (?, ?, ?, 'in_progress', 'learn', ?, ?)
    ON CONFLICT (learner_id, lesson_id) DO NOTHING`, learnerId, lesson.id, lesson.course_id, now, now);
  const cols = Object.keys(set);
  if (cols.length) await dal.run(`UPDATE lesson_progress SET ${cols.map(c => `${c} = ?`).join(', ')}, updated_at = ? WHERE learner_id = ? AND lesson_id = ?`, ...cols.map(c => set[c]), now, learnerId, lesson.id);
  await addCourse(learnerId, lesson.course_id).catch(() => {});
  await dal.run('UPDATE learner_courses SET last_lesson_id = ?, last_at = ? WHERE learner_id = ? AND course_id = ?', lesson.id, now, learnerId, lesson.course_id);
  return dal.one('SELECT * FROM lesson_progress WHERE learner_id = ? AND lesson_id = ?', learnerId, lesson.id);
}

const STEPS = ['learn', 'code', 'practise', 'check', 'result'];
export async function openLesson(learnerId, lessonId) {
  const lesson = lessonById(lessonId);
  if (!lesson) throw err(404, 'No such lesson.');
  return touch(learnerId, lesson);
}
export async function setStep(learnerId, lessonId, step) {
  const lesson = lessonById(lessonId);
  if (!lesson || !STEPS.includes(step)) throw err(400, 'Unknown step.');
  const cur = await touch(learnerId, lesson);
  // Steps only move forward, so coming back keeps the furthest point reached.
  if (STEPS.indexOf(step) > STEPS.indexOf(cur.step)) await touch(learnerId, lesson, { step });
  return dal.one('SELECT * FROM lesson_progress WHERE learner_id = ? AND lesson_id = ?', learnerId, lessonId);
}

async function record(learnerId, { lesson = null, module = null, kind, passed, score = null, level = 'L1', assurance = 'A1', answer = null, detail = null }) {
  const mod = module || moduleById(lesson.module_id);
  await dal.run(`INSERT INTO course_evidence (id, learner_id, course_id, module_id, lesson_id, kind, passed, score, level, assurance, answer_hash, detail_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, ulid(), learnerId, mod.course_id, mod.id, lesson?.id || null, kind, passed ? 1 : 0, score, level, assurance,
  answer ? sha(answer) : null, detail ? JSON.stringify(detail) : null, nowIsoFor());
}

// ─── Practise: code checked against tests in the browser runner ────────────────
/**
 * The page runs the code against every test (hidden ones too) in a Web
 * Worker and reports the results. A first all-pass is practice evidence (L2).
 */
export async function recordPractice(learnerId, lessonId, { results = [], hintsUsed = 0, code = '' }) {
  const lesson = lessonById(lessonId);
  if (!lesson?.task) throw err(404, 'No such practice.');
  const expected = lesson.task.tests.length;
  const passedAll = Array.isArray(results) && results.length === expected && results.every(r => r && r.passed === true);
  const cur = await touch(learnerId, lesson);
  await touch(learnerId, lesson, { practice_tries: (cur.practice_tries || 0) + 1, hints_used: Math.max(cur.hints_used || 0, Number(hintsUsed) || 0) });
  if (passedAll && !cur.practice_passed) {
    await touch(learnerId, lesson, { practice_passed: 1 });
    await record(learnerId, { lesson, kind: 'practice', passed: true, score: 1, level: 'L2', answer: code, detail: { tests: expected, hints: Number(hintsUsed) || 0 } });
    await setStep(learnerId, lessonId, 'check');
  }
  const after = await dal.one('SELECT practice_tries, practice_passed FROM lesson_progress WHERE learner_id = ? AND lesson_id = ?', learnerId, lessonId);
  return { passed: passedAll, tries: after.practice_tries, practice_passed: !!after.practice_passed, solution_available: !!after.practice_passed || after.practice_tries >= 3 };
}

/** The next hint, one at a time; the solution only after three tries, or when asked for. */
export async function nextHint(learnerId, lessonId, { language, solution = false }) {
  const lesson = lessonById(lessonId);
  if (!lesson?.task) throw err(404, 'No such practice.');
  const cur = await touch(learnerId, lesson);
  const { main } = languagePair(language);
  if (solution) {
    if ((cur.practice_tries || 0) < 3 && !cur.practice_passed && !(cur.hints_used >= lesson.task.hints.length)) {
      throw err(409, 'Try a few times first. The solution opens after three tries, or after all the hints.');
    }
    return { solution: lesson.task.solution };
  }
  const n = Math.min((cur.hints_used || 0) + 1, lesson.task.hints.length);
  await touch(learnerId, lesson, { hints_used: n });
  return { hint: lesson.task.hints[n - 1][main] || lesson.task.hints[n - 1].en, n, of: lesson.task.hints.length };
}

// ─── The check, the spoken challenge and test-out ───────────────────────────────
const FEEDBACK = {
  en: { good: 'You used: {list}.', missing: 'Add this next time: {list}.', next: 'Read the cheat sheet once, then try again.', nextPass: 'Well done. Take the spoken challenge to make this stronger.' },
  te: { good: 'మీరు వాడినవి: {list}.', missing: 'తర్వాతిసారి ఇది కూడా చెప్పండి: {list}.', next: 'Cheat sheet ఒకసారి చదివి, మళ్లీ ప్రయత్నించండి.', nextPass: 'చాలా బాగుంది. దీన్ని ఇంకా బలంగా చేయడానికి మౌఖిక challenge తీసుకోండి.' },
  hi: { good: 'आपने इस्तेमाल किया: {list}।', missing: 'अगली बार यह भी बताइए: {list}।', next: 'Cheat sheet एक बार पढ़िए, फिर से कोशिश कीजिए।', nextPass: 'बहुत बढ़िया। इसे और मज़बूत करने के लिए मौखिक challenge लीजिए।' }
};

/** Rule grading: keyword groups matched and answer length. Same rules for every language. */
export function gradeAnswer(lesson, answer) {
  const text = String(answer || '').toLowerCase();
  const groups = lesson.check.keywords || [];
  const hit = groups.map(alts => alts.some(a => text.includes(String(a).toLowerCase())));
  const matched = hit.filter(Boolean).length;
  const words = text.split(/\s+/).filter(Boolean).length;
  const score = groups.length ? Math.min(1, 0.25 + 0.75 * (matched / groups.length)) * (words >= 6 ? 1 : 0.6) : 0;
  const passed = matched >= Math.ceil(groups.length * 0.6) && words >= 6;
  return { passed, score: Math.round(score * 100) / 100, matched: groups.filter((g, i) => hit[i]).map(g => g[0]), missing: groups.filter((g, i) => !hit[i]).map(g => g[0]) };
}

function feedbackParts(g, code) {
  const f = FEEDBACK[code] || FEEDBACK.en;
  return {
    good: g.matched.length ? f.good.replace('{list}', g.matched.join(', ')) : '',
    missing: g.missing.length ? f.missing.replace('{list}', g.missing.join(', ')) : '',
    next: g.passed ? f.nextPass : f.next
  };
}

async function forced(learnerId, answer) {
  if (!isTestLearner()) return null;
  const m = /^#(pass|fail)\b/i.exec(String(answer || '').trim());
  return m ? m[1].toLowerCase() : null;
}

/** A fresh check question: a different one from the learner's last attempt. */
export async function startCheck(learnerId, lessonId, language) {
  const lesson = lessonById(lessonId);
  if (!lesson?.check) throw err(404, 'No such lesson.');
  const tries = Number((await dal.one("SELECT COUNT(*) AS n FROM course_evidence WHERE learner_id = ? AND lesson_id = ? AND kind = 'check'", learnerId, lessonId)).n);
  const { main } = languagePair(language);
  const q = lesson.check.questions[tries % lesson.check.questions.length];
  const question = q[main] || q.en;
  const p = await setStep(learnerId, lessonId, 'check');
  await touch(learnerId, lesson, { check_question: question });
  return { question, attempt: tries + 1, early: !p.practice_passed };
}

function nextLessonAfter(lesson) {
  const course = courseById(lesson.course_id);
  const all = course.modules.flatMap(m => m.lessons);
  const i = all.findIndex(l => l.id === lesson.id);
  return all[i + 1] || null;
}

export async function answerCheck(learnerId, lessonId, { answer, provenance, language }) {
  const lesson = lessonById(lessonId);
  const cur = await dal.one('SELECT * FROM lesson_progress WHERE learner_id = ? AND lesson_id = ?', learnerId, lessonId);
  if (!lesson || !cur?.check_question) throw err(409, 'Start the check first.');
  const before = await lessonLabel(learnerId, lessonId);
  const f = await forced(learnerId, answer);
  const g = f ? { passed: f === 'pass', score: f === 'pass' ? 0.9 : 0.3, matched: [], missing: [] } : gradeAnswer(lesson, answer);
  const assurance = provenance?.mode === 'voice' ? 'A1' : (Number(provenance?.pasted_chars) > 40 ? 'A0' : 'A1');
  if (assurance === 'A0') return { result: 'hold', message: 'Please answer in your own words: pasted text is not counted.' };
  await record(learnerId, { lesson, kind: 'check', passed: g.passed, score: g.score, answer, detail: { matched: g.matched, missing: g.missing } });
  if (g.passed) await touch(learnerId, lesson, { status: 'done', step: 'result', check_question: null });
  else await touch(learnerId, lesson, { check_question: null });
  const after = await lessonLabel(learnerId, lessonId);
  const { main } = languagePair(language);
  const next = g.passed ? nextLessonAfter(lesson) : null;
  return {
    passed: g.passed, result_band: g.passed ? 'pass' : g.score >= 0.5 ? 'partial' : 'fail', forced: !!f,
    feedback_parts: f ? { good: '', missing: '', next: '' } : feedbackParts(g, main),
    label_change: { from: before.label, to: after.label, missing_for_confirmed: after.missing_for_confirmed },
    next_lesson: next ? { id: next.id, title: next.title[main] || next.title.en, module_n: next.module_n, n: next.n } : null,
    module_progress: (await courseProgress(learnerId, lesson.course_id)).modules[lesson.module_id]
  };
}

/** The spoken challenge: explain it aloud after a pass. Bound to the learner's own words (A2). */
export async function answerChallenge(learnerId, lessonId, { answer, mode, language }) {
  const lesson = lessonById(lessonId);
  if (!lesson) throw err(404, 'No such lesson.');
  const passedCheck = await dal.one("SELECT 1 FROM course_evidence WHERE learner_id = ? AND lesson_id = ? AND kind IN ('check', 'testout') AND passed = 1", learnerId, lessonId);
  if (!passedCheck) throw err(409, 'Pass the check first; the spoken challenge comes after it.');
  const f = await forced(learnerId, answer);
  const g = f ? { passed: f === 'pass', score: f === 'pass' ? 0.9 : 0.3, matched: [], missing: [] } : gradeAnswer(lesson, answer);
  await record(learnerId, { lesson, kind: 'challenge', passed: g.passed, score: g.score, assurance: mode === 'voice' || f ? 'A2' : 'A1', answer });
  const { main } = languagePair(language);
  return { passed: g.passed, feedback_parts: feedbackParts(g, main), label: (await lessonLabel(learnerId, lessonId)).label };
}

/** "I already know this": both check questions, answered well, mark the lesson Known. */
export async function testOut(learnerId, lessonId, { answers = [], language }) {
  const lesson = lessonById(lessonId);
  if (!lesson) throw err(404, 'No such lesson.');
  const graded = await Promise.all(lesson.check.questions.map(async (q, i) => {
    const f = await forced(learnerId, answers[i]);
    return f ? { passed: f === 'pass', score: f === 'pass' ? 0.9 : 0.3, matched: [], missing: [] } : gradeAnswer(lesson, answers[i]);
  }));
  const passed = graded.every(g => g.passed);
  const score = graded.reduce((a, g) => a + g.score, 0) / graded.length;
  await record(learnerId, { lesson, kind: 'testout', passed, score, answer: answers.join('\n') });
  if (passed) await touch(learnerId, lesson, { status: 'known', step: 'result' });
  else await touch(learnerId, lesson, {});
  const { main } = languagePair(language);
  return { passed, known: passed, feedback_parts: feedbackParts(graded.find(g => !g.passed) || graded[0], main), next_lesson: passed ? nextLessonAfter(lesson)?.id || null : lesson.id };
}

/** The questions for test-out, in the learner's language. */
export function testOutQuestions(lessonId, language) {
  const lesson = lessonById(lessonId);
  if (!lesson) throw err(404, 'No such lesson.');
  const { main } = languagePair(language);
  return lesson.check.questions.map(q => q[main] || q.en);
}

// ─── Module test and project ────────────────────────────────────────────────────
async function moduleResult(learnerId, mod, set) {
  const now = dal.nowIso();
  await dal.run('INSERT INTO module_results (learner_id, module_id, course_id, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT (learner_id, module_id) DO NOTHING', learnerId, mod.id, mod.course_id, now);
  const cols = Object.keys(set);
  if (cols.length) await dal.run(`UPDATE module_results SET ${cols.map(c => `${c} = ?`).join(', ')}, updated_at = ? WHERE learner_id = ? AND module_id = ?`, ...cols.map(c => set[c]), now, learnerId, mod.id);
  const r = await dal.one('SELECT * FROM module_results WHERE learner_id = ? AND module_id = ?', learnerId, mod.id);
  let completedNow = false;
  if (r.test_passed && r.project_passed && !r.completed_at) {
    await dal.run('UPDATE module_results SET completed_at = ? WHERE learner_id = ? AND module_id = ?', nowIsoFor(), learnerId, mod.id);
    completedNow = true;
  }
  return { ...(await dal.one('SELECT * FROM module_results WHERE learner_id = ? AND module_id = ?', learnerId, mod.id)), completed_now: completedNow };
}

export function moduleTest(moduleId, language) {
  const mod = moduleById(moduleId);
  if (!mod?.test) throw err(404, 'No module test.');
  const { main } = languagePair(language);
  const t = (v) => (v && typeof v === 'object' ? v[main] || v.en : v);
  return { pass: mod.test.pass, questions: mod.test.questions.map((q, i) => ({ i, q: t(q.q), options: q.options.map(t) })) };
}

export async function answerModuleTest(learnerId, moduleId, { answers = [], language }) {
  const mod = moduleById(moduleId);
  if (!mod?.test) throw err(404, 'No module test.');
  const right = mod.test.questions.map((q, i) => Number(answers[i]) === q.answer);
  const score = right.filter(Boolean).length;
  const passed = score >= mod.test.pass;
  await record(learnerId, { module: mod, kind: 'module_test', passed, score: score / right.length });
  const r = await moduleResult(learnerId, mod, passed ? { test_passed: 1, test_score: score / right.length } : {});
  const { main } = languagePair(language);
  const t = (v) => (v && typeof v === 'object' ? v[main] || v.en : v);
  return { passed, score, of: right.length, needed: mod.test.pass, review: mod.test.questions.map((q, i) => ({ i, right: right[i], why: t(q.why) })), module: moduleState(r) };
}

export function moduleProject(moduleId, language) {
  const mod = moduleById(moduleId);
  if (!mod?.project) throw err(404, 'No module project.');
  const { main } = languagePair(language);
  const t = (v) => (v && typeof v === 'object' ? v[main] || v.en : v);
  const p = mod.project;
  return { title: t(p.title), prompt: t(p.prompt), starter: p.starter || '', setup: p.setup || '', language: courseById(mod.course_id).language,
    tests: p.tests.filter(x => !x.hidden), hidden_tests: p.tests.filter(x => x.hidden).length, all_tests: p.tests, hints: (p.hints || []).map(t), expected_output: p.output || '' };
}

export async function submitProject(learnerId, moduleId, { results = [], code = '' }) {
  const mod = moduleById(moduleId);
  if (!mod?.project) throw err(404, 'No module project.');
  const passed = Array.isArray(results) && results.length === mod.project.tests.length && results.every(r => r && r.passed === true);
  await record(learnerId, { module: mod, kind: 'project', passed, score: passed ? 1 : 0, level: 'L2', answer: code });
  const r = await moduleResult(learnerId, mod, passed ? { project_passed: 1 } : {});
  return { passed, module: moduleState(r) };
}

const moduleState = (r) => ({ test_passed: !!r.test_passed, project_passed: !!r.project_passed, completed: !!r.completed_at, completed_now: !!r.completed_now });

/** Skill groups (modules) completed: these go on the Capability Passport. */
export async function completedModules(learnerId) {
  return (await dal.all('SELECT module_id, course_id, completed_at FROM module_results WHERE learner_id = ? AND completed_at IS NOT NULL ORDER BY completed_at', learnerId))
    .filter(r => moduleById(r.module_id));
}

/** Passport facts for completed modules: one skill per module, one node per lesson passed. */
export async function courseSkillFacts(learnerId) {
  const out = [];
  for (const r of await completedModules(learnerId)) {
    const mod = moduleById(r.module_id);
    const course = courseById(r.course_id);
    const nodes = [];
    for (const l of mod.lessons) {
      const f = await lessonFacts(learnerId, l.id);
      if (f) nodes.push(f);
    }
    if (nodes.length) out.push({ skillId: `course:${mod.id}`, name: `${course.title.en}: ${mod.title.en}`, course: course.id, nodes });
  }
  return out;
}

export const allCourses = () => catalog().courses;
