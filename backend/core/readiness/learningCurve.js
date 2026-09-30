// core/readiness/learningCurve.js — learning-curve signals (v4.3 §12.3), for
// the learner and their professor:
//   attainment vs active hours, drawn against the cohort median
//   loops per node, with a robust (Theil-Sen) trend — falling = getting better at learning
//   test-out rate, review pass rate, and the share of checks at A1+ and at A2+
// Loops, time and attempts stay inside Qubirex (learner, institution); they
// never reach employers or matching.
import * as dal from '../db/dal.js';

const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Theil-Sen slope of ys over their index. */
export function theilSen(ys) {
  const slopes = [];
  for (let i = 0; i < ys.length; i += 1) for (let j = i + 1; j < ys.length; j += 1) slopes.push((ys[j] - ys[i]) / (j - i));
  return slopes.length ? median(slopes) : null;
}

function totalNodes(elId) {
  return dal.one(`SELECT COUNT(*) n FROM skill_nodes sn JOIN skill_clusters sc ON sc.id = sn.cluster_id
    JOIN engagements e ON e.capability_target_id = sc.capability_target_id JOIN engagement_learners el ON el.engagement_id = e.id WHERE el.id = ?`, elId).n;
}

/** Progress (% of path mastered) at each cumulative active hour mark. */
export function curvePoints(elId) {
  const total = totalNodes(elId) || 1;
  const mastered = dal.all(`SELECT nm.skill_node_id AS node_id, nm.advanced_at, sn.node_label,
      COALESCE(nm.loops, (SELECT MAX(loop_count) FROM learning_sessions ls WHERE ls.engagement_learner_id = nm.engagement_learner_id AND ls.skill_node_id = nm.skill_node_id), 0) AS loops,
      COALESCE((SELECT SUM(active_minutes) FROM learning_sessions ls WHERE ls.engagement_learner_id = nm.engagement_learner_id AND ls.skill_node_id = nm.skill_node_id), 0) AS minutes
    FROM node_mastery nm JOIN skill_nodes sn ON sn.id = nm.skill_node_id
    WHERE nm.engagement_learner_id = ? AND nm.advanced_at IS NOT NULL ORDER BY nm.advanced_at`, elId);
  let minutes = 0;
  const points = [{ hours: 0, progress: 0 }];
  mastered.forEach((m, i) => {
    minutes += m.minutes || 0;
    points.push({ hours: Math.round((minutes / 60) * 100) / 100, progress: Math.round(((i + 1) / total) * 1000) / 10, node: m.node_label });
  });
  return { points, mastered };
}

const progressAt = (points, h) => points.reduce((p, pt) => (pt.hours <= h ? pt.progress : p), 0);

export function cohortMedianCurve(engagementId, maxHours) {
  const els = dal.all("SELECT id FROM engagement_learners WHERE engagement_id = ? AND COALESCE(access_status,'active') != 'removed'", engagementId).map(r => r.id);
  const curves = els.map(id => curvePoints(id).points);
  const top = Math.max(maxHours, ...curves.map(c => c[c.length - 1].hours), 1);
  const step = top <= 10 ? 0.5 : top <= 40 ? 2 : 5;
  const out = [];
  for (let h = 0; h <= top + 1e-9; h += step) out.push({ hours: Math.round(h * 10) / 10, progress: median(curves.map(c => progressAt(c, h))) ?? 0 });
  return { learners: els.length, points: out };
}

export function learningCurve(elId) {
  const el = dal.one('SELECT engagement_id FROM engagement_learners WHERE id = ?', elId);
  if (!el) return null;
  const { points, mastered } = curvePoints(elId);
  const loops = mastered.map(m => ({ node: m.node_label, loops: m.loops }));
  const trend = loops.length >= 3 ? theilSen(loops.map(l => l.loops)) : null;
  const checks = dal.one(`SELECT COUNT(*) n,
      SUM(CASE WHEN assurance IN ('A1','A2','A3') THEN 1 ELSE 0 END) a1,
      SUM(CASE WHEN assurance IN ('A2','A3') THEN 1 ELSE 0 END) a2,
      SUM(CASE WHEN purpose = 'testout' AND passed = 1 THEN 1 ELSE 0 END) testouts
    FROM evidence_records WHERE el_id = ? AND purpose IN ('check','testout','review','renewal')`, elId);
  const reviews = dal.one("SELECT COUNT(*) n, SUM(passed) passed FROM demonstrations WHERE el_id = ? AND kind = 'review'", elId);
  const share = (a, n) => (n ? Math.round((a / n) * 1000) / 10 : null);
  return {
    points,
    cohort_median: cohortMedianCurve(el.engagement_id, points[points.length - 1].hours),
    loops,
    loops_trend: trend == null ? null : Math.round(trend * 100) / 100,
    loops_trend_label: trend == null ? 'Not enough nodes yet' : trend < -0.05 ? 'Falling — getting better at learning' : trend > 0.05 ? 'Rising' : 'Steady',
    rates: {
      test_out_rate: share(checks.testouts || 0, mastered.length),
      review_pass_rate: share(reviews.passed || 0, reviews.n),
      checks_at_a1_plus: share(checks.a1 || 0, checks.n),
      checks_at_a2_plus: share(checks.a2 || 0, checks.n)
    },
    counts: { mastered: mastered.length, checks: checks.n, reviews: reviews.n }
  };
}
