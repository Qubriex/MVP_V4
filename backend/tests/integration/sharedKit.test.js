// Shared kit (v4.3 canvas): notifications, Ask Qubirex, help, status, glossary.
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import * as dal from '../../core/db/dal.js';
import { freshDb, makeApp, seedInstitution, seedPathway, login, PIN, PASSWORD } from '../helpers/setup.js';
import { setResponder } from '../../core/ai/adapters/mock.js';

let app; let A; let learner; let staff; let restore = () => {};
afterEach(() => restore());
const auth = (s) => ({ Authorization: `Bearer ${s.token}` });

beforeAll(async () => {
  await freshDb();
  app = await makeApp();
  A = await seedInstitution('sk');
  await seedPathway(A);
  learner = await login(app, '/api/auth/learner/login', { learner_ref: A.learnerRef, join_code: A.joinCode, pin: PIN });
  staff = await login(app, '/api/auth/institution/login', { email: A.adminEmail, password: PASSWORD });
});

describe('notifications', () => {
  it('a skill request notifies the institution once; mark all read clears the unread count', async () => {
    await learner.agent.post('/api/learner/skill-requests').set(auth(learner)).send({ skill_name: 'TypeScript', source: 'dashboard' });
    await learner.agent.post('/api/learner/skill-requests').set(auth(learner)).send({ skill_name: 'TypeScript', source: 'dashboard' });
    const r = await staff.agent.get('/api/notifications').set(auth(staff));
    expect(r.status).toBe(200);
    const asks = r.body.items.filter(n => n.kind === 'skill_request');
    expect(asks).toHaveLength(1);
    expect(asks[0].title).toMatch(/asked to add TypeScript/);
    expect(r.body.unread).toBeGreaterThan(0);
    await staff.agent.post('/api/notifications/read-all').set(auth(staff));
    expect((await staff.agent.get('/api/notifications').set(auth(staff))).body.unread).toBe(0);
  });

  it('learners see reviews that are due as a live notification; channels are saved', async () => {
    await dal.run('INSERT INTO node_retention (el_id, node_id, interval_days, due_at, updated_at) VALUES (?, ?, 3, ?, ?)', A.elId, `ct-sk-n1`, new Date(Date.now() - 3600000).toISOString(), dal.nowIso());
    const r = await learner.agent.get('/api/notifications').set(auth(learner));
    expect(r.body.items.find(n => n.kind === 'reviews_due')?.title).toMatch(/1 short review due/);
    const c = await learner.agent.put('/api/notifications/channels').set(auth(learner)).send({ email: true, whatsapp: true });
    expect(c.body.channels).toEqual({ email: true, whatsapp: true, sms: false });
    expect((await learner.agent.get('/api/notifications').set(auth(learner))).body.channels.whatsapp).toBe(true);
  });

  it('needs sign-in', async () => {
    expect((await request(app).get('/api/notifications')).status).toBe(401);
  });
});

describe('Ask Qubirex', () => {
  it('answers a learner from their own facts and only links to allowed pages', async () => {
    let seen = '';
    restore = setResponder((req) => { seen = req.system; return JSON.stringify({ answer: 'Next: Joins.', links: [{ label: 'Go', href: '/learn/session' }, { label: 'Bad', href: 'https://evil.example' }] }); });
    const r = await learner.agent.post('/api/assist/ask').set(auth(learner)).send({ question: 'What should I learn next?', lang: 'te' });
    expect(r.status).toBe(200);
    expect(r.body.answer).toBe('Next: Joins.');
    expect(r.body.links.map(l => l.href)).toEqual(['/learn/session']);
    expect(seen).toMatch(/Answer in Telugu/);
    expect(seen).toMatch(/skills_mastered/);
    expect(seen).not.toMatch(/cohorts/);
  });

  it('answers staff about their cohorts, and falls back to the facts when the model fails', async () => {
    restore = setResponder(() => 'not json');
    const r = await staff.agent.post('/api/assist/ask').set(auth(staff)).send({ question: 'Who is nearly ready?' });
    expect(r.status).toBe(200);
    expect(r.body.source).toBe('facts');
    expect(r.body.answer).toMatch(/Cohort: \d+ nearly ready/);
  });

  it('explains a term in plain words', async () => {
    restore = setResponder(() => 'not json');
    const r = await learner.agent.post('/api/assist/ask').set(auth(learner)).send({ question: 'What does A3 mean?' });
    expect(r.body.answer).toMatch(/supervision/);
  });
});

describe('help and glossary', () => {
  it('accepts a contact message signed in or not, and reports status', async () => {
    expect((await learner.agent.post('/api/help/contact').set(auth(learner)).send({ type: 'problem', message: 'The cohort list is not loading.' })).status).toBe(201);
    expect((await request(app).post('/api/help/contact').send({ type: 'question', message: 'How much does it cost?', reply_to: 'a@b.in' })).status).toBe(201);
    expect((await request(app).post('/api/help/contact').send({ message: 'hi' })).status).toBe(400);
    const rows = await dal.all('SELECT actor_type, type FROM help_requests ORDER BY created_at');
    expect(rows.map(r => r.actor_type)).toEqual(['learner', 'public']);
    const st = await request(app).get('/api/help/status');
    expect(st.body.ok).toBe(true);
    expect((await request(app).get('/api/glossary')).body.A3).toMatch(/supervision/);
  });
});
