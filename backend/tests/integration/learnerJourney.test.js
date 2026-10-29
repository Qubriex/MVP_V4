// The learner journey screens, against the seeded stage learners (S0–S12):
// stage detection, the starting check, the skill tabs (practice, work task,
// spoken challenge), "Confirmed needs two kinds of evidence", attempt history,
// readiness, the employer request detail (item by item), Apply on both sides,
// Day-One, notification preferences, résumé claims and account deletion.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as dal from '../../core/db/dal.js';
import { freshDb, makeApp, login } from '../helpers/setup.js';
import { seedTestData } from '../../scripts/testData.js';
import { JOURNEY } from '../../core/journey/accounts.js';
import { stageOf, journeyFacts } from '../../core/journey/stage.js';

const PIN = '410585';
const JOIN = { telugu: 'QX-FSD-T01', hindi: 'QX-FSD-T02' };
const typed = { mode: 'typed', pasted_chars: 0, paste_events: 0, largest_paste: 0 };
let app;
const before = process.env.AI_ADAPTER;
const as = async (key) => {
  const j = JOURNEY.find(x => x.key === key);
  const s = await login(app, '/api/auth/learner/login', { learner_ref: j.ref, join_code: JOIN[j.language], pin: PIN });
  expect(s.res.status).toBe(200);
  const get = (p) => s.agent.get(`/api/learner${p}`);
  const post = (p, b = {}) => s.agent.post(`/api/learner${p}`).set('X-CSRF-Token', s.csrf).send(b);
  const put = (p, b = {}) => s.agent.put(`/api/learner${p}`).set('X-CSRF-Token', s.csrf).send(b);
  return { ...s, get, post, put, j };
};

beforeAll(async () => {
  process.env.AI_ADAPTER = 'scripted';
  await freshDb();
  app = await makeApp();
  await seedTestData({ log: () => {} });
}, 60000);
afterAll(() => { process.env.AI_ADAPTER = before; });

describe('stage accounts', () => {
  it('every journey learner lands on its own stage, from its own data', async () => {
    for (const j of JOURNEY) expect(stageOf(await journeyFacts(j.elId)), j.key).toBe(j.stage);
  });

  it('GET /journey gives the stage and one next step', async () => {
    const s4 = await as('s4');
    const r = await s4.get('/journey');
    expect(r.body).toMatchObject({ stage: 'S4', next: { key: 'retry_check', href: '/learn/session' } });
    expect(r.body.facts.failed_check.label).toBe('Array methods');
    const s8 = await as('s8');
    expect((await s8.get('/journey')).body.next.href).toBe('/learn/requests/test-j-s8-pipe');
  });
});

describe('starting check', () => {
  it('asks about two questions per skill group, places the learner and explains why', async () => {
    const s1 = await as('s1');
    const start = await s1.post('/baseline/start');
    expect(start.body.status).toBe('started');
    expect(start.body.items).toHaveLength(8);
    for (const it of start.body.items.filter(i => i.group === 'Web Basics')) await s1.post('/baseline/answer', { key: it.key, answer: '#pass' });
    const done = await s1.post('/baseline/finish');
    expect(done.body.placement.known_groups).toEqual(['Web Basics']);
    expect(done.body.placement.start_group).toBe('JavaScript Core');
    expect((await dal.one("SELECT current_node_id FROM engagement_learners WHERE id = 'test-jel-s1'")).current_node_id).toBe('test-node-2-1');
  });

  it('can be skipped, starting at the beginning', async () => {
    const s = await as('s1-hi');
    const r = await s.post('/baseline/skip');
    expect(r.body).toMatchObject({ status: 'skipped', placement: { skipped: true, start_label: 'HTML semantics' } });
  });
});

