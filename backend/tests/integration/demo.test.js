// The public working demo (api/routes/demo.js): sandboxes are created fast,
// kept apart from real, test and other sandboxes in every direction, sign
// with the demo key, send nothing, stay inside their AI budget, cannot reach
// /admin or /dev, and are deleted completely when they end.
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import * as dal from '../../core/db/dal.js';
import { seedTestData } from '../../scripts/testData.js';
import { benchmarks } from '../../core/benchmarks.js';
import { idsFor } from '../../core/demo/world.js';
import { deleteExpired } from '../../core/demo/cleanup.js';
import { freshDb, makeApp, seedInstitution, seedAdmin, login, PIN, PASSWORD } from '../helpers/setup.js';

let app; let real;
const bearer = (t) => ({ Authorization: `Bearer ${t}` });
const ENV = ['DEMO_ENABLED', 'DEMO_STARTS_PER_HOUR', 'DEMO_MAX_ACTIVE', 'DEMO_AI_PER_SANDBOX', 'DEMO_AI_DAILY_LIMIT', 'DEV_LOGIN_ENABLED', 'DEV_LOGIN_SECRET'];
const reset = () => ENV.forEach(k => delete process.env[k]);

// One visitor: an agent with the sandbox cookie, and the current persona's token.
async function visitor(persona) {
  const agent = request.agent(app);
  const r = await agent.post('/api/demo/start').send({ persona });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  const v = { agent, token: r.body.token, body: r.body, sbx: jwt.decode(r.body.token || '')?.sandbox || null };
  v.switch = async (p) => {
    const s = await agent.post('/api/demo/switch').send({ persona: p });
    expect(s.status, JSON.stringify(s.body)).toBe(200);
    v.token = s.body.token; return s.body;
  };
  return v;
}
const as = (v) => bearer(v.token);

beforeAll(async () => {
  await freshDb();
  app = await makeApp();
  await seedTestData({ log: () => {} });
  real = await seedInstitution('real');
  await dal.run("UPDATE institutions SET city = 'Hyderabad' WHERE id = ?", real.institutionId);
  await seedAdmin();
}, 120000);
beforeEach(async () => {
  reset(); process.env.DEMO_ENABLED = 'true'; process.env.DEMO_STARTS_PER_HOUR = '1000';
  await dal.run('DELETE FROM demo_ai_usage');
});
afterAll(reset);

describe('starting a demo', () => {
  it('is off unless DEMO_ENABLED=true', async () => {
    delete process.env.DEMO_ENABLED;
    expect((await request(app).get('/api/demo/status')).body).toEqual({ enabled: false });
    expect((await request(app).post('/api/demo/start').send({ persona: 'lakshmi' })).status).toBe(404);
  });

  it('every persona starts in well under 2 seconds and lands on its home', async () => {
    const homes = { lakshmi: '/learn/dashboard', arjun: '/learn/welcome', placement: '/institution/home', professor: '/institution/home', recruiter: '/employer/home' };
    for (const [p, home] of Object.entries(homes)) {
      const v = await visitor(p);
      expect(v.body.home).toBe(home);
      expect(v.body.setup_ms).toBeLessThan(2000);
    }
    const ver = await visitor('verifier');
    expect(ver.body.token).toBeNull();
    expect(ver.body.home).toMatch(/^\/verify\/QBX-/);
  });

  it('a demo session is real, marked demo, and ends with its sandbox (≤ 4 hours)', async () => {
    const v = await visitor('lakshmi');
    const p = jwt.decode(v.token);
    expect(p).toMatchObject({ demo: true, role: 'learner', sandbox: v.sbx });
    expect(p.exp - p.iat).toBeLessThanOrEqual(4 * 3600);
    const s = await dal.one('SELECT is_demo, sandbox_id FROM auth_sessions WHERE id = ?', p.sid);
    expect(s).toMatchObject({ is_demo: 1, sandbox_id: v.sbx });
    expect((await request(app).get('/api/learner/profile').set(as(v))).status).toBe(200);
  });

  it('rate-limits starts per IP and caps active sandboxes', async () => {
    process.env.DEMO_STARTS_PER_HOUR = '2';
    await dal.run('DELETE FROM demo_sandboxes WHERE deleted_at IS NOT NULL OR 1 = 1');
    await visitor('lakshmi'); await visitor('lakshmi');
    expect((await request(app).post('/api/demo/start').send({ persona: 'lakshmi' })).status).toBe(429);
    process.env.DEMO_STARTS_PER_HOUR = '1000';
    process.env.DEMO_MAX_ACTIVE = '1';
    expect((await request(app).post('/api/demo/start').send({ persona: 'lakshmi' })).status).toBe(503);
  });
});

