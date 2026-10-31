// api/routes/dev.js — developer login: one-click sign-in as the seeded test
// accounts, for the founder and the testing team (docs/DEPLOY-VERCEL.md).
//
// Safety, in the order every request meets it:
//   1. Off unless DEV_LOGIN_ENABLED=true (and DEV_LOGIN_SECRET is 32+
//      characters, and the IP is allowed when DEV_LOGIN_ALLOWED_IPS is set).
//      Otherwise every path here falls through to the ordinary 404.
//   2. POST /unlock checks the passcode on the server in constant time,
//      5 wrong tries per 15 minutes per IP (counted in dev_audit, so every
//      instance shares the count), and sets an 8-hour httpOnly unlock cookie.
//   3. Everything else needs that cookie. /login takes only an account_key
//      from core/testTenant.js DEV_ACCOUNTS and re-checks that the row is in
//      the test tenant by fixed ID before issuing a real session.
//   4. Every unlock, login, reset, skipped wait and end is written to
//      dev_audit (who, role, when, IP); the passcode never is.
import express from 'express';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as dal from '../../core/db/dal.js';
import { ulid } from '../../core/db/ulid.js';
import { logger } from '../../core/logger.js';
import { afterLearnerSignIn } from '../../core/devices.js';
import { authenticate, issueSession, revokeActorSessions, clearSessionCookies, parseCookies } from '../middleware/auth.js';
import { clientIp, resetRateLimitKeys } from '../middleware/rateLimit.js';
import {
  DEV_HOURS, DEV_UNLOCK_COOKIE, devLoginAvailable, passcodeMatches, signUnlock, verifyUnlock
} from '../../core/devLogin.js';
import {
  DEV_ACCOUNTS, TEST_INSTITUTION_ID, TEST_INSTITUTION_IDS, TEST_EMPLOYER_IDS, TEST_ADMIN_ID, TEST_ADMIN_EMAIL
} from '../../core/testTenant.js';
import { JOURNEY, STAGE_NAMES } from '../../core/journey/accounts.js';
import { runControl, controlsFor, testLearner } from '../../core/journey/controls.js';
import { createLearnerInvite } from '../../core/access.js';

const router = express.Router();
const UNLOCK_TRIES = 5;
const UNLOCK_WINDOW_MS = 15 * 60000;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const v2 = (res, status, code, message) => res.status(status).json({ error: { code, message } });
const inList = (ids) => ids.map(() => '?').join(', ');

