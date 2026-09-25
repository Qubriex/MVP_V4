// api/middleware/auth.js
const jwt = require('jsonwebtoken');
require('dotenv').config();

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

// Learner tokens last 7 days, so removal must be checked per request:
// removing a student's access (or deactivating them) signs them out at once.
function requireActiveLearner(req, res, next) {
  if (req.user.role !== 'learner') return next();
  const { getDb } = require('../../db/init');
  const db = getDb();
  const row = db.prepare(`
    SELECT el.access_status, el.engagement_id, l.is_active FROM engagement_learners el JOIN learners l ON l.id = el.learner_id
    WHERE el.id = ? AND l.id = ?
  `).get(req.user.el_id, req.user.id);
  db.close();
  if (!row || row.access_status === 'removed' || !row.is_active) {
    return res.status(401).json({ error: 'Your access to this cohort was removed. Please contact your institution.' });
  }
  if (row.engagement_id !== req.user.engagement_id) {
    return res.status(401).json({ error: 'You were moved to another cohort. Sign in again with its join code.' });
  }
  next();
}

module.exports = { authenticateToken, requireRole, requireActiveLearner };