describe('isolation in every direction', () => {
  let a; let b;
  beforeAll(async () => {
    reset(); process.env.DEMO_ENABLED = 'true'; process.env.DEMO_STARTS_PER_HOUR = '1000';
    a = await visitor('recruiter'); b = await visitor('recruiter');
  });
  const role = { title: 'Frontend developer', city: 'Hyderabad', skills: [{ key: 'javascript', required: true }], bar: 50, published: true };

  it('a demo recruiter finds only its own sandbox\'s students', async () => {
    const roleA = (await request(app).post('/api/employer/roles').set(as(a)).send(role)).body.id;
    const found = (await request(app).get(`/api/employer/roles/${roleA}/candidates`).set(as(a))).body;
    expect(found.total).toBeGreaterThan(3);
    expect(new Set(found.candidates.map(c => c.college))).toEqual(new Set(['Sample Engineering College (demo)']));
    expect(found.candidates.every(c => c.ref.startsWith(`dm${a.sbx}-`))).toBe(true);
  });

  it('a real employer and a test employer never see demo students', async () => {
    await request(app).post('/api/auth/employer/register').send({ company_name: 'Real Co', name: 'Owner', email: 'owner@realco.test', password: PASSWORD }).expect(201);
    const realEmp = (await login(app, '/api/auth/employer/login', { email: 'owner@realco.test', password: PASSWORD })).token;
    const realRole = (await request(app).post('/api/employer/roles').set(bearer(realEmp)).send(role)).body.id;
    const seen = (await request(app).get(`/api/employer/roles/${realRole}/candidates`).set(bearer(realEmp))).body;
    expect(JSON.stringify(seen)).not.toMatch(/Sample Engineering|dm[a-z0-9]{10}/);
    const testEmp = (await login(app, '/api/auth/employer/login', { email: 'test.employer.verified@qubirex.local', password: 'QubirexTest2026!' })).token;
    const testRole = (await request(app).post('/api/employer/roles').set(bearer(testEmp)).send(role)).body.id;
    expect(JSON.stringify((await request(app).get(`/api/employer/roles/${testRole}/candidates`).set(bearer(testEmp))).body)).not.toMatch(/Sample Engineering/);
  });

  it('a demo learner sees only her sandbox\'s jobs; a real learner sees none of them', async () => {
    const l = await visitor('lakshmi');
    const jobs = (await request(app).get('/api/learner/jobs-hub').set(as(l))).body.roles;
    expect(jobs.length).toBeGreaterThan(0);
    expect(new Set(jobs.map(j => j.employer))).toEqual(new Set(['Sample Tech Pvt Ltd', 'Bright Analytics (sample)']));
    const r = await login(app, '/api/auth/learner/login', { learner_ref: real.learnerRef, join_code: real.joinCode, pin: PIN });
    expect(JSON.stringify((await request(app).get('/api/learner/jobs-hub').set(bearer(r.token))).body.roles)).not.toMatch(/Sample Tech|Bright Analytics/);
  });

  it('a demo employer cannot sponsor another sandbox\'s or a real college', async () => {
    expect((await request(app).post('/api/employer/sponsorships').set(as(a)).send({ institution_id: idsFor(b.sbx).institution, seats: 5 })).status).toBe(404);
    expect((await request(app).post('/api/employer/sponsorships').set(as(a)).send({ institution_id: real.institutionId, seats: 5 })).status).toBe(404);
    expect((await request(app).post('/api/employer/sponsorships').set(as(a)).send({ institution_id: idsFor(a.sbx).institution, seats: 5 })).status).toBe(201);
  });

  it('demo colleges never count in real benchmarks or real admin numbers', async () => {
    const realB = await benchmarks(real.institutionId, real.engagementId);
    expect(realB.regional.published).toBe(false);
    const admin = await login(app, '/api/auth/admin/login', { email: 'root@qubirex.test', password: PASSWORD });
    const inst = (await request(app).get('/api/admin/institutions').set(bearer(admin.token))).body;
    expect(inst.map(i => i.id)).toEqual([real.institutionId]);
    const stats = (await request(app).get('/api/admin/stats').set(bearer(admin.token))).body;
    expect(stats.institutions).toBe(1);
    const emps = (await request(app).get('/api/admin/employers').set(bearer(admin.token))).body.employers;
    expect(emps.some(e => /^dm/.test(e.id))).toBe(false);
    const demo = (await request(app).get('/api/admin/demo').set(bearer(admin.token))).body;
    expect(demo.active).toBeGreaterThan(0);
  });

  it('a demo session cannot reach /admin or /dev', async () => {
    Object.assign(process.env, { DEV_LOGIN_ENABLED: 'true', DEV_LOGIN_SECRET: 'a-test-passcode-that-is-long-enough-0123456789' });
    expect((await request(app).get('/api/admin/stats').set(as(a))).status).toBe(403);
    expect((await request(app).get('/api/dev/status').set(as(a))).status).toBe(404);
    expect((await request(app).get('/api/dev/status')).status).toBe(200);
  });
});

