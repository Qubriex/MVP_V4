// scripts/vercel-build.js — the Vercel build step (vercel.json buildCommand).
//   1. With DATABASE_URL (or POSTGRES_URL) set for this environment, apply
//      pending migrations, so the deployed functions never race to migrate.
//   2. Build the React frontend into frontend/build.
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

if (process.env.DATABASE_URL || process.env.POSTGRES_URL) {
  const { migrate } = await import('../core/db/migrate.js');
  const { close } = await import('../core/db/dal.js');
  const applied = await migrate();
  console.log(applied.length ? `Migrations applied: ${applied.join(', ')}` : 'Database schema is up to date.');
  await close();
} else {
  console.warn('DATABASE_URL is not set for this build: migrations skipped. Set it in Vercel → Settings → Environment Variables.');
}

execSync('npm run build', { cwd: path.join(ROOT, 'frontend'), stdio: 'inherit', env: { ...process.env, CI: 'true' } });
