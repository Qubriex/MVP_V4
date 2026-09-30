// Employer accounts and KYB (v4.3 §14.1).
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import * as dal from '../../core/db/dal.js';
import { freshDb, makeApp, seedAdmin, login, PASSWORD } from '../helpers/setup.js';
import { validateGstin, gstinCheckChar } from '../../core/employer/gstin.js';

let app; let owner; let admin; let employerId;
const op = (path, body) => owner.agent.post(path).set('X-CSRF-Token', owner.csrf).send(body);

beforeAll(async () => {
  await freshDb();
  app = await makeApp();
  seedAdmin();
  const r = await request(app).post('/api/auth/employer/register').send({ company_name: '[Company name]', name: 'Owner', email: 'owner@company.test', password: PASSWORD }).expect(201);
  employerId = r.body.employer.id;
  owner = await login(app, '/api/auth/employer/login', { email: 'owner@company.test', password: PASSWORD });
  admin = await login(app, '/api/auth/admin/login', { email: 'root@qubirex.test', password: PASSWORD });
});

describe('GSTIN', () => {
  it('accepts a well-formed GSTIN with the right check character and state code', () => {
    expect(validateGstin('27aapfu0939f1zv')).toMatchObject({ ok: true, state_code: '27', pan: 'AAPFU0939F' });
    expect(gstinCheckChar('27AAPFU0939F1Z')).toBe('V');
  });
  it.each([['27AAPFU0939F1ZX', 'check_character'], ['45AAPFU0939F1ZV', 'state_code'], ['27AAPFU0939F1Z', 'format'], ['27AAPF10939F1ZV', 'format']])('%s → %s', (g, reason) => {
    expect(validateGstin(g)).toMatchObject({ ok: false, reason });
  });
});

describe('KYB flow', () => {
  it('company details with a GSTIN; a bad GSTIN is refused', async () => {
    await owner.agent.put('/api/employer/company').set('X-CSRF-Token', owner.csrf).send({ name: '[Company name]', contact_name: 'Owner', gstin: '27AAPFU0939F1ZX' }).expect(400);
    const r = await owner.agent.put('/api/employer/company').set('X-CSRF-Token', owner.csrf).send({ name: '[Company name]', contact_name: 'Owner', city: 'Hyderabad', gstin: '27AAPFU0939F1ZV' }).expect(200);
    expect(r.body.employer).toMatchObject({ gstin: '27AAPFU0939F1ZV', gst_state_code: '27' });
    expect(r.body.employer.kyb_steps).toEqual({ details: true, domain_verified: false, approved: false });
    expect(r.body.employer).toMatchObject({ can_search: true, can_request_access: false });
  });

  it('admin cannot approve before the domain is verified', async () => {
    await admin.agent.post(`/api/admin/employers/${employerId}/kyb`).set('X-CSRF-Token', admin.csrf).send({ decision: 'verified' }).expect(400);
  });

  it('domain OTP: wrong code counts, the right code verifies, and the email is recorded', async () => {
    const req = await op('/api/employer/verify-domain/request', {}).expect(200);
    expect(req.body.dev_code).toMatch(/^\d{6}$/);
    expect(dal.one("SELECT to_email FROM outbound_messages WHERE kind = 'employer_domain_otp'").to_email).toBe('owner@company.test');
    await op('/api/employer/verify-domain/confirm', { code: '000000' === req.body.dev_code ? '111111' : '000000' }).expect(400);
    await op('/api/employer/verify-domain/confirm', { code: req.body.dev_code }).expect(200);
    const me = await owner.agent.get('/api/employer/me').expect(200);
    expect(me.body.employer.kyb_steps.domain_verified).toBe(true);
  });

  it('admin approves; the account can then request access', async () => {
    const list = await admin.agent.get('/api/admin/employers?status=pending').expect(200);
    expect(list.body.employers.map(e => e.id)).toContain(employerId);
    await admin.agent.post(`/api/admin/employers/${employerId}/kyb`).set('X-CSRF-Token', admin.csrf).send({ decision: 'verified', note: 'Checked GST portal' }).expect(200);
    const me = await owner.agent.get('/api/employer/me').expect(200);
    expect(me.body.employer).toMatchObject({ kyb_status: 'verified', can_request_access: true });
  });
});

