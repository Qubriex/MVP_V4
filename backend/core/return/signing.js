// core/return/signing.js — THE ONLY MODULE THAT LOADS SIGNING KEYS (v4.3 §10).
// tests/structural/signing.test.js fails if any other module reads key files
// or the SIGNING_* environment variables.
//
// Production: keys are PEM files mounted from secure-config at
//   $SECURE_CONFIG_DIR/keys/<kid>.pem   (private, RS256)
// and the active kid is secure-config/keys/active. Development: a key pair is
// generated once into ./data/dev-keys (gitignored). The public half of every
// key — active, retired or compromised — is recorded in signing_keys so the
// JWKS keeps publishing retired keys; private halves never enter the database.
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import * as dal from '../db/dal.js';
import { secureConfigDir } from '../../config/params.js';

let cache = null;

function keyDir() {
  const secure = path.join(secureConfigDir(), 'keys');
  if (fs.existsSync(secure)) return { dir: secure, dev: false };
  if (process.env.NODE_ENV === 'production') throw new Error('Signing keys not found in secure-config/keys');
  return { dir: path.resolve(process.env.DEV_KEY_DIR || './data/dev-keys'), dev: true };
}

function load() {
  if (cache) return cache;
  const { dir, dev } = keyDir();
  let kid;
  if (fs.existsSync(path.join(dir, 'active'))) kid = fs.readFileSync(path.join(dir, 'active'), 'utf8').trim();
  if (!kid && dev) {
    fs.mkdirSync(dir, { recursive: true });
    kid = `dev-${new Date().toISOString().slice(0, 10)}-${crypto.randomBytes(3).toString('hex')}`;
    const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    fs.writeFileSync(path.join(dir, `${kid}.pem`), privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
    fs.writeFileSync(path.join(dir, 'active'), kid);
  }
  if (!kid) throw new Error('No active signing key');
  const privateKey = crypto.createPrivateKey(fs.readFileSync(path.join(dir, `${kid}.pem`), 'utf8'));
  const publicKey = crypto.createPublicKey(privateKey);
  cache = { kid, privateKey, publicKey };
  return cache;
}

const b64u = (buf) => Buffer.from(buf).toString('base64url');

/** Record the active public key in signing_keys (idempotent) and return its kid. */
export function activeKid() {
  const { kid, publicKey } = load();
  if (!dal.one('SELECT 1 FROM signing_keys WHERE kid = ?', kid)) {
    const jwk = { ...publicKey.export({ format: 'jwk' }), kid, alg: 'RS256', use: 'sig' };
    dal.run("INSERT INTO signing_keys (kid, public_jwk_json, status, created_at) VALUES (?, ?, 'active', ?)", kid, JSON.stringify(jwk), dal.nowIso());
  }
  return kid;
}

/** Compact JWS (RS256) over a JSON payload. */
export function signJws(payload, header = {}) {
  const kid = activeKid();
  const h = { alg: 'RS256', kid, ...header };
  const input = `${b64u(JSON.stringify(h))}.${b64u(JSON.stringify(payload))}`;
  const sig = crypto.sign('RSA-SHA256', Buffer.from(input), load().privateKey);
  return `${input}.${b64u(sig)}`;
}

/** Detached RS256 signature over canonical bytes (Mastery Log integrity). */
export function signBytes(bytes) {
  const kid = activeKid();
  return { kid, alg: 'RS256', signature: b64u(crypto.sign('RSA-SHA256', bytes, load().privateKey)) };
}

/** For tests: forget the loaded key. */
export function resetSigningCache() { cache = null; }
