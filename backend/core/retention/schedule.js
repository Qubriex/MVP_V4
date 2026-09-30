// core/retention/schedule.js — spaced review (v4.3 §8).
//   on ADVANCE: interval I = 3 days; due = now + I
//   on review:  strong pass (s ≥ θ + 0.10): I = min(I × 2.5, 120)
//               marginal pass:             I = min(I × 1.8, 120)
//               fail:                      I = 1 day (one-approach remediation offered)
//   SESSION_START takes up to 2 due reviews (oldest first) as warm-ups.
// Every review, pass or fail, is a demonstration; the label is re-derived.
import * as dal from '../db/dal.js';
import params from '../../config/params.js';

const DAY = 86400000;

export function scheduleFirstReview(db, elId, nodeId, fromIso) {
  const I = params.get('retention.initialIntervalDays');
  const due = new Date(Date.parse(fromIso) + I * DAY).toISOString();
  (db || dal.legacyHandle()).prepare(`INSERT INTO node_retention (el_id, node_id, interval_days, due_at, reviews_passed, reviews_failed, updated_at)
    VALUES (?, ?, ?, ?, 0, 0, ?) ON CONFLICT(el_id, node_id) DO UPDATE SET interval_days = excluded.interval_days, due_at = excluded.due_at, updated_at = excluded.updated_at`)
    .run(elId, nodeId, I, due, fromIso);
  return due;
}

/** Next interval after a review. */
export function nextInterval(current, { passed, score, theta }) {
  const r = params.get('retention');
  if (!passed) return r.failIntervalDays;
  const factor = score >= theta + r.strongMargin ? r.strongFactor : r.marginalFactor;
  return Math.min(current * factor, r.maxIntervalDays);
}

export function reschedule(db, elId, nodeId, { passed, score, theta, atIso }) {
  const h = db || dal.legacyHandle();
  const row = h.prepare('SELECT * FROM node_retention WHERE el_id = ? AND node_id = ?').get(elId, nodeId);
  const current = row ? row.interval_days : params.get('retention.initialIntervalDays');
  let I = nextInterval(current, { passed, score, theta });
  // Placement-season consolidation (§8.1): the next review may be capped so the
  // third demonstration lands before the cohort's placement date.
  const cap = consolidationCapDays(h, elId, atIso);
  if (cap != null && passed) I = Math.max(1, Math.min(I, cap));
  const due = new Date(Date.parse(atIso) + I * DAY).toISOString();
  h.prepare(`INSERT INTO node_retention (el_id, node_id, interval_days, due_at, last_review_at, last_result, reviews_passed, reviews_failed, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(el_id, node_id) DO UPDATE SET interval_days = excluded.interval_days, due_at = excluded.due_at, last_review_at = excluded.last_review_at,
      last_result = excluded.last_result, reviews_passed = node_retention.reviews_passed + ?, reviews_failed = node_retention.reviews_failed + ?, updated_at = excluded.updated_at`)
    .run(elId, nodeId, I, due, atIso, passed ? 'pass' : 'fail', passed ? 1 : 0, passed ? 0 : 1, atIso, passed ? 1 : 0, passed ? 0 : 1);
  return { interval: I, due };
}

function consolidationCapDays(h, elId, atIso) {
  const e = h.prepare('SELECT e.placement_date FROM engagement_learners el JOIN engagements e ON e.id = el.engagement_id WHERE el.id = ?').get(elId);
  if (!e || !e.placement_date) return null;
  const days = (Date.parse(e.placement_date) - Date.parse(atIso)) / DAY;
  return days > 1 ? Math.floor(days / 2) : null;
}

/** Reviews due now for an enrolment, oldest first. */
export function dueReviews(elId, { limit = 50, asOf = new Date().toISOString() } = {}) {
  return dal.all(`SELECT r.node_id, r.due_at, r.interval_days, r.last_result, sn.node_label, sc.cluster_label
    FROM node_retention r JOIN skill_nodes sn ON sn.id = r.node_id JOIN skill_clusters sc ON sc.id = sn.cluster_id
    WHERE r.el_id = ? AND r.due_at <= ? ORDER BY r.due_at LIMIT ?`, elId, asOf, limit);
}

export const warmupsFor = (elId) => dueReviews(elId, { limit: params.get('teaching.maxWarmups') });
