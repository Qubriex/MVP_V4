// Evidence ID (v4.3 §9.3, §11): every single-character substitution and every
// adjacent transposition of an issued ID is detected.
import { describe, it, expect } from 'vitest';
import { newEvidenceId, isValidEvidenceId, normaliseEvidenceId, ALPHABET, luhnCheckChar } from '../../core/qep/evidenceId.js';
import { canonicalize } from '../../core/return/canonical.js';

describe('Evidence ID', () => {
  it('has the QBX- + 11 + 1 shape and validates', () => {
    const id = newEvidenceId();
    expect(id).toMatch(/^QBX-[0-9A-HJKMNP-TV-Z]{12}$/);
    expect(isValidEvidenceId(id)).toBe(true);
  });

  it('detects every single substitution and every adjacent transposition (300 issued IDs)', () => {
    for (let n = 0; n < 300; n += 1) {
      const id = newEvidenceId();
      const chars = id.slice(4).split('');
      for (let i = 0; i < chars.length; i += 1) {
        for (const c of ALPHABET) {
          if (c === chars[i]) continue;
          const sub = [...chars]; sub[i] = c;
          expect(isValidEvidenceId(`QBX-${sub.join('')}`)).toBe(false);
        }
        if (i < chars.length - 1 && chars[i] !== chars[i + 1]) {
          const tr = [...chars]; [tr[i], tr[i + 1]] = [tr[i + 1], tr[i]];
          expect(isValidEvidenceId(`QBX-${tr.join('')}`)).toBe(false);
        }
      }
    }
  });

  it('documents why 0/Z pairs are never issued: plain Luhn mod 32 cannot see that swap', () => {
    const body = 'ABCDEFGHJ0Z';
    const swapped = 'ABCDEFGHJZ0';
    expect(luhnCheckChar(body)).toBe(luhnCheckChar(swapped));
  });

  it('normalises lower case, spaces, dashes and Crockford look-alikes', () => {
    const id = newEvidenceId();
    const typed = ` ${id.toLowerCase().replace('qbx-', 'qbx ').replace(/0/g, 'o')} `;
    expect(normaliseEvidenceId(typed)).toBe(id);
  });
});

describe('RFC 8785 canonical JSON', () => {
  it('sorts keys, drops whitespace and formats numbers the ECMAScript way', () => {
    expect(canonicalize({ b: 1, a: [true, null, 1e21, 0.1], c: { z: 'é', y: ' ' } }))
      .toBe('{"a":[true,null,1e+21,0.1],"b":1,"c":{"y":" ","z":"é"}}');
    expect(() => canonicalize({ x: NaN })).toThrow();
  });
});
