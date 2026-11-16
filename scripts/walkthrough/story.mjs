#!/usr/bin/env node
// npm run walkthrough:story -- stories/pitch-60s.js   (or stories/pitch-3min.js)
// A motion-graphics pitch from a story file: section titles (Problem,
// Solution, Our product, Why now…), animated numbers with their sources,
// product footage, an Indian English voice-over and an original score.
// No subtitles. Output: artifacts/walkthrough/<name>.mp4 (+ .png).
//
// The voice-over is one request through the app's voice pipeline (key pool →
// Gemini TTS), cached in artifacts/walkthrough/story/<name>/; line start times
// are measured on it (phrases between pauses, transcribed and aligned word by
// word to the script) and cached too.
// Delete the cache folder to re-voice.
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { execFileSync } from 'child_process';
import { OUT, WORK, ROOT, FFMPEG } from './lib/config.mjs';
import { sceneClip, ff, loudness } from './lib/edit.mjs';
import { launch } from './lib/runner.mjs';
import { writeScore } from './lib/score.mjs';
import { thumbnail, closeCards } from './lib/cards.mjs';
import { duration } from './lib/narration.mjs';
import { alignByPhrases } from './lib/align-check.mjs';

const FPS = 30;
const storyFile = path.resolve(path.dirname(new URL(import.meta.url).pathname), process.argv[2] || 'stories/pitch-60s.js');
const story = (await import(pathToFileURL(storyFile).href)).default;
const LEAD = story.lead ?? 0.6;   // picture before the first word
const TAIL = story.tail ?? 2.6;   // after the last word
const DIR = path.join(OUT, 'story', story.name);
fs.mkdirSync(DIR, { recursive: true });

// The keys come from backend/.env (or the environment); never printed.
const dotenv = await import(path.join(ROOT, 'backend/node_modules/dotenv/lib/main.js'));
(dotenv.default || dotenv).config({ path: path.join(ROOT, 'backend/.env') });

// ─── 1. Voice-over ───────────────────────────────────────────────────────────
const STYLE = 'Read the following like a young Indian founder telling a true story to investors: warm, sincere, confident and hopeful, in a natural Indian English accent, at a lively but clear pace. Say numbers naturally. Pause briefly between paragraphs. Read only the paragraphs below.';
const vo = path.join(DIR, 'voice.wav');
if (!fs.existsSync(vo)) {
  const { speak } = await import(path.join(ROOT, 'backend/core/ai/adapters/gemini.js'));
  const out = await speak({ text: story.lines.map(l => l.say).join('\n\n'), voice: 'Kore', language: 'english', style: STYLE });
  fs.writeFileSync(`${vo}.raw`, out.audio);
  // story.tempo: a little quicker without changing the pitch.
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', `${vo}.raw`, ...(story.tempo ? ['-af', `atempo=${story.tempo}`] : []), '-ar', '48000', '-ac', '2', vo]);
  fs.rmSync(`${vo}.raw`);
  console.log(`voice: ${out.engine}, ${duration(vo).toFixed(1)} s`);
}
const voDur = duration(vo);

// ─── 2. Where each line starts ───────────────────────────────────────────────
const startsFile = path.join(DIR, 'starts.json');
if (!fs.existsSync(startsFile)) {
  // Precise: phrases between pauses, transcribed, aligned word by word to the script.
  const r = await alignByPhrases(story.lines.map(l => l.say), vo, voDur, path.join(DIR, 'tmp'));
  fs.writeFileSync(startsFile, JSON.stringify(r.starts));
}
const starts = JSON.parse(fs.readFileSync(startsFile, 'utf8')).map(x => x + LEAD);
const total = LEAD + voDur + TAIL;
console.log(`${story.name}: voice ${voDur.toFixed(1)} s → video ${total.toFixed(1)} s`);
if (total > story.maxSeconds) console.warn(`  longer than ${story.maxSeconds} s: shorten a line`);

// Beats with their times; sections start at their first line.
const beats = story.lines.map((l, i) => ({ ...l.beat, section: l.section, start: starts[i], end: i + 1 < starts.length ? starts[i + 1] : total, first: i === 0 || story.lines[i - 1].section !== l.section }));
const sections = story.sections.map(s => ({ ...s, start: beats.find(b => b.section === s.id).start }));
// Device shots split their line's time evenly.
for (const b of beats.filter(x => x.type === 'device')) {
  const n = b.shots.length; const span = (b.end - b.start) / n;
  b.shots.forEach((s, i) => { s.start = b.start + i * span; s.end = b.start + (i + 1) * span; });
}

