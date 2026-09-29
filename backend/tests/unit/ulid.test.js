import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { ulid, isUlid } from '../../core/db/ulid.js';

describe('ulid', () => {
  it('is 26 Crockford base32 characters', () => {
    expect(isUlid(ulid())).toBe(true);
  });

  it('sorts in creation order, including many ids in the same millisecond', () => {
    const t = Date.now();
    const ids = Array.from({ length: 500 }, () => ulid(t));
    expect([...ids].sort()).toEqual(ids);
    expect(new Set(ids).size).toBe(500);
  });

  it('property: later timestamps always sort later', () => {
    fc.assert(fc.property(fc.integer({ min: 1, max: 2 ** 40 }), fc.integer({ min: 1, max: 10000 }), (t, d) => ulid(t) < ulid(t + d)));
  });
});