describe('skill tabs and the Confirmed rule', () => {
  it('shows concept, practice items, the work task and progress', async () => {
    const s3 = await as('s3');
    const v = await s3.get('/skill/test-node-1-3');
    expect(v.body.concept.primer.length).toBeGreaterThan(50);
    expect(v.body.practice.map(p => p.kind)).toEqual(['quick', 'quick', 'quick', 'written', 'code']);
    expect(v.body.progress).toMatchObject({ label: 'Partial' });
    expect(v.body.progress.next.key).toBe('task');
  });

  it('a skill needs a second kind of evidence: practice then a work task count only once mastered', async () => {
    const s3 = await as('s3');
    const quick = (await s3.get('/skill/test-node-1-3')).body.practice[0];
    const q = await s3.post('/skill/test-node-1-3/practice', { kind: 'quick', item_key: quick.key, answer: quick.options[0] });
    expect(q.body.counts).toBe(false);
    const code = await s3.post('/skill/test-node-1-3/practice', { kind: 'code', item_key: 'code-1', provenance: typed,
      answer: '.menu { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; }' });
    expect(code.body).toMatchObject({ result: 'pass', counts: true });
    expect(code.body.checks.every(c => c.passed)).toBe(true);
    const kinds = (await dal.all("SELECT kind, level FROM demonstrations WHERE el_id = 'test-jel-s3' AND node_id = 'test-node-1-3' ORDER BY date")).map(d => `${d.kind}:${d.level}`);
    expect(kinds).toContain('practice:L2');

    const task = await s3.post('/skill/test-node-1-3/task');
    expect(task.body.guide.reduce((a, g) => a + g.weight, 0)).toBe(100);
    const again = await s3.post('/skill/test-node-1-3/task');
    expect(again.body.locked_until).toBe(task.body.locked_until);
    const sent = await s3.post('/skill/test-node-1-3/practice', { kind: 'task', answer: '#pass', provenance: typed });
    expect(sent.body.result).toBe('pass');
  });

  it('the spoken challenge is bound to the learner\'s own answer and adds A2', async () => {
    const s7 = await as('s7');
    // S7 already holds evidence; pass a fresh check first so there is an answer to be asked about.
    await dal.run(`INSERT INTO check_answers (evidence_id, answer_text, created_at) SELECT id, 'I would use flexbox with justify-content space-between', created_at FROM evidence_records WHERE el_id = 'test-jel-s7' AND node_id = 'test-node-1-3' AND passed = 1 ON CONFLICT DO NOTHING`);
    const ch = await s7.post('/skill/test-node-1-3/challenge');
    expect(ch.body.question).toContain('flexbox');
    const a = await s7.post(`/challenge/${ch.body.id}/answer`, { answer: '#pass', mode: 'typed' });
    expect(a.body.result).toBe('pass');
    const real = await as('s3');
    const r = await real.post('/challenge/nope/answer', { answer: 'x', mode: 'typed' });
    expect(r.status).toBe(404);
  });

  it('attempt history lists checks, practice and tasks with authorship and evidence level', async () => {
    const s3 = await as('s3');
    const h = await s3.get('/history');
    const kinds = new Set(h.body.attempts.map(a => a.kind));
    expect(kinds.has('check')).toBe(true);
    expect(kinds.has('practice')).toBe(true);
    expect(kinds.has('task')).toBe(true);
    expect(h.body.attempts[0]).toHaveProperty('authorship');
  });
});

