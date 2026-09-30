import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { hit, rateLimit, resetRateLimits } from '../../api/middleware/rateLimit.js';

beforeEach(() => resetRateLimits());

describe('rate limiter', () => {
  it('allows up to the limit per key per window, then refuses', () => {
    const t = 1_000_000;
    for (let i = 0; i < 3; i += 1) expect(hit('b', 'k', 3, 1000, t).allowed).toBe(true);
    expect(hit('b', 'k', 3, 1000, t).allowed).toBe(false);
    expect(hit('b', 'other', 3, 1000, t).allowed).toBe(true);
    expect(hit('b', 'k', 3, 1000, t + 1001).allowed).toBe(true);
  });

  it('middleware answers 429 with Retry-After, keyed per account', async () => {
    const app = express();
    app.use(express.json());
    app.post('/x', rateLimit({ name: 'acct', limit: 2, windowMs: 60000, key: (req) => req.body.email }), (req, res) => res.json({ ok: true }));
    await request(app).post('/x').send({ email: 'a' }).expect(200);
    await request(app).post('/x').send({ email: 'a' }).expect(200);
    const r = await request(app).post('/x').send({ email: 'a' }).expect(429);
    expect(Number(r.headers['retry-after'])).toBeGreaterThan(0);
    await request(app).post('/x').send({ email: 'b' }).expect(200);
  });
});

describe('AI rate limits (v4.3 §22)', () => {
  it('limit POSTs per account, skip GETs', async () => {
    const { aiRateLimitPosts } = await import('../../api/middleware/rateLimit.js');
    const app = express();
    app.use((req, res, next) => { req.session = { actor_type: 'learner', actor_id: 'l1', institution_id: 'i1' }; next(); });
    app.use(aiRateLimitPosts);
    app.all('/x', (req, res) => res.json({ ok: true }));
    for (let i = 0; i < 30; i += 1) await request(app).post('/x').expect(200);
    await request(app).post('/x').expect(429);
    await request(app).get('/x').expect(200);
  });
});
