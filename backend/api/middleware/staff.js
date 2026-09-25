// api/middleware/staff.js
// ─────────────────────────────────────────────────────────────────────────────
// Institution staff: who is signed in, what they may do, which cohorts they
// see. Runs after authenticateToken + requireRole('institution', 'admin').
//
// The token's `id` is always the institution id (existing routes rely on
// req.user.id), and `staff_id` names the staff row. Role and status are read
// from the database on every request, so disabling someone or changing their
// role takes effect immediately, not when their token expires.
//
//   admin     — everything in the institution
//   professor — only cohorts in staff_cohorts; can manage students there
//   viewer    — read-only; sees all cohorts (placement cell, HOD)
//
// Tokens issued before staff accounts existed have no staff_id: they are the
// institution's contact login and act as admin.
// ─────────────────────────────────────────────────────────────────────────────
const { getDb } = require('../../db/init');

function loadStaff(req, res, next) {
  if (req.user.role === 'admin') { // Inferexaa platform admin
    req.staff = { id: null, role: 'admin', name: 'Qubirex admin', platformAdmin: true };
    return next();
  }
  if (!req.user.staff_id) {
    req.staff = { id: null, role: 'admin', name: req.user.name };
    return next();
  }
  const db = getDb();
  const row = db.prepare('SELECT id, name, title, role, status, department FROM institution_users WHERE id = ? AND institution_id = ?')
    .get(req.user.staff_id, req.user.id);
  db.close();
  if (!row || row.status !== 'active') return res.status(401).json({ error: 'Your staff account is not active. Ask your institution admin.' });
  req.staff = row;
  next();
}

function requireStaffRole(...roles) {
  return (req, res, next) => (roles.includes(req.staff.role)
    ? next()
    : res.status(403).json({ error: `This needs the ${roles.join(' or ')} role.` }));
}

// Viewers may read everything in scope and edit only their own profile.
function blockViewerWrites(req, res, next) {
  if (req.staff.role !== 'viewer' || req.method === 'GET' || req.path.startsWith('/me')) return next();
  return res.status(403).json({ error: 'Viewers have read-only access.' });
}

// Engagement ids the caller may see, or null for "all in the institution".
function scopedEngagementIds(db, req) {
  if (req.staff.role !== 'professor') return null;
  return db.prepare('SELECT engagement_id FROM staff_cohorts WHERE staff_id = ?').all(req.staff.id).map(r => r.engagement_id);
}

// The engagement if it belongs to the caller's institution and is in scope.
function findScopedEngagement(db, req, engagementId) {
  const e = db.prepare('SELECT * FROM engagements WHERE id = ? AND institution_id = ?').get(engagementId, req.user.id);
  if (!e) return null;
  const scope = scopedEngagementIds(db, req);
  return !scope || scope.includes(e.id) ? e : null;
}

// SQL fragment + params restricting `alias.engagement_id` (or e.id) to scope.
function scopeClause(db, req, column) {
  const scope = scopedEngagementIds(db, req);
  if (!scope) return { sql: '', params: [] };
  if (!scope.length) return { sql: ' AND 0', params: [] };
  return { sql: ` AND ${column} IN (${scope.map(() => '?').join(',')})`, params: scope };
}

const staffMiddleware = [loadStaff, blockViewerWrites];

module.exports = { loadStaff, requireStaffRole, blockViewerWrites, scopedEngagementIds, findScopedEngagement, scopeClause, staffMiddleware };
