// vercel/autoConfig.js — lets a Vercel deployment run with no secrets typed
// in by hand (docs/decisions.md D-030). Called once per cold start, before the
// app is loaded:
//   1. Database: DATABASE_URL, POSTGRES_URL, or any *_DATABASE_URL /
//      *_POSTGRES_URL a storage integration added (Neon from Vercel Storage).
//   2. Migrations: applied here (idempotent, under an advisory lock), so the
//      build does not need database access.
//   3. URLs: PUBLIC_URL / FRONTEND_URL / PUBLIC_HOST default to the project's
//      production domain from Vercel's system variables.
//   4. Secrets: JWT_SECRET, SUBJECT_SECRET, ITEM_SEED_SECRET, CRON_SECRET and
//      the signing key are generated once and kept in system_secrets.
//   5. Staging defaults: prior parameters and on-screen employer codes, unless
//      SECURE_CONFIG_PARAMS_JSON / QBX_ECHO_EMAIL_CODES say otherwise.
//   6. QBX_SEED_TEST_DATA=1: the test accounts from docs/README.md, once.
// Anything set in the environment wins. QBX_REQUIRE_SECRETS=1 turns steps 4-6
// off, so a real launch fails loudly instead of generating its own.
import crypto from 'crypto';
import * as dal from '../core/db/dal.js';
import { migrate } from '../core/db/migrate.js';
import { ensureSigningKey } from '../core/return/signing.js';

const GENERATED = ['JWT_SECRET', 'SUBJECT_SECRET', 'ITEM_SEED_SECRET', 'CRON_SECRET'];

function findDatabaseUrl(env) {
  if (env.DATABASE_URL || env.POSTGRES_URL) return env.DATABASE_URL || env.POSTGRES_URL;
  const key = Object.keys(env).sort().find(k => /(^|_)(DATABASE_URL|POSTGRES_URL)$/.test(k) && /^postgres(ql)?:\/\//.test(env[k] || ''));
  return key ? env[key] : null;
}

async function secret(name) {
  await dal.run('INSERT INTO system_secrets (name, value, created_at) VALUES (?, ?, ?) ON CONFLICT (name) DO NOTHING',
    name, crypto.randomBytes(32).toString('base64url'), dal.nowIso());
  return (await dal.one('SELECT value FROM system_secrets WHERE name = ?', name)).value;
}

/** @returns {Promise<{ secrets: string, generated: string[] }>} */
export async function autoConfigure(env = process.env) {
  const url = findDatabaseUrl(env);
  if (url && !env.DATABASE_URL) env.DATABASE_URL = url;

  const host = env.VERCEL_PROJECT_PRODUCTION_URL || env.VERCEL_URL;
  if (host) {
    if (!env.PUBLIC_HOST) env.PUBLIC_HOST = host;
    if (!env.PUBLIC_URL) env.PUBLIC_URL = `https://${host}`;
    if (!env.FRONTEND_URL) env.FRONTEND_URL = `https://${host}`;
  }

  if (!url) return { secrets: 'none', generated: [] }; // the startup check reports the missing database
  await migrate();
  if (env.QBX_REQUIRE_SECRETS === '1') return { secrets: 'environment', generated: [] };

  const generated = [];
  for (const name of GENERATED) {
    if (!env[name]) { env[name] = await secret(name); generated.push(name); }
  }
  if ((await ensureSigningKey()) === 'database') generated.push('signing key');
  if (!env.SECURE_CONFIG_PARAMS_JSON && env.QBX_ALLOW_PRIORS === undefined) env.QBX_ALLOW_PRIORS = '1';
  if (env.QBX_ECHO_EMAIL_CODES === undefined) env.QBX_ECHO_EMAIL_CODES = '1';
  env.QBX_SECRETS_SOURCE = generated.length ? `database (${generated.join(', ')})` : 'environment';

  // QBX_SEED_TEST_DATA=1 (test deployments only): create the public test
  // accounts once. The marker row and the seed share one transaction, so a
  // second instance starting at the same time waits, then skips.
  if (env.QBX_SEED_TEST_DATA === '1') {
    await dal.tx(async () => {
      const first = await dal.run("INSERT INTO system_secrets (name, value, created_at) VALUES ('test_data_seeded', ?, ?) ON CONFLICT (name) DO NOTHING",
        dal.nowIso(), dal.nowIso());
      if (!first.changes) return;
      const { seedTestData } = await import('../scripts/testData.js');
      await seedTestData({ log: () => {} });
      console.warn('[qubirex] QBX_SEED_TEST_DATA=1: test accounts created (public credentials — test deployments only).');
    });
  }
  return { secrets: env.QBX_SECRETS_SOURCE, generated };
}
