// api/app.js — builds the Express app (no listening, no migrations), so tests
// can mount it with supertest. server.js runs migrations, starts the outbox
// worker and listens.
import express from 'express';
import './asyncErrors.js';
import cors from 'cors';
import crypto from 'crypto';
import { logger } from '../core/logger.js';
import * as dal from '../core/db/dal.js';
import { generate, synthesize } from '../core/ai/gateway.js';
import params from '../config/params.js';
import authRoutes from './routes/auth.js';
import institutionRoutes from './routes/institution.js';
import institutionTeamRoutes from './routes/institutionTeam.js';
import institutionStudentsRoutes from './routes/institutionStudents.js';
import institutionInsightsRoutes from './routes/institutionInsights.js';
import institutionReviewRoutes from './routes/institutionReview.js';
import institutionActivityRoutes from './routes/institutionActivity.js';
import learnerRoutes from './routes/learner.js';
import portfolioRoutes from './routes/portfolio.js';
import marketRoutes from './routes/market.js';
import employerRoutes from './routes/employer.js';
import learnerEvidenceRoutes from './routes/learnerEvidence.js';
import learnerSettingsRoutes from './routes/learnerSettings.js';
import verifyRoutes from './routes/verify.js';
import { didDocument } from '../core/return/keyRegistry.js';
import { issuerHost } from '../core/return/credentialEngine.js';
import adminRoutes from './routes/admin.js';

// Mount table; scripts/openapi.js reads it to generate openapi.json.
export const MOUNTS = [
  ['/api/auth', authRoutes],
  ['/api/institution', institutionRoutes],
  ['/api/institution', institutionTeamRoutes],      // /me, /team
  ['/api/institution', institutionStudentsRoutes],  // students & access
  ['/api/institution', institutionInsightsRoutes],  // curriculum vs market, where we stand
  ['/api/institution', institutionReviewRoutes],    // faculty review queue, κ, review load
  ['/api/institution', institutionActivityRoutes],  // live status, activity, exports, evidence report
  ['/api/learner', learnerRoutes],
  ['/api/learner', portfolioRoutes],                // profile, resume, skill requests, transcribe
  ['/api/learner', learnerEvidenceRoutes],          // reviews, rechecks, passport, renewal
  ['/api/learner', learnerSettingsRoutes],          // settings: devices, consent, my data
  ['/api/market', marketRoutes],                    // job market, JD gap, emerging topics
  ['/api/employer', employerRoutes],
  ['/api/verify', verifyRoutes],                    // public verifier (v4.3 §10)
  ['/api/admin', adminRoutes]
];

// Routes answering in the v4.3.1 error shape {error: {code, message}}.
const V2_PREFIXES = ['/api/employer', '/api/verify', '/api/practical'];

/**
 * @param {{ drainOutbox?: () => Promise<object> }} [opts] drainOutbox runs the
 *   outbox once; the serverless handler passes it for the cron backstop.
 */
export function createApp({ drainOutbox = null } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', process.env.TRUST_PROXY ? Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY : false);

  app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true }));
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Request id + one structured log line per request.
  app.use((req, res, next) => {
    req.id = req.headers['x-request-id'] && /^[\w-]{1,64}$/.test(req.headers['x-request-id']) ? req.headers['x-request-id'] : crypto.randomUUID();
    req.log = logger.child({ reqId: req.id });
    res.set('X-Request-Id', req.id);
    const started = Date.now();
    res.on('finish', () => req.log.info('http.request', { method: req.method, path: req.path, status: res.statusCode, ms: Date.now() - started }));
    next();
  });

  MOUNTS.forEach(([prefix, router]) => app.use(prefix, router));

  // did:web document for the issuer (v4.3 §9.3); retired keys stay listed.
  app.get('/.well-known/did.json', async (req, res) => { res.set('Cache-Control', 'public, max-age=3600'); res.json(await didDocument(issuerHost())); });

  // Vercel Cron (vercel.json) calls this with Authorization: Bearer $CRON_SECRET.
  app.get('/api/cron/outbox', async (req, res) => {
    if (!process.env.CRON_SECRET || req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) return res.status(401).json({ error: 'Unauthorized' });
    if (!drainOutbox) return res.status(404).json({ error: 'Not available: the server runs its own outbox worker' });
    res.json({ ok: true, ...(await drainOutbox()) });
  });

  // ?deep=1 also checks the database round trip.
  app.get('/api/health', async (req, res) => {
    const body = {
      status: 'ok',
      service: 'Qubirex',
      company: 'Inferexaa Private Limited',
      tagline: 'Receive. Build. Return.',
      timestamp: new Date().toISOString()
    };
    if (req.query.deep === '1') {
      try {
        const m = await dal.one('SELECT MAX(id) AS latest, COUNT(*) AS n FROM schema_migrations');
        body.database = { ok: true, driver: dal.driverKind(), migrations: m.n, latest: m.latest };
        body.outbox = await dal.one(`SELECT COUNT(*) FILTER (WHERE delivered_at IS NULL AND dead_lettered_at IS NULL) AS pending,
          COUNT(*) FILTER (WHERE dead_lettered_at IS NOT NULL) AS dead_lettered, MAX(last_error) AS last_error FROM domain_events`);
      } catch (err) {
        body.status = 'degraded';
        body.database = { ok: false, driver: dal.driverKind(), error: err.message };
      }
      body.params = params.source();
      body.secrets = process.env.QBX_SECRETS_SOURCE || 'environment';
      body.ai = { adapter: process.env.AI_ADAPTER || (process.env.NODE_ENV === 'test' ? 'mock' : 'gemini'), key_set: !!process.env.GEMINI_API_KEY };
      // &ai=1 makes one tiny live model call, so a deployment can confirm its key and model.
      if (req.query.ai === '1') {
        const started = Date.now();
        try {
          const r = await generate({ task: 'HEALTH.ping', input: 'Reply with the single word OK.', maxTokens: 64 });
          body.ai.live = { ok: true, model: r.modelId, ms: Date.now() - started, reply: String(r.text || '').slice(0, 20) };
        } catch (err) {
          body.ai.live = { ok: false, model: process.env.GEMINI_MODEL || null, error: String(err.cause?.message || err.message).slice(0, 300) };
        }
        try {
          const t0 = Date.now();
          const v = await synthesize({ text: 'నమస్కారం' });
          body.ai.voice = { ok: true, engine: v.engine, bytes: v.audio.length, ms: Date.now() - t0 };
        } catch (err) {
          body.ai.voice = { ok: false, error: String(err.cause?.message || err.message).slice(0, 300) };
        }
      }
    }
    res.status(body.status === 'ok' ? 200 : 503).json(body);
  });

  // Errors: generic text only, never internal detail (spec §9).
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    const status = err.status && err.status >= 400 && err.status < 500 ? err.status : 500;
    (req.log || logger).error('http.error', { error: err, path: req.path });
    const message = status === 500 ? 'Internal server error' : 'Bad request';
    const v2 = V2_PREFIXES.some(p => req.path.startsWith(p));
    res.status(status).json({ error: v2 ? { code: status === 500 ? 'internal' : 'bad_request', message } : message });
  });

  return app;
}
