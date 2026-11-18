#!/usr/bin/env node
// Builds one video from a story file in video/stories/:
//   node video/build.mjs video/stories/pitch-60s-en.js
// Steps: voice-over (one request, script text only, never style text) →
// transcript check → line timing → per-scene audio, holds and the brand
// clip → frames (the motion engine, scripts/walkthrough/lib/story.html) →
// music ducked under the voice, two-pass loudness → captions (.srt) and the
// script with timings (video/scripts/) → QA (video/qa.mjs) → video/out/.
// A file whose QA fails stays in video/qa/failed/ and never replaces one in out/.
// Env: PREVIEW=3,10 (stills only) · REDO=4,7 (voice those lines again on their own).
import fs from 'fs';
import path from 'path';
import { pathToFileURL, fileURLToPath } from 'url';
import { execFileSync, spawnSync } from 'child_process';
import { spoken, PRON } from './lib/facts.mjs';
import { readPcm, writeWav, edit, seconds, RATE } from './lib/audio.mjs';
import { writeSrt, writeScript } from './lib/captions.mjs';
import { runQa, report, QA_DIR, OUT_DIR } from './qa.mjs';

const VDIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(VDIR, '..');
const WT = path.join(ROOT, 'scripts/walkthrough/lib');
const { launch } = await import(pathToFileURL(path.join(WT, 'runner.mjs')).href);
const { writeScore } = await import(pathToFileURL(path.join(WT, 'score.mjs')).href);
const { alignByRate, TEXT_MODELS } = await import(pathToFileURL(path.join(WT, 'align-check.mjs')).href);

const FPS = 30;
const story = (await import(pathToFileURL(path.resolve(process.argv[2])).href)).default;
const LANG = story.lang; const LANGCODE = LANG === 'te' ? 'te-IN' : 'en-IN'; const LANG_NAME = LANG === 'te' ? 'Telugu' : 'English';
const LEAD = story.lead ?? 0.6; const TAIL = story.tail ?? 2.6;
const WORK = path.join(VDIR, 'work', story.name);
fs.mkdirSync(path.join(WORK, 'scenes'), { recursive: true });
const dotenv = await import(path.join(ROOT, 'backend/node_modules/dotenv/lib/main.js'));
(dotenv.default || dotenv).config({ path: path.join(ROOT, 'backend/.env') });
const KEYS = [process.env.GEMINI_API_KEY_2, process.env.GEMINI_API_KEY_3, process.env.GEMINI_API_KEY].filter(Boolean);

// A draft until every blank is filled and every pending check is done.
const blanks = [...new Set((JSON.stringify([story.lines.map(l => l.beat), story.strings || {}]) + (story.url || '[website]')).match(/\[(FILL:[^\]]*|website)\]/g) || [])];
const pending = story.pending || [];
const OUTNAME = `${story.name}${blanks.length || pending.length ? '-DRAFT' : ''}`;

