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
import { alignSequential, alignByRate, TEXT_MODELS } from './lib/align-check.mjs';

const FPS = 30;
const storyFile = path.resolve(path.dirname(new URL(import.meta.url).pathname), process.argv[2] || 'stories/pitch-60s.js');
const story = (await import(pathToFileURL(storyFile).href)).default;
const LEAD = story.lead ?? 0.6;   // picture before the first word
const TAIL = story.tail ?? 2.6;   // after the last word
const DIR = path.join(OUT, 'story', story.name);
// Voice language: en-IN by default; te-IN gives a Telugu voice (the script
// is then written in Telugu, and the checks compare letters, not words).
const LANG = story.lang || 'en-IN';
const ENGLISH = LANG.startsWith('en');
const LANG_NAME = { 'te-IN': 'Telugu', 'hi-IN': 'Hindi' }[LANG] || 'English';
fs.mkdirSync(DIR, { recursive: true });

// The keys come from backend/.env (or the environment); never printed.
const dotenv = await import(path.join(ROOT, 'backend/node_modules/dotenv/lib/main.js'));
(dotenv.default || dotenv).config({ path: path.join(ROOT, 'backend/.env') });

// ─── 1. Voice-over ───────────────────────────────────────────────────────────
// Only the script is sent: no instruction text (a speech model can read
// instructions aloud). The accent comes from the voice settings (en-IN).
// Names are spelled the way they should sound, so they are said the same
// way every time (story.say, e.g. { Qubirex: 'Kyoobirex' }).
const SAY = { Qubirex: 'Kyoobirex', 'Jensen Huang': 'Jensen Hwang', ...(story.say || {}) };
const spoken = (t) => Object.entries(SAY).reduce((x, [w, v]) => x.split(w).join(v), t);
const vo = path.join(DIR, 'voice.wav');
if (!fs.existsSync(vo)) {
  const keys = [process.env.GEMINI_API_KEY_2, process.env.GEMINI_API_KEY_3, process.env.GEMINI_API_KEY].filter(Boolean);
  const text = story.lines.map(l => spoken(l.say)).join('\n\n');
  let audio = null; let used = null;
  for (const model of ['gemini-3.8-flash-tts', 'gemini-3.1-flash-tts-preview']) {
    for (const key of keys) {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({ contents: [{ parts: [{ text }] }], generationConfig: { responseModalities: ['AUDIO'], speechConfig: { languageCode: LANG, voiceConfig: { prebuiltVoiceConfig: { voiceName: story.voice || 'Kore' } } } } })
      });
      if (!r.ok) continue;
      const part = (await r.json()).candidates?.[0]?.content?.parts?.find(x => x.inlineData?.data);
      if (!part) continue;
      const raw = Buffer.from(part.inlineData.data, 'base64');
      audio = raw.subarray(0, 4).toString() === 'RIFF' ? raw : (() => { const h = Buffer.alloc(44); const rate = Number(/rate=(\d+)/.exec(part.inlineData.mimeType || '')?.[1]) || 24000; h.write('RIFF', 0); h.writeUInt32LE(36 + raw.length, 4); h.write('WAVE', 8); h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(raw.length, 40); return Buffer.concat([h, raw]); })();
      used = model; break;
    }
    if (audio) break;
  }
  if (!audio) throw new Error('No voice model answered (quota?). Try again later.');
  fs.writeFileSync(`${vo}.raw.wav`, audio);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', `${vo}.raw.wav`, ...(story.tempo ? ['-af', `atempo=${story.tempo}`] : []), '-ar', '48000', '-ac', '2', vo]);
  fs.rmSync(`${vo}.raw.wav`);
  fs.rmSync(path.join(DIR, 'starts.json'), { force: true });
  fs.rmSync(path.join(DIR, 'checked.json'), { force: true });
  fs.rmSync(path.join(DIR, 'transcript.json'), { force: true });
  console.log(`voice: ${used}, ${duration(vo).toFixed(1)} s`);
}
const voDur = duration(vo);

