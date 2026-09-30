// core/employer/apiKeys.js — employer API keys (v4.3 §14.1, §10).
// Keys live in their own table: a public prefix, a bcrypt hash, scopes,
// last-used time and revocation. The full key is shown once, at creation:
//   qbx_<prefix>_<secret>     (prefix 8 base32 chars, secret 32 bytes base64url)
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import * as dal from '../db/dal.js';
import { ulid } from '../db/ulid.js';

export const SCOPES = ['search', 'verify', 'passport.read', 'webhooks'];
const PREFIX_ALPHABET = 'abcdefghjkmnpqrstvwxyz23456789';

export function createKey({ employerId, name, scopes, createdBy }) {
  const bad = (scopes || []).filter(s => !SCOPES.includes(s));
  if (!scopes || !scopes.length || bad.length) throw Object.assign(new Error(`Scopes must be some of: ${SCOPES.join(', ')}`), { status: 400 });
  const prefix = Array.from(crypto.randomBytes(8), b => PREFIX_ALPHABET[b % PREFIX_ALPHABET.length]).join('');
  const secret = crypto.randomBytes(32).toString('base64url');
  const id = ulid();
  dal.run(`INSERT INTO employer_api_keys (id, employer_id, name, prefix, key_hash, scopes_json, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, id, employerId, String(name || 'API key').slice(0, 80), prefix, bcrypt.hashSync(secret, 10),
  JSON.stringify([...new Set(scopes)]), createdBy, dal.nowIso());
  return { id, key: `qbx_${prefix}_${secret}`, prefix, scopes };
}

export function listKeys(employerId) {
  return dal.all('SELECT id, name, prefix, scopes_json, created_at, last_used_at, revoked_at FROM employer_api_keys WHERE employer_id = ? ORDER BY created_at DESC', employerId)
    .map(k => ({ ...k, scopes: JSON.parse(k.scopes_json), scopes_json: undefined }));
}

export function revokeKey(employerId, id) {
  return dal.run('UPDATE employer_api_keys SET revoked_at = ? WHERE id = ? AND employer_id = ? AND revoked_at IS NULL', dal.nowIso(), id, employerId).changes > 0;
}

/** Resolve a presented key. Returns { key, employer } or null. */
export function authenticateKey(presented) {
  const m = /^qbx_([a-z0-9]{8})_([A-Za-z0-9_-]{20,})$/.exec(String(presented || ''));
  if (!m) return null;
  const row = dal.one('SELECT * FROM employer_api_keys WHERE prefix = ? AND revoked_at IS NULL', m[1]);
  if (!row || !bcrypt.compareSync(m[2], row.key_hash)) return null;
  dal.run('UPDATE employer_api_keys SET last_used_at = ? WHERE id = ?', dal.nowIso(), row.id);
  return { key: { ...row, scopes: JSON.parse(row.scopes_json) }, employerId: row.employer_id };
}
