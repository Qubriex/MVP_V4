// The learning language reaches every content endpoint: Ask Qubirex answers
// in it (whatever language the question is typed in, even Telugu in English
// letters), the Ask box can override it, and an open review question switches
// language in place — same instance, no new attempt.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as dal from '../../core/db/dal.js';
import { freshDb, makeApp, login } from '../helpers/setup.js';
import { seedTestData } from '../../scripts/testData.js';
import { withStyle } from '../../core/ai/gateway.js';

let app; let me;
const before = process.env.AI_ADAPTER;
const PIN = '410585';
const TELUGU = /[ఀ-౿]/;
const HINDI = /[ऀ-ॿ]/;
const put = (p, b) => me.agent.put(`/api/learner${p}`).set('X-CSRF-Token', me.csrf).send(b);
const post = (p, b = {}) => me.agent.post(p).set('X-CSRF-Token', me.csrf).send(b);

beforeAll(async () => {
  process.env.AI_ADAPTER = 'scripted';
  await freshDb();
  app = await makeApp();
  await seedTestData({ log: () => {} });
  me = await login(app, '/api/auth/learner/login', { learner_ref: 'TEST-J-S3', join_code: 'QX-FSD-T01', pin: PIN });
}, 60000);
afterAll(() => { process.env.AI_ADAPTER = before; });

describe('Ask Qubirex follows the learning language', () => {
  it('"loop ante enti?" with Telugu chosen gets a Telugu answer from the lessons, with a link', async () => {
    await put('/learning-language', { value: 'telugu' });
    const r = await post('/api/assist/ask', { question: 'loop ante enti?' });
    expect(r.status).toBe(200);
    expect(r.body.answer).toMatch(TELUGU);
    expect(r.body.language).toBe('telugu');
    expect(r.body.links[0].href).toMatch(/^\/learn\/lesson\/(py|jv)-m2-l/);
  });
  it('answers in English when the learning language is English, even for a Telugu question', async () => {
    await put('/learning-language', { value: 'english' });
    const r = await post('/api/assist/ask', { question: 'dictionary ante enti?' });
    expect(r.body.answer).not.toMatch(TELUGU);
    expect(r.body.answer).toMatch(/key/i);
  });
  it('the picker in the Ask box overrides it: the same question in Hindi', async () => {
    const r = await post('/api/assist/ask', { question: 'what is a for loop', lang: 'hindi' });
    expect(r.body.answer).toMatch(HINDI);
    expect(r.body.language).toBe('hindi');
  });
});

describe('an open review question switches language in place', () => {
  it('same instance, same scenario, no new attempt, and switching back shows the same text', async () => {
    await put('/learning-language', { value: 'telugu' });
    const due = (await me.agent.get('/api/learner/reviews/due')).body.due;
    expect(due.length).toBeGreaterThan(0);
    const node = due[0].node_id;
    const start = await post(`/api/learner/reviews/${node}/start`);
    expect(start.status).toBe(200);
    expect(start.body.question).toMatch(TELUGU);
    const count = async () => Number((await dal.one('SELECT COUNT(*) AS n FROM family_instances WHERE el_id = ? AND node_id = ?', 'test-jel-s3', node)).n);
    const n0 = await count();

    const en = await me.agent.get(`/api/learner/reviews/instances/${start.body.instance_id}/question?language=english`);
    expect(en.body.instance_id).toBe(start.body.instance_id);
    expect(en.body.question).not.toMatch(TELUGU);
    const hi = await me.agent.get(`/api/learner/reviews/instances/${start.body.instance_id}/question?language=hindi`);
    expect(hi.body.question).toMatch(HINDI);
    const te = await me.agent.get(`/api/learner/reviews/instances/${start.body.instance_id}/question?language=telugu`);
    expect(te.body.question).toBe(start.body.question);
    expect(await count()).toBe(n0);

    // Starting again in English continues the same open instance, now in English.
    await put('/learning-language', { value: 'english' });
    const again = await post(`/api/learner/reviews/${node}/start`);
    expect(again.body.instance_id).toBe(start.body.instance_id);
    expect(again.body.question).toBe(en.body.question);
    expect(await count()).toBe(n0);
  });
  it('another learner cannot read someone else\'s question', async () => {
    const other = await login(app, '/api/auth/learner/login', { learner_ref: 'TEST-J-S5', join_code: 'QX-FSD-T01', pin: PIN });
    const inst = await dal.one("SELECT id FROM family_instances WHERE el_id = 'test-jel-s3' ORDER BY created_at DESC LIMIT 1");
    expect((await other.agent.get(`/api/learner/reviews/instances/${inst.id}/question?language=english`)).status).toBe(404);
  });
});

