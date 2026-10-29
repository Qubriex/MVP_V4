// api/routes/demo.js — the public working demo ("Try Qubirex as…", /demo).
//
// A visitor picks a sample person; POST /start builds them a private sandbox
// (core/demo/world.js) and signs them in as that person with a real, short
// demo session. From then on they use the real product — real API, real rows,
// real AI within a budget — inside their sandbox only:
//   - every row of the sandbox is in its own world (core/testTenant.js), so
//     real, test and other sandboxes never see it, and it never sees them;
//   - nothing leaves it: mail and WhatsApp land in the Demo inbox;
//   - its Passports are signed with the separate demo key and marked DEMO;
//   - AI use is capped per sandbox and per day (core/demo/budget.js);
//   - it is deleted 4 hours after it starts, or after 2 hours idle
//     (core/demo/cleanup.js, run on each new start and by the daily cron).
//
// The sandbox key is an httpOnly cookie (qbx_demo); POST /switch uses it to
// sign the visitor in as another sample person in the same sandbox, so they
// can see both sides of one action. Off unless DEMO_ENABLED=true.
//
//   GET  /status                    { enabled, personas, ai_mode }
//   POST /start   { persona }       new sandbox + session for that person
//   POST /switch  { persona }       another person, same sandbox
//   GET  /me                        the visitor's sandbox: persona, ends, story, AI use
//   GET  /inbox                     messages that would have been sent
//   POST /story   { step }          mark a guided-story step done
//   POST /reset                     a fresh sandbox, same person
//   POST /exit                      delete the sandbox and sign out
import express from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import * as dal from '../../core/db/dal.js';
import { logger } from '../../core/logger.js';
import { withContext } from '../../core/requestContext.js';
import { afterLearnerSignIn } from '../../core/devices.js';
import { buildWorld, newSandboxId, idsFor, PERSONAS, SAMPLE_JD } from '../../core/demo/world.js';
import { deleteSandbox, deleteExpired } from '../../core/demo/cleanup.js';
import { demoAiState, demoLimits } from '../../core/demo/budget.js';
import { issueCredential, setPublic } from '../../core/return/credentialEngine.js';
import { issueSession, parseCookies, clearSessionCookies, DEMO_IDLE_MS } from '../middleware/auth.js';
import { clientIp } from '../middleware/rateLimit.js';

const router = express.Router();
export const DEMO_COOKIE = 'qbx_demo';
const HARD_MS = 4 * 3600000;
export const STORY_STEPS = ['jd', 'search', 'request', 'approve', 'unlocked', 'dayone', 'lesson', 'bridge'];

const v2 = (res, status, code, message) => res.status(status).json({ error: { code, message } });
const num = (v, d) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);
export const demoEnabled = (env = process.env) => env.DEMO_ENABLED === 'true';
const limits = () => ({ perIpPerHour: num(process.env.DEMO_STARTS_PER_HOUR, 5), maxActive: num(process.env.DEMO_MAX_ACTIVE, 300) });

// The demo cookie: an HMAC token naming the sandbox, separate from sessions.
const cookieKey = () => crypto.createHmac('sha256', String(process.env.JWT_SECRET)).update('demo-sandbox-cookie').digest('base64url');
function setDemoCookie(res, sbx, expiresAt) {
  const token = jwt.sign({ typ: 'demo', sbx }, cookieKey(), { audience: 'qubirex-demo', expiresIn: Math.max(60, Math.floor((new Date(expiresAt) - Date.now()) / 1000)) });
  res.cookie(DEMO_COOKIE, token, { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/api', maxAge: HARD_MS });
}
function sandboxFromCookie(req) {
  try { return jwt.verify(parseCookies(req.headers.cookie)[DEMO_COOKIE] || '', cookieKey(), { audience: 'qubirex-demo' }).sbx; } catch { return null; }
}
async function liveSandbox(sbx) {
  if (!sbx) return null;
  const sb = await dal.one('SELECT * FROM demo_sandboxes WHERE id = ? AND deleted_at IS NULL', sbx);
  if (!sb || sb.expires_at <= dal.nowIso() || new Date(sb.last_active_at).getTime() < Date.now() - DEMO_IDLE_MS) return null;
  return sb;
}
const endsAt = (sb) => new Date(Math.min(new Date(sb.expires_at).getTime(), new Date(sb.last_active_at).getTime() + DEMO_IDLE_MS)).toISOString();

// Off: every path falls through to the ordinary 404, except /status, which
// lets the page say the demo is not switched on.
router.use((req, res, next) => (demoEnabled() || req.path === '/status' ? next() : next('router')));

// Optional bot check (Cloudflare Turnstile) when TURNSTILE_SECRET_KEY is set.
async function humanCheck(req) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  const token = String(req.body?.turnstile || '');
  if (!token) return false;
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token, remoteip: clientIp(req) })
    });
    return !!(await r.json())?.success;
  } catch { return false; }
}

