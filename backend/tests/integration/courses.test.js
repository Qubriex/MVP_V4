// Topics: Course → Module → Lesson, taught first. The catalog, a lesson in
// the learner's learning language, practice results, hints, the check (only
// after practice is offered first), test-out, the module test and project,
// and the completed module on the Capability Passport.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import * as dal from '../../core/db/dal.js';
import { freshDb, makeApp, login } from '../helpers/setup.js';
import { seedTestData } from '../../scripts/testData.js';
import { lessonById, moduleById, missingParts } from '../../core/courses/catalog.js';

let app;
let me;
const before = process.env.AI_ADAPTER;
const PIN = '410585';
const post = (p, b = {}) => me.agent.post(`/api/learner${p}`).set('X-CSRF-Token', me.csrf).send(b);
const put = (p, b = {}) => me.agent.put(`/api/learner${p}`).set('X-CSRF-Token', me.csrf).send(b);
const get = (p) => me.agent.get(`/api/learner${p}`);
const allPass = (tests) => tests.map(t => ({ name: t.name, passed: true }));

beforeAll(async () => {
  process.env.AI_ADAPTER = 'scripted';
  await freshDb();
  app = await makeApp();
  await seedTestData({ log: () => {} });
  me = await login(app, '/api/auth/learner/login', { learner_ref: 'TEST-J-S3', join_code: 'QX-FSD-T01', pin: PIN });
}, 60000);
afterAll(() => { process.env.AI_ADAPTER = before; });

describe('the catalog', () => {
  it('lists Python with numbered modules and lessons in order', async () => {
    const r = await get('/courses/python');
    expect(r.status).toBe(200);
    const m3 = r.body.modules.find(m => m.n === 3);
    expect(m3.title_en).toBe('Functions');
    expect(m3.lessons.map(l => `${m3.n}.${l.n} ${l.title_en}`)).toEqual(['3.1 Defining functions', '3.2 Parameters and arguments', '3.3 Return values', '3.4 Scope and recursion']);
    expect(m3.has_test && m3.has_project).toBe(true);
  });

  it('Return values is complete in English, Telugu and Hindi', () => {
    for (const code of ['en', 'te', 'hi']) expect(missingParts(lessonById('py-m3-l3'), code)).toEqual([]);
  });

  it('is public for "See our topics", with one free sample lesson per course', async () => {
    const list = await request(app).get('/api/catalog');
    expect(list.status).toBe(200);
    const py = list.body.courses.find(c => c.id === 'python');
    const sample = await request(app).get(`/api/catalog/sample/${py.sample_lesson_id}?language=hindi`);
    expect(sample.status).toBe(200);
    expect(sample.body.content_language).toBe('hi');
    expect((await request(app).get('/api/catalog/sample/py-m3-l3')).status).toBe(404);
  });
});

