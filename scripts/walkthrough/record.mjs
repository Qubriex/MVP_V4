#!/usr/bin/env node
// npm run walkthrough:record [-- --scene c2-lesson] [--chapter 2] [--cut internal|phone] [--reset] [--subtitles-only]
// Records each scene separately (one can be re-recorded alone) into
// artifacts/walkthrough/raw/<scene>/. Narration audio is made first (the app's
// own voice), so each scene is paced to its narration.
import fs from 'fs';
import path from 'path';
import { RAW, OUT, BASE, BYPASS, devPasscode, playwright } from './lib/config.mjs';
import { launch, recordScene } from './lib/runner.mjs';
import { prepareNarration } from './lib/narration.mjs';
import { loadScenes } from './lib/scenes.mjs';

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : null; };

const all = await loadScenes();
let scenes = all;
if (opt('scene')) scenes = scenes.filter(s => String(opt('scene')).split(',').includes(s.id));
if (opt('chapter')) scenes = scenes.filter(s => String(opt('chapter')).split(',').map(String).includes(String(s.chapter)));
if (opt('cut')) scenes = scenes.filter(s => (s.cuts || ['external']).includes(opt('cut')) || s.cut === opt('cut'));
if (!scenes.length) { console.error('No scene matches.'); process.exit(2); }

console.log(`Recording ${scenes.length} scene(s) against ${BASE}`);
if (!devPasscode()) { console.error('Set DEV_LOGIN_SECRET (the deployment\'s /dev passcode). It is read from the environment only and never shown.'); process.exit(2); }

if (opt('reset')) {
  const { request } = playwright();
  const req = await request.newContext({ extraHTTPHeaders: BYPASS || undefined });
  await req.post(`${BASE}/api/dev/unlock`, { data: { passcode: devPasscode() } });
  const r = await req.post(`${BASE}/api/dev/reset-test-data`, { data: { confirm: true } });
  console.log(`Test data reset: ${r.status()}`);
  await req.dispose();
}

const narration = await prepareNarration(scenes, { subtitlesOnly: !!opt('subtitles-only') });
console.log(narration.subtitleOnly ? 'Narration: no server voice answered; subtitle-only.' : `Narration voice: ${narration.engines.join(', ')}`);

fs.mkdirSync(RAW, { recursive: true });
const browser = await launch();
const results = [];
for (const scene of scenes) {
  const t = Date.now();
  process.stdout.write(`● ${scene.id} — ${scene.title} … `);
  let ev = null;
  for (let attempt = 0; attempt < (scene.retries ?? 1) + 1; attempt += 1) {
    ev = await recordScene(browser, scene, { narration: narration.lines, log: (m) => console.log(`\n${m}`) });
    if (ev.ok || ev.bugs.length) break; // a broken screen is a bug, not a flake: no retry
  }
  console.log(ev.ok ? `ok ${ev.duration.toFixed(1)} s (${((Date.now() - t) / 1000).toFixed(0)} s to record, ${ev.frames} frames, ${ev.audio.length} app audio)` : 'FAILED');
  results.push({ id: scene.id, ok: ev.ok, duration: ev.duration, error: ev.error || null, bugs: ev.bugs });
}
await browser.close();

// The record of what was recorded, merged with earlier runs.
const indexFile = path.join(OUT, 'recorded.json');
const index = fs.existsSync(indexFile) ? JSON.parse(fs.readFileSync(indexFile, 'utf8')) : {};
for (const r of results) index[r.id] = { ...r, at: new Date().toISOString() };
index._narration = { engines: narration.engines, subtitleOnly: narration.subtitleOnly };
fs.writeFileSync(indexFile, JSON.stringify(index, null, 1));
const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} scenes recorded.`);
for (const f of failed) console.log(`  ✗ ${f.id}: ${f.error}`);
process.exit(failed.length ? 1 : 0);