// ─── Voice ───────────────────────────────────────────────────────────────────
async function tts(text) {
  for (const model of ['gemini-3.8-flash-tts', 'gemini-3.1-flash-tts-preview']) {
    for (const key of KEYS) {
      // Only the words to speak: no style or direction text (it can be read aloud).
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({ contents: [{ parts: [{ text }] }], generationConfig: { responseModalities: ['AUDIO'], speechConfig: { languageCode: LANGCODE, voiceConfig: { prebuiltVoiceConfig: { voiceName: story.voice || 'Kore' } } } } })
      }).catch(() => ({ ok: false }));
      if (!r.ok) continue;
      const part = (await r.json()).candidates?.[0]?.content?.parts?.find(x => x.inlineData?.data);
      if (!part) continue;
      const raw = Buffer.from(part.inlineData.data, 'base64');
      const rate = Number(/rate=(\d+)/.exec(part.inlineData.mimeType || '')?.[1]) || 24000;
      const tmp = path.join(WORK, `tts-${Date.now()}.raw`); fs.writeFileSync(tmp, raw);
      return { file: tmp, rate, model };
    }
  }
  throw new Error('No voice model answered (daily quota?). Try again later.');
}
const toWav = (raw, rate, out) => { execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 's16le', '-ar', String(rate), '-ac', '1', '-i', raw, ...(story.tempo ? ['-af', `atempo=${story.tempo}`] : []), '-ar', String(RATE), '-ac', '2', out]); fs.rmSync(raw); };
async function transcribe(file) {
  const mp3 = `${file}.check.mp3`;
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', file, '-ac', '1', '-ar', '16000', '-b:a', '48k', mp3]);
  const b64 = fs.readFileSync(mp3).toString('base64'); fs.rmSync(mp3);
  const ask = `Transcribe this ${LANG_NAME} audio exactly, word for word, from the very first word to the last${LANG === 'te' ? ', in Telugu script (English words in English letters)' : ''}. Write numbers exactly as spoken. Plain text only, no timestamps, no corrections.`;
  for (const [model, key] of TEXT_MODELS.flatMap(m => KEYS.map(k => [m, k]))) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify({ contents: [{ parts: [{ inline_data: { mime_type: 'audio/mp3', data: b64 } }, { text: ask }] }] }), signal: AbortSignal.timeout(90000) }).catch(() => ({ ok: false }));
    if (r.ok) { const h = (await r.json()).candidates?.[0]?.content?.parts?.map(x => x.text).join(' '); if (h) return h; }
  }
  throw new Error('Could not transcribe the voice-over (text quota?).');
}

const vo = path.join(WORK, 'voice.wav'); const meta = path.join(WORK, 'voice.json');
if (!fs.existsSync(vo)) {
  if (story.voiceFrom) {
    // A draft that reuses an earlier, already checked voice-over.
    for (const f of ['voice.wav', 'transcript.json']) fs.copyFileSync(path.join(story.voiceFrom, f), path.join(WORK, f));
    if (fs.existsSync(path.join(story.voiceFrom, 'tmp'))) fs.cpSync(path.join(story.voiceFrom, 'tmp'), path.join(WORK, 'tmp'), { recursive: true });
    fs.writeFileSync(meta, JSON.stringify({ engine: `${story.voiceEngine || 'Gemini TTS'} (earlier recording, reused)` }));
  } else {
    const r = await tts(story.lines.map(l => spoken(l.say, LANG)).join('\n\n'));
    toWav(r.file, r.rate, vo);
    fs.writeFileSync(meta, JSON.stringify({ engine: `Gemini TTS ${r.model} (${LANGCODE}, ${story.voice || 'Kore'}); Chirp 3 HD not reachable with API keys` }));
    for (const f of ['transcript.json', 'starts.json']) fs.rmSync(path.join(WORK, f), { force: true });
  }
  console.log(`voice: ${seconds(readPcm(vo)).toFixed(1)} s`);
}
const ENGINE = JSON.parse(fs.readFileSync(meta, 'utf8')).engine;

// The transcript check: the voice must be the script, from the first word.
const tFile = path.join(WORK, 'transcript.json');
if (!fs.existsSync(tFile) || !JSON.parse(fs.readFileSync(tFile, 'utf8')).heard) fs.writeFileSync(tFile, JSON.stringify({ heard: await transcribe(vo) }));
const heard = JSON.parse(fs.readFileSync(tFile, 'utf8')).heard;
{
  let ratio; let first;
  if (LANG === 'en') {
    const w = (t) => t.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean);
    const want = w(story.lines.map(l => l.say).join(' ').replace(/Qubirex/g, '')); const got = w(heard.replace(/\b(?:q|c|k)[a-z]*\s?(?:rex|rx|ex|ix|bricks|brix|rix)\b/gi, ''));
    const L = Array.from({ length: want.length + 1 }, () => new Int16Array(got.length + 1));
    for (let i = want.length - 1; i >= 0; i -= 1) for (let j = got.length - 1; j >= 0; j -= 1) L[i][j] = want[i] === got[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    ratio = L[0][0] / want.length; first = got.slice(0, 3).join(' ') === want.slice(0, 3).join(' ');
    if (!first || ratio < 0.85 || got.length - L[0][0] > want.length * 0.1) throw new Error(`The voice does not match the script (${(ratio * 100).toFixed(0)}% matched, starts right: ${first}). Delete ${vo} to re-voice.`);
  }
  console.log(`voice check: ${LANG === 'en' ? `${(ratio * 100).toFixed(0)}% of script words heard, in order` : 'reused, checked earlier'}`);
}

