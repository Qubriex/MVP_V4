// core/return/keyRegistry.js — public keys only (v4.3 §9.3): JWKS, did:web
// document and verification. Retired keys stay published; a compromised key
// flips every credential it signed to reissue_required. No private key is
// ever read here — that happens only in core/return/signing.js.
import crypto from 'crypto';
import * as dal from '../db/dal.js';

export async function jwks() {
  return { keys: (await dal.all("SELECT public_jwk_json FROM signing_keys ORDER BY created_at")).map(r => JSON.parse(r.public_jwk_json)) };
}

export async function keyStatus(kid) {
  return (await dal.one('SELECT status FROM signing_keys WHERE kid = ?', kid))?.status || null;
}

export async function publicKeyFor(kid) {
  const row = await dal.one('SELECT public_jwk_json FROM signing_keys WHERE kid = ?', kid);
  return row ? crypto.createPublicKey({ key: JSON.parse(row.public_jwk_json), format: 'jwk' }) : null;
}

/** Verify a compact JWS against the published keys. Returns the payload or null. */
export async function verifyJws(jws) {
  const [h, p, s] = String(jws || '').split('.');
  if (!h || !p || !s) return null;
  let header;
  try { header = JSON.parse(Buffer.from(h, 'base64url').toString('utf8')); } catch { return null; }
  if (header.alg !== 'RS256' || !header.kid) return null;
  const key = await publicKeyFor(header.kid);
  if (!key) return null;
  const ok = crypto.verify('RSA-SHA256', Buffer.from(`${h}.${p}`), key, Buffer.from(s, 'base64url'));
  if (!ok) return null;
  try { return { header, payload: JSON.parse(Buffer.from(p, 'base64url').toString('utf8')) }; } catch { return null; }
}

export async function didDocument(host) {
  const did = `did:web:${host}`;
  const keys = (await jwks()).keys;
  return {
    '@context': ['https://www.w3.org/ns/did/v1', 'https://w3id.org/security/suites/jws-2020/v1'],
    id: did,
    verificationMethod: keys.map(k => ({ id: `${did}#${k.kid}`, type: 'JsonWebKey2020', controller: did, publicKeyJwk: k })),
    assertionMethod: keys.map(k => `${did}#${k.kid}`)
  };
}
