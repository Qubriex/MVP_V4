// server.js — Qubirex Backend (Inferexaa Private Limited)
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDb } = require('./db/init');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true }));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth',        require('./api/routes/auth'));
app.use('/api/institution', require('./api/routes/institution'));
app.use('/api/learner',     require('./api/routes/learner'));
app.use('/api/admin',       require('./api/routes/admin'));

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({
  status: 'ok',
  service: 'Qubirex',
  company: 'Inferexaa Private Limited',
  tagline: 'Receive. Build. Return.',
  timestamp: new Date().toISOString()
}));

// ─── Error handler ────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Start ────────────────────────────────────────────────────────────────────
initDb();
app.listen(PORT, () => {
  console.log(`\nQubirex backend running on http://localhost:${PORT}`);
  console.log(`   RECEIVE · BUILD · RETURN\n`);
});
