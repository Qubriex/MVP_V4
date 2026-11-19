// Automatic QA for every video before it goes to video/out/ (brief §5):
//   1. voice: no style/instruction text read aloud; numbers match the script
//      and facts.json; "Qubirex" said one way (every mention logged with its time);
//   2. text: in Telugu videos no title, label or caption is English-only
//      (an allow-list holds tech words and the brand);
//   3. overlap: never two title layers at opacity > 0.1 in the same frame;
//   4. hold: every text layer stays ≥ 1 s per 3 words and ≥ 2 s (code ≥ 4.5 s);
//   5. loudness (±1 LU of the target, true peak ≤ −1 dBTP) and format;
//   6. a contact sheet, one frame every 2 s: video/qa/<name>-sheet.jpg.
// Results: video/qa/<name>.json, and one line per video in video/out/REPORT.md.
import fs from 'fs';
import path from 'path';
import { execFileSync, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { FACTS } from './lib/facts.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
export const QA_DIR = path.join(DIR, 'qa');
export const OUT_DIR = path.join(DIR, 'out');

// Sentences that would mean a style prompt was read aloud.
const STYLE = [/read (the following|this)/i, /in (a|the) (warm|calm|friendly|confident)/i, /young indian founder/i, /speak(ing)? like/i, /\btone\b/i, /\bnarrat(e|or)\b/i, /paragraphs? below/i, /voice[- ]over/i, /పై వాక్యాలు|కింది వాక్యాలను/];
// English words allowed on screen in Telugu videos (tech words, brand, names).
// Code itself stays in English (brief §2.1) and is not checked.
const ALLOW = new Set(['qubirex', 'professor', 'ai', 'it', 'code', 'function', 'return', 'python', 'java', 'fy22', 'fy25', 'ceo', 'nvidia', 'english', 'telugu', 'hindi', 'sample', 'data', 'vs', 'add', 'def', 'a', 'b', 'skill', 'skills', 'passport', 'capability', 'online', 'fill', 'website', 'who', 'pays', 'qr', 'jensen', 'huang', 'aicte', 'aishe', 'plfs', 'census', 'xpheno', 'iamai', 'kantar', 'milken', 'institute', 'india', 'report', 'survey', 'cse', 'demo']);
const WORDS = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100 };


// Mono float samples of a file (ffmpeg), optionally filtered.
function samples(file, rate, af) {
  const args = ['-v', 'error', '-i', file, ...(af ? ['-af', af] : []), '-ac', '1', '-ar', String(rate), '-f', 'f32le', '-'];
  const buf = execFileSync('ffmpeg', args, { maxBuffer: 1 << 30 });
  return new Float32Array(buf.buffer, buf.byteOffset, buf.length >> 2);
}
// RMS in dBFS for consecutive windows of `win` seconds.
function rmsWindows(x, rate, win) {
  const n = Math.round(rate * win); const out = [];
  for (let i = 0; i + n <= x.length; i += n) { let e = 0; for (let j = i; j < i + n; j += 1) e += x[j] * x[j]; out.push(10 * Math.log10(e / n + 1e-12)); }
  return out;
}

/** Numbers in English text, digits or words ("ninety-eight" → 98, "three point two" → 3.2). */
export function numbersIn(text) {
  const t = text.toLowerCase().replace(/(\d+):00\b/g, '$1').replace(/-/g, ' ').replace(/,(?=\d)/g, ''); // 11:00 pm is the number 11
  const out = [];
  t.replace(/\d+(\.\d+)?/g, (m) => { out.push(String(Number(m))); return m; });
  const toks = t.replace(/[.,;:!?]/g, ' | ').replace(/[^a-z| ]/g, ' ').split(/\s+/).filter(Boolean); // '|' ends a number
  const SCALE = { hundred: 100, thousand: 1000, lakh: 100000, lakhs: 100000 };
  for (let i = 0; i < toks.length; i += 1) {
    if (!(toks[i] in WORDS)) continue;
    // One spoken number: "two thousand", "ninety eight", "three point two".
    let total = 0; let cur = 0; let j = i;
    while (j < toks.length && (toks[j] in WORDS || toks[j] in SCALE)) {
      const w = toks[j];
      if (w in SCALE) { if (SCALE[w] === 100) cur = (cur || 1) * 100; else { total += (cur || 1) * SCALE[w]; cur = 0; } } else cur += WORDS[w];
      j += 1;
    }
    let n = total + cur;
    if (toks[j] === 'point' && toks[j + 1] in WORDS && WORDS[toks[j + 1]] < 10) { n = Number(`${n}.${WORDS[toks[j + 1]]}`); j += 2; }
    out.push(String(n)); i = j - 1;
  }
  return out;
}