/** Sign in as one sample person of a sandbox. */
async function personaSession(req, res, sb, persona) {
  const p = PERSONAS[persona];
  const ids = idsFor(sb.id);
  const demo = { sandboxId: sb.id, expiresAt: sb.expires_at };
  await dal.run('UPDATE auth_sessions SET revoked_at = ? WHERE sandbox_id = ? AND revoked_at IS NULL', dal.nowIso(), sb.id);
  await dal.run('UPDATE demo_sandboxes SET persona = ?, last_active_at = ? WHERE id = ?', persona, dal.nowIso(), sb.id);
  if (!p.actor) {
    clearSessionCookies(res);
    const ev = await dal.one('SELECT evidence_id FROM credentials WHERE learner_id = ? AND active = 1', ids.learner('l01'));
    return { role: null, user: null, token: null, home: ev ? `/verify/${ev.evidence_id}` : '/verify' };
  }
  let session; let user; let role;
  if (p.actor === 'learner') {
    const row = await dal.one(`SELECT l.id, l.name, l.learner_ref, el.id AS el_id, el.engagement_id, e.language FROM learners l
      JOIN engagement_learners el ON el.learner_id = l.id JOIN engagements e ON e.id = el.engagement_id WHERE l.id = ? AND el.id = ?`, ids.learner(p.key), ids.el(p.key));
    session = await issueSession(res, { actorType: 'learner', actorId: row.id, institutionId: ids.institution, req, demo,
      claims: { id: row.id, el_id: row.el_id, engagement_id: row.engagement_id, language: row.language } });
    await afterLearnerSignIn({ sessionId: session.sessionId, learnerId: row.id, elId: row.el_id, institutionId: ids.institution, req });
    user = { id: row.id, name: row.name, language: row.language, learner_ref: row.learner_ref }; role = 'learner';
  } else if (p.actor === 'staff') {
    const row = await dal.one('SELECT u.*, i.name AS institution_name FROM institution_users u JOIN institutions i ON i.id = u.institution_id WHERE u.id = ?', ids.staff(p.key));
    session = await issueSession(res, { actorType: 'staff', actorId: row.id, institutionId: ids.institution, req, demo, claims: { id: ids.institution, staff_id: row.id, name: row.name } });
    user = { id: row.id, name: row.name, title: row.title, role: row.role, department: row.department, profile_completed: true, institution_name: row.institution_name }; role = 'institution';
  } else {
    const row = await dal.one('SELECT id, email, employer_id FROM employer_users WHERE id = ?', ids.employerUser(p.key));
    session = await issueSession(res, { actorType: 'employer', actorId: row.id, employerId: row.employer_id, req, demo, claims: { id: row.id, employer_id: row.employer_id } });
    user = { email: row.email, employer_id: row.employer_id }; role = 'employer';
  }
  return { token: session.token, csrf_token: session.csrfToken, role, user, home: p.home };
}

