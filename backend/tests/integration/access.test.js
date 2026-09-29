// The roster's PIN-reset flow on an append-only access_events log.
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import * as dal from '../../core/db/dal.js';
import { freshDb, makeApp, seedInstitution, login, PASSWORD } from '../helpers/setup.js';

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