async function audit(req, action, { accountKey = null, role = null, sessionId = null, detail = null } = {}) {
  await dal.run(`INSERT INTO dev_audit (id, action, account_key, role, session_id, ip, user_agent, detail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ulid(), action, accountKey, role, sessionId, clientIp(req), String(req.headers['user-agent'] || '').slice(0, 200), detail, dal.nowIso());
  logger.warn('dev_login.' + action, { accountKey, role, ip: clientIp(req) });
}

// A demo visitor's session token never reaches the developer login.
const demoToken = (req) => {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return false;
  try { return !!jwt.decode(h.slice(7))?.demo; } catch { return false; }
};

// 1. Disabled, misconfigured, not on the allowlist, or a demo session: as if this router did not exist.
router.use((req, res, next) => (devLoginAvailable(clientIp(req)) && !demoToken(req) ? next() : next('router')));

function unlockCookie(res, token) {
  res.cookie(DEV_UNLOCK_COOKIE, token, {
    httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/api/dev', maxAge: DEV_HOURS * 3600000
  });
}

const unlocked = (req) => verifyUnlock(parseCookies(req.headers.cookie)[DEV_UNLOCK_COOKIE]);

function requireUnlock(req, res, next) {
  const u = unlocked(req);
  if (!u) return v2(res, 401, 'locked', 'Enter the developer passcode first.');
  req.devUnlock = u;
  next();
}

// ─── Status and unlock ─────────────────────────────────────────────────────────
router.get('/status', (req, res) => {
  const u = unlocked(req);
  res.json({ enabled: true, unlocked: !!u, unlock_expires_at: u ? new Date(u.exp * 1000).toISOString() : null });
});

router.post('/unlock', async (req, res) => {
  const ip = clientIp(req);
  const since = new Date(Date.now() - UNLOCK_WINDOW_MS).toISOString();
  const tries = Number((await dal.one("SELECT COUNT(*) AS n FROM dev_audit WHERE ip = ? AND action = 'unlock_failed' AND created_at >= ?", ip, since)).n);
  if (tries >= UNLOCK_TRIES) {
    res.set('Retry-After', String(UNLOCK_WINDOW_MS / 1000));
    return v2(res, 429, 'rate_limited', 'Too many tries. Wait 15 minutes and try again.');
  }
  if (!passcodeMatches(req.body?.passcode)) {
    await audit(req, 'unlock_failed');
    return v2(res, 401, 'wrong_passcode', 'That passcode is not right.');
  }
  const { token, expiresAt } = signUnlock();
  unlockCookie(res, token);
  await audit(req, 'unlock');
  res.json({ ok: true, unlock_expires_at: expiresAt });
});

// ─── Accounts ──────────────────────────────────────────────────────────────────
// Each loader returns the row for one fixed test account, or null when it is
// missing or (by fixed ID) not in the test tenant.
const LOADERS = {
  learner: async (a) => dal.one(`
    SELECT l.id, l.name, l.learner_ref, el.id AS el_id, el.engagement_id, e.language, e.institution_id AS eng_institution_id
    FROM learners l JOIN engagement_learners el ON el.learner_id = l.id JOIN engagements e ON e.id = el.engagement_id
    JOIN institutions i ON i.id = e.institution_id
    WHERE l.id = ? AND el.id = ? AND l.institution_id = ? AND e.institution_id = ? AND i.is_test = 1
      AND COALESCE(l.is_active, 1) = 1 AND COALESCE(el.access_status, 'active') = 'active'`, a.learnerId, a.elId, TEST_INSTITUTION_ID, TEST_INSTITUTION_ID),
  staff: async (a) => dal.one(`
    SELECT u.*, i.name AS institution_name FROM institution_users u JOIN institutions i ON i.id = u.institution_id
    WHERE u.institution_id = ? AND lower(u.email) = ? AND u.status = 'active' AND i.is_test = 1`, TEST_INSTITUTION_ID, a.email),
  employer: async (a) => (TEST_EMPLOYER_IDS.includes(a.employerId) ? dal.one(`
    SELECT u.id, u.email, u.name, u.employer_id, e.kyb_status, e.name AS employer_name FROM employer_users u JOIN employers e ON e.id = u.employer_id
    WHERE u.id = ? AND u.employer_id = ? AND e.is_test = 1 AND u.status = 'active'`, a.userId, a.employerId) : null),
  admin: async () => dal.one('SELECT id, email, name FROM admin_users WHERE (id = ? OR lower(email) = ?) AND is_test = 1', TEST_ADMIN_ID, TEST_ADMIN_EMAIL)
};

router.get('/accounts', requireUnlock, async (req, res) => {
  const accounts = await Promise.all(Object.entries(DEV_ACCOUNTS).filter(([, a]) => !a.journey).map(async ([key, a]) => {
    const row = await LOADERS[a.actor](a);
    return {
      key, actor: a.actor, home: a.home, ready: !!row,
      name: row?.name || null,
      detail: a.actor === 'learner' ? row?.learner_ref || null : a.actor === 'employer' ? row?.kyb_status || null : row?.email || null
    };
  }));
  // The test learner's Evidence ID, once the outbox has issued their Passport.
  const passport = await dal.one(`SELECT evidence_id FROM credentials WHERE learner_id = ? AND active = 1 ORDER BY created_at DESC LIMIT 1`, DEV_ACCOUNTS.learner_te.learnerId);
  res.json({ accounts, sample_evidence_id: passport?.evidence_id || null, unlock_expires_at: new Date(req.devUnlock.exp * 1000).toISOString() });
});

// ─── Sign in as one test account ───────────────────────────────────────────────
// A switch ends the developer session it replaces.
const current = authenticate({ optional: true });

router.post('/login', requireUnlock, current, async (req, res) => {
  const key = String(req.body?.account_key || '');
  const a = Object.prototype.hasOwnProperty.call(DEV_ACCOUNTS, key) ? DEV_ACCOUNTS[key] : null;
  if (!a) return v2(res, 404, 'not_found', 'Unknown test account.');
  const row = await LOADERS[a.actor](a);
  if (!row) return v2(res, 404, 'not_seeded', 'This test account is not set up yet. Use “Reset test data” first.');

  if (req.session?.is_dev) await revokeActorSessions(req.session.actor_type, req.session.actor_id);

  let session; let user; let role;
  if (a.actor === 'learner') {
    session = await issueSession(res, {
      actorType: 'learner', actorId: row.id, institutionId: row.eng_institution_id, req, dev: true,
      claims: { id: row.id, el_id: row.el_id, engagement_id: row.engagement_id, language: row.language }
    });
    await afterLearnerSignIn({ sessionId: session.sessionId, learnerId: row.id, elId: row.el_id, institutionId: row.eng_institution_id, req });
    user = { id: row.id, name: row.name, language: row.language, learner_ref: row.learner_ref };
    role = 'learner';
  } else if (a.actor === 'staff') {
    session = await issueSession(res, {
      actorType: 'staff', actorId: row.id, institutionId: row.institution_id, req, dev: true,
      claims: { id: row.institution_id, staff_id: row.id, name: row.name }
    });
    user = { id: row.id, name: row.name, title: row.title, role: row.role, department: row.department, profile_completed: !!row.profile_completed, institution_name: row.institution_name };
    role = 'institution';
  } else if (a.actor === 'employer') {
    session = await issueSession(res, { actorType: 'employer', actorId: row.id, employerId: row.employer_id, req, dev: true, claims: { id: row.id, employer_id: row.employer_id } });
    user = { email: row.email, employer_id: row.employer_id };
    role = 'employer';
  } else {
    session = await issueSession(res, { actorType: 'admin', actorId: row.id, req, dev: true, claims: { id: row.id, email: row.email } });
    user = { email: row.email };
    role = 'admin';
  }
  await audit(req, 'login', { accountKey: key, role: a.actor, sessionId: session.sessionId });
  res.json({ token: session.token, csrf_token: session.csrfToken, role, user, home: a.home, account_key: key, lang: a.lang || null, expires_at: session.expiresAt });
});

// ─── End the developer session ─────────────────────────────────────────────────
// Signs the test account out everywhere (revokeActorSessions) and drops the unlock.
router.post('/end', current, async (req, res) => {
  if (req.session?.is_dev) await revokeActorSessions(req.session.actor_type, req.session.actor_id);
  clearSessionCookies(res);
  res.clearCookie(DEV_UNLOCK_COOKIE, { path: '/api/dev' });
  await audit(req, 'end', { role: req.session?.actor_type || null, sessionId: req.session?.id || null });
  res.json({ ok: true });
});

// ─── Tools: test tenant only ───────────────────────────────────────────────────
router.post('/reset-test-data', requireUnlock, async (req, res) => {
  if (req.body?.confirm !== true) return v2(res, 400, 'confirm', 'Confirm the reset first.');
  const { seedTestData } = await import('../../scripts/testData.js');
  const started = Date.now();
  await seedTestData({ log: () => {} });
  await audit(req, 'reset', { detail: `${Date.now() - started} ms` });
  res.json({ ok: true, ms: Date.now() - started });
});

// Every wait a tester would otherwise sit through, for test rows only.
router.post('/skip-waits', requireUnlock, async (req, res) => {
  const now = dal.nowIso();
  const inst = inList(TEST_INSTITUTION_IDS);
  const emp = inList(TEST_EMPLOYER_IDS);
  const done = {};
  await dal.tx(async () => {
    done.employers_verified = (await dal.run(`UPDATE employers SET kyb_status = 'verified', domain_verified_at = COALESCE(domain_verified_at, ?), updated_at = ?
      WHERE id IN (${emp}) AND is_test = 1`, now, now, ...TEST_EMPLOYER_IDS)).changes;
    done.pin_locks_cleared = (await dal.run(`UPDATE engagement_learners SET locked_at = NULL, failed_pin_attempts = 0
      WHERE engagement_id IN (SELECT e.id FROM engagements e JOIN institutions i ON i.id = e.institution_id WHERE e.institution_id IN (${inst}) AND i.is_test = 1)
        AND (locked_at IS NOT NULL OR failed_pin_attempts > 0)`, ...TEST_INSTITUTION_IDS)).changes;
    const emails = (await dal.all(`SELECT lower(email) AS email FROM institution_users WHERE institution_id IN (${inst})
      UNION SELECT lower(u.email) FROM employer_users u WHERE u.employer_id IN (${emp})
      UNION SELECT lower(email) FROM admin_users WHERE is_test = 1`, ...TEST_INSTITUTION_IDS, ...TEST_EMPLOYER_IDS)).map(r => r.email);
    done.login_failures_cleared = emails.length
      ? (await dal.run(`DELETE FROM login_failures WHERE account_key IN (${inList(emails)})`, ...emails)).changes : 0;
    resetRateLimitKeys(emails);
    done.reviews_due_now = (await dal.run(`UPDATE node_retention SET due_at = ?, updated_at = ?
      WHERE el_id IN (SELECT el.id FROM engagement_learners el JOIN engagements e ON e.id = el.engagement_id JOIN institutions i ON i.id = e.institution_id
        WHERE e.institution_id IN (${inst}) AND i.is_test = 1)`, now, now, ...TEST_INSTITUTION_IDS)).changes;
  });
  await audit(req, 'skip_waits', { detail: JSON.stringify(done) });
  res.json({ ok: true, done });
});

// ─── Learner journey: one test learner per stage, and the time/state controls ──
router.get('/journey', requireUnlock, async (req, res) => {
  const rows = await dal.all('SELECT id, pin_hash IS NOT NULL AS has_pin FROM learners WHERE id = ANY(?::text[]) AND institution_id = ?', JOURNEY.map(j => j.learnerId), TEST_INSTITUTION_ID);
  const present = new Set(rows.map(r => r.id));
  // S0 opens by its invite link until the PIN is set; after that, like the others.
  const hasPin = new Set(rows.filter(r => r.has_pin).map(r => r.id));
  res.json({
    stages: JOURNEY.map(j => ({
      key: j.key, account_key: j.accountKey, stage: j.stage, stage_name: STAGE_NAMES[j.stage], language: j.language, name: j.name, note: j.note,
      learner_ref: j.ref, ready: present.has(j.learnerId), home: DEV_ACCOUNTS[j.accountKey].home, invite_only: j.stage === 'S0' && !hasPin.has(j.learnerId)
    }))
  });
});

// S0 has never signed in: a fresh invite link (the token exists only in this answer).
router.post('/journey/invite', requireUnlock, async (req, res) => {
  const j = JOURNEY.find(x => x.stage === 'S0');
  try { await testLearner(j.elId); } catch { return v2(res, 404, 'not_seeded', 'Use “Reset test data” first.'); }
  const db = dal.legacyHandle();
  const token = await createLearnerInvite(db, { learnerId: j.learnerId, elId: j.elId, staffId: null });
  await audit(req, 'journey_invite', { accountKey: j.accountKey, role: 'learner' });
  res.json({ path: `/learner-invite/${token}` });
});

// The controls act on the test learner this developer session is signed in as.
async function devLearner(req, res, next) {
  if (!req.session?.is_dev || req.session.actor_type !== 'learner') return v2(res, 409, 'not_learner', 'Sign in as a test learner first.');
  try { await testLearner(req.user.el_id); } catch (e) { return v2(res, 403, 'not_test', e.message); }
  next();
}

router.get('/journey/me', requireUnlock, current, devLearner, async (req, res) => {
  const j = JOURNEY.find(x => x.elId === req.user.el_id);
  res.json({ controls: await controlsFor(req.user.el_id), journey: j ? { key: j.key, stage: j.stage, account_key: j.accountKey } : null });
});

router.post('/journey/control', requireUnlock, current, devLearner, async (req, res) => {
  const action = String(req.body?.action || '');
  try {
    if (action === 'reset') {
      const j = JOURNEY.find(x => x.elId === req.user.el_id);
      if (!j) return v2(res, 409, 'not_journey', 'Only journey learners reset one by one. Use “Reset test data” for the others.');
      const { seedJourney } = await import('../../scripts/journeyData.js');
      await seedJourney({ only: [j.key] });
      await audit(req, 'journey_reset', { accountKey: j.accountKey, role: 'learner' });
      return res.json({ ok: true, relogin: j.accountKey, message: `${j.name} is back at ${j.stage}.` });
    }
    const out = await runControl(req.user.el_id, { action, days: req.body?.days, result: req.body?.result, mode: req.body?.mode });
    await audit(req, `journey_${action}`, { role: 'learner', sessionId: req.session.id, detail: JSON.stringify({ days: req.body?.days ?? null, result: req.body?.result ?? null, mode: req.body?.mode ?? null }) });
    res.json(out);
  } catch (e) {
    v2(res, e.status || 500, 'control_failed', e.status ? e.message : 'That control did not work.');
  }
});

// ─── All pages: the ids behind the pages that need one ─────────────────────────
router.get('/route-ids', requireUnlock, async (req, res) => {
  const one = async (sql, ...a) => (await dal.one(sql, ...a)) || {};
  const el = DEV_ACCOUNTS.learner_te.elId;
  res.json({
    engagement_id: (await one('SELECT engagement_id AS id FROM engagement_learners WHERE id = ?', el)).id || null,
    bridge_id: (await one("SELECT id FROM bridge_programmes WHERE institution_id = ? ORDER BY created_at LIMIT 1", TEST_INSTITUTION_ID)).id || null,
    mastery_log_id: (await one('SELECT id FROM mastery_logs WHERE learner_id = ? ORDER BY produced_at DESC LIMIT 1', DEV_ACCOUNTS.learner_te.learnerId)).id || null,
    role_id: (await one('SELECT id FROM employer_roles WHERE employer_id = ? ORDER BY created_at LIMIT 1', DEV_ACCOUNTS.employer_verified.employerId)).id || null,
    candidate_id: (await one('SELECT id FROM employer_pipeline WHERE employer_id = ? ORDER BY created_at LIMIT 1', DEV_ACCOUNTS.employer_verified.employerId)).id || null,
    evidence_id: (await one('SELECT evidence_id AS id FROM credentials WHERE learner_id = ? AND active = 1 ORDER BY created_at DESC LIMIT 1', DEV_ACCOUNTS.learner_te.learnerId)).id || null,
    job_id: 'job-001'
  });
});

// ─── Build info ────────────────────────────────────────────────────────────────
function buildFile() {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'config/build-info.json'), 'utf8')); } catch { return {}; }
}
const STARTED_AT = new Date().toISOString();

router.get('/build-info', requireUnlock, (req, res) => {
  const b = buildFile();
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const adapter = process.env.AI_ADAPTER || (process.env.NODE_ENV === 'test' ? 'mock' : 'gemini');
  const testTutor = process.env.TEST_TUTOR === 'live' ? 'live' : 'scripted';
  res.json({
    version: pkg.version,
    commit: (process.env.VERCEL_GIT_COMMIT_SHA || b.commit || '').slice(0, 12) || null,
    branch: process.env.VERCEL_GIT_COMMIT_REF || b.branch || null,
    built_at: b.built_at || null,
    instance_started_at: STARTED_AT,
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',
    region: process.env.VERCEL_REGION || null,
    ai: adapter === 'mock' && process.env.NODE_ENV === 'test' ? 'mock' : ['mock', 'scripted'].includes(adapter) ? 'scripted tutor (no model)' : process.env.GEMINI_API_KEY ? 'live' : 'live (no key set: AI answers 503)',
    test_tutor: testTutor
  });
});

export default router;
