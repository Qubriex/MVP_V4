// core/readiness/cohort.js
// Readiness for every student in a cohort, one shared definition (v4.3 §12,
// canvas "Why Nearly ready?"):
//   readiness = match with the best-fitting target role, on VERIFIED skills
//               only (mastered nodes covering the JD's skills), 0–100
//   Ready ≥ 80 · Nearly ready 60–79 · Building < 60
// Also the required skills still missing for that role. Used by Ask Qubirex,
// the cohort grid, the institution overview, bridge programmes and employer
// search, so every screen shows the same number. Cached per cohort for a
// minute; mastery changes are rare within that window.
import { readinessTimeline } from '../insights.js';
import { legacyHandle as getDb } from '../db/dal.js';

export const BANDS = Object.freeze({ ready: 80, nearly: 60 });
export const bandOf = (r) => (r >= BANDS.ready ? 'ready' : r >= BANDS.nearly ? 'nearly' : 'building');
export const BAND_LABEL = { ready: 'Ready', nearly: 'Nearly ready', building: 'Building' };

const cache = new Map(); // engagementId → { at, rows }
const TTL = 60000;
export const dropReadinessCache = (engagementId) => (engagementId ? cache.delete(engagementId) : cache.clear());

/**
 * @param {{id: string, capability_target_id: string, institution_id: string}} engagement
 * @returns {Promise<{el_id, learner_id, name, learner_ref, readiness, band, role, below_requirements, nodes_mastered}[]>}
 */
export async function cohortReadiness(engagement) {
  const hit = cache.get(engagement.id);
  if (hit && Date.now() - hit.at < TTL) return hit.rows;
  const db = getDb();
  const students = await db.prepare(`SELECT el.id AS el_id, l.id AS learner_id, l.name, l.learner_ref,
      (SELECT COUNT(*) FROM node_mastery nm WHERE nm.engagement_learner_id = el.id AND nm.advanced_at IS NOT NULL) AS nodes_mastered
    FROM engagement_learners el JOIN learners l ON l.id = el.learner_id
    WHERE el.engagement_id = ? AND COALESCE(el.access_status, 'active') != 'removed' ORDER BY l.name`).all(engagement.id);
  const today = new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
  const r = await readinessTimeline(db, engagement, students.map(s => s.el_id), [today]);
  const rows = students.map(s => {
    const x = r.get(s.el_id) || { match: 0, role: null, below_requirements: [] };
    return { ...s, nodes_mastered: Number(s.nodes_mastered) || 0, readiness: x.match, band: bandOf(x.match), role: x.role, below_requirements: x.below_requirements };
  });
  cache.set(engagement.id, { at: Date.now(), rows });
  return rows;
}

/** Counts per band, and the skill that most often stands between Nearly ready and Ready. */
export function summarise(rows) {
  const counts = { ready: 0, nearly: 0, building: 0 };
  rows.forEach(r => { counts[r.band] += 1; });
  const gaps = new Map();
  rows.filter(r => r.band === 'nearly').forEach(r => r.below_requirements.forEach(s => gaps.set(s, (gaps.get(s) || 0) + 1)));
  const topGap = [...gaps.entries()].sort((a, b) => b[1] - a[1])[0] || null;
  return { counts, total: rows.length, top_gap: topGap ? { skill: topGap[0], students: topGap[1] } : null };
}
