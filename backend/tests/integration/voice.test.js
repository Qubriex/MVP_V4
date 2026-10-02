// Professor Qubirex's voice and spoken style (docs/AI-VOICE-SPEC.md).
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { freshDb, makeApp, seedInstitution, seedPathway, login, PIN } from '../helpers/setup.js';
import { setResponder } from '../../core/ai/adapters/mock.js';
import { issueInstance } from '../../core/evidence/checkWriter.js';
import { runDiagnosis, generateInstruction } from '../../core/brains/teachBrain.js';

let app; let A; let learner; let restore = () => {};
afterEach(() => restore());

beforeAll(async () => {
  await freshDb();
  app = await makeApp();
  A = await seedInstitution('v');
  await seedPathway(A);
  learner = await login(app, '/api/auth/learner/login', { learner_ref: A.learnerRef, join_code: A.joinCode, pin: PIN });
});

describe('the voice endpoint', () => {
  it('returns WAV audio for a learner', async () => {
    const res = await learner.agent.post('/api/learner/tts').set('Authorization', `Bearer ${learner.token}`)
      .send({ text: 'నమస్కారం! మనం ఈ రోజు DOM events గురించి తెలుసుకుందాం.' }).buffer(true)
      .parse((r, cb) => { const b = []; r.on('data', c => b.push(c)); r.on('end', () => cb(null, Buffer.concat(b))); });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/audio\/wav/);
    expect(res.body.slice(0, 4).toString()).toBe('RIFF');
  });

  it('refuses empty and over-long text, and anyone signed out', async () => {
    const auth = { Authorization: `Bearer ${learner.token}` };
    expect((await learner.agent.post('/api/learner/tts').set(auth).send({ text: '' })).status).toBe(400);
    expect((await learner.agent.post('/api/learner/tts').set(auth).send({ text: 'a'.repeat(1300) })).status).toBe(413);
    const { default: request } = await import('supertest');
    expect((await request(app).post('/api/learner/tts').send({ text: 'hi' })).status).toBe(401);
  });
});

describe('spoken style and persona in the teaching prompts', () => {
  it('diagnosis and instruction speak as a woman teacher, for the ear, with a translation caption', async () => {
    const systems = [];
    restore = setResponder((req) => { systems.push(req.system); return undefined; });
    await runDiagnosis({ nodeLabel: 'DOM events', clusterLabel: 'JavaScript', language: 'telugu' });
    await generateInstruction({ nodeLabel: 'DOM events', clusterLabel: 'JavaScript', language: 'hindi' });
    expect(systems).toHaveLength(2);
    for (const s of systems) {
      expect(s).toMatch(/woman teacher/);
      expect(s).toMatch(/read aloud by a text-to-speech voice/);
      expect(s).toMatch(/English translation of exactly what "message" says/);
      expect(s).toMatch(/Never write "I explained"/);
    }
    expect(systems[1]).toMatch(/feminine first-person forms/);
  });
});

describe('check questions', () => {
  it('the fallback question has no invented numbers or brackets', async () => {
    restore = setResponder(() => { throw Object.assign(new Error('down'), { status: 503 }); });
    const inst = await issueInstance({ elId: A.elId, learnerId: A.learnerId, nodeId: `ct-${A.institutionId.slice(5)}-n1`, language: 'telugu' });
    expect(inst.generator).toBe('template');
    expect(inst.question_text).not.toMatch(/[()[\]0-9]/);
    expect(inst.question_text).toMatch(/SQL queries/);
  });
});