// ─── Line timing ─────────────────────────────────────────────────────────────
const sFile = path.join(WORK, 'starts.json');
if (!fs.existsSync(sFile)) {
  const voDur = seconds(readPcm(vo));
  let res;
  if (LANG === 'en') {
    const lf = path.join(WORK, 'lines.json'); fs.writeFileSync(lf, JSON.stringify(story.lines.map(l => l.say)));
    const out = execFileSync(process.env.PYTHON || 'python3', ['-I', path.join(WT, 'forced_align.py'), vo, lf]).toString().trim().split('\n').pop();
    const r = JSON.parse(out);
    if (r.aligned_words !== r.script_words || r.starts.some(x => x == null)) throw new Error(`forced alignment incomplete (${r.aligned_words}/${r.script_words} words)`);
    res = { starts: r.starts.map(x => Math.max(0, x - 0.05)), brand: r.words.filter(x => x.w === 'qubirex') };
  } else {
    const r = await alignByRate(story.lines.map(l => l.say), vo, voDur, path.join(WORK, 'tmp'), { language: LANG_NAME });
    res = { starts: r.starts, brand: [], report: r.report };
  }
  fs.writeFileSync(sFile, JSON.stringify(res, null, 1));
}
const timing = JSON.parse(fs.readFileSync(sFile, 'utf8'));

// ─── Per-scene audio, lines voiced again, holds, the brand clip ─────────────
const redo = (process.env.REDO || '').split(',').filter(Boolean).map(n => Number(n) - 1);
for (const i of redo) {
  const r = await tts(spoken(story.lines[i].say, LANG));
  toWav(r.file, r.rate, path.join(WORK, 'scenes', `${String(i + 1).padStart(2, '0')}.override.wav`));
  console.log(`line ${i + 1} voiced again on its own`);
}
const overrides = story.lines.map((_, i) => { const f = path.join(WORK, 'scenes', `${String(i + 1).padStart(2, '0')}.override.wav`); return fs.existsSync(f) ? readPcm(f) : null; });
const E = edit(readPcm(vo), timing.starts, { pads: story.lines.map(l => l.pad || 0), overrides, brand: timing.brand });
const voFinal = path.join(WORK, 'voice-final.wav'); writeWav(voFinal, E.pcm);
E.scenes.forEach((sc, i) => writeWav(path.join(WORK, 'scenes', `${String(i + 1).padStart(2, '0')}.wav`), sc));
if (E.reference) writeWav(path.join(QA_DIR, `${story.name}-brand.wav`), E.reference);
const starts = E.starts.map(x => x + LEAD); const voDur = seconds(E.pcm);
const total = LEAD + voDur + TAIL;
const brand = E.brand.map(b => ({ ...b, t: +(b.t + LEAD).toFixed(2) }));
console.log(`${story.name}: voice ${voDur.toFixed(1)} s → video ${total.toFixed(1)} s · ${brand.length} brand mentions, one clip`);

