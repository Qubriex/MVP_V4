// api/routes/employer.js — Employer portal (/api/employer), v4.3 §14.1.
//   GET  /me                          company + user (session or any API key)
//   PUT  /company                     name, website, contact, city, optional GSTIN (owner)
//   POST /verify-domain/request       6-digit OTP to the owner's company-domain email
//   POST /verify-domain/confirm       { code }
//   GET  /users · POST /users/invites · PUT /users/:id     owner / recruiter / viewer
//   GET  /api-keys · POST /api-keys · DELETE /api-keys/:id  prefix + bcrypt hash + scopes, shown once
//   GET  /signing-identity · PUT /signing-identity          did:web or JWKS URL (Phase 3 activation)
// KYB: pending until the domain is verified AND an admin approves. Until then
// the account may search but not request access (§14.1). Roles, search and
// access requests arrive in Phase 1. Errors use {error: {code, message}}.
//
// Structural wall: no import may reach session, memory, provenance, CKB-usage
// or evaluation stores, directly or transitively.
import express from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import * as dal from '../../core/db/dal.js';
import { ulid } from '../../core/db/ulid.js';
import { employerAuth, requireEmployerRole } from '../middleware/employerAuth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { validateGstin } from '../../core/employer/gstin.js';
import { createKey, listKeys, revokeKey, SCOPES } from '../../core/employer/apiKeys.js';
import { queueEmail, appUrl } from '../../core/outboundMail.js';
import { newToken, hashToken, inviteExpiry } from '../../core/access.js';

const router = express.Router();
const v2 = (res, status, code, message) => res.status(status).json({ error: { code, message } });
const owner = requireEmployerRole('owner');
const session = employerAuth({ sessionOnly: true });
const devEcho = () => process.env.NODE_ENV !== 'production';
const OTP_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;
const domainOf = (email) => String(email || '').split('@')[1]?.toLowerCase() || '';

function companyView(employer) {
  const steps = {
    details: !!(employer.name && employer.contact_name),
    domain_verified: !!employer.domain_verified_at,
    approved: employer.kyb_status === 'verified'
  };
  return { ...employer, kyb_steps: steps, can_search: true, can_request_access: steps.approved };
}

router.get('/me', employerAuth(), (req, res) => {
  const user = req.employerUser ? (({ id, email, name, role }) => ({ id, email, name, role }))(req.employerUser) : null;
  res.json({ user, api_key: req.apiKey ? { prefix: req.apiKey.prefix, scopes: req.apiKey.scopes } : null, employer: companyView(req.employer) });
});

router.put('/company', session, owner, (req, res) => {
  const b = req.body || {};
  const name = String(b.name ?? req.employer.name).trim();
  if (!name) return v2(res, 400, 'invalid_request', 'Company name is required.');
  let gstin = null; let state = null;
  if (b.gstin) {
    const g = validateGstin(b.gstin);
    if (!g.ok) return v2(res, 400, 'invalid_gstin', { format: 'GSTIN must be 15 characters: state code, PAN, entity number, Z and a check character.', state_code: 'The GSTIN starts with an unknown state code.', check_character: 'The GSTIN check character does not match — check for a typo.' }[g.reason]);
    gstin = g.gstin; state = g.state_code;
  }
  dal.run(`UPDATE employers SET name = ?, website = ?, contact_name = ?, contact_phone = ?, city = ?, gstin = COALESCE(?, gstin), gst_state_code = COALESCE(?, gst_state_code), updated_at = ? WHERE id = ?`,
    name, b.website ? String(b.website).trim() : null, b.contact_name ? String(b.contact_name).trim() : null, b.contact_phone ? String(b.contact_phone).trim() : null,
    b.city ? String(b.city).trim() : null, gstin, state, dal.nowIso(), req.employer.id);
  res.json({ employer: companyView(dal.one('SELECT id, name, domain, website, kyb_status, domain_verified_at, gstin, gst_state_code, contact_name, contact_phone, city, kyb_note FROM employers WHERE id = ?', req.employer.id)) });
});

