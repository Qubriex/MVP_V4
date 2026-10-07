// College loop (v4.3 canvas I1, I3, I5, I8, I9): command centre, MoU target,
// cohort grid, why-not-ready, bridge programmes with "Did it work?", placements.
import { describe, it, expect, beforeAll } from 'vitest';
import * as dal from '../../core/db/dal.js';
import { freshDb, makeApp, seedInstitution, seedPathway, login, PIN, PASSWORD } from '../helpers/setup.js';
import { dropReadinessCache } from '../../core/readiness/cohort.js';

let app; let A; let P; let staff; let prof; let learner;
const auth = (s) => ({ Authorization: `Bearer ${s.token}` });
const ago = (min) => new Date(Date.now() - min * 60000).toISOString();

beforeAll(async () => {
  await freshDb();
  app = await makeApp();
  A = await seedInstitution('cl');
  P = await seedPathway(A);
  await dal.run(`INSERT INTO learners (id, institution_id, name, learner_ref, language) VALUES ('learner-cl2', ?, 'Quiet One', 'REF-cl2', 'telugu')`, A.institutionId);
  await dal.run(`INSERT INTO engagement_learners (id, engagement_id, learner_id) VALUES ('el-cl2', ?, 'learner-cl2')`, A.engagementId);
  await dal.run(`INSERT INTO learning_sessions (id, engagement_learner_id, skill_node_id, language, status, started_at, loop_count, last_heartbeat_at) VALUES ('s-cl', ?, ?, 'telugu', 'active', ?, 1, ?)`, A.elId, P.nodes[0], ago(10), ago(2));
  staff = await login(app, '/api/auth/institution/login', { email: A.adminEmail, password: PASSWORD });
  prof = await login(app, '/api/auth/institution/login', { email: A.profEmail, password: PASSWORD });
  learner = await login(app, '/api/auth/learner/login', { learner_ref: A.learnerRef, join_code: A.joinCode, pin: PIN });
});

describe('command centre (I1)', () => {
  it('shows action cards with Why this?, a setup checklist and AI time', async () => {
    const r = await staff.agent.get('/api/institution/command-centre').set(auth(staff));
    expect(r.status).toBe(200);
    const quiet = r.body.cards.find(c => c.kind === 'quiet');
    expect(quiet.count).toBe(1);
    expect(quiet.why).toMatch(/3 days/);
    expect(r.body.setup.map(s => [s.key, s.done])).toEqual([['target', true], ['students', true], ['lesson', true]]);
    expect(r.body.ai_time).toHaveProperty('minutes');
    expect(r.body.readiness.total).toBe(2);
  });

  it('admins set the MoU target; professors cannot', async () => {
    expect((await prof.agent.put('/api/institution/settings/mou-target').set(auth(prof)).send({ pct: 70 })).status).toBe(403);
    await staff.agent.put('/api/institution/settings/mou-target').set(auth(staff)).send({ pct: 70, label: 'Placed by June', date: '2027-06-30' });
    const r = await staff.agent.get('/api/institution/command-centre').set(auth(staff));
    expect(r.body.scoreboard).toMatchObject({ target_pct: 70, label: 'Placed by June', due: '2027-06-30', placed: 0, total: 2 });
  });
});

describe('cohort grid and why not ready (I3)', () => {
  it('lists students × clusters with readiness and the live light; CSV is logged', async () => {
    const r = await prof.agent.get(`/api/institution/engagements/${A.engagementId}/grid`).set(auth(prof));
    expect(r.body.clusters.map(c => c.label)).toEqual(['SQL', 'Python']);
    expect(r.body.students).toHaveLength(2);
    expect(r.body.students.find(s => s.el_id === A.elId).light).toBe('yellow'); // learning now, 1 loop
    const csv = await prof.agent.get(`/api/institution/engagements/${A.engagementId}/grid.csv`).set(auth(prof));
    expect(csv.text.split('\n')[0]).toMatch(/learner_reference,learner_name,readiness,band,best_role,last_active_at,SQL/);
    expect((await dal.all("SELECT 1 FROM access_events WHERE event = 'data_exported' AND detail LIKE 'Cohort grid%'")).length).toBe(2);
  });

  it('explains why a student is not ready, in plain words', async () => {
    const r = await prof.agent.get(`/api/institution/engagements/${A.engagementId}/students/el-cl2/why`).set(auth(prof));
    expect(r.status).toBe(200);
    expect(r.body.band_label).toBe('Building');
    expect(r.body.reasons.join(' ')).toMatch(/not started|Inactive|early/);
  });
});

