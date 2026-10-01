// core/return/signing.js — THE ONLY MODULE THAT LOADS SIGNING KEYS (v4.3 §10).
// tests/structural/signing.test.js fails if any other module reads key files
// or the SIGNING_* environment variables.
//
// Production: the active private key (RS256, PKCS#8 PEM) comes from
//   SIGNING_KEY_PEM + SIGNING_KEY_ID      (environment; Vercel), or
//   $SECURE_CONFIG_DIR/keys/<kid>.pem with the kid in secure-config/keys/active.
// `npm run secrets:generate` prints a new key pair (and the other secrets).
// A key must stay the same across deploys: every passport it signed is
// verified against it. Development: a key pair is
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
  if (process.env.NODE_ENV === 'production') throw new Error('No signing key: set SIGNING_KEY_PEM and SIGNING_KEY_ID, or mount secure-config/keys');
  return { dir: path.resolve(process.env.DEV_KEY_DIR || './data/dev-keys'), dev: true };
}

function fromEnv() {
  const pem = process.env.SIGNING_KEY_PEM;
  if (!pem) return null;
  const kid = process.env.SIGNING_KEY_ID;
  if (!kid) throw new Error('SIGNING_KEY_PEM is set but SIGNING_KEY_ID is not');
  // Environment UIs often store the PEM on one line with literal \n.
  const privateKey = crypto.createPrivateKey(pem.includes('\\n') ? pem.replace(/\\n/g, '\n') : pem);
  return { kid, privateKey, publicKey: crypto.createPublicKey(privateKey) };
}

function load() {
  if (cache) return cache;
  const env = fromEnv();
  if (env) { cache = env; return cache; }
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
export async function activeKid() {
  const { kid, publicKey } = load();
  if (!await dal.one('SELECT 1 FROM signing_keys WHERE kid = ?', kid)) {
    const jwk = { ...publicKey.export({ format: 'jwk' }), kid, alg: 'RS256', use: 'sig' };
    await dal.run("INSERT INTO signing_keys (kid, public_jwk_json, status, created_at) VALUES (?, ?, 'active', ?)", kid, JSON.stringify(jwk), dal.nowIso());
  }
  return kid;
}

/** Compact JWS (RS256) over a JSON payload. */
export async function signJws(payload, header = {}) {
  const kid = await activeKid();
  const h = { alg: 'RS256', kid, ...header };
  const input = `${b64u(JSON.stringify(h))}.${b64u(JSON.stringify(payload))}`;
  const sig = crypto.sign('RSA-SHA256', Buffer.from(input), load().privateKey);
  return `${input}.${b64u(sig)}`;
}

/** Detached RS256 signature over canonical bytes (Mastery Log integrity). */
export async function signBytes(bytes) {
  const kid = await activeKid();
  return { kid, alg: 'RS256', signature: b64u(crypto.sign('RSA-SHA256', bytes, load().privateKey)) };
}

/**
 * Deployments without a configured key (docs/decisions.md D-030): generate
 * one RS256 key the first time, keep it in system_secrets, and load it into
 * SIGNING_KEY_PEM / SIGNING_KEY_ID for this process. Every instance gets the
 * same key; a configured key (environment or secure-config) always wins.
 * @returns {Promise<'environment'|'secure-config'|'database'>}
 */
export async function ensureSigningKey() {
  if (process.env.SIGNING_KEY_PEM && process.env.SIGNING_KEY_ID) return 'environment';
  if (fs.existsSync(path.join(secureConfigDir(), 'keys', 'active'))) return 'secure-config';
  let row = await dal.one("SELECT value FROM system_secrets WHERE name = 'signing_key'");
  if (!row) {
    const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const kid = `qbx-${new Date().toISOString().slice(0, 10)}-${crypto.randomBytes(3).toString('hex')}`;
    const value = JSON.stringify({ kid, pem: privateKey.export({ type: 'pkcs8', format: 'pem' }) });
    await dal.run("INSERT INTO system_secrets (name, value, created_at) VALUES ('signing_key', ?, ?) ON CONFLICT (name) DO NOTHING", value, dal.nowIso());
    row = await dal.one("SELECT value FROM system_secrets WHERE name = 'signing_key'");
  }
  const { kid, pem } = JSON.parse(row.value);
  process.env.SIGNING_KEY_ID = kid;
  process.env.SIGNING_KEY_PEM = pem;
  cache = null;
  return 'database';
}

/** The variables that carry the key, for configuration error messages. */
export const SIGNING_ENV = 'SIGNING_KEY_PEM + SIGNING_KEY_ID';

/** Whether a production signing key is configured (environment or secure-config), without loading it. */
export function signingKeyConfigured() {
  return !!(process.env.SIGNING_KEY_PEM && process.env.SIGNING_KEY_ID) || fs.existsSync(path.join(secureConfigDir(), 'keys', 'active'));
}

/** For tests: forget the loaded key. */
export function resetSigningCache() { cache = null; }