// ─── Beats, sections, product shots ──────────────────────────────────────────
const beats = story.lines.map((l, i) => ({ ...l.beat, section: l.section, start: starts[i], end: i + 1 < starts.length ? starts[i + 1] : total, first: i === 0 || story.lines[i - 1].section !== l.section }));
const sections = story.sections.map(s => ({ ...s, start: beats.find(b => b.section === s.id).start }));
// Where each product shot zooms (fractions of the 1440×900 screen): one area per shot.
const FOCUS = { walk: [0.21, 0.36, 0.97, 0.80], practise: [0.22, 0.05, 0.97, 0.62], passport: [0.21, 0.38, 0.97, 0.73], verify: [0.10, 0.12, 0.90, 0.80], college: [0.21, 0.50, 0.97, 1.0], employer: [0.20, 0.12, 0.97, 0.75] };
const SHOTS = path.join(VDIR, 'work/shots', story.shots || 'te');
for (const b of beats.filter(x => x.type === 'device')) {
  const n = b.shots.length; const span = (b.end - b.start) / n;
  b.shots.forEach((s, i) => { s.start = b.start + i * span; s.end = b.start + (i + 1) * span; s.still = `${s.key}.png`; s.frames = 1; s.focus = s.focus || FOCUS[s.key]; if (!fs.existsSync(path.join(SHOTS, s.still))) throw new Error(`No product shot ${s.still}: run node video/shots.mjs`); });
}

// ─── Music ───────────────────────────────────────────────────────────────────
const at = (id) => sections.find(s => s.id === id)?.start;
const score = path.join(WORK, 'score.wav');
writeScore(score, total, { solution: at('solution'), product: at('product') ?? at('brand'), whyNow: at('whynow'), close: at('close'), extra: ['whyus', 'next'].map(at).filter(Boolean) });