describe('bridge programmes (I8)', () => {
  let bridgeId;
  it('assigns extra work to chosen students; they see it under Today and can start it', async () => {
    const r = await prof.agent.post('/api/institution/bridges').set(auth(prof)).send({ engagement_id: A.engagementId, node_ids: [P.nodes[1]], scope: 'students', el_ids: [A.elId], retest_at: '2020-01-01' });
    expect(r.status).toBe(201);
    bridgeId = r.body.id;
    const mine = await learner.agent.get('/api/learner/bridges').set(auth(learner));
    expect(mine.body).toHaveLength(1);
    expect(mine.body[0].skills).toEqual([{ id: P.nodes[1], label: 'Joins', mastered: false }]);
    const start = await learner.agent.post('/api/learner/path/node').set(auth(learner)).send({ node_id: P.nodes[1] });
    expect(start.status).toBe(200);
    const notes = await learner.agent.get('/api/notifications').set(auth(learner));
    expect(notes.body.items.some(n => n.kind === 'bridge')).toBe(true);
  });

  it('"Did it work?" compares before and after', async () => {
    let r = await staff.agent.get(`/api/institution/bridges/${bridgeId}`).set(auth(staff));
    expect(r.body.result).toMatchObject({ assigned: 1, completed: 0 });
    expect(r.body.result.verdict).toMatch(/Not yet/);
    await dal.run('INSERT INTO node_mastery (id, engagement_learner_id, skill_node_id, mastery_attainment, advanced_at) VALUES (?, ?, ?, 0.8, ?)', 'nm-cl', A.elId, P.nodes[1], dal.nowIso());
    dropReadinessCache();
    r = await staff.agent.get(`/api/institution/bridges/${bridgeId}`).set(auth(staff));
    expect(r.body.students[0].newly_mastered).toEqual(['Joins']);
    expect(r.body.result.verdict).toMatch(/It worked: 1 of 1/);
    const list = await staff.agent.get('/api/institution/bridges').set(auth(staff));
    expect(list.body[0]).toMatchObject({ skills: ['Joins'], students: 1, status: 'open' });
  });

  it('refuses skills outside the cohort pathway', async () => {
    const r = await prof.agent.post('/api/institution/bridges').set(auth(prof)).send({ engagement_id: A.engagementId, node_ids: ['nope'], scope: 'cohort' });
    expect(r.status).toBe(400);
  });
});

describe('placements (I9) and Mastery Logs to students (I5)', () => {
  it('records offers and placements, a 90-day rating, and summarises salary bands', async () => {
    const a = await staff.agent.post('/api/institution/placements').set(auth(staff)).send({ el_id: A.elId, employer_name: 'Acme', role_title: 'Data analyst', status: 'placed', salary_lpa: 4.5, offer_date: '2026-09-01' });
    expect(a.status).toBe(201);
    await staff.agent.post('/api/institution/placements').set(auth(staff)).send({ el_id: 'el-cl2', employer_name: 'Beta', status: 'offer', salary_lpa: 9 });
    await staff.agent.put(`/api/institution/placements/${a.body.id}`).set(auth(staff)).send({ rating_90d: 4, rating_note: 'Strong start' });
    const r = await staff.agent.get('/api/institution/placements').set(auth(staff));
    expect(r.body.summary).toMatchObject({ placed: 1, offers: 2, rated_90d: 1, avg_rating_90d: 4 });
    expect(r.body.summary.salary_bands.find(b => b.label === '3–5 LPA').count).toBe(1);
    expect(r.body.summary.salary_bands.find(b => b.label === '8 LPA and above').count).toBe(1);
  });

  it('sends Mastery Logs to students as notifications', async () => {
    await staff.agent.post(`/api/institution/engagements/${A.engagementId}/produce-mastery-logs`).set(auth(staff)).send({});
    const r = await staff.agent.post(`/api/institution/engagements/${A.engagementId}/mastery-logs/send`).set(auth(staff)).send({});
    expect(r.body.sent).toBe(2);
    const notes = await learner.agent.get('/api/notifications').set(auth(learner));
    expect(notes.body.items.some(n => n.kind === 'mastery_log')).toBe(true);
  });

  it('the board report summarises cohorts and placements', async () => {
    const r = await staff.agent.get('/api/institution/board-report').set(auth(staff));
    expect(r.body.cohorts[0]).toMatchObject({ cohort: 'Cohort', students: 2 });
    expect(r.body.placements.placed).toBe(1);
  });
});
