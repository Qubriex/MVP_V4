// label_v1 (v4.3 §9.1, §11): Confirmed only when every condition holds; each
// removed alone downgrades to Partial; persistence with < 2 passes → Foundational.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { labelV1, freshness, impliedInterval, missingForConfirmed } from '../../core/qep/labelFn.js';

const D = (day) => new Date(Date.UTC(2026, 0, 1) + day * 86400000).toISOString();
const facts = { masteredAt: D(0), theta: 0.70, persistence: false, codeNode: false };
const demo = (day, passed, score, assurance = 'A1', kind = 'review', level = 'L1') => ({ date: D(day), passed, score, assurance, kind, level });
// mastery d0, review d3, review+challenge d10 (A2), Day-One d17 (A3): Figure B6.1
const confirmedDemos = [demo(0, true, 0.82, 'A1', 'mastery'), demo(3, true, 0.8), demo(10, true, 0.85, 'A2'), demo(17, true, 0.9, 'A3', 'dayone')];
const asOf = D(18);

describe('label_v1', () => {
  it('Confirmed with ≥ 3 passes, span ≥ 14 d, Cq ≥ 0.75, best ≥ θ + 0.10, fresh ≥ 0.85, A2+', () => {
    const r = labelV1(facts, confirmedDemos, asOf);
    expect(r.label).toBe('Confirmed');
    expect(r.spanDays).toBe(17);
    expect(missingForConfirmed(facts, confirmedDemos, asOf)).toEqual([]);
  });

  it('three passes by day 10 is still Partial: span < 14 days (Figure B6.1)', () => {
    expect(labelV1(facts, confirmedDemos.slice(0, 3), D(11)).label).toBe('Partial');
  });

  it.each([
    ['fewer than 3 passes', confirmedDemos.filter((_, i) => i !== 1 && i !== 2).concat([]), asOf],
    ['span under 14 days', [demo(0, true, 0.82, 'A1', 'mastery'), demo(3, true, 0.8), demo(10, true, 0.85, 'A2'), demo(12, true, 0.9, 'A3')], D(13)],
    ['best below θ + 0.10', confirmedDemos.map(d => ({ ...d, score: 0.75 })), asOf],
    ['no A2+ pass', confirmedDemos.map(d => ({ ...d, assurance: 'A1' })), asOf],
    ['stale (freshness < 0.85)', confirmedDemos, D(200)]
  ])('removing one condition downgrades to Partial: %s', (_, demos, when) => {
    expect(labelV1(facts, demos, when).label).toBe('Partial');
  });

  it('code nodes need execution evidence (L2) for Confirmed', () => {
    expect(labelV1({ ...facts, codeNode: true }, confirmedDemos, asOf).label).toBe('Partial');
    expect(labelV1({ ...facts, codeNode: true }, confirmedDemos.map(d => ({ ...d, level: 'L2' })), asOf).label).toBe('Confirmed');
  });

  it('Cq < 0.50 → Foundational; persistence with < 2 passes → Foundational', () => {
    const failing = [demo(0, true, 0.8, 'A1', 'mastery'), demo(3, false, 0.4), demo(4, false, 0.4), demo(5, false, 0.5)];
    expect(labelV1(facts, failing, D(6)).label).toBe('Foundational');
    expect(labelV1({ ...facts, persistence: true }, [demo(0, true, 0.65, 'A1', 'mastery')], D(1)).label).toBe('Foundational');
  });

  it('old failures age out of the 6-demonstration window', () => {
    const demos = [demo(0, true, 0.82, 'A1', 'mastery'), demo(3, false, 0.5), demo(4, false, 0.5),
      demo(10, true, 0.85, 'A2'), demo(20, true, 0.85), demo(30, true, 0.85), demo(40, true, 0.9), demo(50, true, 0.9), demo(60, true, 0.9)];
    expect(labelV1(facts, demos, D(61)).label).toBe('Confirmed');
  });

  it('not mastered → none', () => {
    expect(labelV1({ ...facts, masteredAt: null }, [], asOf).label).toBe('none');
  });

  it('property: labels are monotone in freshness — later asOf never raises Partial to Confirmed after staleness', () => {
    fc.assert(fc.property(fc.integer({ min: 18, max: 400 }), (day) => {
      const now = labelV1(facts, confirmedDemos, D(day)).label;
      const later = labelV1(facts, confirmedDemos, D(day + 200)).label;
      return !(now === 'Partial' && later === 'Confirmed');
    }));
  });
});

describe('freshness (§8)', () => {
  const I = 10;
  it('is 1.0 on time, 0.85 at half the overdue range, floors at 0.7, and 0.5 after 18 months', () => {
    expect(freshness(D(0), I, D(10))).toBe(1);
    expect(freshness(D(0), I, D(20))).toBeCloseTo(0.85);
    expect(freshness(D(0), I, D(60))).toBe(0.7);
    expect(freshness(D(0), I, D(560))).toBe(0.5);
  });

  it('the implied interval replays the schedule: 3 d, ×2.5 strong, ×1.8 marginal, fail → 1 d', () => {
    expect(impliedInterval([demo(0, true, 0.8, 'A1', 'mastery')], 0.7)).toBe(3);
    expect(impliedInterval([demo(0, true, 0.8, 'A1', 'mastery'), demo(3, true, 0.85)], 0.7)).toBe(7.5);
    expect(impliedInterval([demo(0, true, 0.8, 'A1', 'mastery'), demo(3, true, 0.72)], 0.7)).toBeCloseTo(5.4);
    expect(impliedInterval([demo(0, true, 0.8, 'A1', 'mastery'), demo(3, false, 0.3)], 0.7)).toBe(1);
  });
});
