// api/routes/shared.js — the shared kit, for every signed-in side (v4.3 canvas).
//   GET  /api/notifications              stored + live notifications, unread count, channels
//   POST /api/notifications/read-all
//   PUT  /api/notifications/channels     { email, whatsapp, sms }
//   POST /api/assist/ask                 { question, lang } → Ask Qubirex (own data only)
//   POST /api/help/contact               { type, message, reply_to? } (signed in or not)
//   GET  /api/help/status                is the service up (public)
//   GET  /api/glossary                   the plain-words glossary (public)
//   GET  /api/sample-lesson?lang=telugu  the home page's sample lesson, spoken (public)
import express from 'express';
import * as dal from '../../core/db/dal.js';
import { ulid } from '../../core/db/ulid.js';
import { authenticate } from '../middleware/auth.js';
import { loadStaff } from '../middleware/staff.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { listFor, markAllRead, setChannels } from '../../core/notify.js';
import { ask, GLOSSARY } from '../../core/assist.js';
import { aiNotConfigured, AI_NOT_CONFIGURED, synthesize } from '../../core/ai/gateway.js';
import { hit, clientIp } from '../middleware/rateLimit.js';

const router = express.Router();
const signedIn = authenticate();
const maybeSignedIn = authenticate({ optional: true });
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
// Sign-in is optional: a stale token from an old visit must not block (or
// redirect) a visitor who only wants to send a message.
router.post('/help/contact', contactLimit, maybeSignedIn, async (req, res) => {
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

// The home page's sample lesson in the server's teaching voice, so it plays
// on every device (most browsers have no Telugu or Hindi voice of their own).
// The text is fixed here — visitors cannot make it say anything else — and
// each language is made once, then served from memory.
export const SAMPLE_LESSON = {
  telugu: 'React లో component అంటే ఒక చిన్న భాగం. ఒక బటన్ గురించి ఆలోచించండి — ఒకసారి రాస్తే, ఎక్కడైనా వాడొచ్చు. ఇప్పుడు మీరే ఒకటి రాయండి.',
  hindi: 'React में component एक छोटा हिस्सा है। एक बटन के बारे में सोचिए — एक बार लिखो, कहीं भी इस्तेमाल करो। अब आप ख़ुद एक लिखिए।'
};
const sampleAudio = new Map();
router.get('/sample-lesson', async (req, res) => {
  const language = req.query.lang === 'hindi' ? 'hindi' : 'telugu';
  if (!sampleAudio.has(language)) {
    if (!hit('sample:lesson', clientIp(req), 20, 3600000).allowed) return res.status(429).json({ error: 'Please try again in a little while.' });
    try {
      const out = await synthesize({ text: SAMPLE_LESSON[language], language, institutionId: null });
      sampleAudio.set(language, out);
    } catch (err) {
      if (aiNotConfigured(err)) return res.status(503).json({ error: AI_NOT_CONFIGURED });
      req.log?.warn?.('sample_lesson.failed', { error: (err.cause || err).message });
      return res.status(502).json({ error: 'The sample voice is unavailable right now.' });
    }
  }
  const out = sampleAudio.get(language);
  res.set('Content-Type', out.mimeType);
  res.set('Cache-Control', 'public, max-age=86400');
  res.send(out.audio);
});

export default router;
