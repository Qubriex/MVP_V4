// scripts/record-sample-lesson.js — records the home page's sample lesson in
// Professor Qubirex's teaching voice to static files, so "Hear a sample
// lesson" plays a shipped file instead of calling the AI on every visit:
//   frontend/public/audio/sample-lesson-{telugu,hindi}.{wav|mp3}
//   frontend/public/audio/sample-lesson.json   (which file is which)
// The Vercel build runs it when GEMINI_API_KEY is set and no recording is
// present (scripts/vercel-build.js). By hand, from backend/:
//   GEMINI_API_KEY=… node scripts/record-sample-lesson.js [--force]
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as gemini from '../core/ai/adapters/gemini.js';
import { TTS_VOICE } from '../core/ai/gateway.js';
import { SAMPLE_LESSON } from '../core/sampleLesson.js';

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../frontend/public/audio');
const MANIFEST = path.join(OUT, 'sample-lesson.json');
const EXT = { 'audio/wav': 'wav', 'audio/mpeg': 'mp3' };

export async function recordSampleLesson({ force = false, log = console.log } = {}) {
  if (!process.env.GEMINI_API_KEY) { log('record-sample-lesson: GEMINI_API_KEY is not set; skipped.'); return false; }
  if (!force && fs.existsSync(MANIFEST)) { log('record-sample-lesson: a recording is already present; skipped (use --force to re-record).'); return false; }
  fs.mkdirSync(OUT, { recursive: true });
  const manifest = {};
  for (const [language, text] of Object.entries(SAMPLE_LESSON)) {
    const out = await gemini.speak({ model: process.env.GEMINI_TTS_MODEL || 'gemini-2.5-flash-preview-tts', text, voice: process.env.GEMINI_TTS_VOICE || TTS_VOICE, language });
    const file = `sample-lesson-${language}.${EXT[out.mimeType] || 'wav'}`;
    fs.writeFileSync(path.join(OUT, file), out.audio);
    manifest[language] = `/audio/${file}`;
    log(`record-sample-lesson: ${file} (${Math.round(out.audio.length / 1024)} KB, ${out.modelVersion})`);
  }
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
  return true;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await recordSampleLesson({ force: process.argv.includes('--force') });
}
