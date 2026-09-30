// core/employer/gstin.js — GSTIN format, state code and check character (v4.3 §14.1).
//   15 characters: 2-digit state code · 10-character PAN (AAAAA9999A) ·
//   entity number (1-9, A-Z) · 'Z' (default) · check character.
// The check character is a Luhn-style mod-36 sum with factors 1, 2 alternating.
const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// State / UT codes in use (01–38), plus 97 (other territory) and 99 (centre jurisdiction).
export const STATE_CODES = new Set([...Array.from({ length: 38 }, (_, i) => String(i + 1).padStart(2, '0')), '97', '99']);

export function gstinCheckChar(first14) {
  let sum = 0;
  for (let i = 0; i < 14; i += 1) {
    const v = CHARS.indexOf(first14[i]);
    if (v < 0) throw new Error('Invalid character');
    const p = v * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(p / 36) + (p % 36);
  }
  return CHARS[(36 - (sum % 36)) % 36];
}

/** @returns {{ok: true, state_code: string, pan: string} | {ok: false, reason: string}} */
export function validateGstin(raw) {
  const g = String(raw || '').trim().toUpperCase();
  if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(g)) return { ok: false, reason: 'format' };
  if (!STATE_CODES.has(g.slice(0, 2))) return { ok: false, reason: 'state_code' };
  if (gstinCheckChar(g.slice(0, 14)) !== g[14]) return { ok: false, reason: 'check_character' };
  return { ok: true, gstin: g, state_code: g.slice(0, 2), pan: g.slice(2, 12) };
}
