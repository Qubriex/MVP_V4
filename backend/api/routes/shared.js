// api/routes/shared.js — the shared kit, for every signed-in side (v4.3 canvas).
//   GET  /api/notifications              stored + live notifications, unread count, channels
//   POST /api/notifications/read-all
//   PUT  /api/notifications/channels     { email, whatsapp, sms }
//   POST /api/assist/ask                 { question, lang } → Ask Qubirex (own data only)
//   POST /api/help/contact               { type, message, reply_to? } (signed in or not)
//   GET  /api/help/status                is the service up (public)
//   GET  /api/glossary                   the plain-words glossary (public)
import express from 'express';
import * as dal from '../../core/db/dal.js';
import { ulid } from '../../core/db/ulid.js';
import { authenticate } from '../middleware/auth.js';
import { loadStaff } from '../middleware/staff.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { listFor, markAllRead, setChannels } from '../../core/notify.js';
import { ask, GLOSSARY } from '../../core/assist.js';
import { aiNotConfigured, AI_NOT_CONFIGURED } from '../../core/ai/gateway.js';

const router = express.Router();
const signedIn = authenticate();
// Staff need their role and cohort scope loaded (professors see their cohorts only).
const withStaff = (req, res, next) => (req.session?.actor_type === 'staff' ? loadStaff(req, res, next) : next());

router.get('/notifications', signedIn, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(await listFor(req));
});
router.post('/notifications/read-all', signedIn, async (req, res) => {
  await markAllRead(req);
  res.json({ ok: true });
});
router.put('/notifications/channels', signedIn, async (req, res) => {
  res.json({ channels: await setChannels(req, req.body || {}) });
});

const askLimit = rateLimit({ name: 'assist:ask', limit: 40, windowMs: 3600000, key: (req) => `${req.session?.actor_type}:${req.session?.actor_id}` });
router.post('/assist/ask', signedIn, withStaff, askLimit, async (req, res) => {
  const question = String(req.body?.question || '').trim();
  if (!question) return res.status(400).json({ error: 'Type or say a question.' });
  try {
    res.json(await ask(req, { question, lang: req.body?.lang }));
  } catch (err) {
    if (aiNotConfigured(err)) return res.status(503).json({ error: AI_NOT_CONFIGURED });
    req.log?.warn?.('assist.failed', { error: err.message });
    res.status(502).json({ error: 'Ask Qubirex could not answer right now. Please try again.' });
  }
});

const contactLimit = rateLimit({ name: 'help:contact', limit: 10, windowMs: 3600000 });
router.post('/help/contact', contactLimit, async (req, res, next) => {
  // Optional sign-in: use it when present, but allow the public site too.
  if (req.headers.authorization || /qbx_session/.test(req.headers.cookie || '')) return signedIn(req, res, next);
  return next();
}, async (req, res) => {
  const type = ['question', 'problem', 'data_request', 'grievance'].includes(req.body?.type) ? req.body.type : 'question';
  const message = String(req.body?.message || '').trim().slice(0, 4000);
  if (message.length < 5) return res.status(400).json({ error: 'Please write a little more so we can help.' });
  const s = req.session;
  await dal.run(`INSERT INTO help_requests (id, actor_type, actor_id, institution_id, employer_id, type, message, reply_to, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, ulid(), s?.actor_type || 'public', s?.actor_id || null, s?.institution_id || null, s?.employer_id || null,
  type, message, String(req.body?.reply_to || '').slice(0, 200) || null, dal.nowIso());
  res.status(201).json({ message: 'Thanks — we reply on WhatsApp or email within 1 working day.' });
});

router.get('/help/status', async (req, res) => {
  let db = false;
  try { await dal.one('SELECT 1 AS ok'); db = true; } catch { db = false; }
  res.set('Cache-Control', 'no-store');
  res.json({ ok: db, database: db, ai: !!process.env.GEMINI_API_KEY, checked_at: new Date().toISOString() });
});

router.get('/glossary', (req, res) => res.json(GLOSSARY));

export default router;
