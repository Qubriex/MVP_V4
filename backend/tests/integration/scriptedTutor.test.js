// The scripted tutor (AI_ADAPTER=scripted): real lesson text in each
// language, "I'm ready for the check" always gives a check question, grading
// by the rubric gives pass / partial / fail with three feedback lines, and
// '#pass' / '#fail' force a result only for test-tenant learners.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as dal from '../../core/db/dal.js';
import { freshDb, makeApp, seedInstitution, seedPathway, login, PIN } from '../helpers/setup.js';
import { lessonFor, grade, questionFor, intentOf } from '../../core/ai/adapters/scripted.js';
import { withContext } from '../../core/requestContext.js';
// The learner here chose full Telugu, so the scripts reach her in that style.
const fullTelugu = (node) => withContext({ learningMode: 'telugu' }, () => lessonFor(node, 'telugu'));

const typed = { mode: 'typed', pasted_chars: 0, paste_events: 0, largest_paste: 0 };
let app; let A; let T; let real; let test;
const before = process.env.AI_ADAPTER;

beforeAll(async () => {
  process.env.AI_ADAPTER = 'scripted';
  await freshDb();
  app = await makeApp();
  A = await seedInstitution('a');
  await seedPathway(A, { theta: 0.7 });
  T = await seedInstitution('t');
  await seedPathway(T, { theta: 0.7 });
  await dal.run('UPDATE institutions SET is_test = 1 WHERE id = ?', T.institutionId);
  real = await login(app, '/api/auth/learner/login', { learner_ref: A.learnerRef, join_code: A.joinCode, pin: PIN });
  test = await login(app, '/api/auth/learner/login', { learner_ref: T.learnerRef, join_code: T.joinCode, pin: PIN });
});
afterAll(() => { process.env.AI_ADAPTER = before; });

const post = (who, path, body) => who.agent.post(path).set('X-CSRF-Token', who.csrf).send(body);

describe('lesson content', () => {
  it('has every lesson turn for all 20 seeded skills in Telugu, Hindi and English', () => {
    const skills = ['HTML semantics', 'CSS box model', 'CSS flexbox', 'Responsive design', 'Git basics', 'Variables and types', 'Functions and scope', 'Array methods', 'DOM events', 'Async and fetch',
      'React components', 'React state and props', 'Hooks', 'Forms in React', 'Calling APIs', 'Node.js basics', 'Express routes', 'REST design', 'SQL queries', 'Joins'];
    for (const s of skills) {
      for (const lang of ['telugu', 'hindi', 'english']) {
        const l = lessonFor(s, lang);
        expect(l.generic, `${s} ${lang}`).toBeUndefined();
        for (const k of ['explain', 'example', 'another_way', 'not_understood']) expect(l.turns[k].message.length).toBeGreaterThan(40);
        expect(l.turns.explain.code).toBeTruthy();
        expect(l.turns.explain.mermaid).toBeTruthy();
        expect(l.check.questions).toHaveLength(3);
        if (lang !== 'english') expect(l.turns.explain.captionEn).toBeTruthy();
      }
    }
  });

  it('understands "I don\'t understand", "another way" and "example" in all three languages', () => {
    expect(intentOf('అర్థం కాలేదు')).toBe('not_understood');
    expect(intentOf('समझ नहीं आया')).toBe('not_understood');
    expect(intentOf("I don't understand")).toBe('not_understood');
    expect(intentOf('ఇంకో విధంగా చెప్పండి')).toBe('another_way');
    expect(intentOf('उदाहरण दीजिए')).toBe('example');
  });

  it('grades by the rubric: pass, partial and fail, with feedback lines', () => {
    const good = grade({ nodeLabel: 'SQL queries', language: 'english', answer: 'SELECT name FROM bookings WHERE date is tomorrow ORDER BY name so the list is sorted.', theta: 0.7 });
    expect(good.passed).toBe(true);
    expect(good.whatWasGood).toBeTruthy();
    const some = grade({ nodeLabel: 'SQL queries', language: 'english', answer: 'I would select the passengers I need from bookings for the trip.', theta: 0.7 });
    expect(some.passed).toBe(false);
    expect(some.score).toBeGreaterThanOrEqual(0.5);
    expect(some.whatWasMissing).toMatch(/where|order by/i);
    expect(grade({ nodeLabel: 'SQL queries', language: 'english', answer: 'no idea', theta: 0.7 }).score).toBeLessThan(0.5);
    expect(questionFor({ nodeLabel: 'Joins', language: 'telugu', context: 'లైబ్రరీ పుస్తకాల రికార్డులు', variant: 1 })).toContain('లైబ్రరీ');
  });
});

