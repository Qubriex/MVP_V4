// core/qep/sdjwt.js — SD-JWT (IETF draft) for the Capability Passport (v4.3 §9.2).
//   disclosure = base64url(JSON [salt, claimName, value])
//   digest     = base64url(SHA-256(disclosure))   → listed in the payload's _sd
//   compact    = <issuer-signed JWT>~<disclosure>~…~
// Phase 0 issues every skill disclosure together (build step "Credential v1");
// the verifier still checks each disclosure against the signed digests, so
// Phase 1 selective disclosure is the same format with fewer disclosures sent.
import crypto from 'crypto';
import { signJws } from '../return/signing.js';
import { verifyJws } from '../return/keyRegistry.js';

const b64u = (v) => Buffer.from(v).toString('base64url');
export const digestOf = (disclosure) => b64u(crypto.createHash('sha256').update(disclosure).digest());

export function makeDisclosure(name, value) {
  const salt = b64u(crypto.randomBytes(16)); // ≥ 128 bits (CF2 §6)
  const disclosure = b64u(JSON.stringify([salt, name, value]));
  return { disclosure, digest: digestOf(disclosure), name, value };
}

/**
 * @param {object} payload       always-visible claims
 * @param {Array<[string, any]>} selective  [name, value] pairs issued as disclosures
 */
export async function issueSdJwt(payload, selective) {
  const disclosures = selective.map(([n, v]) => makeDisclosure(n, v));
  const jwt = await signJws({ ...payload, _sd: disclosures.map(d => d.digest).sort(), _sd_alg: 'sha-256' }, { typ: 'vc+sd-jwt' });
  return { compact: `${jwt}~${disclosures.map(d => d.disclosure).join('~')}~`, disclosures };
}

/**
 * Verify the issuer signature and every presented disclosure.
 * @returns {null | { header: object, payload: object, claims: Array<{name: string, value: any}> }}
 */
export async function verifySdJwt(compact) {
  const parts = String(compact || '').split('~');
  const signed = await verifyJws(parts[0]);
  if (!signed) return null;
  const allowed = new Set(signed.payload._sd || []);
  const claims = [];
  for (const d of parts.slice(1).filter(Boolean)) {
    if (!allowed.has(digestOf(d))) return null; // a disclosure the issuer never signed
    try {
      const [, name, value] = JSON.parse(Buffer.from(d, 'base64url').toString('utf8'));
      claims.push({ name, value });
    } catch { return null; }
  }
  return { header: signed.header, payload: signed.payload, claims };
}