describe('team', () => {
  it('owner invites a recruiter on the company domain; the invite link creates the account', async () => {
    await op('/api/employer/users/invites', { email: 'someone@gmail.test', role: 'recruiter' }).expect(400);
    const inv = await op('/api/employer/users/invites', { email: 'rec@company.test', name: 'Rec', role: 'recruiter' }).expect(201);
    const token = inv.body.invite_url.split('/').pop();
    expect((await request(app).get(`/api/auth/employer/invite/${token}`).expect(200)).body).toMatchObject({ email: 'rec@company.test', role: 'recruiter' });
    await request(app).post(`/api/auth/employer/invite/${token}/accept`).send({ password: 'short' }).expect(400);
    await request(app).post(`/api/auth/employer/invite/${token}/accept`).send({ name: 'Rec', password: PASSWORD }).expect(201);
    await request(app).post(`/api/auth/employer/invite/${token}/accept`).send({ password: PASSWORD }).expect(404);
    const rec = await login(app, '/api/auth/employer/login', { email: 'rec@company.test', password: PASSWORD });
    expect((await rec.agent.get('/api/employer/me')).body.user.role).toBe('recruiter');
    // only the owner manages keys and people
    await rec.agent.post('/api/employer/api-keys').set('X-CSRF-Token', rec.csrf).send({ name: 'x', scopes: ['verify'] }).expect(403);
  });
});

describe('API keys', () => {
  it('shown once, stored as a bcrypt hash, scoped, and revocable', async () => {
    await op('/api/employer/api-keys', { name: 'ATS', scopes: ['everything'] }).expect(400);
    const k = await op('/api/employer/api-keys', { name: 'ATS', scopes: ['verify'] }).expect(201);
    expect(k.body.key).toMatch(/^qbx_[a-z0-9]{8}_/);
    const row = dal.one('SELECT key_hash, prefix FROM employer_api_keys WHERE id = ?', k.body.id);
    expect(row.key_hash).toMatch(/^\$2[aby]\$/);
    expect(row.key_hash).not.toContain(k.body.key.split('_')[2]);
    const list = await owner.agent.get('/api/employer/api-keys').expect(200);
    expect(JSON.stringify(list.body)).not.toContain(k.body.key);
    const me = await request(app).get('/api/employer/me').set('X-QBX-API-Key', k.body.key).expect(200);
    expect(me.body).toMatchObject({ user: null, api_key: { scopes: ['verify'] } });
    // account changes need a portal session, not a key
    await request(app).get('/api/employer/users').set('X-QBX-API-Key', k.body.key).expect(403);
    await request(app).get('/api/employer/me').set('X-QBX-API-Key', `${k.body.key}x`).expect(401);
    await owner.agent.delete(`/api/employer/api-keys/${k.body.id}`).set('X-CSRF-Token', owner.csrf).expect(200);
    await request(app).get('/api/employer/me').set('X-QBX-API-Key', k.body.key).expect(401);
  });

  it('signing identity must be on the company domain', async () => {
    await owner.agent.put('/api/employer/signing-identity').set('X-CSRF-Token', owner.csrf).send({ kind: 'did_web', value: 'did:web:evil.test' }).expect(400);
    const r = await owner.agent.put('/api/employer/signing-identity').set('X-CSRF-Token', owner.csrf).send({ kind: 'jwks_url', value: 'https://keys.company.test/jwks.json' }).expect(200);
    expect(r.body.identity).toMatchObject({ kind: 'jwks_url', activated: 0 });
  });
});
