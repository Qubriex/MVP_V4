// core/courses/catalog.js — the topic catalog: Course → Module → Lesson, in a
// fixed order (Module 3 · Lesson 2). Lesson plans are data, in
// data/courses/<course>/: course.json (title, summary, level, hours, status,
// module files) and one file per module with its lessons, module test and
// project. Text fields are { en, te, hi }; code, tests and pictures are shared.
//
// Every lesson has the same ten parts (the clear-teaching standard):
//   oneLine, useCase, explain (+ simpler, anotherExample), picture, code (with
//   line notes and output), mistakes, listen (spoken from explain + code notes),
//   quick (3 questions), task (practice with tests, hints, solution), cheat.
// Plus the check: fresh questions with keyword groups and a spoken challenge.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { currentLearningMode } from '../requestContext.js';
import { nativeDeep, namesIn } from '../language/style.js';

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data/courses');
export const LANG_CODE = { telugu: 'te', hindi: 'hi', english: 'en' };
export const LEARNING_LANGUAGES = ['telugu', 'hindi', 'english', 'telugu_en', 'hindi_en'];
export const LESSON_PARTS = ['oneLine', 'useCase', 'explain', 'picture', 'code', 'mistakes', 'listen', 'quick', 'task', 'cheat'];

let cache = null;

/** Every course, in catalog order. Read once per process. */
export function catalog() {
  if (cache) return cache;
  const courses = [];
  if (fs.existsSync(DIR)) {
    for (const dir of fs.readdirSync(DIR).sort()) {
      const file = path.join(DIR, dir, 'course.json');
      if (!fs.existsSync(file)) continue;
      const c = JSON.parse(fs.readFileSync(file, 'utf8'));
      c.modules = (c.modules || [])
        .filter((m) => typeof m !== 'string' || fs.existsSync(path.join(DIR, dir, m)))
        .map((m) => (typeof m === 'string' ? JSON.parse(fs.readFileSync(path.join(DIR, dir, m), 'utf8')) : m));
      c.modules.forEach((m) => {
        m.course_id = c.id;
        (m.lessons || []).forEach((l) => { l.module_id = m.id; l.course_id = c.id; l.module_n = m.n; });
      });
      courses.push(c);
    }
  }
  courses.sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  const lessons = new Map();
  const modules = new Map();
  courses.forEach((c) => c.modules.forEach((m) => { modules.set(m.id, m); m.lessons.forEach((l) => lessons.set(l.id, l)); }));
  cache = { courses, byId: new Map(courses.map((c) => [c.id, c])), modules, lessons };
  return cache;
}
export const _resetCatalog = () => { cache = null; };

// A learner who chose full Telugu / Hindi (not the mix) gets every lesson,
// module and course text in the full language (core/language/style.js); the
// mix, staff and public pages get the text as written. Cached per mode.
const styledCache = { te: new WeakMap(), hi: new WeakMap() };
function codeNames(o, out = []) {
  if (o && typeof o === 'object') {
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === 'string' && ['source', 'starter', 'solution', 'setup', 'wrong'].includes(k)) out.push(v);
      else codeNames(v, out);
    }
  }
  return out;
}
function styled(item) {
  if (!item) return null;
  const mode = currentLearningMode();
  if (mode !== 'telugu' && mode !== 'hindi') return item;
  const code = mode === 'telugu' ? 'te' : 'hi';
  const cache = styledCache[code];
  if (!cache.has(item)) cache.set(item, nativeDeep(item, code, namesIn(...codeNames(item))));
  return cache.get(item);
}
export const courseById = (id) => styled(catalog().byId.get(id));
export const moduleById = (id) => styled(catalog().modules.get(id));
export const lessonById = (id) => styled(catalog().lessons.get(id));

/** The base language and caption language for a learning-language choice. */
export function languagePair(learning) {
  if (learning === 'telugu_en') return { main: 'te', caption: 'en' };
  if (learning === 'hindi_en') return { main: 'hi', caption: 'en' };
  return { main: LANG_CODE[learning] || 'te', caption: learning === 'english' ? null : 'en' };
}

// One text in the main language; null when that language is not written yet.
const pickText = (v, code) => {
  if (v == null) return null;
  if (typeof v === 'string' || Array.isArray(v) || typeof v !== 'object') return v;
  return v[code] ?? null;
};

/** Which languages a lesson is complete in (every text part present). */
export function lessonLanguages(lesson) {
  return ['en', 'te', 'hi'].filter((code) => missingParts(lesson, code).length === 0);
}

