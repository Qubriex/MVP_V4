// api/routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../../db/init');
require('dotenv').config();

const router = express.Router();

// ─── Institution login ────────────────────────────────────────────────────────
router.post('/institution/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const db = getDb();
  const institution = db.prepare('SELECT * FROM institutions WHERE contact_email = ?').get(email);
  db.close();

  if (!institution || !bcrypt.compareSync(password, institution.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { id: institution.id, role: 'institution', name: institution.name },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({ token, institution: { id: institution.id, name: institution.name, type: institution.type } });
});

// ─── Institution register ─────────────────────────────────────────────────────
router.post('/institution/register', (req, res) => {
  const { name, type, contact_name, contact_email, contact_phone, city, password } = req.body;
  if (!name || !contact_email || !password) {
    return res.status(400).json({ error: 'Name, email and password required' });
  }

  const db = getDb();
  const existing = db.prepare('SELECT id FROM institutions WHERE contact_email = ?').get(contact_email);
  if (existing) { db.close(); return res.status(409).json({ error: 'Email already registered' }); }

  const id = uuidv4();
  const password_hash = bcrypt.hashSync(password, 10);
  db.prepare(`
    INSERT INTO institutions (id, name, type, contact_name, contact_email, contact_phone, city, password_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, type || 'other', contact_name, contact_email, contact_phone, city || 'Hyderabad', password_hash);
  db.close();

  res.status(201).json({ message: 'Institution registered successfully', id });
});

// ─── Learner login (learner_ref + engagement code + PIN) ─────────────────────
// engagement_id and learner_ref are both distributed to a whole cohort, so
// neither is a secret on its own — pin is the factor that makes this a real
// login rather than "anyone who knows the engagement ID can read anyone
// else's private doubts and session history."
router.post('/learner/login', (req, res) => {
  const { learner_ref, engagement_id, pin } = req.body;
  if (!learner_ref || !engagement_id || !pin) {
    return res.status(400).json({ error: 'Learner reference, engagement ID, and PIN required' });
  }

  const db = getDb();
  const data = db.prepare(`
    SELECT l.*, el.id as el_id, el.engagement_id, e.language,
           el.current_node_id, el.overall_status
    FROM learners l
    JOIN engagement_learners el ON el.learner_id = l.id
    JOIN engagements e ON e.id = el.engagement_id
    WHERE l.learner_ref = ? AND el.engagement_id = ?
  `).get(learner_ref, engagement_id);
  db.close();

  if (!data) return res.status(401).json({ error: 'Learner not found in this engagement' });
  if (!data.pin_hash || !bcrypt.compareSync(pin, data.pin_hash)) {
    return res.status(401).json({ error: 'Invalid PIN' });
  }

  const token = jwt.sign(
    { id: data.id, el_id: data.el_id, engagement_id, role: 'learner', language: data.language },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({ token, learner: { id: data.id, name: data.name, language: data.language, learner_ref: data.learner_ref } });
});

// ─── Admin login ──────────────────────────────────────────────────────────────
router.post('/admin/login', (req, res) => {
  const { email, password } = req.body;
  const db = getDb();
  const admin = db.prepare('SELECT * FROM admin_users WHERE email = ?').get(email);
  db.close();

  if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { id: admin.id, role: 'admin', email: admin.email },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  );
  res.json({ token });
});

module.exports = router;