describe('readiness, requests, apply, Day-One', () => {
  it('readiness for a role: three bars per skill and 2 skills short for S6', async () => {
    const s6 = await as('s6');
    const r = await s6.get('/readiness?role=test-role-0002');
    expect(r.body.role.band_label).toBe('Nearly ready');
    expect(r.body.role.short.sort()).toEqual(['REST APIs', 'SQL']);
    const sql = r.body.role.skills.find(s => s.key === 'sql');
    expect(sql).toMatchObject({ employers: 100, verified: false });
    expect(sql.course).toBeGreaterThan(0);
    expect(r.body.role.hours_to_close).toBeGreaterThan(0);
    expect((await s6.post('/plan', { skill: 'REST APIs' })).body.plan.map(p => p.skill_name)).toEqual(['SQL', 'REST APIs']);
  });

  it('an employer request: interview promise first, item by item, name off by default; the employer sees only what was shared', async () => {
    const s8 = await as('s8');
    const d = await s8.get('/requests/test-j-s8-pipe');
    expect(d.body).toMatchObject({ interview_promised: true, default_on: ['skills', 'labels', 'dayone', 'resume'], stage: 'requested' });
    await s8.post('/requests/test-j-s8-pipe/decide', { decision: 'question', note: 'Is this role on-site?' });
    const ok = await s8.post('/requests/test-j-s8-pipe/decide', { decision: 'approve', items: ['skills', 'labels'], expires_days: 30 });
    expect(ok.body.stage).toBe('access_granted');
    expect(ok.body.decisions.map(x => x.decision)).toEqual(['approved', 'question']);
    const emp = await login(app, '/api/auth/employer/login', { email: 'test.employer.verified@qubirex.local', password: 'QubirexTest2026!' });
    const c = await emp.agent.get('/api/employer/candidates/test-j-s8-pipe');
    expect(c.body.name).toBeNull();
    expect(c.body.contact).toBeNull();
    expect(c.body.evidence.length).toBeGreaterThan(0);
    expect(c.body.evidence[0]).toHaveProperty('label');
  });

  it('Apply shares exactly what is listed and the status changes on both sides', async () => {
    const s7 = await as('s7');
    const view = await s7.get('/apply/test-role-0002');
    expect(view.body.shares).toEqual(['skills', 'labels', 'dayone', 'resume', 'name', 'contact']);
    expect((await s7.post('/apply/test-role-0002', {})).status).toBe(400);
    const sent = await s7.post('/apply/test-role-0002', { confirm: true });
    expect(sent.body.stage).toBe('applied');
    const emp = await login(app, '/api/auth/employer/login', { email: 'test.employer.verified@qubirex.local', password: 'QubirexTest2026!' });
    const pipe = await emp.agent.get('/api/employer/pipeline');
    const row = pipe.body.rows.find(r => r.id === sent.body.id);
    expect(row).toMatchObject({ stage: 'applied', name: 'Lakshmi Durga' });
    const st = await emp.agent.post(`/api/employer/pipeline/${sent.body.id}/stage`).set('X-CSRF-Token', emp.csrf).send({ stage: 'shortlisted' });
    expect(st.status).toBe(200);
    const r = (await s7.get(`/requests/${sent.body.id}`)).body;
    expect(r.stage).toBe('shortlisted');
    expect(r.history.map(h => h.stage)).toEqual(['applied', 'shortlisted']);
  });

  it('Day-One: check before starting, practice, then the scored run adds A3', async () => {
    const s9 = await as('s9');
    const v = await s9.get('/dayone');
    expect(v.body.status).toBe('practice_done');
    await s9.post('/dayone/precheck', { checks: { quiet_room: true, camera: false, minutes: true } });
    expect((await s9.post('/dayone/scored', { answers: ['#pass'] })).status).toBe(409);
    expect((await s9.post('/dayone/precheck', { checks: { quiet_room: true, camera: true, minutes: true } })).body.ready).toBe(true);
    const done = await s9.post('/dayone/scored', { answers: v.body.tasks.map(() => '#pass'), supervision: { camera_on: true } });
    expect(done.body).toMatchObject({ scored: true, passed: true });
    expect((await dal.one("SELECT COUNT(*) AS n FROM demonstrations WHERE el_id = 'test-jel-s9' AND kind = 'dayone' AND assurance = 'A3' AND date > ?", new Date(Date.now() - 60000).toISOString())).n).toBeGreaterThan(0);
  });
});

describe('settings and records', () => {
  it('notification preferences: required ones stay on', async () => {
    const s = await as('s3');
    const p = await s.put('/notification-prefs', { prefs: [{ event: 'employer_request', channels: { in_app: false, whatsapp: false } }, { event: 'review_due', channels: { in_app: false } }] });
    const req = p.body.prefs.find(x => x.event === 'employer_request');
    expect(req.channels).toMatchObject({ in_app: true, whatsapp: false });
    expect(p.body.prefs.find(x => x.event === 'review_due').channels.in_app).toBe(false);
  });

  it('résumé claims never count; proven skills come from the Passport', async () => {
    const s = await as('s6');
    const r = await s.post('/resume/claims', { text: 'Skills: React, Node.js, Docker, SQL\nBuilt a REST API' });
    const names = r.body.claims.map(c => c.skill);
    expect(names).toEqual(expect.arrayContaining(['React', 'SQL']));
    expect(r.body.claims.find(c => c.skill === 'SQL').proven).toBeNull();
    expect(r.body.proven.length).toBeGreaterThan(5);
  });

  it('delete my account needs the OTP, then waits 14 days and can be cancelled', async () => {
    const s = await as('s2');
    const q = await s.post('/account-deletion/request');
    expect(q.body.dev_code).toMatch(/^\d{6}$/);
    expect((await s.post('/account-deletion/confirm', { otp: '000000' === q.body.dev_code ? '111111' : '000000' })).status).toBe(400);
    const c = await s.post('/account-deletion/confirm', { otp: q.body.dev_code });
    expect(c.body.status).toBe('scheduled');
    expect(Date.parse(c.body.purge_after) - Date.now()).toBeGreaterThan(13 * 86400000);
    expect((await s.post('/account-deletion/cancel')).body.status).toBe('none');
  });

  it('the Passport shows who viewed it (type and date) and whether labels changed after sharing', async () => {
    const s7 = await as('s7');
    const p = (await s7.get('/passport')).body;
    expect(p.shared_since).toBeTruthy();
    expect(p.views.last_90_days.map(v => v.type).sort()).toEqual(['employer', 'public']);
    expect(p.labels_changed_since_share).toBe(true);
  });
});

