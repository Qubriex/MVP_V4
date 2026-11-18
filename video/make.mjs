#!/usr/bin/env node
// Builds one video of the kit from its manifest id:
//   node video/make.mjs institution-full-en        (npm run video:render -- institution-full-en)
// The voice line and on-screen text of every scene come from the script
// (video/scripts/<lang>/<id>.md, read by lib/parse-script.mjs); the layout file
// (video/layouts/<id>.mjs) only says which visual shows each scene.
// Telugu versions (founder decision, 18 Nov 2026): English on-screen text,
// Telugu voice-over, English captions.
// Steps: voice (script words only, never style text; two voices where the
// script has a student or a lecturer) → transcript check → scene timing →
// per-scene audio, holds, silent scenes, one brand clip → frames (16:9 engine
// or the 9:16 / 1:1 engine) → music ducked under the voice, two-pass
// loudness → captions (.srt; burned in for 9:16 and 1:1) → script with timings
// → QA → video/out/ (a failing file goes to video/qa/failed/ instead).
// Env: PREVIEW=3,10 (stills only) · REDO=4 (voice scene 4 again on its own).
import fs from 'fs';
import path from 'path';
import { pathToFileURL, fileURLToPath } from 'url';
import { execFileSync, spawnSync } from 'child_process';
import { spoken, website, FILL } from './lib/facts.mjs';
import { loadScript } from './lib/parse-script.mjs';
import { readPcm, writeWav, edit, seconds, RATE } from './lib/audio.mjs';
import { writeSrt, writeScript } from './lib/captions.mjs';
import { runQa, report, QA_DIR, OUT_DIR } from './qa.mjs';

const VDIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(VDIR, '..');
const WT = path.join(ROOT, 'scripts/walkthrough/lib');
const { launch } = await import(pathToFileURL(path.join(WT, 'runner.mjs')).href);
const { writeScore } = await import(pathToFileURL(path.join(WT, 'score.mjs')).href);
const { alignByRate, TEXT_MODELS } = await import(pathToFileURL(path.join(WT, 'align-check.mjs')).href);
const CONFIG = JSON.parse(fs.readFileSync(path.join(VDIR, 'qa/qa-config.json'), 'utf8'));

const FPS = 30;
const ID = process.argv[2];
const entry = JSON.parse(fs.readFileSync(path.join(VDIR, 'manifest.json'), 'utf8')).videos.find(v => v.id === ID);
if (!entry) throw new Error(`No video "${ID}" in video/manifest.json`);
const LANG = entry.language; const SID = path.basename(entry.script, '.md');
const [W, H] = entry.size.split('x').map(Number);
const WIDE = entry.aspect === '16:9';
const range = entry.target_length.replace(/\s*s$/, '').split('-').map(x => (x.includes(':') ? x.split(':').reduce((m, s) => m * 60 + Number(s), 0) : Number(x)));
const TARGET = { lufs: entry.loudness_lufs, size: [W, H], min: range[0] - 1, max: range[1] };
const LANGCODE = LANG === 'te' ? 'te-IN' : 'en-IN'; const LANG_NAME = LANG === 'te' ? 'Telugu' : 'English';

const script = loadScript(SID, LANG); const en = loadScript(SID, 'en');
const layout = (await import(pathToFileURL(path.join(VDIR, 'layouts', `${SID}.mjs`)).href)).default({ lang: LANG, wide: WIDE, scenes: en.scenes, website: website(), contact: FILL.contact || '[FILL: contact]' });
const scenes = script.scenes.map((s, i) => ({ ...s, ...layout.scenes[i], say: s.say, en: en.scenes[i] }));
if (scenes.some(s => !s.beat && !s.beats)) throw new Error(`layouts/${SID}.mjs has no visual for every scene`);
const LEAD = layout.lead ?? 0.5; const TAIL = layout.tail ?? 3.0; // the end card holds 3 s after the voice