// 31 Oct: "Telugu" and "Telugu + English" (and the Hindi pair) gave the same text.
describe('full language and the English mix are different', () => {
  const LATIN = /\b[A-Za-z]{3,}\b/g;
  const latin = (t) => (String(t).match(LATIN) || []).length;
  const lesson = async (mode) => { await put('/learning-language', { value: mode }); return (await me.agent.get('/api/learner/lessons/py-m3-l3')).body; };

  it('a course lesson: Telugu is full Telugu, the mix keeps English words; code stays English in both', async () => {
    const te = await lesson('telugu');
    const mix = await lesson('telugu_en');
    const a = te.parts.explain.join(' '); const b = mix.parts.explain.join(' ');
    expect(a).not.toBe(b);
    expect(a).toMatch(TELUGU); expect(b).toMatch(TELUGU);
    expect(latin(a)).toBeLessThan(latin(b));
    expect(b).toMatch(/\bvalue\b/); expect(a).toMatch(/విలువ/);
    expect(a).toMatch(/\breturn\b/); expect(a).toMatch(/\bprint\b/);
    expect(te.parts.code.source).toBe(mix.parts.code.source);
    expect(te.parts.oneLine).not.toBe(mix.parts.oneLine);
  });
  it('the same for Hindi and Hindi + English', async () => {
    const hi = await lesson('hindi');
    const mix = await lesson('hindi_en');
    const a = hi.parts.explain.join(' '); const b = mix.parts.explain.join(' ');
    expect(a).not.toBe(b);
    expect(a).toMatch(HINDI);
    expect(latin(a)).toBeLessThan(latin(b));
  });
  it('a skill page (Attempt history → Array methods): Telugu and the mix differ', async () => {
    const node = await dal.one("SELECT sn.id FROM skill_nodes sn WHERE sn.node_label = 'Array methods' AND sn.id LIKE 'test-%' LIMIT 1");
    await put('/learning-language', { value: 'telugu' });
    const te = (await me.agent.get(`/api/learner/skill/${node.id}`)).body;
    await put('/learning-language', { value: 'telugu_en' });
    const mix = (await me.agent.get(`/api/learner/skill/${node.id}`)).body;
    expect(te.concept.primer).toMatch(TELUGU);
    expect(te.concept.primer).not.toBe(mix.concept.primer);
    expect(latin(te.concept.primer)).toBeLessThan(latin(mix.concept.primer));
  });
  it('an open review question is kept separately for each exact mode', async () => {
    await put('/learning-language', { value: 'telugu' });
    const due = (await me.agent.get('/api/learner/reviews/due')).body.due;
    const start = await post(`/api/learner/reviews/${due[0].node_id}/start`);
    const te = await me.agent.get(`/api/learner/reviews/instances/${start.body.instance_id}/question?language=telugu`);
    const mix = await me.agent.get(`/api/learner/reviews/instances/${start.body.instance_id}/question?language=telugu_en`);
    const keys = (await dal.all('SELECT language FROM instance_texts WHERE instance_id = ?', start.body.instance_id)).map(r => r.language);
    expect(keys).toEqual(expect.arrayContaining(['telugu', 'telugu_en']));
    expect(te.body.question).toMatch(TELUGU); expect(mix.body.question).toMatch(TELUGU);
  });
  it('AI prompts are told which style: full language vs the spoken mix', () => {
    const req = { task: 'TEACH.instruction', system: 'Teach in Telugu.', input: 'x' };
    const full = withStyle(req, 'telugu').system;
    const mix = withStyle(req, 'telugu_en').system;
    expect(full).toMatch(/full Telugu sentences/);
    expect(mix).toMatch(/Hyderabad/);
    expect(full).not.toBe(mix);
    expect(withStyle({ task: 'X', system: 'Answer in English.' }, 'telugu').system).toBe('Answer in English.');
    expect(withStyle(req, 'hindi_en').system).toBe('Teach in Telugu.');
  });
});
