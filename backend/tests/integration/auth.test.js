// Auth for all four actor types, cookie sessions + CSRF, logout, lockout and
// tenancy scoping (spec §5 Foundation, §9, §10).
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import * as dal from '../../core/db/dal.js';
import { freshDb, makeApp, seedInstitution, seedAdmin, login, PASSWORD, PIN } from '../helpers/setup.js';
import { resetRateLimits } from '../../api/middleware/rateLimit.js';

let app;
let A;
let B;
beforeAll(async () => {
  await freshDb();
  app = await makeApp();
  A = seedInstitution('a');
  B = seedInstitution('b');
  seedAdmin();
});
beforeEach(() => resetRateLimits());

const cookieOf = (res, name) => (res.headers['set-cookie'] || []).find(c => c.startsWith(`${name}=`));

describe('staff', () => {
  it('logs in with an httpOnly SameSite=Strict session cookie and a readable CSRF cookie', async () => {
    const { res } = await login(app, '/api/auth/institution/login', { email: A.adminEmail, password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.csrf_token).toBeTruthy();
    expect(cookieOf(res, 'qbx_session')).toMatch(/HttpOnly/i);
    expect(cookieOf(res, 'qbx_session')).toMatch(/SameSite=Strict/i);
    expect(cookieOf(res, 'qbx_csrf')).not.toMatch(/HttpOnly/i);
  });

  it('cookie requests read without CSRF, but state changes need the X-CSRF-Token header', async () => {
    const { agent, csrf } = await login(app, '/api/auth/institution/login', { email: A.adminEmail, password: PASSWORD });
    await agent.get('/api/institution/me').expect(200);
    const denied = await agent.put('/api/institution/me').send({ name: 'X' });
    expect(denied.status).toBe(403);
    await agent.put('/api/institution/me').set('X-CSRF-Token', 'wrong').send({ name: 'X' }).expect(403);
    const ok = await agent.put('/api/institution/me').set('X-CSRF-Token', csrf).send({ name: 'Admin A' });
    expect(ok.status).not.toBe(403);
  });

  it('Bearer tokens still work for the current frontend, without CSRF', async () => {
    const { token } = await login(app, '/api/auth/institution/login', { email: A.adminEmail, password: PASSWORD });
    await request(app).get('/api/institution/me').set('Authorization', `Bearer ${token}`).expect(200);
  });

  it('the cookieOnlyAuth flag turns Bearer tokens off', async () => {
    const { token } = await login(app, '/api/auth/institution/login', { email: A.adminEmail, password: PASSWORD });
    process.env.FEATURE_COOKIE_ONLY_AUTH = '1';
    try {
      await request(app).get('/api/institution/me').set('Authorization', `Bearer ${token}`).expect(401);
    } finally {
      delete process.env.FEATURE_COOKIE_ONLY_AUTH;
    }
  });

  it('logout revokes the session for cookie and Bearer alike', async () => {
    const { agent, csrf, token } = await login(app, '/api/auth/institution/login', { email: A.adminEmail, password: PASSWORD });
    await agent.post('/api/auth/logout').expect(403); // CSRF
    await agent.post('/api/auth/logout').set('X-CSRF-Token', csrf).expect(200);
    await agent.get('/api/institution/me').expect(401);
    await request(app).get('/api/institution/me').set('Authorization', `Bearer ${token}`).expect(401);
  });

  it('tokens that do not name a live session are refused (no pre-v4.3.1 tokens)', async () => {
    const old = jwt.sign({ id: A.institutionId, staff_id: 'staff-admin-a', role: 'institution' }, process.env.JWT_SECRET);
    await request(app).get('/api/institution/me').set('Authorization', `Bearer ${old}`).expect(401);
    const forged = jwt.sign({ id: A.institutionId, staff_id: 'staff-admin-a', role: 'institution', sid: 'nope' }, process.env.JWT_SECRET);
    await request(app).get('/api/institution/me').set('Authorization', `Bearer ${forged}`).expect(401);
  });

  it('refreshes the CSRF token on request', async () => {
    const { agent, csrf } = await login(app, '/api/auth/institution/login', { email: A.adminEmail, password: PASSWORD });
    const r = await agent.get('/api/auth/csrf').expect(200);
    expect(r.body.csrf_token).not.toBe(csrf);
    await agent.post('/api/auth/logout').set('X-CSRF-Token', csrf).expect(403);
    await agent.post('/api/auth/logout').set('X-CSRF-Token', r.body.csrf_token).expect(200);
  });
});

describe('lockout: 5 failures in 15 minutes, per account and per IP', () => {
  afterEach(() => dal.run('DELETE FROM login_failures'));

  it('locks the account, even against the right password', async () => {
    for (let i = 0; i < 5; i += 1) {
      await request(app).post('/api/auth/institution/login').send({ email: A.profEmail, password: 'wrong-password' }).expect(401);
    }
    const r = await request(app).post('/api/auth/institution/login').send({ email: A.profEmail, password: PASSWORD });
    expect(r.status).toBe(429);
  });

  it('locks the IP across accounts', async () => {
    for (let i = 0; i < 5; i += 1) {
      await request(app).post('/api/auth/admin/login').send({ email: `nobody${i}@x.test`, password: 'wrong-password' }).expect(401);
    }
    await request(app).post('/api/auth/institution/login').send({ email: B.adminEmail, password: PASSWORD }).expect(429);
  });

  it('a success clears the account counter', async () => {
    for (let i = 0; i < 4; i += 1) await request(app).post('/api/auth/employer/login').send({ email: 'no@x.test', password: 'x' });
    dal.run('DELETE FROM login_failures'); // isolate the account rule from the IP rule
    for (let i = 0; i < 4; i += 1) await request(app).post('/api/auth/institution/login').send({ email: B.profEmail, password: 'wrong-password' });
    await request(app).post('/api/auth/institution/login').send({ email: B.profEmail, password: PASSWORD }).expect(200);
    expect(dal.one("SELECT COUNT(*) n FROM login_failures WHERE account_key = ?", B.profEmail).n).toBe(0);
  });

  it('passwords must be at least 10 characters', async () => {
    const r = await request(app).post('/api/auth/institution/register').send({ name: 'N', contact_email: 'n@n.test', password: 'short' });
    expect(r.status).toBe(400);
  });
});

describe('learner', () => {
  it('logs in with join code + PIN and can read their own record', async () => {
    const { agent, res } = await login(app, '/api/auth/learner/login', { learner_ref: A.learnerRef, join_code: A.joinCode, pin: PIN });
    expect(res.status).toBe(200);
    await agent.get('/api/learner/mastery-record').expect(200);
  });

  it('is signed out at once when access is removed', async () => {
    const { agent } = await login(app, '/api/auth/learner/login', { learner_ref: B.learnerRef, join_code: B.joinCode, pin: PIN });
    await agent.get('/api/learner/mastery-record').expect(200);
    dal.run("UPDATE engagement_learners SET access_status = 'removed' WHERE id = ?", B.elId);
    await agent.get('/api/learner/mastery-record').expect(401);
    dal.run("UPDATE engagement_learners SET access_status = 'active' WHERE id = ?", B.elId);
  });

  it('cannot reach staff, employer or admin routes', async () => {
    const { agent } = await login(app, '/api/auth/learner/login', { learner_ref: A.learnerRef, join_code: A.joinCode, pin: PIN });
    await agent.get('/api/institution/me').expect(403);
    await agent.get('/api/employer/me').expect(403);
    await agent.get('/api/admin/stats').expect(403);
  });
});

describe('employer', () => {
  let employer;
  it('registers with KYB pending and emits EMPLOYER_REGISTERED in the same transaction', async () => {
    const r = await request(app).post('/api/auth/employer/register')
      .send({ company_name: '[Company name]', name: 'Hiring Lead', email: 'lead@company.test', password: PASSWORD });
    expect(r.status).toBe(201);
    expect(r.body.employer).toMatchObject({ kyb_status: 'pending', domain: 'company.test' });
    employer = r.body.employer;
    expect(dal.one("SELECT type FROM domain_events WHERE aggregate_type = 'employer' AND aggregate_id = ?", employer.id).type).toBe('EMPLOYER_REGISTERED');
  });

  it('answers errors as {error: {code, message}}', async () => {
    const weak = await request(app).post('/api/auth/employer/register').send({ company_name: 'C', name: 'N', email: 'n@c.test', password: 'short' });
    expect(weak.status).toBe(400);
    expect(weak.body.error).toMatchObject({ code: 'weak_password' });
    const dup = await request(app).post('/api/auth/employer/register').send({ company_name: 'C', name: 'N', email: 'lead@company.test', password: PASSWORD });
    expect(dup.status).toBe(409);
    await request(app).get('/api/employer/me').expect(401).then(r => expect(r.body.error.code).toBe('unauthenticated'));
  });

  it('logs in and sees only its own account', async () => {
    const { agent, res } = await login(app, '/api/auth/employer/login', { email: 'lead@company.test', password: PASSWORD });
    expect(res.status).toBe(200);
    const me = await agent.get('/api/employer/me').expect(200);
    expect(me.body.employer.id).toBe(employer.id);
    expect(me.body.user.role).toBe('owner');
    expect(JSON.stringify(me.body)).not.toMatch(/password/);
  });

  it('cannot reach institution, learner or admin routes', async () => {
    const { agent } = await login(app, '/api/auth/employer/login', { email: 'lead@company.test', password: PASSWORD });
    await agent.get('/api/institution/me').expect(403);
    await agent.get('/api/learner/mastery-record').expect(403);
    await agent.get('/api/admin/stats').expect(403);
  });

  it('a suspended company is locked out immediately', async () => {
    const { agent } = await login(app, '/api/auth/employer/login', { email: 'lead@company.test', password: PASSWORD });
    dal.run("UPDATE employers SET kyb_status = 'suspended' WHERE id = ?", employer.id);
    await agent.get('/api/employer/me').expect(403);
    dal.run("UPDATE employers SET kyb_status = 'pending' WHERE id = ?", employer.id);
  });
});

describe('admin', () => {
  it('logs in and reaches admin routes; other actors cannot', async () => {
    const { agent, res } = await login(app, '/api/auth/admin/login', { email: 'root@qubirex.test', password: PASSWORD });
    expect(res.status).toBe(200);
    await agent.get('/api/admin/stats').expect(200);
    await agent.get('/api/employer/me').expect(403);
    const staff = await login(app, '/api/auth/institution/login', { email: A.adminEmail, password: PASSWORD });
    await staff.agent.get('/api/admin/stats').expect(403);
  });
});

describe('tenancy scoping', () => {
  it('staff of institution A never see institution B cohorts or students', async () => {
    const { agent } = await login(app, '/api/auth/institution/login', { email: A.adminEmail, password: PASSWORD });
    await agent.get(`/api/institution/engagements/${B.engagementId}`).expect(404);
    const roster = await agent.get('/api/institution/students').expect(200);
    const ids = JSON.stringify(roster.body);
    expect(ids).toContain(A.learnerRef);
    expect(ids).not.toContain(B.learnerRef);
    await agent.get(`/api/institution/students/${B.elId}`).expect(404);
  });

  it('a professor sees only their own cohorts', async () => {
    dal.run("INSERT INTO engagements (id, institution_id, capability_target_id, title, language, join_code) VALUES ('eng-a2', 'inst-a', 'ct-a', 'Other', 'telugu', 'QX-OTH-A22')");
    const { agent } = await login(app, '/api/auth/institution/login', { email: A.profEmail, password: PASSWORD });
    await agent.get(`/api/institution/engagements/${A.engagementId}`).expect(200);
    await agent.get('/api/institution/engagements/eng-a2').expect(404);
  });

  it('every session carries its tenant', () => {
    const rows = dal.all('SELECT actor_type, institution_id, employer_id FROM auth_sessions');
    for (const r of rows) {
      if (r.actor_type === 'staff' || r.actor_type === 'learner') expect(r.institution_id).toBeTruthy();
      if (r.actor_type === 'employer') expect(r.employer_id).toBeTruthy();
    }
  });
});

describe('password change', () => {
  it('signs out the other sessions of that staff member, keeps the current one', async () => {
    const other = await login(app, '/api/auth/institution/login', { email: B.adminEmail, password: PASSWORD });
    const current = await login(app, '/api/auth/institution/login', { email: B.adminEmail, password: PASSWORD });
    await current.agent.put('/api/institution/me/password').set('X-CSRF-Token', current.csrf)
      .send({ current_password: PASSWORD, new_password: 'short' }).expect(400);
    await current.agent.put('/api/institution/me/password').set('X-CSRF-Token', current.csrf)
      .send({ current_password: PASSWORD, new_password: 'AnotherGood42!' }).expect(200);
    await other.agent.get('/api/institution/me').expect(401);
    await current.agent.get('/api/institution/me').expect(200);
  });
});
