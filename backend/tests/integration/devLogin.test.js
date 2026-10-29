// Developer login (/api/dev) and the test-tenant wall (core/testTenant.js):
// off by default, server-checked passcode with a 5-tries limit, real 8-hour
// sessions marked dev, only the fixed test accounts, and test data never
// mixing with real employers, benchmarks or admin numbers.
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import * as dal from '../../core/db/dal.js';
import { seedTestData } from '../../scripts/testData.js';
import { benchmarks } from '../../core/benchmarks.js';
import { devLoginConfigError } from '../../core/devLogin.js';
import { freshDb, makeApp, seedInstitution, seedAdmin, login, PIN, PASSWORD } from '../helpers/setup.js';

const SECRET = 'a-test-passcode-that-is-long-enough-0123456789';
const ROUTES = [['get', '/api/dev/status'], ['post', '/api/dev/unlock'], ['get', '/api/dev/accounts'], ['post', '/api/dev/login'],
  ['post', '/api/dev/reset-test-data'], ['post', '/api/dev/skip-waits'], ['get', '/api/dev/build-info'], ['post', '/api/dev/end']];
let app; let real;
const bearer = (t) => ({ Authorization: `Bearer ${t}` });
const enable = (extra = {}) => Object.assign(process.env, { DEV_LOGIN_ENABLED: 'true', DEV_LOGIN_SECRET: SECRET }, extra);
const disable = () => { delete process.env.DEV_LOGIN_ENABLED; delete process.env.DEV_LOGIN_SECRET; delete process.env.DEV_LOGIN_ALLOWED_IPS; };

async function unlockedAgent() {
  const agent = request.agent(app);
  const r = await agent.post('/api/dev/unlock').send({ passcode: SECRET });
  expect(r.status).toBe(200);
  return agent;
}
async function open(agent, key) {
  const r = await agent.post('/api/dev/login').send({ account_key: key });
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  return r.body;
}

beforeAll(async () => {
  await freshDb();
  app = await makeApp();
  await seedTestData({ log: () => {} });
  real = await seedInstitution('real');
  await dal.run("UPDATE institutions SET city = 'Hyderabad' WHERE id = ?", real.institutionId);
  await seedAdmin();
}, 120000);
beforeEach(async () => { disable(); await dal.run('DELETE FROM dev_audit'); });
afterAll(disable);

describe('off by default', () => {
  it('every /api/dev route answers 404 when DEV_LOGIN_ENABLED is unset', async () => {
    for (const [m, p] of ROUTES) expect((await request(app)[m](p).send({ passcode: SECRET, account_key: 'learner_te' })).status, p).toBe(404);
  });

  it('also 404 when enabled with a passcode under 32 characters, and the deployment refuses to start', async () => {
    enable({ DEV_LOGIN_SECRET: 'too-short' });
    expect((await request(app).get('/api/dev/status')).status).toBe(404);
    expect(devLoginConfigError(process.env)).toMatch(/at least 32 characters/);
    expect(devLoginConfigError({ DEV_LOGIN_ENABLED: 'false' })).toBeNull();
  });

  it('404 from an IP outside DEV_LOGIN_ALLOWED_IPS', async () => {
    enable({ DEV_LOGIN_ALLOWED_IPS: '10.1.2.3' });
    expect((await request(app).get('/api/dev/status')).status).toBe(404);
    enable({ DEV_LOGIN_ALLOWED_IPS: '10.1.2.3, 127.0.0.1' });
    expect((await request(app).get('/api/dev/status')).status).toBe(200);
  });
});

describe('passcode', () => {
  it('a wrong passcode is 401, and the 6th try in 15 minutes is rate-limited even with the right one', async () => {
    enable();
    for (let i = 0; i < 5; i += 1) expect((await request(app).post('/api/dev/unlock').send({ passcode: `wrong-${i}` })).status).toBe(401);
    expect((await request(app).post('/api/dev/unlock').send({ passcode: SECRET })).status).toBe(429);
    const rows = await dal.all('SELECT action, ip, detail FROM dev_audit');
    expect(rows.filter(r => r.action === 'unlock_failed')).toHaveLength(5);
    expect(JSON.stringify(rows)).not.toContain('wrong-');
  });

  it('accounts and login need the unlock cookie', async () => {
    enable();
    expect((await request(app).get('/api/dev/accounts')).status).toBe(401);
    expect((await request(app).post('/api/dev/login').send({ account_key: 'learner_te' })).status).toBe(401);
  });
});