const WORK = path.join(VDIR, 'work', ID);
fs.mkdirSync(path.join(WORK, 'scenes'), { recursive: true });
const dotenv = await import(path.join(ROOT, 'backend/node_modules/dotenv/lib/main.js'));
(dotenv.default || dotenv).config({ path: path.join(ROOT, 'backend/.env') });
const KEYS = [process.env.GEMINI_API_KEY_2, process.env.GEMINI_API_KEY_3, process.env.GEMINI_API_KEY].filter(Boolean);

// A draft while any blank is open or founder footage is missing.
// Blanks the founder has filled (contact, website) are no longer open.
const blanks = [...new Set((JSON.stringify(scenes.map(s => [s.beat, s.beats, s.screen])) + website() + (layout.usesContact ? (FILL.contact || '[FILL: contact]') : '')).match(/\[(FILL:[^\]]*|website)\]/g) || [])].filter(b => !(b === '[FILL: contact]' && FILL.contact) && !(b === '[website]' && FILL.website));
const founder = scenes.some(s => s.directions.some(d => /founder on camera/i.test(d)));
const OUTNAME = `${ID}${blanks.length || founder ? '-DRAFT' : ''}`;

// ─── Voice ───────────────────────────────────────────────────────────────────
// Who speaks a part of a scene: [Student…] → Student, [Top half] → Lecturer,
// anything else → Professor (the narrator is Professor Qubirex's voice).
const speakerOf = (d) => (/student/i.test(d) ? 'Student' : /top half|lecture/i.test(d) ? 'Lecturer' : 'Professor');
const VOICES = { Professor: 'Kore', Student: 'Puck', Lecturer: 'Charon' };
function parts(s) {
  const raw = String(s.voice || '').replace(/^\*draft[^*]*\*\s*/i, '');
  const out = []; let who = 'Professor';
  raw.split(/(\[[^\]]*\])/).forEach(seg => { if (/^\[(?!FILL|website)/.test(seg)) { if (!/timer|founder on camera/i.test(seg)) who = speakerOf(seg); } else if (seg.trim() && !/^\[(FILL|website)/.test(seg.trim())) out.push({ who, text: seg.replace(/\[FILL[^\]]*\]\.?/g, '').trim() }); });
  return out.filter(x => x.text);
}
const voiced = scenes.map((s, i) => ({ i, parts: s.say && !s.silent ? parts(s) : [] })).filter(v => v.parts.length);
const speakers = [...new Set(voiced.flatMap(v => v.parts.map(p => p.who)))];
const MULTI = speakers.length > 1;

async function tts(text) {
  const speechConfig = MULTI
    ? { languageCode: LANGCODE, multiSpeakerVoiceConfig: { speakerVoiceConfigs: speakers.map(sp => ({ speaker: sp, voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICES[sp] } } })) } }
    : { languageCode: LANGCODE, voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } };
  for (const model of ['gemini-3.8-flash-tts', 'gemini-3.1-flash-tts-preview']) {
    for (const key of KEYS) {
      // Only the words to speak (and, for two voices, who says them): never style text.
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({ contents: [{ parts: [{ text }] }], generationConfig: { responseModalities: ['AUDIO'], speechConfig } })
      }).catch(() => ({ ok: false }));
      if (!r.ok) continue;
      const part = (await r.json()).candidates?.[0]?.content?.parts?.find(x => x.inlineData?.data);
      if (!part) continue;
      const rate = Number(/rate=(\d+)/.exec(part.inlineData.mimeType || '')?.[1]) || 24000;
      const tmp = path.join(WORK, `tts-${Date.now()}.raw`); fs.writeFileSync(tmp, Buffer.from(part.inlineData.data, 'base64'));
      return { file: tmp, rate, model };
    }
  }
  throw new Error('No voice model answered (daily quota?). Try again later; nothing else was changed.');
}
const toWav = (raw, rate, out) => { execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 's16le', '-ar', String(rate), '-ac', '1', '-i', raw, ...(layout.tempo ? ['-af', `atempo=${layout.tempo}`] : []), '-ar', String(RATE), '-ac', '2', out]); fs.rmSync(raw); };
const ttsText = () => (MULTI ? voiced.flatMap(v => v.parts.map(p => `${p.who}: ${spoken(p.text, LANG)}`)).join('\n') : voiced.map(v => spoken(v.parts.map(p => p.text).join(' '), LANG)).join('\n\n'));