// ─── Frames ──────────────────────────────────────────────────────────────────
const frames = path.join(WORK, 'frames');
fs.rmSync(frames, { recursive: true, force: true }); fs.mkdirSync(frames, { recursive: true });
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('pageerror', e => console.error('page error:', e.message));
await page.addInitScript((d) => { window.STORY = d; }, { beats, sections, total, footage: pathToFileURL(SHOTS).href, url: story.url || '[website]', strings: story.strings || {} });
await page.goto(pathToFileURL(path.join(WT, 'story.html')).href);
await page.evaluate(() => document.fonts.ready);
if (process.env.PREVIEW) {
  for (const t of process.env.PREVIEW.split(',').map(Number)) { await page.evaluate((x) => window.render(x), t); await page.screenshot({ path: path.join(frames, `preview-${String(t).padStart(6, '0')}.png`) }); }
  await browser.close(); console.log(`previews in ${frames}`); process.exit(0);
}
const n = Math.round(total * FPS); const layers = [];
for (let i = 0; i < n; i += 1) {
  const t = i / FPS;
  await page.evaluate((x) => window.render(x), t);
  layers.push({ t, layers: await page.evaluate(() => window.qaLayers()) });
  await page.screenshot({ path: path.join(frames, `${String(i + 1).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 92 });
  if (i % 900 === 0) console.log(`  frame ${i}/${n}`);
}
await browser.close();

// ─── Sound: voice + music ducked ~12 dB under it, two-pass loudness ─────────
const ms = Math.round(LEAD * 1000);
const mix = path.join(WORK, 'mix.wav');
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', voFinal, '-i', score, '-filter_complex',
  `[0:a]adelay=${ms}|${ms},apad,atrim=duration=${total.toFixed(3)},asplit=2[v][key];[1:a]volume=0.9[m];[m][key]sidechaincompress=threshold=0.02:ratio=8:attack=20:release=500:makeup=1[md];[v][md]amix=inputs=2:normalize=0:duration=first[a]`,
  '-map', '[a]', '-ar', '48000', mix]);
const LUFS = story.target?.lufs ?? -16;
// Pass 1 measures, pass 2 applies the measured values (linear, no pumping).
const measured = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', mix, '-af', `loudnorm=I=${LUFS}:TP=-2:LRA=11:print_format=json`, '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
const meas = JSON.parse(measured.slice(measured.lastIndexOf('{')));
const mixN = path.join(WORK, 'mix-norm.wav');
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', mix, '-af', `loudnorm=I=${LUFS}:TP=-2:LRA=11:measured_I=${meas.input_i}:measured_TP=${meas.input_tp}:measured_LRA=${meas.input_lra}:measured_thresh=${meas.input_thresh}:offset=${meas.target_offset}:linear=true,aresample=48000`, mixN]);
const final = path.join(WORK, `${OUTNAME}.mp4`);
execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', String(FPS), '-i', path.join(frames, '%05d.jpg'), '-i', mixN, '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-t', total.toFixed(3), final]);

// ─── Captions and the script ────────────────────────────────────────────────
const voiced = story.lines.map((l, i) => ({ text: l.caption || l.say, start: starts[i], end: starts[i] + (E.scenes[i].length / RATE) - (l.pad || 0) - 0.05 }));
const srt = path.join(WORK, `${OUTNAME}.srt`);
writeSrt(srt, voiced);
const onScreen = (b) => [b.label, ...(b.lines || []), ...(b.shots || []).map(s => `${s.kicker}: ${s.title} (${s.key} screen)`), b.type === 'quote' ? `“${b.text}” — ${b.who}` : '', b.type === 'recipe' ? 'Recipe card; code card add(a, b): bug "*" flagged, fixed to "+", tick' : '', b.type === 'close' ? 'Logo, tagline, action line, website' : '', b.type === 'logo' ? 'Logo' : '', b.source ? `Source: ${b.source}` : ''].filter(Boolean).join(' · ');
writeScript(path.join(VDIR, 'scripts', `${story.name}.md`), {
  title: story.title || story.name, name: OUTNAME, lang: LANG, total,
  notes: [`Voice: ${ENGINE}.`, `Numbers from video/facts.json; brand said as in video/pronunciation.json (${PRON.Qubirex.say}).`, ...(blanks.length ? [`Blanks still open: ${blanks.join(', ')}.`] : []), ...pending.map(p => `Pending: ${p}`), ...(story.notes || [])],
  lines: story.lines.map((l, i) => ({ section: story.sections.find(s => s.id === l.section)?.title || l.section, text: l.say, back: l.back, next: l.next, start: voiced[i].start, end: voiced[i].end, screen: onScreen(beats[i]) }))
});

// ─── QA, then out/ ───────────────────────────────────────────────────────────
const factKeys = [...new Set(story.lines.map(l => l.beat?.fact).filter(Boolean))];
const target = { lufs: LUFS, size: [1920, 1080], fps: 30, min: 0, max: 9999, ...(story.target || {}) };
const qa = runQa({ name: OUTNAME, file: final, lang: LANG, heard, script: story.lines.map(l => l.say), factKeys, brand, brandSpliced: !!E.reference, frames: layers, target });
for (const c of qa.checks) console.log(`  ${c.ok ? '✓' : '✗'} ${c.name}: ${c.detail}`);
const dest = qa.pass ? OUT_DIR : path.join(QA_DIR, 'failed');
fs.mkdirSync(dest, { recursive: true });
fs.copyFileSync(final, path.join(dest, `${OUTNAME}.mp4`)); fs.copyFileSync(srt, path.join(dest, `${OUTNAME}.srt`));
if (qa.pass) for (const old of fs.readdirSync(OUT_DIR).filter(f => f.startsWith(story.name) && !f.startsWith(OUTNAME + '.'))) fs.rmSync(path.join(OUT_DIR, old));
report({ key: story.name, file: `${path.relative(VDIR, dest)}/${OUTNAME}.mp4`, duration: qa.duration, lufs: qa.lufs, truePeak: qa.truePeak, engine: ENGINE, pass: qa.pass, failed: qa.checks.filter(c => !c.ok).map(c => `${c.name} (${c.detail})`), notes: [...(blanks.length ? [`blanks: ${blanks.join(', ')}`] : []), ...pending].join('; ') });
console.log(`${qa.pass ? '✓ QA passed' : '✗ QA failed'}: ${path.relative(ROOT, path.join(dest, `${OUTNAME}.mp4`))} · ${qa.duration} s · ${qa.lufs} LUFS · sheet ${qa.sheet}`);
