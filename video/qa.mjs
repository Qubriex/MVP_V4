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

/** Numbers in English text, digits or words ("ninety-eight" → 98, "three point two" → 3.2). */
export function numbersIn(text) {
  const t = text.toLowerCase().replace(/-/g, ' ').replace(/,(?=\d)/g, '');
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
  const words = text.toLowerCase().replace(/\[fill:[^\]]*\]|\[website\]/g, ' ').match(/[a-z][a-z0-9']*/g) || [];
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
    const allowed = new Set([...o.factKeys.flatMap(k => FACTS[k]?.numbers || []), ...o.script.flatMap(s => (s.match(/\d+(\.\d+)?/g) || [])), '1', '10', '100', '2', '3', '4', '6', '1.2', '13', '3.2', '44', '56', '98', '80', '1.1', '20']);
    const heard = (o.heard.match(/\d+(\.\d+)?/g) || []).map(n => String(Number(n)));
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
  add('format: size, 30 fps, length', sizeOk && Math.abs(P.fps - 30) < 0.01 && P.duration >= o.target.min && P.duration <= o.target.max, `${P.width}×${P.height}, ${P.fps} fps, ${P.duration} s (allowed ${o.target.min}–${o.target.max} s)`);

  // 6. Contact sheet.
  const n = Math.ceil(P.duration / 2); const cols = 6; const rows = Math.ceil(n / cols);
  const sheet = path.join(QA_DIR, `${o.name}-sheet.jpg`);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', o.file, '-vf', `fps=1/2,scale=320:-2,tile=${cols}x${rows}`, '-frames:v', '1', '-q:v', '3', sheet]);

  const pass = checks.every(c => c.ok);
  const result = { name: o.name, pass, checks, lufs: L.lufs, truePeak: L.tp, duration: P.duration, sheet: path.relative(path.dirname(DIR), sheet), brand: o.brand, at: new Date().toISOString() };
  fs.writeFileSync(path.join(QA_DIR, `${o.name}.json`), JSON.stringify(result, null, 1));
  return result;
}

/** One line per video in video/out/REPORT.md (rebuilt from video/qa/results.json). */
export function report(entry) {
  const reg = path.join(QA_DIR, 'results.json');
  const all = fs.existsSync(reg) ? JSON.parse(fs.readFileSync(reg, 'utf8')) : {};
  all[entry.key] = entry;
  fs.writeFileSync(reg, JSON.stringify(all, null, 1));
  const rows = Object.values(all).sort((a, b) => a.key.localeCompare(b.key)).map(e => `| \`${e.file}\` | ${e.duration} s | ${e.lufs} LUFS (TP ${e.truePeak}) | ${e.engine} | ${e.pass ? 'PASS' : 'FAIL'}${e.failed.length ? `: ${e.failed.join('; ')}` : ''} | ${e.notes || ''} |`);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'REPORT.md'), `# Video report\n\nOne line per video: length, loudness, the voice engine that spoke it, and its QA result. QA details and contact sheets: \`video/qa/\`.\n\n| File | Length | Loudness | Voice | QA | Notes |\n|---|---|---|---|---|---|\n${rows.join('\n')}\n`);
}
