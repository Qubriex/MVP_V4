// core/db/ulid.js
// ULID primary keys (§6): 48-bit millisecond time + 80 bits of randomness,
// Crockford base32, lexicographically sortable. Monotonic within one
// millisecond so ids created in the same tick still sort in creation order.
import crypto from 'crypto';

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
let lastTime = -1;
let lastRandom = null;

function encodeTime(ms) {
  let out = '';
  for (let i = 0; i < 10; i += 1) { out = ALPHABET[ms % 32] + out; ms = Math.floor(ms / 32); }
  return out;
}

function encodeRandom(bytes) {
  // 80 bits → 16 base32 characters
  let bits = 0n;
  for (const b of bytes) bits = (bits << 8n) | BigInt(b);
  let out = '';
  for (let i = 0; i < 16; i += 1) { out = ALPHABET[Number(bits & 31n)] + out; bits >>= 5n; }
  return out;
}

function incrementRandom(bytes) {
  const next = Buffer.from(bytes);
  for (let i = next.length - 1; i >= 0; i -= 1) {
    if (next[i] === 255) { next[i] = 0; continue; }
    next[i] += 1;
    return next;
  }
  throw new Error('ULID random overflow within one millisecond');
}

/** @returns {string} a 26-character ULID */
export function ulid(now = Date.now()) {
  if (now === lastTime) {
    lastRandom = incrementRandom(lastRandom);
  } else {
    lastTime = now;
    lastRandom = crypto.randomBytes(10);
  }
  return encodeTime(now) + encodeRandom(lastRandom);
}

export const isUlid = (s) => typeof s === 'string' && /^[0-9A-HJKMNP-TV-Z]{26}$/.test(s);