// ─── Domain email OTP (§14.1 KYB) ────────────────────────────────────────────
router.post('/verify-domain/request', session, owner, rateLimit({ name: 'employer:otp', limit: 5, windowMs: 3600000, key: (req) => req.tenant.employerId, legacyErrors: false }), (req, res) => {
  if (req.employer.domain_verified_at) return res.json({ already_verified: true });
  const email = req.employerUser.email;
  if (domainOf(email) !== req.employer.domain) return v2(res, 400, 'domain_mismatch', `Use an owner account on @${req.employer.domain} to verify the domain.`);
  const code = String(crypto.randomInt(100000, 1000000));
  dal.tx(() => {
    dal.run('UPDATE employer_domain_otps SET used_at = ? WHERE employer_id = ? AND used_at IS NULL', 'superseded', req.employer.id);
    dal.run(`INSERT INTO employer_domain_otps (id, employer_id, user_id, email, code_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ulid(), req.employer.id, req.employerUser.id, email, bcrypt.hashSync(code, 8), new Date(Date.now() + OTP_MINUTES * 60000).toISOString(), dal.nowIso());
    queueEmail(dal.legacyHandle(), { to: email, subject: 'Your Qubirex verification code', kind: 'employer_domain_otp',
      body: `Your code to verify ${req.employer.domain} on Qubirex is ${code}. It expires in ${OTP_MINUTES} minutes.` });
  });
  // No mail provider yet: development echoes the code so the flow can be tested.
  res.json({ sent_to: email, expires_minutes: OTP_MINUTES, ...(devEcho() ? { dev_code: code } : {}) });
});

router.post('/verify-domain/confirm', session, owner, (req, res) => {
  const otp = dal.one('SELECT * FROM employer_domain_otps WHERE employer_id = ? AND used_at IS NULL ORDER BY created_at DESC LIMIT 1', req.employer.id);
  if (!otp || otp.expires_at < dal.nowIso()) return v2(res, 400, 'otp_expired', 'That code has expired. Ask for a new one.');
  if (otp.attempts >= OTP_MAX_ATTEMPTS) return v2(res, 429, 'otp_locked', 'Too many wrong codes. Ask for a new one.');
  if (!bcrypt.compareSync(String(req.body.code || ''), otp.code_hash)) {
    dal.run('UPDATE employer_domain_otps SET attempts = attempts + 1 WHERE id = ?', otp.id);
    return v2(res, 400, 'otp_wrong', 'That code is not right.');
  }
  dal.tx(() => {
    dal.run('UPDATE employer_domain_otps SET used_at = ? WHERE id = ?', dal.nowIso(), otp.id);
    dal.run('UPDATE employers SET domain_verified_at = ?, updated_at = ? WHERE id = ?', dal.nowIso(), dal.nowIso(), req.employer.id);
  });
  res.json({ ok: true, domain_verified: true });
});

// ─── Users (owner / recruiter / viewer) ───────────────────────────────────────
router.get('/users', session, (req, res) => {
  const users = dal.all('SELECT id, email, name, role, status, last_login_at, created_at FROM employer_users WHERE employer_id = ? ORDER BY role, name', req.employer.id);
  const invites = dal.all('SELECT id, email, name, role, expires_at, created_at FROM employer_invites WHERE employer_id = ? AND used_at IS NULL AND expires_at > ? ORDER BY created_at DESC', req.employer.id, dal.nowIso());
  res.json({ users, invites });
});

router.post('/users/invites', session, owner, (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const role = req.body.role === 'viewer' ? 'viewer' : req.body.role === 'recruiter' ? 'recruiter' : null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !role) return v2(res, 400, 'invalid_request', 'A work email and a role (recruiter or viewer) are required.');
  if (domainOf(email) !== req.employer.domain) return v2(res, 400, 'domain_mismatch', `Invite people with an @${req.employer.domain} email.`);
  if (dal.one('SELECT 1 FROM employer_users WHERE email = ?', email)) return v2(res, 409, 'email_taken', 'That person already has an account.');
  const token = newToken();
  dal.tx(() => {
    dal.run(`INSERT INTO employer_invites (id, employer_id, email, name, role, token_hash, expires_at, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ulid(), req.employer.id, email, req.body.name ? String(req.body.name).trim() : null, role, hashToken(token), inviteExpiry(), req.employerUser.id, dal.nowIso());
    queueEmail(dal.legacyHandle(), { to: email, subject: `Join ${req.employer.name} on Qubirex`, kind: 'employer_invite',
      body: `${req.employerUser.name || 'Your colleague'} invited you to ${req.employer.name} on Qubirex as a ${role}. Accept: ${appUrl()}/employer/invite/${token}` });
  });
  res.status(201).json({ invite_url: `${appUrl()}/employer/invite/${token}`, email, role });
});

router.put('/users/:id', session, owner, (req, res) => {
  const u = dal.one('SELECT * FROM employer_users WHERE id = ? AND employer_id = ?', req.params.id, req.employer.id);
  if (!u) return v2(res, 404, 'not_found', 'Not found');
  if (u.id === req.employerUser.id) return v2(res, 400, 'invalid_request', 'You cannot change your own role or status.');
  const role = ['owner', 'recruiter', 'viewer'].includes(req.body.role) ? req.body.role : u.role;
  const status = ['active', 'disabled'].includes(req.body.status) ? req.body.status : u.status;
  dal.run('UPDATE employer_users SET role = ?, status = ?, updated_at = ? WHERE id = ?', role, status, dal.nowIso(), u.id);
  if (status === 'disabled') dal.run("UPDATE auth_sessions SET revoked_at = ? WHERE actor_type = 'employer' AND actor_id = ? AND revoked_at IS NULL", dal.nowIso(), u.id);
  res.json({ ok: true });
});

// ─── API keys ─────────────────────────────────────────────────────────────────
router.get('/api-keys', session, (req, res) => res.json({ keys: listKeys(req.employer.id), scopes: SCOPES }));

router.post('/api-keys', session, owner, (req, res) => {
  try {
    const k = createKey({ employerId: req.employer.id, name: req.body.name, scopes: req.body.scopes, createdBy: req.employerUser.id });
    res.status(201).json({ ...k, note: 'Copy this key now. It is shown only once; Qubirex stores only a hash.' });
  } catch (err) {
    v2(res, err.status || 500, 'invalid_request', err.message);
  }
});

router.delete('/api-keys/:id', session, owner, (req, res) => {
  if (!revokeKey(req.employer.id, req.params.id)) return v2(res, 404, 'not_found', 'Key not found or already revoked.');
  res.json({ ok: true });
});

// ─── Signing identity (optional; employer-held keys activate in Phase 3) ────────
router.get('/signing-identity', session, (req, res) => {
  res.json({ identity: dal.one('SELECT kind, value, activated, updated_at FROM employer_signing_identities WHERE employer_id = ?', req.employer.id) || null });
});

router.put('/signing-identity', session, owner, (req, res) => {
  const kind = req.body.kind === 'jwks_url' ? 'jwks_url' : req.body.kind === 'did_web' ? 'did_web' : null;
  const value = String(req.body.value || '').trim();
  const onDomain = (host) => host === req.employer.domain || host.endsWith(`.${req.employer.domain}`);
  let ok = false;
  if (kind === 'did_web') ok = /^did:web:[a-z0-9.-]+(:[\w.-]+)*$/i.test(value) && onDomain(value.split(':')[2].toLowerCase());
  if (kind === 'jwks_url') { try { const u = new URL(value); ok = u.protocol === 'https:' && onDomain(u.hostname.toLowerCase()); } catch { ok = false; } }
  if (!ok) return v2(res, 400, 'invalid_request', `Give a did:web identifier or an https JWKS URL on ${req.employer.domain}.`);
  dal.run(`INSERT INTO employer_signing_identities (employer_id, kind, value, activated, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)
    ON CONFLICT(employer_id) DO UPDATE SET kind = excluded.kind, value = excluded.value, updated_at = excluded.updated_at`, req.employer.id, kind, value, dal.nowIso(), dal.nowIso());
  res.json({ identity: { kind, value, activated: 0 }, note: 'Recorded. Endorsements stay custodial until employer-held keys are activated (Phase 3).' });
});

export default router;
