// core/qep/labelFn.js — qep:label_v1 (v4.3 §9.1), the published label function.
//
// PURE: no imports, no I/O, no clock. The same file is the reference verifier:
// given signed node facts, dated demonstrations and a reference time, anyone
// can recompute the label a credential shows today. Labels are never stored.
//
//   post  = demos with date ≥ masteredAt, most recent 6 only
//   Cq    = (1 + passes(post)) / (2 + count(post))
//   span  = days(first pass in post .. last pass in post)
//   fresh = freshness(last pass, interval implied by the pass history, asOf)
//   not passed                                         → none
//   Cq < 0.50 or (persistence and passes(post) < 2)     → Foundational
//   passes ≥ 3, span ≥ 14, Cq ≥ 0.75, best ≥ θ + 0.10,
//   (code node → E ≥ L2), fresh ≥ 0.85, max A ≥ A2      → Confirmed
//   else                                                → Partial

export const LABEL_FUNCTION = 'qep:label_v1';

// Prior values (v4.3 Appendix A). Deployments pass their calibrated params.
export const DEFAULTS = Object.freeze({
  confirmed: { window: 6, minPasses: 3, minSpanDays: 14, minCq: 0.75, thetaMargin: 0.10, minFreshness: 0.85, minAssurance: 'A2', codeMinEvidence: 'L2' },
  foundational: { maxCq: 0.50, persistenceMinPasses: 2 },
  retention: { initialIntervalDays: 3, strongMargin: 0.10, strongFactor: 2.5, marginalFactor: 1.8, maxIntervalDays: 120, failIntervalDays: 1,
    freshness: { floorOverdue: 0.7, overdueSlope: 0.3, staleMonths: 18, stale: 0.5 } }
});

const DAY = 86400000;
const LEVEL = { L1: 1, L2: 2, L3: 3, L4: 4 };
const ASSURANCE = { A0: 0, A1: 1, A2: 2, A3: 3 };
const t = (d) => (typeof d === 'number' ? d : Date.parse(d));
const merge = (p) => ({
  confirmed: { ...DEFAULTS.confirmed, ...(p && p.confirmed) },
  foundational: { ...DEFAULTS.foundational, ...(p && p.foundational) },
  retention: { ...DEFAULTS.retention, ...(p && p.retention), freshness: { ...DEFAULTS.retention.freshness, ...(p && p.retention && p.retention.freshness) } }
});

/** Replay the review schedule (§8) over dated demonstrations to get the current interval in days. */
export function impliedInterval(demos, theta, params) {
  const r = merge(params).retention;
  let interval = r.initialIntervalDays;
  [...demos].sort((a, b) => t(a.date) - t(b.date)).forEach((d, i) => {
    if (i === 0 && d.kind === 'mastery') return; // the mastery pass starts the schedule
    if (!d.passed) interval = r.failIntervalDays;
    else if (d.score != null && d.score >= theta + r.strongMargin) interval = Math.min(interval * r.strongFactor, r.maxIntervalDays);
    else interval = Math.min(interval * r.marginalFactor, r.maxIntervalDays);
  });
  return interval;
}

/** Freshness (§8): 1.0 while due is in the future; linear to 0.7 while overdue; 0.5 when > 18 months old. */
export function freshness(lastPassDate, intervalDays, asOf, params) {
  const f = merge(params).retention.freshness;
  if (lastPassDate == null) return 0;
  const last = t(lastPassDate);
  const now = t(asOf);
  const staleAt = new Date(last);
  staleAt.setUTCMonth(staleAt.getUTCMonth() + f.staleMonths);
  if (now > staleAt.getTime()) return f.stale;
  const due = last + intervalDays * DAY;
  if (now <= due) return 1;
  return Math.max(f.floorOverdue, 1 - f.overdueSlope * (now - due) / (2 * intervalDays * DAY));
}

/**
 * @param {{masteredAt: string|null, theta: number, persistence?: boolean, codeNode?: boolean, E?: string}} facts
 * @param {Array<{date: string, kind: string, passed: boolean|number, score?: number, level?: string, assurance: string}>} demos
 * @param {string|number} asOf
 * @param {object} [params] calibrated thresholds; defaults are the v4.3 priors
 */
export function labelV1(facts, demos, asOf, params) {
  const p = merge(params);
  const c = p.confirmed;
  const empty = { label: 'none', cq: null, spanDays: 0, freshness: 0, best: null, evidence: null, assurance: null, lastDemonstrated: null, passes: 0, count: 0 };
  if (!facts || !facts.masteredAt) return empty;
  const mastered = t(facts.masteredAt);
  const now = t(asOf);
  const since = demos.filter(d => t(d.date) >= mastered && t(d.date) <= now).sort((a, b) => t(a.date) - t(b.date));
  const post = since.slice(-c.window);
  const passes = post.filter(d => !!d.passed);
  const cq = (1 + passes.length) / (2 + post.length);
  const spanDays = passes.length > 1 ? (t(passes[passes.length - 1].date) - t(passes[0].date)) / DAY : 0;
  const lastPass = passes.length ? passes[passes.length - 1] : null;
  const fresh = lastPass ? freshness(lastPass.date, impliedInterval(since, facts.theta, params), now, params) : 0;
  const best = passes.reduce((m, d) => (d.score != null && (m == null || d.score > m) ? d.score : m), null);
  const levels = [...passes.map(d => d.level).filter(Boolean), facts.E].filter(Boolean);
  const evidence = levels.sort((a, b) => LEVEL[b] - LEVEL[a])[0] || null;
  const assurance = passes.map(d => d.assurance).filter(a => a in ASSURANCE).sort((a, b) => ASSURANCE[b] - ASSURANCE[a])[0] || null;
  const out = { cq, spanDays, freshness: fresh, best, evidence, assurance, lastDemonstrated: lastPass ? lastPass.date : null, passes: passes.length, count: post.length };

  if (cq < p.foundational.maxCq || (facts.persistence && passes.length < p.foundational.persistenceMinPasses)) return { ...out, label: 'Foundational' };
  const confirmed = passes.length >= c.minPasses
    && spanDays >= c.minSpanDays
    && cq >= c.minCq
    && best != null && best >= facts.theta + c.thetaMargin
    && (!facts.codeNode || (evidence && LEVEL[evidence] >= LEVEL[c.codeMinEvidence]))
    && fresh >= c.minFreshness
    && assurance != null && ASSURANCE[assurance] >= ASSURANCE[c.minAssurance];
  return { ...out, label: confirmed ? 'Confirmed' : 'Partial' };
}

/** Which Confirmed conditions are still missing (learner-facing guidance, never a score). */
export function missingForConfirmed(facts, demos, asOf, params) {
  const c = merge(params).confirmed;
  const r = labelV1(facts, demos, asOf, params);
  if (r.label === 'none') return ['mastery'];
  const miss = [];
  if (r.passes < c.minPasses) miss.push('more_demonstrations');
  if (r.spanDays < c.minSpanDays) miss.push('time_span');
  if (r.cq < c.minCq) miss.push('consistency');
  if (r.best == null || r.best < facts.theta + c.thetaMargin) miss.push('strong_pass');
  if (facts.codeNode && !(r.evidence && LEVEL[r.evidence] >= LEVEL[c.codeMinEvidence])) miss.push('execution_evidence');
  if (r.freshness < c.minFreshness) miss.push('freshness');
  if (!r.assurance || ASSURANCE[r.assurance] < ASSURANCE[c.minAssurance]) miss.push('challenge_bound');
  return miss;
}
