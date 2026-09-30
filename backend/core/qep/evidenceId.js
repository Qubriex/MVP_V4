// core/qep/evidenceId.js — Evidence ID (v4.3 §9.3)
//   "QBX-" + 11 random Crockford base32 characters + 1 Luhn mod-32 check character.
// Typos are rejected before any lookup. Luhn mod N detects every
// single-character substitution. It misses exactly one adjacent transposition
// — the pair (0, Z), whose weighted sums coincide, as 09↔90 does in decimal
// Luhn — so IDs containing an adjacent 0/Z pair are never issued. Every
// adjacent transposition of an issued ID is therefore detected
// (docs/decisions.md D-022).
import crypto from 'crypto';

export const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const N = ALPHABET.length;
const PREFIX = 'QBX-';

/** Luhn mod N check character over a string of alphabet characters. */
export function luhnCheckChar(body) {
  let factor = 2;
  let sum = 0;
  for (let i = body.length - 1; i >= 0; i -= 1) {
    const code = ALPHABET.indexOf(body[i]);
    if (code < 0) throw new Error('Invalid character');
    let addend = factor * code;
    factor = factor === 2 ? 1 : 2;
    addend = Math.floor(addend / N) + (addend % N);
    sum += addend;
  }
  return ALPHABET[(N - (sum % N)) % N];
}

/** Normalise user input: uppercase, Crockford aliases (O→0, I/L→1), strip spaces and dashes after the prefix. */
export function normaliseEvidenceId(input) {
  const s = String(input || '').trim().toUpperCase().replace(/\s+/g, '');
  const body = s.startsWith(PREFIX) ? s.slice(PREFIX.length) : s.replace(/^QBX/, '');
  return PREFIX + body.replace(/-/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
}

export function isValidEvidenceId(id) {
  const s = String(id || '');
  if (!/^QBX-[0-9A-HJKMNP-TV-Z]{12}$/.test(s)) return false;
  const body = s.slice(4, 15);
  return luhnCheckChar(body) === s[15];
}

const BLIND_PAIR = /0Z|Z0/;

export function newEvidenceId() {
  for (;;) {
    const bytes = crypto.randomBytes(11);
    const body = Array.from(bytes, b => ALPHABET[b % N]).join('');
    const full = body + luhnCheckChar(body);
    if (!BLIND_PAIR.test(full)) return `${PREFIX}${full}`;
  }
}