async function transcribe(file) {
  const mp3 = `${file}.check.mp3`;
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', file, '-ac', '1', '-ar', '16000', '-b:a', '48k', mp3]);
  const b64 = fs.readFileSync(mp3).toString('base64'); fs.rmSync(mp3);
  const ask = `Transcribe this ${LANG_NAME} audio exactly, word for word, from the very first word to the last${LANG === 'te' ? ', in Telugu script (English words in English letters)' : ''}. Write numbers exactly as spoken. Plain text only, no speaker names, no timestamps, no corrections.`;
  for (const [model, key] of TEXT_MODELS.flatMap(m => KEYS.map(k => [m, k]))) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify({ contents: [{ parts: [{ inline_data: { mime_type: 'audio/mp3', data: b64 } }, { text: ask }] }] }), signal: AbortSignal.timeout(90000) }).catch(() => ({ ok: false }));
    if (r.ok) { const h = (await r.json()).candidates?.[0]?.content?.parts?.map(x => x.text).join(' '); if (h) return h; }
  }
  throw new Error('Could not transcribe the voice-over (text quota?).');
}

const vo = path.join(WORK, 'voice.wav'); const meta = path.join(WORK, 'voice.json');
const want = ttsText();
if (fs.existsSync(meta) && JSON.parse(fs.readFileSync(meta, 'utf8')).text !== want) for (const f of ['voice.wav', 'voice.json', 'transcript.json', 'timing.json']) fs.rmSync(path.join(WORK, f), { force: true });
// The same words in the same language were voiced for another cut (the square
// employer video uses the widescreen one's voice): reuse it.
if (!fs.existsSync(vo)) for (const other of fs.readdirSync(path.join(VDIR, 'work'))) {
  const m = path.join(VDIR, 'work', other, 'voice.json');
  if (other !== ID && fs.existsSync(m) && JSON.parse(fs.readFileSync(m, 'utf8')).text === want) { for (const f of ['voice.wav', 'voice.json', 'transcript.json', 'timing.json']) if (fs.existsSync(path.join(VDIR, 'work', other, f))) fs.copyFileSync(path.join(VDIR, 'work', other, f), path.join(WORK, f)); console.log(`voice: reused from ${other}`); break; }
}
if (!fs.existsSync(vo)) {
  const r = await tts(want); toWav(r.file, r.rate, vo);
  fs.writeFileSync(meta, JSON.stringify({ text: want, engine: `Gemini TTS ${r.model} (${LANGCODE}; ${speakers.map(s => `${s}: ${VOICES[s]}`).join(', ')}); Chirp 3 HD not reachable with API keys` }));
  console.log(`voice: ${seconds(readPcm(vo)).toFixed(1)} s`);
}
const ENGINE = JSON.parse(fs.readFileSync(meta, 'utf8')).engine;
const tFile = path.join(WORK, 'transcript.json');
if (!fs.existsSync(tFile)) fs.writeFileSync(tFile, JSON.stringify({ heard: await transcribe(vo) }));
const heard = JSON.parse(fs.readFileSync(tFile, 'utf8')).heard;
const scriptText = voiced.map(v => v.parts.map(p => p.text).join(' '));
{ // The transcript must be the script, from the first word.
  if (LANG === 'en') {
    const w = (t) => t.toLowerCase().replace(/\b(?:q|c|k)[a-z]*[\s-]?(?:bi[\s-]?)?(?:rex|rx|ex|ix|bricks|brix|rix)\b/g, ' ').replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean);
    const a = w(scriptText.join(' ').replace(/Qubirex/g, '')); const b = w(heard);
    const L = Array.from({ length: a.length + 1 }, () => new Int16Array(b.length + 1));
    for (let i = a.length - 1; i >= 0; i -= 1) for (let j = b.length - 1; j >= 0; j -= 1) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    const ratio = L[0][0] / a.length;
    if (ratio < 0.85 || b.length - L[0][0] > a.length * 0.1) throw new Error(`The voice does not match the script (${(ratio * 100).toFixed(0)}% of words heard in order). Delete ${vo} to re-voice.`);
    console.log(`voice check: ${(ratio * 100).toFixed(0)}% of script words heard, in order`);
  } else console.log('voice check: Telugu letters compared in QA');
}

