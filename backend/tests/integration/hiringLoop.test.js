// Hiring loop (v4.3 canvas L5, L8, E1–E7, E10): roles from a JD, anonymous
// search of students who opted in, request → yes per item → evidence,
// pipeline stages reaching the college's Placements, bulk verify, colleges.
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import * as dal from '../../core/db/dal.js';
import { freshDb, makeApp, seedInstitution, seedPathway, seedAdmin, login, PIN, PASSWORD } from '../helpers/setup.js';

let app; let A; let P; let owner; let learner; let staff; let roleId; let employerId;
const auth = (s) => ({ Authorization: `Bearer ${s.token}` });
const emp = (s) => ({ 'X-CSRF-Token': s.csrf });

beforeAll(async () => {
  await freshDb();
  app = await makeApp();
  A = await seedInstitution('hl');
  P = await seedPathway(A);
  await dal.run('INSERT INTO node_mastery (id, engagement_learner_id, skill_node_id, mastery_attainment, advanced_at) VALUES (?, ?, ?, 0.8, ?)', 'nm-hl', A.elId, P.nodes[0], dal.nowIso());
  await seedAdmin();
  await request(app).post('/api/auth/employer/register').send({ company_name: 'Acme Analytics', name: 'Owner', email: 'owner@acme.test', password: PASSWORD }).expect(201);
  owner = await login(app, '/api/auth/employer/login', { email: 'owner@acme.test', password: PASSWORD });
  employerId = (await dal.one("SELECT employer_id FROM employer_users WHERE email = 'owner@acme.test'")).employer_id;
  learner = await login(app, '/api/auth/learner/login', { learner_ref: A.learnerRef, join_code: A.joinCode, pin: PIN });
  staff = await login(app, '/api/auth/institution/login', { email: A.adminEmail, password: PASSWORD });
});

describe('roles from a job description (E2)', () => {
  it('finds skills, marks "nice to have" as optional, and shows market share', async () => {
    const r = await owner.agent.post('/api/employer/roles/parse').set(emp(owner)).send({ jd_text: 'Data analyst\nMust know SQL and Excel\nNice to have: Python' });
    expect(r.status).toBe(200);
    const sql = r.body.skills.find(s => s.key === 'sql');
    expect(sql).toMatchObject({ required: true, market_share: 48 });
    expect(r.body.skills.find(s => s.key === 'python')?.required).toBe(false);
  });

  it('creates a published role with an interview promise', async () => {
    const r = await owner.agent.post('/api/employer/roles').set(emp(owner)).send({ title: 'Data analyst', city: 'Hyderabad', skills: [{ key: 'sql', required: true }, { key: 'python', required: false }], bar: 60, published: true, interview_promise: true });
    expect(r.status).toBe(201);
    roleId = r.body.id;
  });
});

describe('search and consent (E3, L5)', () => {
  it('shows nobody until a student turns on "Let employers find me"', async () => {
    let r = await owner.agent.get(`/api/employer/roles/${roleId}/candidates`).set(emp(owner));
    expect(r.body.total).toBe(0);
    await learner.agent.put('/api/learner/discoverable').set(auth(learner)).send({ on: true, city: 'Hyderabad' });
    r = await owner.agent.get(`/api/employer/roles/${roleId}/candidates`).set(emp(owner));
    expect(r.body.total).toBe(1);
    const c = r.body.candidates[0];
    expect(c.code).toMatch(/^C-[0-9A-F]{6}$/);
    expect(c).not.toHaveProperty('name');
    expect(r.body.colleges[0]).toMatchObject({ too_few: true });
  });

  it('only verified companies can request; anyone can watch', async () => {
    const ref = (await owner.agent.get(`/api/employer/roles/${roleId}/candidates`).set(emp(owner))).body.candidates[0].ref;
    expect((await owner.agent.post(`/api/employer/roles/${roleId}/candidates/${ref}/request`).set(emp(owner)).send({})).status).toBe(403);
    expect((await owner.agent.post(`/api/employer/roles/${roleId}/candidates/${ref}/watch`).set(emp(owner)).send({})).status).toBe(200);
    await dal.run("UPDATE employers SET kyb_status = 'verified' WHERE id = ?", employerId);
    const r = await owner.agent.post(`/api/employer/roles/${roleId}/candidates/${ref}/request`).set(emp(owner)).send({ items: ['skills', 'contact'] });
    expect(r.status).toBe(200);
  });

  it('the student sees the request and says yes to skills only; the employer then sees the name and evidence, not contact', async () => {
    const hub = await learner.agent.get('/api/learner/jobs-hub').set(auth(learner));
    expect(hub.body.requests[0]).toMatchObject({ employer: 'Acme Analytics', stage: 'requested', interview_promised: true, asked: ['skills', 'contact'] });
    expect(hub.body.roles[0]).toMatchObject({ title: 'Data analyst', interview_promise: true, stage: 'requested' });
    const pid = hub.body.requests[0].id;
    expect((await learner.agent.post(`/api/learner/requests/${pid}/respond`).set(auth(learner)).send({ yes: true, items: [] })).status).toBe(400);
    await learner.agent.post(`/api/learner/requests/${pid}/respond`).set(auth(learner)).send({ yes: true, items: ['skills', 'resume'] }).expect(200);
    const c = await owner.agent.get(`/api/employer/candidates/${pid}`).set(emp(owner));
    expect(c.body).toMatchObject({ name: 'Learner', stage: 'access_granted', shared: ['skills'], contact: null });
    expect(await dal.one('SELECT level FROM consents WHERE learner_id = ? AND level = 4 AND withdrawn_at IS NULL', A.learnerId)).toBeTruthy();
    const home = await owner.agent.get('/api/employer/home').set(emp(owner));
    expect(home.body.waiting).toBe(1);
  });
});

