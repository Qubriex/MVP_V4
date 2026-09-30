// RETURN (v4.3 §8, §9, §9.3, §9.5, §10): reviews, Mastery Log integrity,
// passport issue on MASTERY_LOG_PRODUCED, public verification, renewal.
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import * as dal from '../../core/db/dal.js';
import { freshDb, makeApp, seedInstitution, seedPathway, login, PIN, PASSWORD } from '../helpers/setup.js';
import { setResponder } from '../../core/ai/adapters/mock.js';
import { mapPathway } from '../../core/graph/coverage.js';
import { createWorker } from '../../core/events/worker.js';
import { registerHandlers } from '../../core/events/handlers.js';
import { verifySdJwt } from '../../core/qep/sdjwt.js';
import { revokeCredential } from '../../core/return/credentialEngine.js';
import { resetRateLimits } from '../../api/middleware/rateLimit.js';

let app; let A; let P; let learner; let admin;
let restore = () => {};
const typed = { mode: 'typed', pasted_chars: 0, paste_events: 0, largest_paste: 0 };
const lp = (path, body) => learner.agent.post(path).set('X-CSRF-Token', learner.csrf).send(body);

beforeAll(async () => {
  await freshDb();
  registerHandlers();
  app = await makeApp();
  A = await seedInstitution('a');
  P = await seedPathway(A);
  await mapPathway(P.ct);
  learner = await login(app, '/api/auth/learner/login', { learner_ref: A.learnerRef, join_code: A.joinCode, pin: PIN });
  admin = await login(app, '/api/auth/institution/login', { email: A.adminEmail, password: PASSWORD });
  restore = setResponder((req) => {
    if (req.task === 'EVAL.mastery') return { score: 0.92, evaluation: 'e', feedbackForLearner: 'Well explained.', understandingGaps: [] };
    if (req.task === 'EVIDENCE.conceptItem') return { question: `Q ${req.hash.slice(0, 6)}` };
    return { message: 'lesson', decision: 'CHECK' };
  });
  // Master the first node through the real check path.
  const s = await lp('/api/learner/session/start', {});
  await lp('/api/learner/session/message', { content: 'ready', session_id: s.body.session_id });
  const r = await lp('/api/learner/session/message', { content: 'SELECT returns matching rows.', session_id: s.body.session_id, provenance: typed });
  expect(r.body.result).toBe('advance');
});
afterEach(() => resetRateLimits());

describe('reviews (v4.3 §8)', () => {
  it('a review is not available before it is due, then runs as a new instance and reschedules', async () => {
    await lp(`/api/learner/reviews/${P.nodes[0]}/start`, {}).expect(409);
    await dal.run('UPDATE node_retention SET due_at = ? WHERE node_id = ?', new Date(Date.now() - 1000).toISOString(), P.nodes[0]);
    const due = await learner.agent.get('/api/learner/reviews/due').expect(200);
    expect(due.body.due.map(d => d.node_id)).toContain(P.nodes[0]);
    expect(due.body.warmups).toEqual([P.nodes[0]]);
    const start = await lp(`/api/learner/reviews/${P.nodes[0]}/start`, {}).expect(200);
    const again = await lp(`/api/learner/reviews/${P.nodes[0]}/start`, {}).expect(200);
    expect(again.body.instance_id).toBe(start.body.instance_id); // one review per due date
    const hold = await lp(`/api/learner/reviews/instances/${start.body.instance_id}/answer`, { answer: 'x'.repeat(100), provenance: { mode: 'typed', pasted_chars: 100, largest_paste: 100 } }).expect(200);
    expect(hold.body.result).toBe('hold');
    const ans = await lp(`/api/learner/reviews/instances/${start.body.instance_id}/answer`, { answer: 'Rows that match the WHERE filter come back.', provenance: typed }).expect(200);
    expect(ans.body).toMatchObject({ result: 'passed', passed: true });
    expect(ans.body).not.toHaveProperty('score');
    // strong pass (0.92 ≥ θ 0.75 + 0.10): 3 d × 2.5 = 7.5 d
    expect((await dal.one('SELECT interval_days FROM node_retention WHERE node_id = ?', P.nodes[0])).interval_days).toBe(7.5);
    expect((await dal.all('SELECT kind FROM demonstrations ORDER BY date')).map(d => d.kind)).toEqual(['mastery', 'review']);
    await lp(`/api/learner/reviews/instances/${start.body.instance_id}/answer`, { answer: 'again', provenance: typed }).expect(409);
  });
});

