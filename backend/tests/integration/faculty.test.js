// Faculty review (v4.3 §7.8): blind queue, verdicts, κ calibration, load forecast.
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import * as dal from '../../core/db/dal.js';
import { freshDb, makeApp, seedInstitution, seedPathway, login, PIN, PASSWORD } from '../helpers/setup.js';
import { setResponder } from '../../core/ai/adapters/mock.js';

let app; let A; let P; let learner; let prof;
let restore = () => {};
const typed = { mode: 'typed', pasted_chars: 0, paste_events: 0, largest_paste: 0 };

beforeAll(async () => {
  await freshDb();
  app = await makeApp();
  A = await seedInstitution('a');
  P = await seedPathway(A);
  learner = await login(app, '/api/auth/learner/login', { learner_ref: A.learnerRef, join_code: A.joinCode, pin: PIN });
  prof = await login(app, '/api/auth/institution/login', { email: A.profEmail, password: PASSWORD });
});
afterEach(() => restore());

async function provisionalPass() {
  const scores = [0.78, 0.70];
  restore = setResponder((req) => {
    if (req.task === 'EVAL.mastery') { const score = scores.shift() ?? 0.9; return { score, evaluation: 'e', feedbackForLearner: 'f', understandingGaps: [] }; }
    if (req.task === 'EVIDENCE.conceptItem') return { question: `Q ${req.hash.slice(0, 5)}` };
    return { message: 'lesson', decision: 'CHECK' };
  });
  const lp = (path, body) => learner.agent.post(path).set('X-CSRF-Token', learner.csrf).send(body);
  const s = await lp('/api/learner/session/start', {});
  await lp('/api/learner/session/message', { content: 'ready', session_id: s.body.session_id });
  const r = await lp('/api/learner/session/message', { content: 'SELECT picks rows.', session_id: s.body.session_id, provenance: typed });
  expect(r.body).toMatchObject({ result: 'advance', provisional: true });
}

describe('blind review queue', () => {
  it('shows the question, the answer and the rubric — never the AI score, stratum or learner', async () => {
    await provisionalPass();
    const q = await prof.agent.get('/api/institution/review-queue').expect(200);
    expect(q.body.items).toHaveLength(1);
    const item = q.body.items[0];
    expect(item.answer).toBe('SELECT picks rows.');
    expect(item.question).toMatch(/^Q /);
    expect(item.rubric.passing.length).toBeGreaterThan(0);
    const text = JSON.stringify(q.body);
    expect(text).not.toMatch(/r_c|score|stratum|borderline|reason/);
    expect(item.learner).toBeNull();
  });

  it('a fail verdict on a pass requires a recheck and records a faculty demonstration; the learner is then revealed', async () => {
    const item = (await prof.agent.get('/api/institution/review-queue')).body.items[0];
    await prof.agent.post(`/api/institution/review-queue/${item.id}/verdict`).set('X-CSRF-Token', prof.csrf).send({ verdict: 'maybe', band: '0.0-0.49' }).expect(400);
    const r = await prof.agent.post(`/api/institution/review-queue/${item.id}/verdict`).set('X-CSRF-Token', prof.csrf).send({ verdict: 'fail', band: '0.5-0.69' }).expect(200);
    expect(r.body.outcome).toMatchObject({ agree: false, recheck: true });
    expect(r.body.item.learner.learner_ref).toBe(A.learnerRef);
    expect(await dal.one('SELECT recheck_required, provisional FROM node_mastery WHERE skill_node_id = ?', P.nodes[0])).toEqual({ recheck_required: 1, provisional: 0 });
    expect(await dal.one("SELECT kind, passed FROM demonstrations WHERE kind = 'faculty'")).toEqual({ kind: 'faculty', passed: 0 });
    await expect((async () => await dal.run('DELETE FROM faculty_reviews'))()).rejects.toThrow(/append-only/);
    await prof.agent.post(`/api/institution/review-queue/${item.id}/verdict`).set('X-CSRF-Token', prof.csrf).send({ verdict: 'pass', band: '0.7-0.89' }).expect(409);
    expect((await dal.one("SELECT COUNT(*) n FROM domain_events WHERE type = 'FACULTY_REVIEW_DONE'")).n).toBe(1);
  });

  it('staff of another institution cannot see or decide the item', async () => {
    const B = await seedInstitution('b');
    const other = await login(app, '/api/auth/institution/login', { email: B.adminEmail, password: PASSWORD });
    const q = await other.agent.get('/api/institution/review-queue?status=done').expect(200);
    expect(q.body.items).toHaveLength(0);
  });
});

describe('calibration and load', () => {
  it('reports κ per node with the §7.8 rule, and a weekly minutes forecast against the contract', async () => {
    const admin = await login(app, '/api/auth/institution/login', { email: A.adminEmail, password: PASSWORD });
    const c = await admin.agent.get(`/api/institution/calibration?engagement_id=${A.engagementId}`).expect(200);
    expect(c.body.rule).toMatchObject({ min_n: 20, min_lower: 0.5, min_point: 0.6 });
    expect(c.body.nodes[0]).toMatchObject({ n: 0, status: 'sampling' });
    let load = (await admin.agent.get(`/api/institution/review-load?engagement_id=${A.engagementId}`).expect(200)).body;
    expect(load.forecast_minutes_per_week).toBeGreaterThan(0);
    expect(load.contracted_minutes_per_week).toBeNull();
    await admin.agent.put('/api/institution/review-contract').set('X-CSRF-Token', admin.csrf).send({ review_minutes_per_100: 1 }).expect(200);
    load = (await admin.agent.get(`/api/institution/review-load?engagement_id=${A.engagementId}`).expect(200)).body;
    expect(load.over_contract).toBe(true);
    await prof.agent.put('/api/institution/review-contract').set('X-CSRF-Token', prof.csrf).send({ review_minutes_per_100: 60 }).expect(403);
  });
});
