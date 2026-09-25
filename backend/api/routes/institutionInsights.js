// api/routes/institutionInsights.js — Curriculum vs market, Where we stand.
// Mounted at /api/institution. JD figures are sample data (sample: true in
// every response); pathway coverage, mastery and job-match are computed from
// the institution's own pathways and students' verified skills.
const express = require('express');
const { getDb } = require('../../db/init');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { staffMiddleware, findScopedEngagement, scopeClause } = require('../middleware/staff');
const { curriculumCoverage, cohortStanding } = require('../../core/insights');
const market = require('../../core/market/sampleMarket');

const router = express.Router();
router.use(authenticateToken);
router.use(requireRole('institution'));
router.use(...staffMiddleware);

function cohortsInScope(db, req) {
  const scope = scopeClause(db, req, 'e.id');
  return db.prepare(`
    SELECT e.id, e.title, e.capability_target_id, ct.title as ct_title, ct.version as ct_version
    FROM engagements e JOIN capability_targets ct ON ct.id = e.capability_target_id
    WHERE e.institution_id = ? ${scope.sql} ORDER BY e.created_at DESC
  `).all(req.user.id, ...scope.params);
}

// ?engagement_id= (defaults to the most recent cohort in scope)
router.get('/insights/curriculum', (req, res) => {
  const db = getDb();
  try {
    const cohorts = cohortsInScope(db, req);
    const pick = req.query.engagement_id ? cohorts.find(c => c.id === req.query.engagement_id) : cohorts[0];
    if (!pick) return res.json({ cohorts, empty: true });
    const data = curriculumCoverage(db, { capabilityTargetId: pick.capability_target_id, engagementId: pick.id });
    res.json({ cohorts, cohort: pick, regions: Object.keys(market.MONTHLY_DEMAND).filter(c => c !== 'all'), ...data });
  } finally {
    db.close();
  }
});

// ?engagement_id=&compare=regional|last_year|<other engagement id>&roles=a,b
router.get('/insights/standing', (req, res) => {
  const db = getDb();
  try {
    const cohorts = cohortsInScope(db, req);
    const pickId = req.query.engagement_id || (cohorts[0] && cohorts[0].id);
    const engagement = pickId ? findScopedEngagement(db, req, pickId) : null;
    if (!engagement) return res.json({ cohorts, empty: true });
    const compare = req.query.compare || 'regional';
    let compareEngagement = null;
    if (!market.BENCHMARKS[compare]) {
      compareEngagement = findScopedEngagement(db, req, compare);
      if (!compareEngagement) return res.status(404).json({ error: 'Comparison cohort not found' });
    }
    // Target roles: ?roles=, else what the cohort's professors set on their profiles.
    let roles = req.query.roles ? String(req.query.roles).split(',').map(s => s.trim()).filter(Boolean) : null;
    if (!roles) {
      const set = db.prepare(`SELECT u.target_roles FROM staff_cohorts sc JOIN institution_users u ON u.id = sc.staff_id WHERE sc.engagement_id = ?`).all(engagement.id)
        .flatMap(r => { try { return JSON.parse(r.target_roles || '[]'); } catch { return []; } });
      roles = set.length ? [...new Set(set)] : null;
    }
    const data = cohortStanding(db, engagement, { roles, compare: compareEngagement ? 'engagement' : compare, compareEngagement });
    res.json({
      cohorts, cohort: { id: engagement.id, title: engagement.title },
      compare_options: [
        ...Object.entries(market.BENCHMARKS).map(([id, b]) => ({ id, label: b.label, sample: true })),
        ...cohorts.filter(c => c.id !== engagement.id).map(c => ({ id: c.id, label: c.title, sample: false }))
      ],
      compare, all_roles: [...new Set(market.JOBS.map(j => j.role))],
      ...data
    });
  } finally {
    db.close();
  }
});

module.exports = router;