describe('Mastery Log → passport (v4.3 §9)', () => {
  it('a produced Mastery Log carries an Evidence ID and a signed SHA-256, and the passport is issued by the outbox', async () => {
    await admin.agent.post(`/api/institution/engagements/${A.engagementId}/produce-mastery-logs`).set('X-CSRF-Token', admin.csrf).send({}).expect(200);
    const log = await dal.one('SELECT evidence_id, sha256, signature_json FROM mastery_logs WHERE learner_id = ?', A.learnerId);
    expect(log.evidence_id).toMatch(/^QBX-/);
    expect(log.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.parse(log.signature_json)).toMatchObject({ alg: 'RS256' });
    await createWorker().tick();
    const p = await learner.agent.get('/api/learner/passport').expect(200);
    expect(p.body).toMatchObject({ issued: true, version: 1, status: 'valid', public: false });
    expect(p.body.skills.map(s => s.skill_id)).toContain('sql_select');
    expect(p.body.skills[0].label).toBe('Partial'); // mastered + 1 review: not yet Confirmed
    expect(p.body.skills[0].nodes[0].missing_for_confirmed).toEqual(expect.arrayContaining(['more_demonstrations', 'time_span', 'challenge_bound']));
  });

  it('the credential is a verifiable SD-JWT that signs facts only — no label, no journey metrics', async () => {
    const c = await dal.one('SELECT sd_jwt FROM credentials WHERE active = 1');
    const v = await verifySdJwt(c.sd_jwt);
    expect(v).toBeTruthy();
    const text = JSON.stringify(v);
    expect(text).not.toMatch(/"label"\s*:\s*"(Confirmed|Partial|Foundational)"|loops|attempt|active_minutes|confidence/);
    expect(v.claims[0].value.nodes[0]).toMatchObject({ theta: 0.75, E: 'L1', A_at_mastery: 'A1', persistence: false });
    // a disclosure the issuer never signed is rejected
    const forged = Buffer.from(JSON.stringify(['salt', 'skill:evil', { skillId: 'evil' }])).toString('base64url');
    expect(await verifySdJwt(`${c.sd_jwt}${forged}~`)).toBeNull();
  });
});

describe('public verification (v4.3 §10)', () => {
  it('returns malformed, not_found, then valid with skills only once the holder makes them public', async () => {
    const id = (await dal.one('SELECT evidence_id FROM credentials WHERE active = 1')).evidence_id;
    await request(app).get('/api/verify/QBX-NOTREAL0000').expect(400);
    const typo = `${id.slice(0, 5)}${id[6]}${id[5]}${id.slice(7)}`;
    if (typo !== id) expect((await request(app).get(`/api/verify/${typo}`)).status).toBe(400);
    let v = (await request(app).get(`/api/verify/${id.toLowerCase()}`).expect(200)).body;
    expect(v).toMatchObject({ status: 'valid', proof: 'authentic_and_unaltered', skills_public: false, skills: [] });
    expect(JSON.stringify(v)).not.toMatch(/Learner|REF-a|learner-a/);
    await lp('/api/learner/passport/share', { public: true }).expect(200);
    v = (await request(app).get(`/api/verify/${id}`).expect(200)).body;
    expect(v.skills_public).toBe(true);
    expect(v.skills[0]).toMatchObject({ label: 'Partial', evidence: 'L1', assurance: 'A1' });
    expect(v.skills[0]).not.toHaveProperty('missing_for_confirmed');
  });

  it('publishes JWKS, the did:web document and the status list', async () => {
    const jwks = (await request(app).get('/api/verify/jwks.json').expect(200)).body;
    expect(jwks.keys[0]).toMatchObject({ kty: 'RSA', alg: 'RS256' });
    expect(jwks.keys[0]).not.toHaveProperty('d');
    const did = (await request(app).get('/.well-known/did.json').expect(200)).body;
    expect(did.id).toMatch(/^did:web:/);
    const c = await dal.one('SELECT status_list_id FROM credentials WHERE active = 1');
    const list = (await request(app).get(`/api/verify/status/${c.status_list_id}`).expect(200)).body;
    expect(list).toMatchObject({ type: 'BitstringStatusList', statusPurpose: 'revocation' });
  });

  it('20 not_found in an hour blocks that IP', async () => {
    const { newEvidenceId } = await import('../../core/qep/evidenceId.js');
    for (let i = 0; i < 20; i += 1) await request(app).get(`/api/verify/${newEvidenceId()}`).expect(404);
    await request(app).get(`/api/verify/${newEvidenceId()}`).expect(429);
  });
});

describe('renewal (v4.3 §9.5)', () => {
  it('one instance per skill; answering all reissues a new version with a new window, same Evidence ID', async () => {
    const before = await dal.one('SELECT evidence_id, version, valid_until FROM credentials WHERE active = 1');
    const p = await lp('/api/learner/passport/renew', {}).expect(200);
    expect(p.body.renewal.items.length).toBeGreaterThan(0);
    for (const item of p.body.renewal.items) {
      await lp(`/api/learner/reviews/instances/${item.instance_id}/answer`, { answer: 'I can still explain SELECT and filters.', provenance: typed }).expect(200);
    }
    const after = await dal.one('SELECT evidence_id, version, valid_until FROM credentials WHERE active = 1');
    expect(after.evidence_id).toBe(before.evidence_id);
    expect(after.version).toBe(2);
    expect(after.valid_until >= before.valid_until).toBe(true);
    expect((await dal.all("SELECT kind FROM demonstrations WHERE kind = 'renewal'")).length).toBe(p.body.renewal.items.length);
    expect((await dal.one("SELECT COUNT(*) n FROM domain_events WHERE type = 'CREDENTIAL_REISSUED'")).n).toBe(1);
  });

  it('revocation flips the status bit and verify says revoked', async () => {
    const id = (await dal.one('SELECT evidence_id FROM credentials WHERE active = 1')).evidence_id;
    await revokeCredential(id, 'test');
    expect((await request(app).get(`/api/verify/${id}`).expect(200)).body.status).toBe('revoked');
    await expect((async () => await dal.run('DELETE FROM credentials'))()).rejects.toThrow(/append-only/);
  });
});