describe('demo Passports', () => {
  it('are signed with the demo key and issuer, flagged DEMO on Verify, and kept out of the JWKS', async () => {
    const v = await visitor('verifier');
    const id = v.body.home.split('/').pop();
    const r = (await request(app).get(`/api/verify/${id}`)).body;
    expect(r).toMatchObject({ status: 'valid', demo: true });
    expect(r.issuer).toMatch(/:demo$/);
    expect(r.key_id).toMatch(/^demo-/);
    expect(r).not.toHaveProperty('sandbox');
    const jwks = (await request(app).get('/api/verify/jwks.json')).body.keys.map(k => k.kid);
    expect(jwks).not.toContain(r.key_id);
    // A real Passport (test learner) is signed with the real key.
    const realEv = (await dal.one("SELECT evidence_id FROM credentials WHERE learner_id = 'test-learner-0001' AND active = 1"))?.evidence_id;
    if (realEv) {
      const t = (await request(app).get(`/api/verify/${realEv}`)).body;
      expect(t.demo).toBe(false);
      expect(t.key_id).not.toBe(r.key_id);
    }
  });

  it('real employers\' bulk verify refuses them; the same sandbox\'s recruiter can check them', async () => {
    const v = await visitor('recruiter');
    const ev = (await v.agent.get('/api/demo/me')).body.lakshmi_evidence_id;
    const realEmp = (await login(app, '/api/auth/employer/login', { email: 'test.employer.verified@qubirex.local', password: 'QubirexTest2026!' })).token;
    const outside = (await request(app).post('/api/employer/verify/bulk').set(bearer(realEmp)).send({ ids: [ev] })).body.results[0];
    expect(outside.status).toBe('demo_not_accepted');
    const inside = (await request(app).post('/api/employer/verify/bulk').set(as(v)).send({ ids: [ev] })).body.results[0];
    expect(inside.status).toBe('valid');
  });
});

describe('the cross-side loop, inbox and story', () => {
  it('employer requests access → Lakshmi says yes → candidate unlocked → Day-One; all messages land in the Demo inbox', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const v = await visitor('recruiter');
    const ids = idsFor(v.sbx);
    const roleId = `${ids.employer('e1')}-r1`;
    const cands = (await request(app).get(`/api/employer/roles/${roleId}/candidates`).set(as(v))).body.candidates;
    const lakshmi = cands.find(c => c.ref === ids.el('l01'));
    expect(lakshmi).toBeTruthy();
    expect((await request(app).post(`/api/employer/roles/${roleId}/candidates/${lakshmi.ref}/request`).set(as(v)).send({})).status).toBe(200);

    await v.switch('lakshmi');
    const reqs = (await request(app).get('/api/learner/jobs-hub').set(as(v))).body.requests;
    expect(reqs).toHaveLength(1);
    expect((await request(app).post(`/api/learner/requests/${reqs[0].id}/respond`).set(as(v)).send({ yes: true, items: ['skills', 'resume', 'contact'] })).status).toBe(200);

    await v.switch('recruiter');
    const pipe = (await request(app).get('/api/employer/pipeline').set(as(v))).body.rows.find(r => r.learner_id === ids.learner('l01') || r.code === lakshmi.code);
    const cand = (await request(app).get(`/api/employer/candidates/${pipe.id}`).set(as(v))).body;
    expect(cand.open).toBe(true);
    expect(cand.name).toBe('Lakshmi Prasanna');
    expect(cand.evidence_id).toMatch(/^QBX-/);
    expect((await request(app).post(`/api/employer/pipeline/${pipe.id}/stage`).set(as(v)).send({ stage: 'dayone' })).status).toBe(200);

    const inbox = (await v.agent.get('/api/demo/inbox')).body.messages;
    expect(inbox.some(m => m.channel === 'whatsapp' && /Day-One/i.test(`${m.subject} ${m.body}`))).toBe(true);
    expect(await dal.one("SELECT COUNT(*) AS n FROM outbound_messages WHERE sandbox_id = ? AND status != 'demo_inbox'", v.sbx)).toMatchObject({ n: 0 });
    expect(fetchSpy).not.toHaveBeenCalled(); // nothing left the server
    fetchSpy.mockRestore();

    expect((await v.agent.post('/api/demo/story').send({ step: 'request' })).body.story).toEqual(['request']);
    expect((await v.agent.post('/api/demo/story').send({ step: 'nope' })).status).toBe(400);
  });

  it('a college invite goes to the Demo inbox, never out', async () => {
    const v = await visitor('placement');
    const ids = idsFor(v.sbx);
    await request(app).post('/api/institution/team/invite').set(as(v)).send({ email: 'new.prof@example.com', name: 'New Prof', role: 'professor', cohort_ids: [ids.engTe] });
    const rows = await dal.all('SELECT status, sandbox_id FROM outbound_messages WHERE to_email = ?', 'new.prof@example.com');
    rows.forEach(r => expect(r).toMatchObject({ status: 'demo_inbox', sandbox_id: v.sbx }));
  });
});