describe('sign in as a test account', () => {
  it('lists every role card as ready after the seed', async () => {
    enable();
    const agent = await unlockedAgent();
    const r = await agent.get('/api/dev/accounts');
    expect(r.body.accounts.map(a => a.key)).toEqual(['learner_te', 'learner_hi', 'learner_new', 'college_admin', 'professor', 'employer_verified', 'employer_pending', 'admin']);
    expect(r.body.accounts.every(a => a.ready)).toBe(true);
  });

  it('issues a real session with dev: true, actor "developer", 8 hours, and audits it', async () => {
    enable();
    const agent = await unlockedAgent();
    const body = await open(agent, 'learner_te');
    const p = jwt.decode(body.token);
    expect(p).toMatchObject({ dev: true, actor: 'developer', actor_type: 'learner', role: 'learner' });
    expect(p.exp - p.iat).toBe(8 * 3600);
    const s = await dal.one('SELECT is_dev, expires_at, created_at FROM auth_sessions WHERE id = ?', p.sid);
    expect(s.is_dev).toBe(1);
    expect(new Date(s.expires_at) - new Date(s.created_at)).toBe(8 * 3600000);
    expect((await request(app).get('/api/learner/profile').set(bearer(body.token))).status).toBe(200);
    const a = await dal.one("SELECT * FROM dev_audit WHERE action = 'login'");
    expect(a).toMatchObject({ account_key: 'learner_te', role: 'learner', session_id: p.sid });
    expect(a.ip).toBeTruthy();
  });

  it('opens each role at its home, with the right role', async () => {
    enable();
    const agent = await unlockedAgent();
    const want = { learner_hi: ['learner', '/learn/dashboard'], learner_new: ['learner', '/learn/welcome'], college_admin: ['institution', '/institution/home'],
      professor: ['institution', '/institution/home'], employer_verified: ['employer', '/employer/home'], employer_pending: ['employer', '/employer/home'], admin: ['admin', '/admin/overview'] };
    for (const [key, [role, home]] of Object.entries(want)) {
      const b = await open(agent, key);
      expect([b.role, b.home], key).toEqual([role, home]);
    }
    const hi = await open(agent, 'learner_hi');
    expect(hi.user.language).toBe('hindi');
  });

  it('refuses anything but a fixed test account key: real IDs, test IDs, prototype keys', async () => {
    enable();
    const agent = await unlockedAgent();
    for (const k of [real.learnerId, real.adminEmail, 'test-learner-0001', 'TEST-LRNR-001', '__proto__', 'constructor', '']) {
      expect((await agent.post('/api/dev/login').send({ account_key: k })).status, k).toBe(404);
    }
    expect((await agent.post('/api/dev/login').send({ account_key: { learnerId: real.learnerId } })).status).toBe(404);
  });

  it('refuses a test account whose row has left the test tenant', async () => {
    enable();
    const agent = await unlockedAgent();
    await dal.run("UPDATE institutions SET is_test = 0 WHERE id = 'test-inst-0001'");
    try {
      expect((await agent.post('/api/dev/login').send({ account_key: 'learner_te' })).status).toBe(404);
      expect((await agent.post('/api/dev/login').send({ account_key: 'college_admin' })).status).toBe(404);
    } finally {
      await dal.run("UPDATE institutions SET is_test = 1 WHERE id = 'test-inst-0001'");
    }
  });

  it('switching ends the previous developer session, and End signs the account out', async () => {
    enable();
    const agent = await unlockedAgent();
    const first = await open(agent, 'professor');
    const second = (await agent.post('/api/dev/login').set(bearer(first.token)).send({ account_key: 'employer_verified' })).body;
    expect((await request(app).get('/api/institution/me').set(bearer(first.token))).status).toBe(401);
    expect((await request(app).get('/api/employer/me').set(bearer(second.token))).status).toBe(200);
    expect((await agent.post('/api/dev/end').set(bearer(second.token))).status).toBe(200);
    expect((await request(app).get('/api/employer/me').set(bearer(second.token))).status).toBe(401);
    expect((await agent.get('/api/dev/accounts')).status).toBe(401); // the unlock is gone too
  });
});

describe('tools', () => {
  it('skip waits verifies the test employer and clears test PIN locks, nothing real', async () => {
    enable();
    const agent = await unlockedAgent();
    await dal.run("UPDATE engagement_learners SET locked_at = ?, failed_pin_attempts = 5 WHERE id IN ('test-el-0001', ?)", dal.nowIso(), real.elId);
    const r = await agent.post('/api/dev/skip-waits').send({});
    expect(r.status).toBe(200);
    expect((await dal.one("SELECT kyb_status FROM employers WHERE id = 'test-employer-0001'")).kyb_status).toBe('verified');
    expect((await dal.one("SELECT locked_at FROM engagement_learners WHERE id = 'test-el-0001'")).locked_at).toBeNull();
    expect((await dal.one('SELECT locked_at FROM engagement_learners WHERE id = ?', real.elId)).locked_at).not.toBeNull();
    await dal.run('UPDATE engagement_learners SET locked_at = NULL, failed_pin_attempts = 0 WHERE id = ?', real.elId);
  });

  it('reset needs a confirmation, then puts the pending employer back to pending', async () => {
    enable();
    const agent = await unlockedAgent();
    expect((await agent.post('/api/dev/reset-test-data').send({})).status).toBe(400);
    expect((await agent.post('/api/dev/reset-test-data').send({ confirm: true })).status).toBe(200);
    expect((await dal.one("SELECT kyb_status FROM employers WHERE id = 'test-employer-0001'")).kyb_status).toBe('pending');
    expect((await dal.one("SELECT kyb_status FROM employers WHERE id = 'test-employer-0002'")).kyb_status).toBe('verified');
  }, 60000);

  it('build info says mock or live AI', async () => {
    enable();
    const agent = await unlockedAgent();
    const r = await agent.get('/api/dev/build-info');
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ version: expect.any(String), environment: 'test', ai: 'mock' });
  });
});