describe('a lesson, taught first, in the learning language', () => {
  it('follows the learning language: English, then Hindi', async () => {
    await put('/learning-language', { value: 'english' });
    const en = await get('/lessons/py-m3-l3');
    expect(en.body.content_language).toBe('en');
    expect(en.body.parts.explain[0]).toMatch(/cricket/);
    expect(en.body.parts.code.notes.length).toBeGreaterThan(3);
    await put('/learning-language', { value: 'hindi' });
    const hi = await get('/lessons/py-m3-l3');
    expect(hi.body.content_language).toBe('hi');
    expect(hi.body.parts.explain[0]).toMatch(/[ऀ-ॿ]/);
    expect(hi.body.progress.step).toBe('learn');
    await put('/learning-language', { value: 'telugu' });
  });

  it('answers a question within the lesson, and "explain simpler" uses the lesson', async () => {
    const why = await post('/lessons/py-m3-l3/ask', { question: 'Why do we use return instead of print?' });
    expect(why.body.answer).toMatch(/return|print/);
    const simpler = await post('/lessons/py-m3-l3/ask', { question: 'Explain simpler' });
    expect(simpler.body).toMatchObject({ kind: 'simpler', source: 'lesson' });
    const inEnglish = await post('/lessons/py-m3-l3/ask', { question: 'Explain in English' });
    expect(inEnglish.body.language).toBe('english');
  });

  it('practice: hints one at a time, a failing run, then a pass that counts once', async () => {
    const h1 = await post('/lessons/py-m3-l3/hint');
    expect(h1.body).toMatchObject({ n: 1, of: 3 });
    expect((await post('/lessons/py-m3-l3/hint', { solution: true })).status).toBe(409);
    const tests = (await get('/lessons/py-m3-l3/practice/tests')).body.tests;
    expect(tests.some(t => t.hidden)).toBe(true);
    const bad = await post('/lessons/py-m3-l3/practice', { results: tests.map((t, i) => ({ name: t.name, passed: i === 0 })), code: 'print(a*b)' });
    expect(bad.body.passed).toBe(false);
    const good = await post('/lessons/py-m3-l3/practice', { results: allPass(tests), code: 'return a*b' });
    expect(good.body).toMatchObject({ passed: true, practice_passed: true });
    expect((await dal.one("SELECT COUNT(*) AS n FROM course_evidence WHERE lesson_id = 'py-m3-l3' AND kind = 'practice'")).n).toBe(1);
  });

  it('the check: a fresh question, rule grading with feedback, the label and module progress', async () => {
    const q1 = await post('/lessons/py-m3-l3/check');
    expect(q1.body.question).toBeTruthy();
    const fail = await post('/lessons/py-m3-l3/check/answer', { answer: 'not sure', provenance: { mode: 'typed' } });
    expect(fail.body).toMatchObject({ passed: false });
    expect(fail.body.feedback_parts.missing).toBeTruthy();
    const q2 = await post('/lessons/py-m3-l3/check');
    expect(q2.body.question).not.toBe(q1.body.question);
    const pass = await post('/lessons/py-m3-l3/check/answer', { answer: 'We use return so the value goes back to the caller and can be stored in a variable; print only shows it and the function gives None.', provenance: { mode: 'typed' } });
    expect(pass.body).toMatchObject({ passed: true, result_band: 'pass' });
    expect(pass.body.label_change.to).not.toBe('none');
    expect(pass.body.next_lesson.id).toBe('py-m3-l4');
    expect(pass.body.module_progress.lessons_done).toBe(1);
  });

  it('"I already know this": passing marks the lesson Known; not passing keeps it open', async () => {
    const qs = await get('/lessons/py-m3-l1/testout');
    expect(qs.body.questions).toHaveLength(2);
    const no = await post('/lessons/py-m3-l1/testout', { answers: ['no idea', 'no idea'] });
    expect(no.body.known).toBe(false);
    const yes = await post('/lessons/py-m3-l1/testout', { answers: ['#pass', '#pass'] });
    expect(yes.body.known).toBe(true);
    expect((await get('/courses/python')).body.progress.lessons['py-m3-l1'].status).toBe('known');
  });

  it('the module test and project complete Module 3 and put Functions on the Passport', async () => {
    const t = (await get('/modules/py-m3/test')).body;
    const answers = moduleById('py-m3').test.questions.map(q => q.answer);
    expect(t.questions).toHaveLength(answers.length);
    const test = await post('/modules/py-m3/test', { answers });
    expect(test.body).toMatchObject({ passed: true });
    const proj = (await get('/modules/py-m3/project')).body;
    const done = await post('/modules/py-m3/project', { results: allPass(proj.runner_tests) });
    expect(done.body.module).toMatchObject({ test_passed: true, project_passed: true, completed: true });
    const passport = (await get('/passport')).body;
    expect(passport.skills.some(s => s.skill_id === 'course:py-m3' && s.course === 'python')).toBe(true);
  });
});