/** The parts of a lesson missing in one language (for topics:check and the page notice). */
export function missingParts(lesson, code) {
  const miss = [];
  const has = (v) => {
    const x = pickText(v, code);
    return Array.isArray(x) ? x.length > 0 && x.every(Boolean) : !!x;
  };
  if (!has(lesson.title)) miss.push('title');
  if (!has(lesson.oneLine)) miss.push('oneLine');
  if (!has(lesson.useCase)) miss.push('useCase');
  if (!has(lesson.explain)) miss.push('explain');
  if (!has(lesson.simpler)) miss.push('simpler');
  if (!has(lesson.anotherExample)) miss.push('anotherExample');
  if (!lesson.picture) miss.push('picture');
  if (!lesson.code?.source || !(lesson.code.notes || []).length || (lesson.code.notes || []).some((n) => !has(n.note))) miss.push('code');
  if ((lesson.mistakes || []).length < 2 || lesson.mistakes.some((m) => !has(m.fix))) miss.push('mistakes');
  if ((lesson.quick || []).length < 3 || lesson.quick.some((q) => !has(q.q) || !has(q.why))) miss.push('quick');
  const task = lesson.task || {};
  if (!has(task.prompt) || !(task.tests || []).length || (task.hints || []).length < 3 || task.hints.some((h) => !has(h)) || !task.solution) miss.push('task');
  if (!has(lesson.cheat)) miss.push('cheat');
  const chk = lesson.check || {};
  if ((chk.questions || []).length < 2 || chk.questions.some((q) => !has(q)) || !(chk.keywords || []).length || !has(chk.challenge)) miss.push('check');
  return miss;
}

/**
 * A lesson in the learner's learning language: every part, plus English
 * captions where the main language is Telugu or Hindi. `available` lists the
 * languages it is complete in; when the learner's language is not one of
 * them the page says so instead of showing another language silently.
 */
export function lessonView(lesson, learning = 'telugu') {
  const { main, caption } = languagePair(learning);
  const ready = lessonLanguages(lesson);
  const code = ready.includes(main) ? main : null;
  const p = (v) => (code ? pickText(v, code) : null);
  const cap = (v) => (caption && code ? pickText(v, caption) : null);
  const course = courseById(lesson.course_id);
  const mod = moduleById(lesson.module_id);
  const spoken = code ? [...(p(lesson.explain) || []), ...(lesson.code?.notes || []).map((n) => p(n.note))].filter(Boolean).join(' ') : '';
  return {
    id: lesson.id, n: lesson.n, module_n: lesson.module_n, minutes: lesson.minutes || 20,
    course: { id: course.id, title: pickText(course.title, code || 'en'), language: course.language },
    module: { id: mod.id, n: mod.n, title: pickText(mod.title, code || 'en') },
    title: pickText(lesson.title, code || 'en'), title_en: pickText(lesson.title, 'en'),
    language: learning, content_language: code, available: ready, caption_language: caption,
    parts: code ? {
      oneLine: p(lesson.oneLine), oneLine_en: cap(lesson.oneLine),
      useCase: p(lesson.useCase), useCase_en: cap(lesson.useCase),
      explain: p(lesson.explain), explain_en: cap(lesson.explain),
      simpler: p(lesson.simpler), anotherExample: p(lesson.anotherExample),
      picture: lesson.picture,
      code: { language: course.language, source: lesson.code.source, output: lesson.code.output || '', setup: lesson.code.setup || '',
        notes: lesson.code.notes.map((n) => ({ line: n.line, note: p(n.note), note_en: cap(n.note) })) },
      mistakes: lesson.mistakes.map((m) => ({ wrong: m.wrong, fix: p(m.fix), fix_en: cap(m.fix) })),
      listen: spoken,
      quick: lesson.quick.map((q, i) => ({ i, q: p(q.q), options: q.options.map((o) => pickText(o, code)), answer: q.answer, why: p(q.why) })),
      task: { prompt: p(lesson.task.prompt), prompt_en: cap(lesson.task.prompt), starter: lesson.task.starter || '', setup: lesson.task.setup || '',
        tests: (lesson.task.tests || []).filter((t) => !t.hidden).map((t) => ({ ...t })), hidden_tests: (lesson.task.tests || []).filter((t) => t.hidden).length,
        hint_count: lesson.task.hints.length },
      cheat: p(lesson.cheat), cheat_en: cap(lesson.cheat)
    } : null
  };
}

/** The tests a practice run must pass, hidden ones included (sent to the runner, never shown). */
export const practiceTests = (lesson) => lesson.task?.tests || [];

/** Course outline for the course page, in the learner's language. */
export function courseOutline(course, learning = 'telugu') {
  const { main } = languagePair(learning);
  const t = (v) => pickText(v, main) || pickText(v, 'en');
  return {
    id: course.id, title: t(course.title), title_en: pickText(course.title, 'en'), summary: t(course.summary), level: course.level, hours: course.hours,
    language: course.language, status: course.status, icon: course.icon || null,
    modules: course.modules.map((m) => ({
      id: m.id, n: m.n, title: t(m.title), title_en: pickText(m.title, 'en'), summary: t(m.summary), skill: m.skill,
      lessons: m.lessons.map((l) => ({ id: l.id, n: l.n, title: t(l.title), title_en: pickText(l.title, 'en'), minutes: l.minutes || 20, languages: lessonLanguages(l) })),
      has_test: !!(m.test?.questions || []).length, has_project: !!m.project
    }))
  };
}
