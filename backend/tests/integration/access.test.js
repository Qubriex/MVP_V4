// The roster's PIN-reset flow on an append-only access_events log.
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import * as dal from '../../core/db/dal.js';
import { freshDb, makeApp, seedInstitution, login, PASSWORD, PIN } from '../helpers/setup.js';

let app;
let A;
beforeAll(async () => {
  await freshDb();
  app = await makeApp();
  A = seedInstitution('a');
});

describe('PIN reset request → staff reset', () => {
  it('the request shows on the roster until staff reset the PIN, with no UPDATE to the log', async () => {
    await request(app).post('/api/auth/learner/pin-reset-request').send({ learner_ref: A.learnerRef, join_code: A.joinCode }).expect(200);
    // A second request while one is open is not duplicated.
    await request(app).post('/api/auth/learner/pin-reset-request').send({ learner_ref: A.learnerRef, join_code: A.joinCode }).expect(200);
    expect(dal.one("SELECT COUNT(*) n FROM access_events WHERE event = 'pin_reset_requested'").n).toBe(1);

    const { agent, csrf } = await login(app, '/api/auth/institution/login', { email: A.adminEmail, password: PASSWORD });
    const before = await agent.get('/api/institution/students').expect(200);
    const row = before.body.rows.find(s => s.learner_ref === A.learnerRef);
    expect(row.reset_requested).toBeTruthy();

    await agent.post('/api/institution/students/actions').set('X-CSRF-Token', csrf)
      .send({ action: 'reset_pin', el_ids: [A.elId] }).expect(200);
    const after = await agent.get('/api/institution/students').expect(200);
    expect(after.body.rows.find(s => s.learner_ref === A.learnerRef).reset_requested).toBeFalsy();
    const events = dal.all("SELECT event FROM access_events WHERE engagement_learner_id = ? ORDER BY created_at, id", A.elId).map(r => r.event);
    expect(events).toEqual(expect.arrayContaining(['pin_reset_requested', 'pin_reset_resolved']));
  });
});

describe('learner PIN lock with delayed unlock (v4.3 §22)', () => {
  it('five wrong PINs lock the enrolment; after 30 minutes it unlocks by itself', async () => {
    const bad = { learner_ref: A.learnerRef, join_code: A.joinCode, pin: '000000' };
    dal.run("UPDATE learners SET pin_hash = ? WHERE id = ?", (await import('bcryptjs')).default.hashSync(PIN, 4), A.learnerId);
    for (let i = 0; i < 4; i += 1) await request(app).post('/api/auth/learner/login').send(bad).expect(401);
    const locked = await request(app).post('/api/auth/learner/login').send(bad).expect(423);
    expect(locked.body.error).toMatch(/30 minutes/);
    await request(app).post('/api/auth/learner/login').send({ ...bad, pin: PIN }).expect(423);
    dal.run("UPDATE engagement_learners SET locked_at = ? WHERE id = ?", new Date(Date.now() - 31 * 60000).toISOString(), A.elId);
    await request(app).post('/api/auth/learner/login').send({ ...bad, pin: PIN }).expect(200);
    expect(dal.one("SELECT event FROM access_events WHERE engagement_learner_id = ? AND event = 'unlocked'", A.elId)).toBeTruthy();
  });
});