describe('the test tenant stays apart from real data', () => {
  let realEmployer; let testEmployer; let realRole; let testRole;
  const role = { title: 'Frontend developer', city: 'Hyderabad', skills: [{ key: 'javascript', required: true }], bar: 60, published: true };

  beforeAll(async () => {
    enable();
    // A real student and a test student both turn on "Let employers find me".
    const realLearner = await login(app, '/api/auth/learner/login', { learner_ref: real.learnerRef, join_code: real.joinCode, pin: PIN });
    const d = await request(app).put('/api/learner/discoverable').set(bearer(realLearner.token)).send({ on: true, city: 'Hyderabad' });
    expect(d.status).toBe(200);
    const agent = await unlockedAgent();
    const testLearner = await open(agent, 'learner_te');
    const d2 = await request(app).put('/api/learner/discoverable').set(bearer(testLearner.token)).send({ on: true, city: 'Hyderabad' });
    expect(d2.status).toBe(200);
    testEmployer = await open(agent, 'employer_verified');
    await request(app).post('/api/auth/employer/register').send({ company_name: 'Real Co', name: 'Owner', email: 'owner@realco.test', password: PASSWORD }).expect(201);
    realEmployer = (await login(app, '/api/auth/employer/login', { email: 'owner@realco.test', password: PASSWORD })).token;
    realRole = (await request(app).post('/api/employer/roles').set(bearer(realEmployer)).send(role)).body.id;
    testRole = (await request(app).post('/api/employer/roles').set(bearer(testEmployer.token)).send(role)).body.id;
    disable();
  });

  it('a real employer finds the real student but never the test learner, and the test employer the reverse', async () => {
    const r = await request(app).get(`/api/employer/roles/${realRole}/candidates`).set(bearer(realEmployer));
    const t = await request(app).get(`/api/employer/roles/${testRole}/candidates`).set(bearer(testEmployer.token));
    expect(r.body.candidates.map(c => c.college)).toEqual(['[Institution name] real']);
    expect(t.body.candidates.map(c => c.college)).toEqual(['Qubirex Test Institution']);
    const colleges = await request(app).get('/api/employer/colleges').set(bearer(realEmployer));
    expect(JSON.stringify(colleges.body)).not.toContain('test-inst');
  });

  it('a real college cannot be sponsored by the test employer (and is "not found" to it)', async () => {
    const r = await request(app).post('/api/employer/sponsorships').set(bearer(testEmployer.token)).send({ institution_id: real.institutionId, seats: 5 });
    expect(r.status).toBe(404);
  });

  it('test colleges never count in a real college\'s regional benchmark', async () => {
    const realB = await benchmarks(real.institutionId, real.engagementId);
    expect(realB.regional.published).toBe(false); // the three Hyderabad peers are test data
    const testB = await benchmarks('test-inst-0001', '4a4c13c4-989e-4c03-b636-3bdba7fd1025');
    expect(testB.regional.published).toBe(true);
  });

  it('real admin numbers leave the test tenant out; the test admin sees only it', async () => {
    const admin = await login(app, '/api/auth/admin/login', { email: 'root@qubirex.test', password: PASSWORD });
    const realStats = (await request(app).get('/api/admin/stats').set(bearer(admin.token))).body;
    const realInst = (await request(app).get('/api/admin/institutions').set(bearer(admin.token))).body;
    expect(realInst.map(i => i.id)).toEqual([real.institutionId]);
    expect(realStats.institutions).toBe(1);
    const realEmployers = (await request(app).get('/api/admin/employers').set(bearer(admin.token))).body.employers;
    expect(realEmployers.every(e => !e.id.startsWith('test-'))).toBe(true);

    const testAdmin = await login(app, '/api/auth/admin/login', { email: 'test.admin@qubirex.local', password: 'QubirexTest2026!' });
    const testInst = (await request(app).get('/api/admin/institutions').set(bearer(testAdmin.token))).body;
    expect(testInst.every(i => i.id.startsWith('test-'))).toBe(true);
    expect(testInst).toHaveLength(4);
    expect((await request(app).post('/api/admin/ontology-review/x').set(bearer(testAdmin.token)).send({ action: 'reject' })).status).toBe(403);
  });
});
