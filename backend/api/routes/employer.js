// api/routes/employer.js — Employer portal (/api/employer)
// Phase 0 foundation: the account itself. Roles, search, access requests and
// pipeline arrive in Phase 1 (spec §5). Errors use {error: {code, message}}.
//
// Structural wall: this module may not import session, memory, provenance,
// CKB-usage or evaluation stores, directly or transitively.
import express from 'express';
import { authenticate, requireActor } from '../middleware/auth.js';
import { loadEmployer } from '../middleware/employerAuth.js';

const router = express.Router();
router.use(authenticate({ errors: 'v2' }), requireActor('employer'), loadEmployer);

router.get('/me', (req, res) => {
  const { id, email, name, role } = req.employerUser;
  res.json({ user: { id, email, name, role }, employer: req.employer });
});

export default router;