// ─── 3. Footage (whole screen, never cropped) ────────────────────────────────
const SOURCES = {
  walk: { scene: 'c2-lesson-code', from: (c) => c.highlights[1].start + c.highlights[1].dur },
  practise: { scene: 'c2-lesson-practise', from: (c) => c.highlights[1].start + 1.5 },
  passport: { scene: 'c2-passport', from: (c) => c.highlights[0].start + 0.5 },
  verify: { scene: 'c5-verify', from: (c) => c.highlights[0].start + 3 },
  college: { scene: 'c3-heatmap', from: (c) => c.highlights[0].start + 0.3 },
  employer: { scene: 'c4-candidate', from: (c) => c.highlights[0].start + 0.5 }
};
const footage = path.join(WORK, 'story-footage', story.name);
for (const b of beats.filter(x => x.type === 'device')) {
  for (const s of b.shots) {
    const src = SOURCES[s.key];
    const clip = await sceneClip(src.scene, { labels: false });
    const len = s.end - s.start + 0.3;
    const from = Math.max(0, Math.min(src.from(clip), clip.dur - len));
    const dir = path.join(footage, s.key);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    ff(['-ss', from.toFixed(3), '-t', len.toFixed(3), '-i', clip.file, '-vf', `fps=${FPS},scale=1240:698`, '-q:v', '3', path.join(dir, '%04d.jpg')], `footage ${s.key}`);
    s.frames = fs.readdirSync(dir).length;
  }
}

// ─── 4. Score ────────────────────────────────────────────────────────────────
const at = (id) => sections.find(s => s.id === id)?.start;
const score = path.join(DIR, 'score.wav');
writeScore(score, total, { solution: at('solution'), product: at('product'), whyNow: at('whynow'), close: at('close'), extra: ['whyus', 'next'].map(at).filter(Boolean) });

// ─── 5. Draw every frame ─────────────────────────────────────────────────────
const frames = path.join(WORK, 'story-frames', story.name);
fs.rmSync(frames, { recursive: true, force: true });
fs.mkdirSync(frames, { recursive: true });
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('pageerror', e => console.error('page error:', e.message));
await page.addInitScript((d) => { window.STORY = d; }, { beats, sections, total, footage: pathToFileURL(footage).href });
await page.goto(pathToFileURL(path.join(ROOT, 'scripts/walkthrough/lib/story.html')).href);
await page.evaluate(() => document.fonts.ready);
if (process.env.PREVIEW) {
  for (const t of process.env.PREVIEW.split(',').map(Number)) { await page.evaluate((x) => window.render(x), t); await page.screenshot({ path: path.join(frames, `preview-${String(t).padStart(6, '0')}.png`) }); }
  await browser.close(); await closeCards();
  console.log(`previews in ${frames}`); process.exit(0);
}
const n = Math.round(total * FPS);
const t0 = Date.now();
for (let i = 0; i < n; i += 1) {
  await page.evaluate((t) => window.render(t), i / FPS);
  await page.screenshot({ path: path.join(frames, `${String(i + 1).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 92 });
  if (i % 600 === 0) console.log(`  frame ${i}/${n} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}
await browser.close();

// ─── 6. Picture + voice + score (ducked), −16 LUFS ───────────────────────────
const final = path.join(OUT, `${story.name}.mp4`);
const ms = Math.round(LEAD * 1000);
ff(['-framerate', String(FPS), '-i', path.join(frames, '%05d.jpg'), '-i', vo, '-i', score,
  '-filter_complex', `[1:a]adelay=${ms}|${ms},apad,atrim=duration=${total.toFixed(3)},asplit=2[v][key];[2:a]volume=0.95[m];[m][key]sidechaincompress=threshold=0.03:ratio=6:attack=30:release=600[md];[v][md]amix=inputs=2:normalize=0:duration=first,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[a]`,
  '-map', '0:v', '-map', '[a]', '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-t', total.toFixed(3), final], story.name);
const thumbAt = (beats.find(b => b.type === 'stat') || beats[1]).start + 1.6;
const tf = path.join(WORK, `${story.name}-thumb.jpg`);
ff(['-ss', thumbAt.toFixed(2), '-i', final, '-frames:v', '1', '-q:v', '2', tf], 'thumbnail');
fs.copyFileSync(await thumbnail(story.name, tf, 'Your language. Your skills. Your future.', 'Qubirex · investor pitch'), path.join(OUT, `${story.name}.png`));
await closeCards();
const l = loudness(final);
console.log(`✓ ${story.name}.mp4 ${duration(final).toFixed(1)} s · ${(fs.statSync(final).size / 1048576).toFixed(1)} MB · ${l.lufs} LUFS`);
