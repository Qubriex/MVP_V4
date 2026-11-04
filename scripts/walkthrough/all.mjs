#!/usr/bin/env node
// npm run walkthrough:all — resets the test data, re-records every scene and
// re-edits every video, in one command. Extra flags go to edit (e.g. --music file).
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const run = (file, args) => {
  const r = spawnSync(process.execPath, [path.join(here, file), ...args], { stdio: 'inherit' });
  if (r.status !== 0) { console.error(`${file} failed (exit ${r.status}). Fix the scene(s) listed above, then run again.`); process.exit(r.status || 1); }
};
const extra = process.argv.slice(2);
run('script.mjs', []);
run('record.mjs', ['--reset']);
run('edit.mjs', extra);