async function createSandbox(req, persona) {
  const sbx = newSandboxId();
  const now = dal.nowIso();
  const expires = new Date(Date.now() + HARD_MS).toISOString();
  await dal.tx(async () => {
    await dal.run(`INSERT INTO demo_sandboxes (id, persona, ip, created_at, last_active_at, expires_at, story_json) VALUES (?, ?, ?, ?, ?, ?, '[]')`, sbx, persona, clientIp(req), now, now, expires);
    await buildWorld(sbx);
  });
  // Lakshmi's Passport, signed with the demo key and public, so the Verifier
  // persona has something real to check.
  await withContext({ sandboxId: sbx }, async () => {
    const lk = idsFor(sbx);
    const c = await issueCredential(lk.el('l01'));
    if (c) await setPublic(c.evidence_id, lk.learner('l01'), true);
  });
  return dal.one('SELECT * FROM demo_sandboxes WHERE id = ?', sbx);
}

const inSandbox = (sbx, fn) => withContext({ sandboxId: sbx }, fn);

// ─── Routes ──────────────────────────────────────────────────────────────────
router.get('/status', async (req, res) => {
  if (!demoEnabled()) return res.json({ enabled: false });
  const ai = await demoAiState('');
  res.json({ enabled: true, personas: Object.keys(PERSONAS), ai_mode: ai.mode === 'limit_reached' ? 'live' : ai.mode, idle_minutes: DEMO_IDLE_MS / 60000, hours: HARD_MS / 3600000 });
});

router.post('/start', async (req, res) => {
  const persona = String(req.body?.persona || '');
  if (!Object.prototype.hasOwnProperty.call(PERSONAS, persona)) return v2(res, 400, 'persona', 'Pick one of the sample people.');
  const L = limits();
  const ip = clientIp(req);
  const recent = Number((await dal.one('SELECT COUNT(*) AS n FROM demo_sandboxes WHERE ip = ? AND created_at >= ?', ip, new Date(Date.now() - 3600000).toISOString())).n);
  if (recent >= L.perIpPerHour) { res.set('Retry-After', '3600'); return v2(res, 429, 'rate_limited', 'You have started several demos in the last hour. Please try again a little later.'); }
  if (!await humanCheck(req)) return v2(res, 403, 'bot_check', 'Please complete the check that you are not a robot.');

  const started = Date.now();
  // A visitor starting again leaves their old sandbox behind: delete it now.
  const old = sandboxFromCookie(req);
  if (old) await deleteSandbox(old).catch(() => {});
  await deleteExpired({ limit: 3 }).catch(err => logger.warn('demo.lazy_cleanup_failed', { error: err.message }));
  const active = Number((await dal.one('SELECT COUNT(*) AS n FROM demo_sandboxes WHERE deleted_at IS NULL AND expires_at > ?', dal.nowIso())).n);
  if (active >= L.maxActive) return v2(res, 503, 'busy', 'The demo is very busy right now. Please try again in a few minutes.');

  const sb = await createSandbox(req, persona);
  setDemoCookie(res, sb.id, sb.expires_at);
  const out = await inSandbox(sb.id, () => personaSession(req, res, sb, persona));
  logger.info('demo.started', { persona, ms: Date.now() - started });
  res.status(201).json({ ...out, persona, ends_at: endsAt(sb), setup_ms: Date.now() - started });
});

async function requireSandbox(req, res, next) {
  const sb = await liveSandbox(sandboxFromCookie(req));
  if (!sb) return v2(res, 401, 'demo_ended', 'This demo has ended. Start a new one.');
  req.sandbox = sb;
  return inSandbox(sb.id, next);
}

router.post('/switch', requireSandbox, async (req, res) => {
  const persona = String(req.body?.persona || '');
  if (!Object.prototype.hasOwnProperty.call(PERSONAS, persona)) return v2(res, 400, 'persona', 'Pick one of the sample people.');
  res.json({ ...await personaSession(req, res, req.sandbox, persona), persona, ends_at: endsAt(req.sandbox) });
});

