// api/app.js — builds the Express app (no listening, no migrations), so tests
// can mount it with supertest. server.js runs migrations, starts the outbox
// worker and listens.
import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { logger } from '../core/logger.js';
import authRoutes from './routes/auth.js';
import institutionRoutes from './routes/institution.js';
import institutionTeamRoutes from './routes/institutionTeam.js';
import institutionStudentsRoutes from './routes/institutionStudents.js';
import institutionInsightsRoutes from './routes/institutionInsights.js';
import learnerRoutes from './routes/learner.js';
import portfolioRoutes from './routes/portfolio.js';
import marketRoutes from './routes/market.js';
import employerRoutes from './routes/employer.js';
import adminRoutes from './routes/admin.js';

// Mount table; scripts/openapi.js reads it to generate openapi.json.
export const MOUNTS = [
  ['/api/auth', authRoutes],
  ['/api/institution', institutionRoutes],
  ['/api/institution', institutionTeamRoutes],      // /me, /team
  ['/api/institution', institutionStudentsRoutes],  // students & access
  ['/api/institution', institutionInsightsRoutes],  // curriculum vs market, where we stand
  ['/api/learner', learnerRoutes],
  ['/api/learner', portfolioRoutes],                // profile, resume, skill requests, transcribe
  ['/api/market', marketRoutes],                    // job market, JD gap, emerging topics
  ['/api/employer', employerRoutes],
  ['/api/admin', adminRoutes]
];

// Routes answering in the v4.3.1 error shape {error: {code, message}}.
const V2_PREFIXES = ['/api/employer', '/api/verify', '/api/practical'];

export function createApp() {
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

  app.get('/api/health', (req, res) => res.json({
    status: 'ok',
    service: 'Qubirex',
    company: 'Inferexaa Private Limited',
    tagline: 'Receive. Build. Return.',
    timestamp: new Date().toISOString()
  }));

  // Errors: generic text only, never internal detail (spec §9).
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = err.status && err.status >= 400 && err.status < 500 ? err.status : 500;
    (req.log || logger).error('http.error', { error: err, path: req.path });
    const message = status === 500 ? 'Internal server error' : 'Bad request';
    const v2 = V2_PREFIXES.some(p => req.path.startsWith(p));
    res.status(status).json({ error: v2 ? { code: status === 500 ? 'internal' : 'bad_request', message } : message });
  });

  return app;
}