// The gate: the whole voice-over is transcribed and must be the script, from
// the first word, with nothing added (no instructions, no improvised lines).
const checkedFile = path.join(DIR, 'checked.json');
if (!fs.existsSync(checkedFile)) {
  const mp3 = `${vo}.check.mp3`;
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', vo, '-ac', '1', '-ar', '16000', '-b:a', '48k', mp3]);
  const b64 = fs.readFileSync(mp3).toString('base64'); fs.rmSync(mp3);
  // A transcript of this same voice is reused (it costs a request).
  const prev = path.join(DIR, 'transcript.json');
  let heard = fs.existsSync(prev) ? JSON.parse(fs.readFileSync(prev, 'utf8')).heard : null;
  const gateKeys = [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY_3, process.env.GEMINI_API_KEY_2].filter(Boolean);
  for (const [model, key] of TEXT_MODELS.flatMap(m => gateKeys.map(k => [m, k]))) {
    if (heard) break;
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify({ contents: [{ parts: [{ inline_data: { mime_type: 'audio/mp3', data: b64 } }, { text: `Transcribe this ${LANG_NAME} audio exactly, word for word, from the very first word to the last${ENGLISH ? '' : `, in ${LANG_NAME} script (English words in English letters)`}. Plain text only, no timestamps, no corrections.` }] }] }), signal: AbortSignal.timeout(90000) }).catch(() => ({ ok: false }));
    if (r.ok) { heard = (await r.json()).candidates?.[0]?.content?.parts?.map(x => x.text).join(' '); if (heard) break; }
  }
  if (!heard) throw new Error('Could not transcribe the voice-over to check it (text quota?).');
  if (!ENGLISH) {
    // The transcript writes loanwords (graduates, skill) in English letters and
    // numbers as digits, so compare only the Telugu (or Devanagari) letters, in
    // order: every line must be clearly heard, and nothing may be added.
    // The brand name is always written in English letters (Qubirex), so it is left out.
    const only = (t) => t.replace(/క్యూబిరెక్స్|क्यूबिरेक्स/g, '').replace(/[^\u0C00-\u0C7F\u0900-\u097F]+/g, '');
    const lineOf = []; let want = '';
    story.lines.forEach((l, i) => { const x = only(l.say); want += x; for (let k = 0; k < x.length; k += 1) lineOf.push(i); });
    const got = only(heard);
    const L = Array.from({ length: want.length + 1 }, () => new Int16Array(got.length + 1));
    for (let i = want.length - 1; i >= 0; i -= 1) for (let j = got.length - 1; j >= 0; j -= 1) L[i][j] = want[i] === got[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    const common = L[0][0];
    const hit = new Array(story.lines.length).fill(0);
    for (let i = 0, j = 0; i < want.length && j < got.length;) { if (want[i] === got[j]) { hit[lineOf[i]] += 1; i += 1; j += 1; } else if (L[i + 1][j] >= L[i][j + 1]) i += 1; else j += 1; }
    const perLine = story.lines.map((l, i) => +(hit[i] / Math.max(1, only(l.say).length)).toFixed(2));
    const startsRight = perLine[0] >= 0.6 && [...want.slice(0, 8)].filter((c, k) => got.slice(0, 12).includes(c)).length >= 6;
    const extra = got.length - common;
    const report = { startsRight, script_letters: want.length, heard_letters: got.length, matched: common, extra_letters: extra, per_line: perLine, heard };
    fs.writeFileSync(path.join(DIR, 'transcript.json'), JSON.stringify(report, null, 1));
    if (!startsRight || Math.min(...perLine) < 0.5 || common / want.length < 0.65 || extra > want.length * 0.08) throw new Error(`The voice-over does not match the script (starts right: ${startsRight}, weakest line ${Math.min(...perLine)}, matched ${common}/${want.length} letters, extra ${extra}). Delete ${vo} to re-voice.`);
    fs.writeFileSync(checkedFile, JSON.stringify({ ok: true, ...report }));
    console.log(`voice check: matches the script (${common}/${want.length} letters, ${extra} extra)`);
  } else {
    const words = (t) => t.toLowerCase().replace(/[^a-z0-9% ]+/g, ' ').split(/\s+/).filter(Boolean)
      .map(w => (/^(q|c|k)\w*(rex|rx|ex|ix|brix|bix)$/.test(w) ? 'qubirex' : ({ one: '1', ten: '10', three: '3', six: '6', four: '4', two: '2' }[w] || w)));
    const want = words(story.lines.map(l => l.say).join(' ')); const got = words(heard);
    const L = Array.from({ length: want.length + 1 }, () => new Int16Array(got.length + 1));
    for (let i = want.length - 1; i >= 0; i -= 1) for (let j = got.length - 1; j >= 0; j -= 1) L[i][j] = want[i] === got[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    const common = L[0][0];
    const startsRight = got.slice(0, 4).join(' ') === want.slice(0, 4).join(' ');
    const extra = got.length - common;
    const report = { startsRight, script_words: want.length, heard_words: got.length, matched: common, extra_words: extra, first_heard: got.slice(0, 12).join(' '), heard };
    fs.writeFileSync(path.join(DIR, 'transcript.json'), JSON.stringify(report, null, 1));
    if (!startsRight || common / want.length < 0.92 || extra > want.length * 0.08 || /read the following|warm sincere|paragraphs below/.test(got.join(' '))) {
      throw new Error(`The voice-over does not match the script (starts right: ${startsRight}, matched ${common}/${want.length}, extra ${extra}). First words heard: "${report.first_heard}". Delete ${vo} to re-voice.`);
    }
    fs.writeFileSync(checkedFile, JSON.stringify({ ok: true, ...report }));
    console.log(`voice check: matches the script (${common}/${want.length} words, ${extra} extra)`);
  }
}

// ─── 2. Where each line starts ───────────────────────────────────────────────
const startsFile = path.join(DIR, 'starts.json');
if (!fs.existsSync(startsFile)) {
  // Offline forced alignment of the script to the voice (pocketsphinx; set
  // PYTHON to a Python with `pip install pocketsphinx`). Falls back to
  // transcribing the words after each pause (needs the Gemini text quota).
  let starts = null;
  if (!ENGLISH) {
    const r = await alignByRate(story.lines.map(l => l.say), vo, voDur, path.join(DIR, 'tmp'), { language: LANG_NAME });
    fs.writeFileSync(path.join(DIR, 'align-report.json'), JSON.stringify(r.report, null, 1));
    console.log(`  line timing: speaking rate + pauses${r.transcribed ? ' + first words heard' : ''}`);
    starts = r.starts;
  }
  if (!starts) try {
    const linesFile = path.join(DIR, 'lines.json');
    fs.writeFileSync(linesFile, JSON.stringify(story.lines.map(l => l.say)));
    const out = execFileSync(process.env.PYTHON || 'python3', ['-I', path.join(ROOT, 'scripts/walkthrough/lib/forced_align.py'), vo, linesFile]).toString().trim().split('\n').pop();
    const r = JSON.parse(out);
    if (r.aligned_words === r.script_words && r.starts.every(x => x != null)) starts = r.starts.map(x => Math.max(0, x - 0.05));
    else console.warn(`  forced alignment incomplete (${r.aligned_words}/${r.script_words} words)`);
  } catch (e) { console.warn(`  forced alignment unavailable: ${String(e.message).split('\n')[0]}`); }
  if (!starts) {
    const r = await alignSequential(story.lines.map(l => l.say), vo, voDur, path.join(DIR, 'tmp'));
    starts = r.starts;
  }
  fs.writeFileSync(startsFile, JSON.stringify(starts));
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
// focus: the box [x0, y0, x1, y1] (fractions of the screen) each screen zooms
// to, chosen so the text is readable and test labels stay out of view.
const SOURCES = {
  walk: { scene: 'c2-lesson-code', from: (c) => c.highlights[1].start + c.highlights[1].dur, focus: [0.21, 0.40, 0.96, 0.82] },
  practise: { scene: 'c2-lesson-practise', from: (c) => c.highlights[1].start + 1.5, focus: [0.21, 0.02, 0.96, 0.66] },
  passport: { scene: 'c2-passport', from: (c) => c.highlights[0].start + 0.5, focus: [0.20, 0.20, 0.98, 0.80] },
  verify: { scene: 'c5-verify', from: (c) => c.highlights[0].start + 3, focus: [0.12, 0.07, 0.78, 0.66] },
  college: { scene: 'c3-heatmap', from: (c) => c.highlights[0].start + 0.3, focus: [0.44, 0.18, 0.98, 0.72] },
  employer: { scene: 'c4-candidate', from: (c) => c.highlights[0].start + 0.5, focus: [0.20, 0.18, 0.98, 0.98] }
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
    ff(['-ss', from.toFixed(3), '-t', len.toFixed(3), '-i', clip.file, '-vf', `fps=${FPS},scale=1920:1080`, '-q:v', '2', path.join(dir, '%04d.jpg')], `footage ${s.key}`);
    s.frames = fs.readdirSync(dir).length;
    s.focus = s.focus || src.focus;
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
await page.addInitScript((d) => { window.STORY = d; }, { beats, sections, total, footage: pathToFileURL(footage).href, url: story.url || '', strings: story.strings || {} });
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
fs.copyFileSync(await thumbnail(story.name, tf, ...(story.thumb || ['Your language. Your skills. Your future.', 'Qubirex · investor pitch'])), path.join(OUT, `${story.name}.png`));
await closeCards();
const l = loudness(final);
console.log(`✓ ${story.name}.mp4 ${duration(final).toFixed(1)} s · ${(fs.statSync(final).size / 1048576).toFixed(1)} MB · ${l.lufs} LUFS`);