// ─── Scene timing ────────────────────────────────────────────────────────────
const tmFile = path.join(WORK, 'timing.json');
if (!fs.existsSync(tmFile)) {
  const voDur = seconds(readPcm(vo)); let res;
  if (LANG === 'en') {
    const lf = path.join(WORK, 'lines.json'); fs.writeFileSync(lf, JSON.stringify(scriptText));
    const r = JSON.parse(execFileSync(process.env.PYTHON || 'python3', ['-I', path.join(WT, 'forced_align.py'), vo, lf]).toString().trim().split('\n').pop());
    if (r.starts.some(x => x == null)) throw new Error(`forced alignment incomplete (${r.aligned_words}/${r.script_words} words)`);
    res = { starts: r.starts.map(x => Math.max(0, x - 0.05)), words: r.words, brand: r.words.filter(x => x.w === 'qubirex') };
  } else {
    const r = await alignByRate(scriptText, vo, voDur, path.join(WORK, 'tmp'), { language: LANG_NAME });
    res = { starts: r.starts, words: [], brand: [], report: r.report };
  }
  fs.writeFileSync(tmFile, JSON.stringify(res, null, 1));
}
const timing = JSON.parse(fs.readFileSync(tmFile, 'utf8'));

// ─── Audio: per-scene files, holds, silent scenes, the brand clip ───────────
const redo = (process.env.REDO || '').split(',').filter(Boolean).map(Number);
for (const n of redo) {
  const k = voiced.findIndex(v => scenes[v.i].n === n); if (k < 0) continue;
  const r = await tts(spoken(scriptText[k], LANG)); toWav(r.file, r.rate, path.join(WORK, 'scenes', `${String(n).padStart(2, '0')}.override.wav`));
}
const overrides = voiced.map(v => { const f = path.join(WORK, 'scenes', `${String(scenes[v.i].n).padStart(2, '0')}.override.wav`); return fs.existsSync(f) ? readPcm(f) : null; });
// Each scene lasts as long as the script plans (its time column), and never
// less than its voice plus 0.3 s (kit §3.2).
const rawPcm = readPcm(vo); const rawDur = seconds(rawPcm);
const fitPads = voiced.map((v, k) => { const s = scenes[v.i]; const d = (k + 1 < voiced.length ? timing.starts[k + 1] : rawDur) - timing.starts[k]; return Math.max(s.pad || 0, 0.3, layout.fit === 'voice' || v.i === scenes.length - 1 ? 0 : (s.to - s.from) - d); }); // the end card's time is the 3 s hold
// Keep the whole video inside the manifest's length: shrink the extra
// script-time padding if needed (never below 0.3 s after a line).
{ const silent = scenes.reduce((a, s, i) => a + (voiced.some(v => v.i === i) ? 0 : (s.hold ?? Math.max(2, s.to - s.from))), 0);
  const est = LEAD + rawDur + fitPads.reduce((a, x) => a + x, 0) + silent + TAIL; const limit = TARGET.max - 0.5;
  if (est > limit) { const extra = fitPads.reduce((a, x) => a + Math.max(0, x - 0.3), 0); const k = Math.max(0, 1 - (est - limit) / Math.max(extra, 1e-6)); fitPads.forEach((x, i) => { fitPads[i] = 0.3 + Math.max(0, x - 0.3) * k; }); } }
