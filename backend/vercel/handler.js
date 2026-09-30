// vercel/handler.js — the Express app as one Vercel Function (api/index.mjs).
//   - Cold start: load parameters, register event subscribers. Migrations run
//     in the build (scripts/vercel-build.js), not per request; set
//     QBX_MIGRATE_ON_START=1 to also run them on the first request.
//   - The outbox has no always-on worker here: after any request that can
//     write, the response is sent first and the outbox is drained in the
//     background with waitUntil(). The daily cron (/api/cron/outbox) is a
//     backstop for anything a crashed instance left behind.
import { waitUntil } from '@vercel/functions';
import params from '../config/params.js';
import { migrate } from '../core/db/migrate.js';
import { registerHandlers } from '../core/events/handlers.js';
import { createWorker } from '../core/events/worker.js';
import { createApp } from '../api/app.js';
import { logger } from '../core/logger.js';
import { signingKeyConfigured, SIGNING_ENV } from '../core/return/signing.js';

let ready = null;
let app = null;
let worker = null;

// What a production deployment cannot run without. Names only are reported,
// never values. GEMINI_API_KEY is left out: without it AI features answer 503
// and the rest of the site still works.
// The signing key is checked by core/return/signing.js, the only module that
// may touch it.
const REQUIRED = ['DATABASE_URL|POSTGRES_URL', 'JWT_SECRET', 'SUBJECT_SECRET', 'ITEM_SEED_SECRET',
  'SECURE_CONFIG_PARAMS_JSON|QBX_ALLOW_PRIORS'];

export function missingEnv(env = process.env) {
  const missing = REQUIRED.filter(names => !names.split('|').some(n => env[n]));
  if (!signingKeyConfigured()) missing.push(SIGNING_ENV);
  return missing;
}

async function init() {
  if (process.env.NODE_ENV === 'production') {
    const missing = missingEnv();
    if (missing.length) throw Object.assign(new Error(`Missing environment variables: ${missing.join(', ')}`), { missing });
  }
  params.load();
  if (process.env.QBX_MIGRATE_ON_START === '1') await migrate();
  registerHandlers();
  worker = createWorker();
  app = createApp({ drainOutbox: () => worker.tick() });
}

export default async function handler(req, res) {
  try {
    ready = ready || init();
    await ready;
  } catch (err) {
    ready = null;
    logger.error('startup.failed', { error: err });
    res.statusCode = 503;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ error: 'Service is misconfigured. Check the deployment logs.', ...(err.missing ? { missing_env: err.missing } : {}) }));
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.on('finish', () => waitUntil(worker.tick().catch(err => logger.error('outbox.drain_failed', { error: err.message }))));
  }
  app(req, res);
}