// Guided-story steps done, read from what the visitor actually did in the
// sandbox (plus any marked by hand).
async function storyProgress(sb) {
  const ids = idsFor(sb.id);
  const e1 = ids.employer('e1');
  const stages = (await dal.all('SELECT stage FROM employer_pipeline WHERE employer_id = ?', e1)).map(r => r.stage);
  const after = (list) => stages.some(st => list.includes(st));
  const roles = Number((await dal.one('SELECT COUNT(*) AS n FROM employer_roles WHERE employer_id = ?', e1)).n);
  const lesson = await dal.one('SELECT 1 FROM learning_sessions WHERE engagement_learner_id = ? AND started_at >= ?', ids.el('l01'), sb.created_at.replace('T', ' ').slice(0, 19));
  const bridge = await dal.one('SELECT 1 FROM bridge_programmes WHERE institution_id = ?', ids.institution);
  const done = new Set();
  if (roles > 2) done.add('jd');
  if (stages.length) { done.add('search'); done.add('request'); }
  if (after(['access_granted', 'interview', 'dayone', 'offer', 'hired'])) done.add('approve');
  if (after(['interview', 'dayone', 'offer', 'hired'])) done.add('unlocked');
  if (after(['dayone', 'offer', 'hired'])) done.add('dayone');
  if (lesson) done.add('lesson');
  if (bridge) done.add('bridge');
  let marked = [];
  try { marked = JSON.parse(sb.story_json || '[]'); } catch { marked = []; }
  marked.forEach(m => done.add(m));
  return STORY_STEPS.filter(st => done.has(st));
}

router.get('/me', requireSandbox, async (req, res) => {
  const sb = req.sandbox;
  const ids = idsFor(sb.id);
  const unread = Number((await dal.one('SELECT COUNT(*) AS n FROM outbound_messages WHERE sandbox_id = ?', sb.id)).n);
  const ev = await dal.one('SELECT evidence_id FROM credentials WHERE learner_id = ? AND active = 1', ids.learner('l01'));
  const story = await storyProgress(sb);
  res.set('Cache-Control', 'no-store');
  res.json({
    persona: sb.persona, ends_at: endsAt(sb), started_at: sb.created_at, story, steps: STORY_STEPS, inbox_count: unread,
    ai: await demoAiState(sb.id), limits: demoLimits(), sample_jd: SAMPLE_JD, lakshmi_evidence_id: ev?.evidence_id || null,
    sample_role_id: `${ids.employer('e1')}-r1`, lakshmi_ref: ids.el('l01')
  });
});

router.get('/inbox', requireSandbox, async (req, res) => {
  const rows = await dal.all(`SELECT id, channel, to_email AS recipient, subject, body, kind, created_at FROM outbound_messages
    WHERE sandbox_id = ? ORDER BY created_at DESC LIMIT 100`, req.sandbox.id);
  res.set('Cache-Control', 'no-store');
  res.json({ messages: rows });
});

router.post('/story', requireSandbox, async (req, res) => {
  const step = String(req.body?.step || '');
  if (!STORY_STEPS.includes(step)) return v2(res, 400, 'step', 'Unknown step.');
  let story = [];
  try { story = JSON.parse(req.sandbox.story_json || '[]'); } catch { story = []; }
  if (!story.includes(step)) story.push(step);
  await dal.run('UPDATE demo_sandboxes SET story_json = ? WHERE id = ?', JSON.stringify(story), req.sandbox.id);
  res.json({ story });
});

router.post('/reset', requireSandbox, async (req, res) => {
  const persona = req.sandbox.persona;
  await deleteSandbox(req.sandbox.id);
  const sb = await createSandbox(req, persona);
  setDemoCookie(res, sb.id, sb.expires_at);
  res.json({ ...await inSandbox(sb.id, () => personaSession(req, res, sb, persona)), persona, ends_at: endsAt(sb) });
});

router.post('/exit', async (req, res) => {
  const sbx = sandboxFromCookie(req);
  if (sbx) await deleteSandbox(sbx).catch(() => {});
  clearSessionCookies(res);
  res.clearCookie(DEMO_COOKIE, { path: '/api' });
  res.json({ ok: true });
});

export default router;
