// /api/health?deep=1 says which voice learners hear: server, browser-fallback or off.
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import { freshDb, makeApp } from '../helpers/setup.js';
import { voiceStatus } from '../../core/ai/gateway.js';

let app;
beforeAll(async () => { await freshDb(); app = await makeApp(); });
afterEach(() => { delete process.env.AI_ADAPTER; delete process.env.GEMINI_API_KEY; });

describe('voice in the health check', () => {
  it('reports the voice source and what is missing, by name only', async () => {
    const r = await request(app).get('/api/health?deep=1');
    expect(r.status).toBe(200);
    expect(['server', 'browser-fallback', 'off']).toContain(r.body.voice);
    expect(r.body.voice_detail).toHaveProperty('missing');
  });

  it('with no key the voice is off and GEMINI_API_KEY is named as missing', async () => {
    process.env.AI_ADAPTER = 'gemini';
    const v = await voiceStatus({ fresh: true });
    expect(v).toMatchObject({ voice: 'off', missing: ['GEMINI_API_KEY'] });
  });
});