describe('the journey on the college and employer side', () => {
  const college = () => login(app, '/api/auth/institution/login', { email: 'test.institution@qubirex.local', password: 'QubirexTest2026!' });

  it('Students shows each journey stage; hiring stages stay the student\'s own and read as Ready', async () => {
    const c = await college();
    const r = await c.agent.get('/api/institution/students');
    const stageOfRow = (elId) => r.body.rows.find(x => x.el_id === elId)?.stage;
    expect(stageOfRow('test-jel-s3')).toBe('S3');
    expect(stageOfRow('test-jel-s4')).toBe('S4');
    expect(['S7', 'S11']).toContain(stageOfRow('test-jel-s8'));
    expect(r.body.rows.some(x => ['S8', 'S9', 'S10'].includes(x.stage))).toBe(false);
    expect(r.body.stage_counts.S4).toBeGreaterThan(0);
  });

  it('"Stuck at check" lists students whose last check has not passed, and help requests reach the professor', async () => {
    const c = await college();
    const stuck = await c.agent.get('/api/institution/students-stuck');
    const row = stuck.body.rows.find(x => x.el_id === 'test-jel-s4');
    // The S4 seed already asked for help on this skill; asking again keeps one open request.
    expect(row).toMatchObject({ node_label: 'Array methods', asked_for_help: true });
    expect(row.failed_tries).toBeGreaterThan(0);

    const s4 = await as('s4');
    expect((await s4.post(`/skill/${row.node_id}/help`, { message: 'Again' })).body).toMatchObject({ ok: true, already_open: true });
    const open = await c.agent.get('/api/institution/help-requests');
    const h = open.body.items.filter(x => x.el_id === 'test-jel-s4');
    expect(h).toHaveLength(1);
    expect(h[0]).toMatchObject({ node_label: 'Array methods', status: 'open' });
    expect(h[0].failed_tries).toBe(row.failed_tries);

    const ans = await c.agent.post(`/api/institution/help-requests/${h[0].id}/answer`).set('X-CSRF-Token', c.csrf).send({ reply: 'map changes each item; filter keeps some.' });
    expect(ans.status).toBe(200);
    expect((await c.agent.get('/api/institution/help-requests?status=answered')).body.items.some(x => x.id === h[0].id)).toBe(true);
    expect((await c.agent.get('/api/institution/students-stuck')).body.rows.find(x => x.el_id === 'test-jel-s4').asked_for_help).toBe(false);
    const note = await dal.one("SELECT title, href FROM notifications WHERE actor_type = 'learner' AND actor_id = ? AND kind = 'help_answered'", s4.j.learnerId);
    expect(note.href).toBe(`/learn/skill/${row.node_id}`);
  });

  it('the employer sees how skills were shown and whose answer it was, never failed tries', async () => {
    const emp = await login(app, '/api/auth/employer/login', { email: 'test.employer.verified@qubirex.local', password: 'QubirexTest2026!' });
    const c = (await emp.agent.get('/api/employer/candidates/test-j-s8-pipe')).body;
    expect(c.evidence_summary.kinds.length).toBeGreaterThan(0);
    expect(c.evidence_summary.kinds.every(k => k.count > 0)).toBe(true);
    expect(Object.keys(c.evidence_summary.authorship).length).toBeGreaterThan(0);
    expect(JSON.stringify(c)).not.toMatch(/failed_tries|attempt_count|loops/);
    const pipe = (await emp.agent.get('/api/employer/pipeline')).body.rows;
    const applied = pipe.find(r => r.source === 'apply');
    expect(applied.shared.length).toBeGreaterThan(0);
  });

  it('Reviews gives a streak', async () => {
    const s12 = await as('s12');
    const r = await s12.get('/reviews/due');
    expect(r.body.streak).toMatchObject({ days: expect.any(Number), today: expect.any(Boolean) });
  });
});
