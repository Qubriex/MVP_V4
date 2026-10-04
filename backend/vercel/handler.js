// vercel/handler.js — the Express app as one Vercel Function (api/index.js).
//   - Cold start: check the required configuration FIRST, then load the app.
//     Route modules read parameters while they load, so a misconfigured
//     deployment must be caught before they are imported; otherwise the
//     function crashes with a bare 500 instead of saying what is missing.
//   - vercel/autoConfig.js runs first: finds the database, applies migrations,
//     and fills in any secret not set in the environment (D-030).
//   - The outbox has no always-on worker here: after any request that can
//     write (and after any request when it was last drained over a minute
//     ago), the response is sent first and the outbox is drained in the
//     background with waitUntil(). The daily cron (/api/cron/outbox) is a
//     backstop for anything a crashed instance left behind.
import { waitUntil } from '@vercel/functions';
import { signingKeyConfigured, SIGNING_ENV } from '../core/return/signing.js';
import { autoConfigure } from './autoConfig.js';

// What a production deployment cannot run without. Names only are reported,
// never values. GEMINI_API_KEY is left out: without it AI features answer 503
// and the rest of the site still works. The signing key is checked by
// core/return/signing.js, the only module that may touch it.
const REQUIRED = ['DATABASE_URL|POSTGRES_URL', 'JWT_SECRET', 'SUBJECT_SECRET', 'ITEM_SEED_SECRET',
  'SECURE_CONFIG_PARAMS_JSON|QBX_ALLOW_PRIORS'];

export function missingEnv(env = process.env) {
  const missing = REQUIRED.filter(names => !names.split('|').some(n => env[n]));
  if (!signingKeyConfigured()) missing.push(SIGNING_ENV);
  return missing;
}

let ready = null;
let app = null;
let worker = null;
let lastDrain = 0;
let logger = console;

async function init() {
  const auto = await autoConfigure();
  if (auto.generated.length) console.warn(`[qubirex] Using secrets kept in the database: ${auto.generated.join(', ')}. Set them in the environment for a real launch (docs/DEPLOY-VERCEL.md).`);
  if (process.env.NODE_ENV === 'production') {
    // Without a database nothing else can be provisioned, so that is the only
    // thing to ask for; the secrets are generated once it exists (D-030).
    const missing = !process.env.DATABASE_URL && process.env.QBX_REQUIRE_SECRETS !== '1'
      ? ['a database — Vercel → Storage → connect a Neon Postgres database to this project, then redeploy']
      : missingEnv();
    if (missing.length) throw Object.assign(new Error(`Missing environment variables: ${missing.join(', ')}`), { missing });
  }
  const { default: params } = await import('../config/params.js');
  params.load();
  ({ logger } = await import('../core/logger.js'));
  const { registerHandlers } = await import('../core/events/handlers.js');
  const { createWorker } = await import('../core/events/worker.js');
  const { createApp } = await import('../api/app.js');
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
    logger.error(err.missing ? `startup.misconfigured: ${err.message}` : 'startup.failed', { error: err.message });
    res.statusCode = 503;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ error: 'Service is misconfigured. Check the deployment logs.', ...(err.missing ? { missing_env: err.missing } : {}) }));
    return;
  }
  // Drain the outbox after any request that can write, and after any other
  // request when it has not been drained for a minute — so background work
  // (review questions, notifications) runs within minutes, not at the daily
  // cron (Vercel Hobby allows one cron run a day).
  const writes = req.method !== 'GET' && req.method !== 'HEAD';
  if (writes || Date.now() - lastDrain > 60000) {
    lastDrain = Date.now();
    res.on('finish', () => waitUntil(worker.tick().catch(err => logger.error('outbox.drain_failed', { error: err.message }))));
  }
  app(req, res);
}
