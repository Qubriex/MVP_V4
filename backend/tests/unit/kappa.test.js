import { describe, it, expect } from 'vitest';
import { weightedKappa, bootstrapKappa } from '../../core/evidence/faculty.js';

describe('weighted κ (v4.3 §7.8)', () => {
  it('is 1 for perfect agreement and ~0 for independent ratings', () => {
    const perfect = [[0, 0], [1, 1], [2, 2], [3, 3], [2, 2], [1, 1]];
    expect(weightedKappa(perfect)).toBeCloseTo(1);
    const indep = [];
    for (let a = 0; a < 4; a += 1) for (let b = 0; b < 4; b += 1) indep.push([a, b]);
    expect(weightedKappa(indep)).toBeCloseTo(0);
  });

  it('penalises distant disagreements more than adjacent ones (quadratic weights)', () => {
    const base = [[0, 0], [1, 1], [2, 2], [3, 3]];
    expect(weightedKappa([...base, [2, 3]])).toBeGreaterThan(weightedKappa([...base, [0, 3]]));
  });

  it('bootstrap interval brackets the point estimate and is reproducible', () => {
    const pairs = Array.from({ length: 30 }, (_, i) => [i % 4, (i % 4 + (i % 7 === 0 ? 1 : 0)) % 4]);
    const a = bootstrapKappa(pairs, { samples: 400 });
    const b = bootstrapKappa(pairs, { samples: 400 });
    expect(a).toEqual(b);
    expect(a.lower).toBeLessThanOrEqual(a.point);
    expect(a.upper).toBeGreaterThanOrEqual(a.point);
  });
});
