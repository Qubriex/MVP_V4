#!/usr/bin/env node
// npm run walkthrough:pitch-motion — the emotional elevator pitch: Problem →
// Solution → Our Product → Why Now, as motion graphics (lib/motion.html drawn
// frame by frame in Chrome) with real product footage, an Indian English
// voice-over and an original synthesised score. No subtitles.
//
// The voice-over is one request through the app's voice pipeline (cached in
// artifacts/walkthrough/pitch2/vo-all.wav); the line start times below were
// measured on that recording. If you regenerate the voice, re-measure them.
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { OUT, WORK, ROOT, FFMPEG } from './lib/config.mjs';
import { sceneClip, ff, loudness } from './lib/edit.mjs';
import { launch } from './lib/runner.mjs';
import { writeScore } from './lib/score.mjs';
import { thumbnail, closeCards } from './lib/cards.mjs';
import { duration } from './lib/narration.mjs';

const DIR = path.join(OUT, 'pitch2');
const LEAD = 0.5; // seconds of picture before the first word
const FPS = 30;

// Where each line starts in vo-all.wav (seconds), measured.
const LINE_STARTS = [0.0, 4.78, 10.52, 17.25, 22.49, 24.26, 29.22, 35.89, 40.81, 51.07];
const L = LINE_STARTS.map(x => x + LEAD);
const S = { solution: L[3], product: L[4], whyNow: L[8], close: L[9] };
// Why-now cards and the closing words, on the spoken phrases.
const WHY = [42.07, 44.99, 47.05].map(x => x + LEAD);
const TAG = [52.31, 53.40, 54.63].map(x => x + LEAD);

// Product shots: real footage (no captions) in the device frame.
const SHOTS = [
  { key: 'walk', scene: 'c2-lesson-code', from: (c) => c.highlights[1].start + c.highlights[1].dur, start: L[5], end: L[6], kicker: 'In your language', title: 'Professor Qubirex explains every line', side: 'right' },
  { key: 'practise', scene: 'c2-lesson-practise', from: (c) => c.highlights[1].start + 1.5, start: L[6], end: L[6] + 3.2, kicker: 'Practise', title: 'Real code, real tests', side: 'left' },
  { key: 'passport', scene: 'c2-passport', from: (c) => c.highlights[0].start + 0.5, start: L[6] + 3.2, end: L[7], kicker: 'Capability Passport', title: 'Every skill, signed', side: 'right' },
  { key: 'college', scene: 'c3-heatmap', from: (c) => c.highlights[0].start + 0.3, start: L[7], end: L[7] + 2.4, kicker: 'Colleges', title: 'See who is ready', side: 'left' },
  { key: 'employer', scene: 'c4-candidate', from: (c) => c.highlights[0].start + 0.5, start: L[7] + 2.4, end: S.whyNow, kicker: 'Employers', title: 'Hire on proof', side: 'right' }
];

const vo = path.join(DIR, 'vo-all.wav');
if (!fs.existsSync(vo)) { console.error(`Missing ${vo}: generate the voice-over first (see the header of this file).`); process.exit(2); }
const total = LEAD + duration(vo) + 2.4;
const footage = path.join(WORK, 'pitch-footage');
const frames = path.join(WORK, 'pitch-frames');
fs.rmSync(frames, { recursive: true, force: true });
fs.mkdirSync(frames, { recursive: true });

// 1. Footage frames for each shot.
for (const s of SHOTS) {
  const clip = await sceneClip(s.scene, { labels: false });
  const len = s.end - s.start + 0.2;
  const from = Math.max(0, Math.min(s.from(clip), clip.dur - len));
  const dir = path.join(footage, s.key);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  ff(['-ss', from.toFixed(3), '-t', len.toFixed(3), '-i', clip.file, '-vf', `fps=${FPS},scale=1240:-2`, '-q:v', '3', path.join(dir, '%04d.jpg')], `footage ${s.key}`);
  s.frames = fs.readdirSync(dir).length;
}

// 2. The score.
const score = path.join(DIR, 'score.wav');
writeScore(score, total, S);

// 3. Draw every frame.
const TIMES = { s: S, lines: L, why: WHY, tag: TAG, footage: pathToFileURL(footage).href, shots: SHOTS.map(({ from, scene, ...s }) => s) };
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.addInitScript((t) => { window.TIMES = t; }, TIMES);
await page.goto(pathToFileURL(path.join(ROOT, 'scripts/walkthrough/lib/motion.html')).href);
await page.evaluate(() => document.fonts.ready);
// PREVIEW=2,8,14 renders only those seconds (as PNGs in work/pitch-frames) and stops.
if (process.env.PREVIEW) {
  for (const t of process.env.PREVIEW.split(',').map(Number)) {
    await page.evaluate((x) => window.render(x), t);
    await page.screenshot({ path: path.join(frames, `preview-${t}.png`) });
  }
  await browser.close(); await closeCards();
  console.log(`previews in ${frames}`);
  process.exit(0);
}
const n = Math.round(total * FPS);
const t0 = Date.now();
for (let i = 0; i < n; i += 1) {
  await page.evaluate((t) => window.render(t), i / FPS);
  await page.screenshot({ path: path.join(frames, `${String(i + 1).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 92 });
  if (i % 300 === 0) console.log(`  frame ${i}/${n} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}
await browser.close();
await closeCards();

// 4. Picture + voice + score (the score ducks under the voice), −16 LUFS.
const final = path.join(OUT, 'qubirex-pitch-story.mp4');
const ms = Math.round(LEAD * 1000);
ff(['-framerate', String(FPS), '-i', path.join(frames, '%05d.jpg'), '-i', vo, '-i', score,
  '-filter_complex', `[1:a]adelay=${ms}|${ms},apad,atrim=duration=${total.toFixed(3)},asplit=2[v][key];[2:a]volume=0.9[m];[m][key]sidechaincompress=threshold=0.03:ratio=6:attack=30:release=600[md];[v][md]amix=inputs=2:normalize=0:duration=first,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[a]`,
  '-map', '0:v', '-map', '[a]', '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-t', total.toFixed(3), final], 'pitch story');
const frame = path.join(WORK, 'pitch-story-thumb.jpg');
ff(['-ss', String(S.solution + 2.5), '-i', final, '-frames:v', '1', '-q:v', '2', frame], 'thumbnail');
fs.copyFileSync(await thumbnail('pitch-story', frame, 'Learn in your language. Prove every skill.', 'Qubirex'), path.join(OUT, 'qubirex-pitch-story.png'));
await closeCards();
const l = loudness(final);
console.log(`✓ qubirex-pitch-story.mp4 ${duration(final).toFixed(1)} s · ${(fs.statSync(final).size / 1048576).toFixed(1)} MB · ${l.lufs} LUFS`);
void FFMPEG;