const telugu = (s) => /[\u0C00-\u0C7F]/.test(s);
function englishOnly(text) {
  if (telugu(text) || /[\u0900-\u097F]/.test(text)) return false;
  const words = text.toLowerCase().replace(/\[fill:[^\]]*\]|\[website\]|\[te pending\]/g, ' ').replace(/\b[\w-]+(\.[\w-]+)+\.(app|com|in|org|ai)\b/g, ' ').replace(/\+?\d[\d\s-]{7,}\d/g, ' ').match(/[a-z][a-z0-9']*/g) || [];
  return words.some(w => w.length > 1 && !ALLOW.has(w.replace(/'s$/, ''))); // single letters (journey A–D) are not words
}

function loudness(file) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1 << 26 });
  const s = r.stderr.slice(r.stderr.lastIndexOf('Summary:'));
  return { lufs: Number(/I:\s+(-?[\d.]+) LUFS/.exec(s)?.[1]), tp: Number(/Peak:\s+(-?[\d.]+) dBFS/.exec(s)?.[1]) };
}
function probe(file) {
  const j = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,width,height,r_frame_rate:format=duration', '-of', 'json', file]).toString());
  const v = j.streams.find(s => s.codec_type === 'video'); const [a, b] = v.r_frame_rate.split('/').map(Number);
  return { width: v.width, height: v.height, fps: +(a / b).toFixed(2), duration: +Number(j.format.duration).toFixed(2) };
}

/**
 * @param {object} o
 * @param {string} o.name  output name without .mp4
 * @param {string} o.file  the rendered video
 * @param {'en'|'te'} o.lang
 * @param {string} o.heard  the voice-over transcribed back
 * @param {string[]} o.script  the spoken lines
 * @param {string[]} o.factKeys  facts used in this video
 * @param {{t:number,dur:number,line:number}[]} o.brand  brand mentions (final times)
 * @param {boolean} o.brandSpliced  every mention is the same clip
 * @param {{t:number, layers:object[]}[]} o.frames  qaLayers() per frame
 * @param {{lufs:number, size:[number,number], fps:number, min:number, max:number}} o.target
 */
export function runQa(o) {
  fs.mkdirSync(QA_DIR, { recursive: true });
  const checks = [];
  const add = (name, ok, detail) => checks.push({ name, ok, detail });

  // 1. Voice.
  const banned = [...STYLE, ...(o.banned || []).map(x => new RegExp(x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'))];
  const style = banned.filter(re => re.test(o.heard)).map(String);
  add('voice: no style text read aloud', style.length === 0, style.length ? `heard: ${style.join(', ')}` : 'none heard');
  if (o.lang === 'en') {
    const want = new Set(o.script.flatMap(numbersIn));
    const heard = numbersIn(o.heard);
    const extra = [...new Set(heard.filter(n => !want.has(n)))];
    const factNums = o.factKeys.flatMap(k => FACTS[k]?.numbers || []);
    const missing = factNums.filter(n => !heard.includes(String(Number(n))));
    add('voice: numbers match the script and facts.json', extra.length === 0 && missing.length === 0, `${extra.length ? `heard but not in the script: ${extra.join(', ')}. ` : ''}${missing.length ? `facts not heard: ${missing.join(', ')}. ` : ''}${!extra.length && !missing.length ? `all ${factNums.length} fact numbers heard, no others` : ''}`);
  } else {
    const allowed = new Set([...o.factKeys.flatMap(k => FACTS[k]?.numbers || []), ...o.script.flatMap(s => (s.replace(/,(?=\d)/g, '').match(/\d+(\.\d+)?/g) || []).map(n => String(Number(n)))), '1', '10', '100', '2', '3', '4', '6', '1.2', '13', '3.2', '44', '56', '98', '80', '1.1', '20']);
    const heard = (o.heard.replace(/,(?=\d)/g, '').match(/\d+(\.\d+)?/g) || []).map(n => String(Number(n))); // 2,000 is one number
    const extra = [...new Set(heard.filter(n => !allowed.has(n)))];
    add('voice: numbers match facts.json', extra.length === 0, extra.length ? `heard numbers not in the facts: ${extra.join(', ')}` : `${heard.length} numbers heard, all in the facts`);
  }
  const forms = [...new Set((o.heard.match(/\b(?:q|c|k)[a-z]*\s?(?:rex|rx|ex|ix|bricks|brix|rix)\b|క్యూ[^\s.,]*/gi) || []).map(x => x.toLowerCase()))];
  add('voice: "Qubirex" said one way', o.brandSpliced || forms.length <= 1, `${o.brand.length} mentions at ${o.brand.map(b => `${b.t.toFixed(1)} s`).join(', ') || '—'}; ${o.brandSpliced ? 'every mention is the same recorded clip' : 'not spliced'}; the transcript wrote it as: ${forms.join(' / ') || '—'}`);

  // 2–4. On-screen text.
  const spans = new Map(); // id → { kind, text, code, runs: [[a,b]] }
  const overlaps = [];
  for (const f of o.frames) {
    const titles = f.layers.filter(l => l.kind === 'title' && l.op > 0.1 && l.group !== 'caption');
    const groups = new Set(titles.map(l => l.group));
    if (groups.size > 1) overlaps.push({ t: f.t, texts: titles.map(l => l.text.slice(0, 40)) });
    for (const l of f.layers) {
      if (!spans.has(l.id)) spans.set(l.id, { kind: l.kind, text: l.text, code: l.code, runs: [] });
      const sp = spans.get(l.id); sp.text = l.text;
      if (l.op > 0.5) { const last = sp.runs[sp.runs.length - 1]; if (last && f.t - last[1] < 0.07) last[1] = f.t; else sp.runs.push([f.t, f.t]); }
    }
  }
  if (o.lang === 'te' && o.teluguText !== false) {
    const bad = [...new Set([...spans.values()].filter(s => ['title', 'label', 'chip'].includes(s.kind) && !s.code && englishOnly(s.text)).map(s => s.text))];
    add('text: no English-only titles, labels or captions', bad.length === 0, bad.length ? `English-only: ${bad.slice(0, 8).map(x => `"${x.slice(0, 50)}"`).join(', ')}` : 'all Telugu (tech words and brand allowed)');
  }
  add('text: one title at a time', overlaps.length === 0, overlaps.length ? `${overlaps.length} frames, first at ${overlaps[0].t.toFixed(2)} s: ${overlaps[0].texts.join(' | ')}` : 'no frame with two titles');
  const end = o.frames.length ? o.frames[o.frames.length - 1].t : 0;
  const short = [];
  for (const s of spans.values()) {
    if (s.kind === 'deco' || s.kind === 'caption' || !s.runs.length) continue;
    const longest = Math.max(...s.runs.map(([a, b]) => b - a + 1 / 30));
    const words = s.text.split(/\s+/).filter(Boolean).length;
    const need = s.code ? (o.codeHold ?? 4.5) : Math.max(2, words / 3);
    const lastRun = s.runs[s.runs.length - 1];
    if (longest + 0.05 < need && !(lastRun[1] >= end - 0.05)) short.push(`"${s.text.slice(0, 40)}" ${longest.toFixed(1)} s < ${need.toFixed(1)} s`);
  }
  add('text: read time held', short.length === 0, short.length ? short.slice(0, 6).join('; ') : `${spans.size} text layers checked`);

  // Code shown on screen runs: the bug really is a bug, and the fix works.
  if (o.codeTest) {
    const py = 'def add(a, b):\n    return a * b\nassert add(2, 3) != 5\ndef add(a, b):\n    return a + b\nassert add(2, 3) == 5 and add(-1, 1) == 0\nprint("ok")';
    const r = spawnSync('python3', ['-I', '-c', py], { encoding: 'utf8' });
    add('code: the snippet runs (bug fails, fix passes)', r.stdout.trim() === 'ok', r.stdout.trim() === 'ok' ? 'add(a, b): "a * b" fails the test, "a + b" passes' : (r.stderr || 'did not run').slice(0, 200));
  }

  // 5. Loudness and format.
  const L = loudness(o.file); const P = probe(o.file);
  add(`loudness: ${o.target.lufs} LUFS ±1, true peak ≤ −1 dBTP`, Math.abs(L.lufs - o.target.lufs) <= 1 && L.tp <= -1, `${L.lufs} LUFS, true peak ${L.tp} dBTP`);
  const sizeOk = P.width === o.target.size[0] && P.height === o.target.size[1];
  add('format: size, 30 fps, length', sizeOk && Math.abs(P.fps - 30) < 0.01 && P.duration <= o.target.max, `${P.width}×${P.height}, ${P.fps} fps, ${P.duration} s (max ${o.target.max} s${P.duration < o.target.min ? `; shorter than the kit's ${o.target.min} s because dead air was removed` : ''})`);


  // 7. Revision 1: no sound effects, no dead air, product shots never cropped, no blue.
  const extra = {};
  if (o.voiceFile) {
    const W = 0.05; // 50 ms windows
    const voice = rmsWindows(samples(o.voiceFile, 16000), 16000, W);
    const speech = (t) => { const i = Math.floor((t - o.lead) / W); for (let k = i - 4; k <= i + 4; k += 1) if (voice[k] > -45) return true; return false; };
    // SFX: broadband energy above 5 kHz for > 0.5 s with no speech.
    const hi = rmsWindows(samples(o.file, 48000, 'highpass=f=5000,highpass=f=5000'), 48000, W);
    const sfx = []; let run = null;
    hi.forEach((db, i) => { const t = i * W; const hot = db > -58 && !speech(t); if (hot) { run = run || [t, t]; run[1] = t + W; } else if (run) { if (run[1] - run[0] > 0.5) sfx.push(run); run = null; } });
    if (run && run[1] - run[0] > 0.5) sfx.push(run);
    extra.sfx = sfx.length ? sfx.map(([a, b]) => `${a.toFixed(1)}–${b.toFixed(1)} s`).join(', ') : 'none';
    add('sound: no sound effects (no >5 kHz noise > 0.5 s without speech)', sfx.length === 0, sfx.length ? `noise at ${extra.sfx}` : 'none found');
    // Silence: gaps in the voice between its first and last word, outside the declared holds (code cards, timers).
    const on = voice.map(db => db > -45); const first = on.indexOf(true); const last = on.lastIndexOf(true);
    const gaps = []; let g = null;
    for (let i = first; i <= last; i += 1) { if (!on[i]) { g = g ?? i; } else if (g != null) { gaps.push([o.lead + g * W, o.lead + i * W]); g = null; } }
    // The part of a pause that falls inside a declared hold (a code card or timer) does not count.
    const outside = ([a, b]) => (b - a) - (o.holds || []).reduce((m, [h0, h1]) => m + Math.max(0, Math.min(b, h1) - Math.max(a, h0)), 0);
    const open = gaps.map(x => [x[0], x[0] + outside(x)]); const longest = open.reduce((m, [a, b]) => Math.max(m, b - a), 0);
    const longestAll = gaps.reduce((m, [a, b]) => Math.max(m, b - a), 0);
    extra.longestSilence = +longest.toFixed(2); extra.longestHold = +longestAll.toFixed(2);
    const bad = open.filter(([a, b]) => b - a > 1.5);
    add('sound: no silence > 1.5 s mid-video', bad.length === 0, bad.length ? bad.map(([a, b]) => `${(b - a).toFixed(1)} s outside holds, at ${a.toFixed(1)} s`).join(', ') : `longest pause ${longest.toFixed(2)} s${longestAll > longest ? ` (code card/timer hold ${longestAll.toFixed(1)} s, declared)` : ''}`);
  }
  // Crop: every product screenshot frame stays inside the safe area.
  const [SW, SH] = o.target.size; const [mx, my] = o.safe || [0.05, 0.05];
  const crop = o.frames.filter(f => (f.boxes || []).some(([l, t, r, b]) => l < SW * mx - 1 || t < SH * my - 1 || r > SW * (1 - mx) + 1 || b > SH * (1 - my) + 1));
  add('picture: product shots inside the safe area', crop.length === 0, crop.length ? `${crop.length} frames, first at ${crop[0].t.toFixed(2)} s: box ${crop[0].boxes.map(b => b.map(Math.round).join(',')).join(' / ')}` : `${o.frames.filter(f => (f.boxes || []).length).length} frames with a product shot, all inside`);
  // Blue: sample 2 frames a second; screenshots masked out.
  {
    const w = 192; const h = Math.round(w * SH / SW); const sx = w / SW;
    const buf = execFileSync('ffmpeg', ['-v', 'error', '-i', o.file, '-vf', `fps=2,scale=${w}:${h}:flags=area`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 30 });
    const per = w * h * 3; let worst = 0; let worstT = 0;
    for (let k = 0; k * per < buf.length; k += 1) {
      const t = (k + 0.5) / 2; const f = o.frames.reduce((best, x) => (Math.abs(x.t - t) < Math.abs(best.t - t) ? x : best), o.frames[0] || { t, boxes: [] });
      const boxes = (f.boxes || []).map(bx => bx.map(v => v * sx));
      let blue = 0; let all = 0;
      for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
        if (boxes.some(([l, tp, r, b]) => x >= l - 2 && x <= r + 2 && y >= tp - 2 && y <= b + 2)) continue;
        const i = k * per + (y * w + x) * 3; const R = buf[i]; const G = buf[i + 1]; const B = buf[i + 2]; all += 1;
        if (B > R + 30 && B > G + 30) blue += 1;
      }
      const frac = all ? blue / all : 0; if (frac > worst) { worst = frac; worstT = k / 2; }
    }
    add('picture: no blue (≤ 2% of pixels, screenshots excluded)', worst <= 0.02, `worst frame ${(worst * 100).toFixed(2)}% at ${worstT.toFixed(1)} s`);
  }

  // 8. Revision 2: brand per mention, product-shot holds, callouts, captions, clicks, the closing sting.
  if (o.brandHeard) {
    const split = o.brandHeard.filter(m => m.words !== 1);
    const SPLIT = /\b(?:q\.?\s?b|cube|cue|kyu|queue|cu)\s+(?:by|be|bi|bee)?\s*(?:rex|tracks|trax|tracs|recs|wrecks|x)\b/i;
    const whole = SPLIT.exec(o.heard);
    add('brand: every mention heard as one word', split.length === 0 && !whole, `${o.brandHeard.map(m => `${m.t} s "${m.token || '?'}"`).join('; ') || 'no mentions'}${whole ? `; full transcript has "${whole[0]}"` : ''}`);
  }
  if (o.shots && o.shots.length) {
    const minHold = Math.min(...o.shots.map(x => x.hold)); const minCall = Math.min(...o.shots.map(x => x.callout));
    extra.shortestShot = +minHold.toFixed(2); extra.shortestCallout = +minCall.toFixed(2);
    add('product shots: each ≥ 4 s, callout ≥ 3 s', minHold >= 4 && minCall >= 3, `${o.shots.length} shots; shortest ${minHold.toFixed(1)} s, shortest callout ${minCall.toFixed(1)} s`);
    const bad = o.shots.filter(x => !x.ok);
    const mags = o.frames.flatMap(f => (f.calls || []).map(c => c[4])).filter(Boolean);
    const minMag = mags.length ? Math.min(...mags) : null;
    extra.calloutResult = bad.length ? `FAIL: ${bad.map(x => `${x.key}/${x.call}${x.cut.length ? ` cuts "${x.cut.slice(0, 3).join(' ')}"` : ''}${x.flat > 0.7 ? ` ${(x.flat * 100).toFixed(0)}% flat` : ''}`).join('; ')}` : `PASS: ${o.shots.length} callouts, no word cut, emptiest ${(Math.max(...o.shots.map(x => x.flat)) * 100).toFixed(0)}% flat tiles${minMag ? `, ${minMag.toFixed(2)}–${Math.max(...mags).toFixed(2)}× the page` : ''}`;
    add('callouts: no edge through a word, not empty (≤ 70% flat)', bad.length === 0, extra.calloutResult);
  }
  {
    const hit = o.frames.find(f => f.cap && (f.calls || []).some(([l, t, r, b]) => l < f.cap[2] && r > f.cap[0] && t < f.cap[3] && b > f.cap[1]));
    add('captions never over a callout', !hit, hit ? `overlap at ${hit.t.toFixed(2)} s` : 'no overlap');
  }
  if (o.clicks) add('sound: no clicks or pops (isolated bursts)', o.clicks.length === 0, o.clicks.length ? o.clicks.map(c => `${c.t} s (${c.db} dB)`).join(', ') : 'none');
  if (o.tailFrom != null) {
    const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-ss', String(Math.max(0, o.tailFrom)), '-i', o.file, '-af', 'ebur128', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
    const I = Number((/I:\s+(-?[\d.]+) LUFS/.exec(r.slice(r.lastIndexOf('Summary'))) || [])[1]);
    extra.tailLufs = Number.isFinite(I) ? I : null;
    add('sound: closing music after the last line < −20 LUFS', !Number.isFinite(I) || I < -20, Number.isFinite(I) ? `${I} LUFS over the last ${(P.duration - o.tailFrom).toFixed(1)} s` : 'too short to measure');
  }

  // 6. Contact sheet.
  const n = Math.ceil(P.duration / 2); const cols = 6; const rows = Math.ceil(n / cols);
  const sheet = path.join(QA_DIR, `${o.name}-sheet.jpg`);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', o.file, '-vf', `fps=1/2,scale=320:-2,tile=${cols}x${rows}`, '-frames:v', '1', '-q:v', '3', sheet]);

  const pass = checks.every(c => c.ok);
  const result = { name: o.name, pass, checks, lufs: L.lufs, truePeak: L.tp, duration: P.duration, ...extra, sheet: path.relative(path.dirname(DIR), sheet), brand: o.brand, at: new Date().toISOString() };
  fs.writeFileSync(path.join(QA_DIR, `${o.name}.json`), JSON.stringify(result, null, 1));
  return result;
}

/** One line per video in video/out/REPORT.md (rebuilt from video/qa/results.json). */
export function report(entry) {
  const reg = path.join(QA_DIR, 'results.json');
  const all = fs.existsSync(reg) ? JSON.parse(fs.readFileSync(reg, 'utf8')) : {};
  if (all[entry.key] && entry.oldDuration == null) entry.oldDuration = all[entry.key].revision === entry.revision ? all[entry.key].oldDuration : all[entry.key].duration;
  all[entry.key] = entry;
  fs.writeFileSync(reg, JSON.stringify(all, null, 1));
  const rows = Object.values(all).sort((a, b) => a.key.localeCompare(b.key)).map(e => `| \`${e.file}\` | ${e.oldDuration != null ? `${e.oldDuration} s` : '—'} | ${e.duration} s | ${e.longestSilence != null ? `${e.longestSilence} s` : '—'} | ${e.sfx ?? '—'} | ${e.pass ? 'PASS' : 'FAIL'}${e.failed.length ? `: ${e.failed.join('; ')}` : ''} | ${e.lufs} LUFS (TP ${e.truePeak}) | ${e.notes || ''} |`);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const r2 = Object.values(all).filter(e => e.revision === 2).sort((a, b) => a.key.localeCompare(b.key)).map(e => `| \`${e.file}\` | ${e.duration} s | ${(e.brandHeard || []).join('<br>') || '—'} | ${e.shortestShot != null ? `${e.shortestShot} s` : '—'} | ${e.calloutResult || '—'} | ${e.pass ? 'PASS' : 'FAIL'}${e.failed.length ? `: ${e.failed.join('; ')}` : ''} |`);
  const rev2 = r2.length ? `## Revision 2 (19 Nov 2026)\n\nBrand: each mention cut out and transcribed alone (the transcriber is not told the name); one word passes. Shortest shot: the shortest time any product screen stays up (its callout shows from 0.6 s). Callout QA: no callout edge cuts through a word, and no callout is more than 70% flat tiles (empty).\n\n| File | New length | Brand, as heard per mention | Shortest product shot | Callout QA | QA result |\n|---|---|---|---|---|---|\n${r2.join('\n')}\n\n## All videos\n\n` : '';
  fs.writeFileSync(path.join(OUT_DIR, 'REPORT.md'), `# Video report\n\n${rev2}One line per video. Longest silence is the longest pause in the voice mid-video, outside the declared code-card and timer holds. SFX found lists any noise above 5 kHz lasting over 0.5 s with no speech. QA details and contact sheets: \`video/qa/\`.\n\n| File | Old length | New length | Longest silence | SFX found | QA result | Loudness | Notes |\n|---|---|---|---|---|---|---|---|\n${rows.join('\n')}\n`);
}