describe('the loop through the API', () => {
  it('teaches with real text, offers a check on request, and a rubric pass advances the skill', async () => {
    const start = await post(real, '/api/learner/session/start', {});
    expect(start.status).toBe(200);
    expect(start.body.message).not.toMatch(/^mock/);
    // Teach first: the opening is the explanation, never a diagnostic question.
    expect(start.body.decision).toBe('TEACH');
    expect(start.body.message).toBe(fullTelugu('SQL queries').turns.explain.message);
    expect(start.body.history[0].message_type).toBe('instruction');
    const sid = start.body.session_id;
    const lesson = await post(real, '/api/learner/session/message', { content: 'I know a little', session_id: sid });
    expect(lesson.body.decision).toBe('CONTINUE');
    expect(lesson.body.code).toMatch(/SELECT/);
    expect(lesson.body.caption_en).toBeTruthy();
    const again = await post(real, '/api/learner/session/message', { content: 'అర్థం కాలేదు', session_id: sid });
    expect(again.body.message).toBe(fullTelugu('SQL queries').turns.not_understood.message);

    const ready = await post(real, '/api/learner/session/message', { request_check: true, session_id: sid });
    expect(ready.body.decision).toBe('CHECK');
    expect(ready.body.check_question).toBeTruthy();

    const fail = await post(real, '/api/learner/session/message', { content: 'I am not sure about this one at all.', session_id: sid, provenance: typed });
    expect(fail.body).toMatchObject({ passed: false, result_band: 'fail' });
    expect(fail.body.feedback_parts.next).toBeTruthy();

    const ready2 = await post(real, '/api/learner/session/message', { request_check: true, session_id: sid });
    expect(ready2.body.check_question).toBeTruthy();
    expect(ready2.body.check_question).not.toBe(ready.body.check_question);
    const pass = await post(real, '/api/learner/session/message', { content: 'SELECT name, train_no FROM bookings WHERE journey_date is tomorrow ORDER BY name gives a sorted list of passengers.', session_id: sid, provenance: typed });
    expect(pass.body).toMatchObject({ passed: true, result_band: 'pass', forced: false });
    expect(pass.body.label_change).toMatchObject({ from: 'none', to: 'Partial' });
    expect(pass.body.next_node.label).toBe('Joins');
  });

  it('coming back never replays the opening: a short welcome-back line instead', async () => {
    const first = await post(real, '/api/learner/session/start', {});
    const again = await post(real, '/api/learner/session/start', {});
    expect(again.body.session_id).toBe(first.body.session_id);
    expect(again.body.resumed).toBe(true);
    expect(again.body.message).toBeUndefined();
    expect(again.body.welcome_back.message).toMatch(new RegExp(first.body.node_label));
    expect(again.body.welcome_back.message).not.toBe(first.body.history[0].content);
  });

  it('"I\'m ready for the check" always gives a check question, even before much teaching; asking again shows the same one', async () => {
    const start = await post(real, '/api/learner/session/start', {});
    const ready = await post(real, '/api/learner/session/message', { request_check: true, session_id: start.body.session_id });
    expect(ready.body.decision).toBe('CHECK');
    expect(ready.body.check_question).toBeTruthy();
    const typed = await post(real, '/api/learner/session/message', { content: "I'm ready for the test", session_id: start.body.session_id });
    expect(typed.body.decision).toBe('CHECK');
    expect(typed.body.check_question).toBe(ready.body.check_question);
  });

  it('the tutor follows the learning language chosen in Settings, not only the cohort default', async () => {
    const set = await test.agent.put('/api/learner/learning-language').set('X-CSRF-Token', test.csrf).send({ value: 'english' });
    expect(set.body.value).toBe('english');
    const s = await post(test, '/api/learner/session/start', {});
    expect(s.body.language).toBe('english');
    await test.agent.put('/api/learner/learning-language').set('X-CSRF-Token', test.csrf).send({ value: 'telugu_en' });
    expect((await post(test, '/api/learner/session/start', {})).body.language).toBe('telugu');
    await dal.run('UPDATE learners SET learning_language = NULL WHERE id = ?', test.user?.id || (await dal.one("SELECT id FROM learners WHERE learning_language = 'telugu_en'")).id);
  });

  it('#pass is only a code word for test-tenant learners', async () => {
    const realStart = await post(real, '/api/learner/session/start', {});
    await post(real, '/api/learner/session/message', { request_check: true, session_id: realStart.body.session_id });
    const r = await post(real, '/api/learner/session/message', { content: '#pass', session_id: realStart.body.session_id, provenance: typed });
    expect(r.body.passed).toBe(false);

    const s = await post(test, '/api/learner/session/start', {});
    await post(test, '/api/learner/session/message', { request_check: true, session_id: s.body.session_id });
    const f = await post(test, '/api/learner/session/message', { content: '#fail', session_id: s.body.session_id, provenance: typed });
    expect(f.body).toMatchObject({ passed: false, forced: true });
    await post(test, '/api/learner/session/message', { request_check: true, session_id: s.body.session_id });
    const p = await post(test, '/api/learner/session/message', { content: '#pass', session_id: s.body.session_id, provenance: typed });
    expect(p.body).toMatchObject({ passed: true, forced: true });
  });
});