const E = edit(rawPcm, timing.starts, { pads: fitPads, overrides, brand: timing.brand });
if (E.reference) writeWav(path.join(QA_DIR, `${ID}-brand.wav`), E.reference);
// Interleave silent scenes (timer, founder footage, open blanks) with a hold.
const pcmParts = []; const sceneStart = []; const sceneVoice = []; let t0 = LEAD; let k = 0;
const brand = [];
scenes.forEach((s, i) => {
  sceneStart[i] = t0;
  if (k < voiced.length && voiced[k].i === i) {
    const sc = E.scenes[k]; pcmParts.push(sc);
    E.brand.filter(b => b.line === k).forEach(b => brand.push({ ...b, t: +(t0 + b.t - E.starts[k]).toFixed(2) }));
    sceneVoice[i] = sc.length / RATE - fitPads[k]; t0 += sc.length / RATE; k += 1;
  } else { const hold = s.hold ?? Math.max(2, s.to - s.from); pcmParts.push(new Float32Array(Math.round(hold * RATE))); sceneVoice[i] = 0; t0 += hold; }
  writeWav(path.join(WORK, 'scenes', `${String(s.n).padStart(2, '0')}.wav`), pcmParts[pcmParts.length - 1]);
});
const pcm = new Float32Array(pcmParts.reduce((a, x) => a + x.length, 0)); { let o = 0; pcmParts.forEach(x => { pcm.set(x, o); o += x.length; }); }
const voFinal = path.join(WORK, 'voice-final.wav'); writeWav(voFinal, pcm);
const total = t0 + TAIL;
console.log(`${ID}: ${scenes.length} scenes, voice ${seconds(pcm).toFixed(1)} s → video ${total.toFixed(1)} s · ${brand.length} brand mentions${E.reference ? ', one clip' : ''}`);

// ─── Beats ───────────────────────────────────────────────────────────────────
const FOCUS = { walk: [0.21, 0.36, 0.97, 0.80], practise: [0.22, 0.05, 0.97, 0.62], passport: [0.21, 0.38, 0.97, 0.73], verify: [0.10, 0.12, 0.90, 0.80], college: [0.21, 0.50, 0.97, 1.0], employer: [0.20, 0.12, 0.97, 0.75], lesson: [0.21, 0.40, 0.97, 1.0], courses: [0.20, 0.40, 0.80, 0.80], ask: [0.21, 0.80, 0.97, 0.98], check: [0.21, 0.33, 0.97, 0.68], whynot: [0.69, 0.0, 1.0, 0.42], overview: [0.20, 0.48, 0.99, 1.0], qr: [0.62, 0.36, 0.97, 0.70] };
// On a phone-shaped frame each shot zooms much tighter, to one readable area.
const FOCUS_TALL = { walk: [0.21, 0.40, 0.60, 0.62], practise: [0.22, 0.25, 0.62, 0.43], check: [0.21, 0.36, 0.62, 0.50], passport: [0.21, 0.40, 0.62, 0.72], verify: [0.10, 0.45, 0.55, 0.78], employer: [0.20, 0.37, 0.56, 0.95], courses: [0.20, 0.30, 0.55, 0.50], lesson: [0.21, 0.28, 0.62, 0.40], ask: [0.21, 0.80, 0.62, 0.98], college: [0.21, 0.50, 0.60, 1.0], qr: [0.74, 0.36, 0.97, 0.62] };
const SHOTS = path.join(VDIR, 'work/shots/te');
const beats = [];
scenes.forEach((s, i) => {
  const a = sceneStart[i]; const b = i + 1 < scenes.length ? sceneStart[i + 1] : total;
  const list = s.beats || [{ ...s.beat }];
  // A scene with two visuals switches at a fraction of its voice (or of the scene).
  list.forEach((x, j) => {
    const from = j === 0 ? a : a + (sceneVoice[i] || (b - a)) * x.at; const to = j + 1 < list.length ? a + (sceneVoice[i] || (b - a)) * list[j + 1].at : b;
    beats.push({ ...x, section: s.section, scene: s.n, start: from, end: to, last: i === scenes.length - 1 });
  });
});
const sections = (layout.sections || []).map(sec => ({ ...sec, start: beats.find(b => b.section === sec.id)?.start ?? 0 })).filter(sec => beats.some(b => b.section === sec.id));
beats.forEach((b, i) => { b.first = i === 0 || beats[i - 1].section !== b.section; if (b.type === 'split') b.mid = b.midAt === 'start' ? b.start + .1 : b.midAt === 'never' ? 1e9 : b.start + (b.end - b.start) * .45; });
for (const b of beats.filter(x => (x.type === 'device' || x.type === 'shot') && x.shots)) {
  const n = b.shots.length; const span = (b.end - b.start) / n;
  b.shots.forEach((s, j) => { s.start = b.start + j * span; s.end = b.start + (j + 1) * span; s.still = `${s.key === 'qr' ? 'passport' : s.key}.png`; s.frames = 1; s.focus = s.focus || (WIDE ? FOCUS[s.key] : FOCUS_TALL[s.key] || FOCUS[s.key]); if (!fs.existsSync(path.join(SHOTS, s.still))) throw new Error(`No product shot ${s.still}: run node video/shots.mjs`); });
  if (b.type === 'shot') b.shots.forEach(s => { s.key = s.still.replace('.png', ''); });
}
// Captions: what is said, in English (Telugu versions show the English meaning).
const capLines = scenes.map((s, i) => ({ text: (LANG === 'te' ? s.en.say : s.say) || '', start: sceneStart[i], end: sceneStart[i] + (sceneVoice[i] || 0) })).filter(c => c.text && c.end > c.start);