describe('AI budget', () => {
  it('stops a sandbox at its limit with the demo message, and the day at the daily limit', async () => {
    process.env.DEMO_AI_PER_SANDBOX = '2';
    const v = await visitor('placement');
    // Ask Qubirex never breaks: past the limit it answers from the page's facts.
    const ask = () => request(app).post('/api/assist/ask').set(as(v)).send({ question: 'What does Partial mean?' });
    expect((await ask()).body.source).toBe('model');
    expect((await ask()).body.source).toBe('model');
    const third = await ask();
    expect(third.status).toBe(200);
    expect(third.body.source).toBe('facts');
    expect((await v.agent.get('/api/demo/me')).body.ai).toMatchObject({ calls: 2, mode: 'limit_reached' });

    process.env.DEMO_AI_PER_SANDBOX = '50'; process.env.DEMO_AI_DAILY_LIMIT = '3';
    const w = await visitor('placement');
    expect((await request(app).post('/api/assist/ask').set(as(w)).send({ question: 'What does Partial mean?' })).body.source).toBe('model');
    expect((await request(app).post('/api/assist/ask').set(as(w)).send({ question: 'What does Partial mean?' })).body.source).toBe('facts');
    // An AI route without a fallback of its own answers 503 with the demo message.
    const tts = await request(app).post('/api/learner/tts').set(as(await visitor('lakshmi'))).send({ text: 'నమస్కారం' });
    if (tts.status !== 404) { expect(tts.status).toBe(503); expect(tts.body.error).toMatch(/Demo limit reached/); }
    expect((await w.agent.get('/api/demo/me')).body.ai.mode).toBe('cached_daily');
  });
});

describe('ending', () => {
  it('Reset gives a fresh sandbox; Exit deletes it and signs out', async () => {
    const v = await visitor('lakshmi');
    const first = v.sbx;
    const r = await v.agent.post('/api/demo/reset').send({});
    expect(r.status).toBe(200);
    const second = jwt.decode(r.body.token).sandbox;
    expect(second).not.toBe(first);
    expect((await dal.one('SELECT deleted_at FROM demo_sandboxes WHERE id = ?', first)).deleted_at).toBeTruthy();
    expect((await request(app).get('/api/learner/profile').set(as(v))).status).toBe(401);
    expect((await request(app).get('/api/learner/profile').set(bearer(r.body.token))).status).toBe(200);
    expect((await v.agent.post('/api/demo/exit').send({})).status).toBe(200);
    expect((await request(app).get('/api/learner/profile').set(bearer(r.body.token))).status).toBe(401);
    expect(Number((await dal.one('SELECT COUNT(*) AS n FROM learners WHERE id LIKE ?', `dm${second}%`)).n)).toBe(0);
    expect((await v.agent.get('/api/demo/me')).status).toBe(401);
  });

  it('an idle or expired sandbox stops working and is deleted with everything in it', async () => {
    const v = await visitor('recruiter');
    await request(app).post('/api/employer/roles').set(as(v)).send({ title: 'Made by the visitor', skills: [{ key: 'sql', required: true }], bar: 60, published: true });
    await dal.run('UPDATE demo_sandboxes SET last_active_at = ? WHERE id = ?', new Date(Date.now() - 3 * 3600000).toISOString(), v.sbx);
    expect((await request(app).get('/api/employer/me').set(as(v))).status).toBe(401);
    const before = Number((await dal.one('SELECT COUNT(*) AS n FROM learners')).n);
    expect(await deleteExpired({ limit: 100 })).toBeGreaterThan(0);
    expect(Number((await dal.one('SELECT COUNT(*) AS n FROM employer_roles WHERE employer_id LIKE ?', `dm${v.sbx}%`)).n)).toBe(0);
    expect(Number((await dal.one('SELECT COUNT(*) AS n FROM credentials WHERE learner_id LIKE ?', `dm${v.sbx}%`)).n)).toBe(0);
    // Real and test rows are untouched.
    expect(await dal.one('SELECT id FROM learners WHERE id = ?', real.learnerId)).toBeTruthy();
    expect(await dal.one("SELECT id FROM learners WHERE id = 'test-learner-0001'")).toBeTruthy();
    expect(Number((await dal.one('SELECT COUNT(*) AS n FROM learners')).n)).toBeLessThan(before);
  });
});
