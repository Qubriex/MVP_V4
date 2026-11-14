#!/usr/bin/env node
// npm run walkthrough:pitch — a voiced product demo under one minute, for an
// elevator pitch. No subtitles. Built from the recorded scenes (run
// walkthrough:record first) and a spoken English voice-over made through the
// app's own voice pipeline (key pool → Gemini TTS), one clip per line, cached
// in artifacts/walkthrough/pitch/.
//   node scripts/walkthrough/pitch.mjs        (needs the Gemini keys in backend/.env)
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { OUT, WORK, ROOT } from './lib/config.mjs';
import { sceneClip, cardClip, join, finish, loudness, ff } from './lib/edit.mjs';
import { introCard, closingCard, thumbnail, closeCards } from './lib/cards.mjs';
import { duration } from './lib/narration.mjs';

const DIR = path.join(OUT, 'pitch');
// Each line, the scene that shows it, and where in that scene to start:
// { line: n } = when narration line n of the scene starts; `after: true` = once it ends.
const SHOTS = [
  { say: "Many students in India learn to code in a language they don't think in.", scene: 'c1-home', at: { line: 1 } },
  { say: 'Qubirex teaches in their own language: Telugu, Hindi or English.', scene: 'c1-home', at: { line: 2, after: true } },
  { say: 'Professor Qubirex explains the idea, shows the code, and walks through it line by line.', scene: 'c2-lesson-code', at: { line: 1, after: true } },
  { say: 'Students practise real code, and pass a fresh check before any skill counts.', scene: 'c2-lesson-practise', at: { line: 1 } },
  { say: 'Every skill they prove goes on a signed Capability Passport.', scene: 'c2-passport', at: { line: 0 } },
  { say: 'Colleges see who is ready and who needs help.', scene: 'c3-heatmap', at: { line: 0 } },
  { say: "Employers hire on checked skills, only with the student's consent.", scene: 'c4-candidate', at: { line: 0 } },
  { say: 'And anyone can verify a Passport in seconds.', scene: 'c5-verify', at: { line: 0 } },
  { say: 'Qubirex. Your language. Your skills. Your future.', card: 'closing' }
];

async function voice(i, text) {
  const file = path.join(DIR, `vo-${i}.wav`);
  if (fs.existsSync(file)) return file;
  // The keys come from backend/.env (or the environment); they are never printed.
  const dotenv = await import(path.join(ROOT, 'backend/node_modules/dotenv/lib/main.js'));
  (dotenv.default || dotenv).config({ path: path.join(ROOT, 'backend/.env') });
  const { speak } = await import(path.join(ROOT, 'backend/core/ai/adapters/gemini.js'));
  const out = await speak({ text, voice: 'Kore', language: 'english' });
  fs.writeFileSync(`${file}.raw`, out.audio);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', `${file}.raw`, '-ar', '48000', '-ac', '2', file]);
  fs.rmSync(`${file}.raw`);
  return file;
}

fs.mkdirSync(DIR, { recursive: true });
const parts = [];
try {
  for (const [i, shot] of SHOTS.entries()) {
    const vo = await voice(i, shot.say);
    const len = duration(vo) + 0.7;
    const out = path.join(WORK, `pitch-${i}.mp4`);
    let src; let start = 0;
    if (shot.card) {
      src = cardClip(await closingCard(), 'pitch-closing', len + 1.2);
    } else {
      src = await sceneClip(shot.scene);
      const h = src.highlights[shot.at.line];
      if (!h) throw new Error(`${shot.scene}: no narration line ${shot.at.line}`);
      start = Math.max(0, Math.min(h.start + (shot.at.after ? h.dur : 0), src.dur - len));
    }
    const d = shot.card ? src.dur : len;
    // The scene's own sound (the lesson voice) stays, quieter, under the voice-over.
    ff(['-ss', start.toFixed(3), '-t', d.toFixed(3), '-i', src.file, '-i', vo,
      '-filter_complex', `[0:a]volume=0.35[bg];[1:a]adelay=250|250[v];[bg][v]amix=inputs=2:normalize=0:duration=first[a]`,
      '-map', '0:v', '-map', '[a]', '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-r', '30', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', out], `pitch shot ${i}`);
    parts.push({ file: out, dur: duration(out), cues: [], marks: [], highlights: [], id: `pitch-${i}` });
  }
  const intro = cardClip(await introCard(), 'pitch-intro', 1.8, { fadeIn: true });
  const all = join([intro, ...parts], 'pitch');
  const final = path.join(OUT, 'qubirex-pitch-60s.mp4');
  const done = finish(all, final, {});
  const frame = path.join(WORK, 'pitch-thumb.jpg');
  ff(['-ss', '12', '-i', final, '-frames:v', '1', '-q:v', '2', frame], 'pitch thumbnail');
  fs.copyFileSync(await thumbnail('pitch', frame, 'Qubirex in under a minute', 'Product demo'), path.join(OUT, 'qubirex-pitch-60s.png'));
  const l = loudness(final);
  console.log(`✓ qubirex-pitch-60s.mp4 ${done.dur.toFixed(1)} s · ${(fs.statSync(final).size / 1048576).toFixed(1)} MB · ${l.lufs} LUFS`);
  if (done.dur >= 60) { console.error('Longer than a minute: shorten a line.'); process.exitCode = 1; }
} finally {
  await closeCards();
}
