// "Is this the person in front of you?" on the public verifier (v4.3 canvas
// P2): a typed name is matched, initials and word order allowed; the stored
// name is never returned.
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { freshDb, makeApp } from '../helpers/setup.js';
import { namesMatch } from '../../api/routes/verify.js';

let app;
beforeAll(async () => { await freshDb(); app = await makeApp(); });

describe('name check', () => {
  it('matches initials and any word order, in any script', () => {
    expect(namesMatch('K. Ravi Kumar', 'Ravi Kumar K')).toBe(true);
    expect(namesMatch('R Kumar K', 'Kumar Ravi K.')).toBe(true);
    expect(namesMatch('లక్ష్మి రావు', 'రావు లక్ష్మి')).toBe(true);
    expect(namesMatch('Ravi Kumar', 'Ravi Kumar K')).toBe(false);
    expect(namesMatch('Ravi Sharma', 'Ravi Kumar')).toBe(false);
  });

  it('asks for a full name and does not reveal unknown IDs', async () => {
    expect((await request(app).post('/api/verify/QBX-AAAAAAAAAAAA/name-check').send({ name: 'Ravi' })).status).toBe(400);
    const r = await request(app).post('/api/verify/QBX-AAAAAAAAAAAA/name-check').send({ name: 'Ravi Kumar' });
    expect(r.status).toBe(404);
    expect(JSON.stringify(r.body)).not.toMatch(/name/);
  });
});