// ─── Music, frames, sound ───────────────────────────────────────────────────
const score = path.join(WORK, 'score.wav');
// The score changes chord at the sections (or, without sections, through the video).
const cue = (k, f) => sections[k]?.start ?? total * f;
writeScore(score, total, { solution: cue(1, .2), product: cue(2, .45), whyNow: cue(3, .7), close: Math.max(beats[beats.length - 1].start, cue(3, .7) + .1), extra: [] });
const frames = path.join(WORK, 'frames'); fs.rmSync(frames, { recursive: true, force: true }); fs.mkdirSync(frames, { recursive: true });
const srt = path.join(WORK, `${OUTNAME}.srt`); writeSrt(srt, capLines);
const cues = fs.readFileSync(srt, 'utf8').split(/\n\n+/).filter(Boolean).map(c => { const [, tm, ...txt] = c.split('\n'); const [x, y] = tm.split(' --> ').map(v => { const [h, m, r] = v.split(':'); return Number(h) * 3600 + Number(m) * 60 + Number(r.replace(',', '.')); }); return { start: x, end: y, text: txt.join('\n') }; });
const browser = await launch();
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.on('pageerror', e => console.error('page error:', e.message));
const engine = WIDE ? path.join(WT, 'story.html') : path.join(VDIR, 'lib/flex.html');
await page.addInitScript((d) => { window.STORY = d; }, { beats, sections, total, footage: pathToFileURL(SHOTS).href, url: website(), strings: {}, size: [W, H], captions: WIDE ? [] : cues, captionSize: entry.aspect === '1:1' ? 44 : 52 });
await page.goto(pathToFileURL(engine).href);
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
}
await browser.close();
const mix = path.join(WORK, 'mix.wav');
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', voFinal, '-i', score, '-filter_complex',
  `[0:a]apad,atrim=duration=${total.toFixed(3)},asplit=2[v][key];[1:a]volume=0.9[m];[m][key]sidechaincompress=threshold=0.02:ratio=8:attack=20:release=500:makeup=1[md];[v][md]amix=inputs=2:normalize=0:duration=first[a]`, '-map', '[a]', '-ar', '48000', mix]);
