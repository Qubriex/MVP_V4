// scripts/vercel-build.js — the Vercel build step (vercel.json buildCommand).
//   1. With DATABASE_URL (or POSTGRES_URL) set for this environment, apply
//      pending migrations, so the deployed functions never race to migrate.
//   2. Write backend/config/build-info.json (commit, branch, build time) for
//      the developer page's "current build" panel.
//   3. Record the home page's sample lesson (scripts/record-sample-lesson.js).
//   4. Build the React frontend into frontend/build.
import { execSync } from 'child_process';
import fs from 'fs';
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

fs.writeFileSync(path.join(ROOT, 'backend/config/build-info.json'), JSON.stringify({
  commit: process.env.VERCEL_GIT_COMMIT_SHA || null,
  branch: process.env.VERCEL_GIT_COMMIT_REF || null,
  built_at: new Date().toISOString()
}, null, 2));

// The home page's sample lesson, recorded once per build in the teaching
// voice (needs GEMINI_API_KEY). Never fails the build: without a recording
// the page asks the API, then the browser's voice.
try {
  const { recordSampleLesson } = await import('./record-sample-lesson.js');
  await recordSampleLesson();
} catch (err) {
  console.warn(`Sample lesson not recorded: ${err.message}`);
}

execSync('npm run build', { cwd: path.join(ROOT, 'frontend'), stdio: 'inherit', env: { ...process.env, CI: 'true' } });