describe('pipeline (E6) and placements (I9)', () => {
  let pid;
  it('moves to offer, which appears on the college Placements page', async () => {
    const p = await owner.agent.get('/api/employer/pipeline').set(emp(owner));
    pid = p.body.rows[0].id;
    await owner.agent.post(`/api/employer/pipeline/${pid}/stage`).set(emp(owner)).send({ stage: 'interview' }).expect(200);
    await owner.agent.post(`/api/employer/pipeline/${pid}/stage`).set(emp(owner)).send({ stage: 'offer' }).expect(200);
    const pl = await staff.agent.get('/api/institution/placements').set(auth(staff));
    expect(pl.body.rows[0]).toMatchObject({ employer_name: 'Acme Analytics', status: 'offer', source: 'employer' });
    const csv = await owner.agent.get('/api/employer/pipeline.csv').set(emp(owner));
    expect(csv.text.split('\n')[1]).toMatch(/Learner/);
  });

  it('withdrawing ends access at once', async () => {
    await learner.agent.post(`/api/learner/requests/${pid}/withdraw`).set(auth(learner)).expect(200);
    const c = await owner.agent.get(`/api/employer/candidates/${pid}`).set(emp(owner));
    expect(c.body.name).toBeUndefined();
    expect(c.body.open).toBe(false);
  });
});

describe('applications, sponsorship, colleges, bulk verify', () => {
  it('a student applies to and withdraws from a job post', async () => {
    await learner.agent.post('/api/learner/posts/job-001/apply').set(auth(learner)).expect(200);
    let hub = await learner.agent.get('/api/learner/jobs-hub').set(auth(learner));
    expect(hub.body.applications[0]).toMatchObject({ id: 'job-001', status: 'applied' });
    await learner.agent.post('/api/learner/posts/job-001/withdraw').set(auth(learner)).expect(200);
    hub = await learner.agent.get('/api/learner/jobs-hub').set(auth(learner));
    expect(hub.body.applications[0].status).toBe('withdrawn');
  });

  it('sponsors a cohort; the college admin accepts', async () => {
    const s = await owner.agent.post('/api/employer/sponsorships').set(emp(owner)).send({ institution_id: A.institutionId, role_id: roleId, seats: 20 });
    expect(s.status).toBe(201);
    const list = await staff.agent.get('/api/institution/sponsorships').set(auth(staff));
    expect(list.body[0]).toMatchObject({ employer: 'Acme Analytics', seats: 20, status: 'proposed' });
    await staff.agent.post(`/api/institution/sponsorships/${s.body.id}/decide`).set(auth(staff)).send({ accept: true, engagement_id: A.engagementId }).expect(200);
    expect((await owner.agent.get('/api/employer/sponsorships').set(emp(owner))).body[0].status).toBe('accepted');
  });

  it('colleges with fewer than 5 students show "too few"', async () => {
    const r = await owner.agent.get('/api/employer/colleges').set(emp(owner));
    expect(r.body.colleges[0]).toMatchObject({ too_few: true });
    expect(r.body.skills).toEqual([]);
  });

  it('bulk verify reports each ID', async () => {
    const r = await owner.agent.post('/api/employer/verify/bulk').set(emp(owner)).send({ ids: ['nope', 'QBX-AAAAAAAAAAAA'] });
    expect(r.status).toBe(200);
    expect(r.body.results.map(x => x.status)).toEqual(['malformed', expect.any(String)]);
  });
});