const LUFS = TARGET.lufs;
const measured = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', mix, '-af', `loudnorm=I=${LUFS}:TP=-3:LRA=11:print_format=json`, '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
const meas = JSON.parse(measured.slice(measured.lastIndexOf('{')));
const mixN = path.join(WORK, 'mix-norm.wav');
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', mix, '-af', `loudnorm=I=${LUFS}:TP=-3:LRA=11:measured_I=${meas.input_i}:measured_TP=${meas.input_tp}:measured_LRA=${meas.input_lra}:measured_thresh=${meas.input_thresh}:offset=${meas.target_offset}:linear=true,aresample=48000`, mixN]);
const final = path.join(WORK, `${OUTNAME}.mp4`);
execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', String(FPS), '-i', path.join(frames, '%05d.jpg'), '-i', mixN, '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', '-t', total.toFixed(3), final]);

// ─── Script with timings ─────────────────────────────────────────────────────
fs.mkdirSync(path.join(OUT_DIR, 'scripts'), { recursive: true });
writeScript(path.join(OUT_DIR, 'scripts', `${ID}.md`), {
  title: `${en.meta['script id'] || SID} (${LANG_NAME} voice)`, name: OUTNAME, lang: LANG, total,
  notes: [`Voice: ${ENGINE}.`, `Script: ${script.file}${LANG === 'te' ? ' (Telugu voice lines voiced before native review, on the founder\'s go-ahead; on-screen text in English)' : ''}.`, ...(blanks.length ? [`Blanks still open: ${blanks.join(', ')}.`] : []), ...(founder ? ['Founder footage not filmed yet: placeholder cards.'] : [])],
  lines: scenes.map((s, i) => ({ section: s.section || '', text: s.say || `(no voice: ${s.directions.join(', ') || 'hold'})`, back: s.back, start: sceneStart[i], end: sceneStart[i] + (sceneVoice[i] || (i + 1 < scenes.length ? sceneStart[i + 1] - sceneStart[i] : TAIL)), screen: s.screen.join(' / ') }))
});

// ─── QA, then out/ ───────────────────────────────────────────────────────────
const factKeys = [...new Set(beats.map(b => b.fact).filter(Boolean))];
const codeScenes = beats.some(b => b.type === 'code' || b.type === 'recipe');
const qa = runQa({ name: OUTNAME, file: final, lang: LANG, heard, script: scriptText, factKeys, brand, brandSpliced: !!E.reference, frames: layers, target: TARGET, banned: CONFIG.bannedSpokenPhrases, codeHold: CONFIG.minCodeHoldSeconds, teluguText: false, codeTest: codeScenes });
for (const c of qa.checks) console.log(`  ${c.ok ? '✓' : '✗'} ${c.name}: ${c.detail}`);
const dest = qa.pass ? OUT_DIR : path.join(QA_DIR, 'failed');
fs.mkdirSync(dest, { recursive: true });
fs.copyFileSync(final, path.join(dest, `${OUTNAME}.mp4`)); fs.copyFileSync(srt, path.join(dest, `${OUTNAME}.srt`));
if (qa.pass) for (const old of fs.readdirSync(OUT_DIR).filter(f => f.startsWith(`${ID}.`) || f.startsWith(`${ID}-DRAFT.`))) if (!old.startsWith(`${OUTNAME}.`)) fs.rmSync(path.join(OUT_DIR, old));
report({ key: ID, file: `${path.relative(VDIR, dest)}/${OUTNAME}.mp4`, duration: qa.duration, lufs: qa.lufs, truePeak: qa.truePeak, engine: ENGINE, pass: qa.pass, failed: qa.checks.filter(c => !c.ok).map(c => `${c.name} (${c.detail})`), notes: [...(blanks.length ? [`blanks: ${blanks.join(', ')}`] : []), ...(founder ? ['founder footage missing'] : []), ...(LANG === 'te' ? ['Telugu voice not yet native-reviewed; English text on screen'] : [])].join('; ') });
console.log(`${qa.pass ? '✓ QA passed' : '✗ QA failed'}: ${path.relative(ROOT, path.join(dest, `${OUTNAME}.mp4`))} · ${qa.duration} s · ${qa.lufs} LUFS · sheet ${qa.sheet}`);
