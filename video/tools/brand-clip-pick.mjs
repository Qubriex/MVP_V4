// Picks the brand clip that is heard as ONE word most often in real contexts:
// each test recording's first "Qubirex" (video/qa/brand-tests/*.wav, cut by
// word alignment, at the videos' 0.95 speed, quiet edges trimmed) is spliced
// into real voices (institution-60s, employer-square) and every mention is
// transcribed by a transcriber that is not told the name.
//   PYTHON=<python with pocketsphinx> node video/tools/brand-clip-pick.mjs
// → video/qa/brand-tests/pick.json, and the winner at video/assets/voice/qubirex-en.wav
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';
import { readPcm, writeWav, edit, levels, RATE } from '../lib/audio.mjs';

const VDIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = path.resolve(VDIR, '..');
const TMP = path.join(VDIR, 'work/brand-pick'); fs.mkdirSync(TMP, { recursive: true });
const dotenv = await import(path.join(ROOT, 'backend/node_modules/dotenv/lib/main.js'));
(dotenv.default || dotenv).config({ path: path.join(ROOT, 'backend/.env') });
const KEYS = [process.env.GEMINI_API_KEY_2, process.env.GEMINI_API_KEY_3, process.env.GEMINI_API_KEY].filter(Boolean);
const { TEXT_MODELS } = await import(pathToFileURL(path.join(ROOT, 'scripts/walkthrough/lib/align-check.mjs')).href);
const PY = process.env.PYTHON; if (!PY) throw new Error('set PYTHON');
const ROUNDS = Number(process.env.ROUNDS || 1);

let ki = 0;
async function asr(file) {
  const b64 = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-ac', '1', '-ar', '16000', '-b:a', '48k', '-f', 'mp3', '-']).toString('base64');
  const ask = 'Transcribe this short English audio clip exactly as you hear it, word for word. If a word is a name you do not know, spell it the way it sounds. Plain text only.';
  for (const model of TEXT_MODELS) for (let n = 0; n < KEYS.length; n += 1) {
    const key = KEYS[(ki++) % KEYS.length];
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify({ contents: [{ parts: [{ inline_data: { mime_type: 'audio/mp3', data: b64 } }, { text: ask }] }], generationConfig: { temperature: 0 } }), signal: AbortSignal.timeout(60000) }).catch(() => ({ ok: false }));
    if (r.ok) { const t = (await r.json()).candidates?.[0]?.content?.parts?.map(x => x.text).join(' ').trim(); if (t) return t; }
  }
  return '';
}
const lev = (a, b) => { const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]); for (let j = 1; j <= b.length; j += 1) d[0][j] = j; for (let i = 1; i <= a.length; i += 1) for (let j = 1; j <= b.length; j += 1) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length]; };
function brandToken(text) {
  const toks = String(text).replace(/[.,!?;:"“”()]/g, ' ').split(/\s+/).filter(Boolean); let best = { d: 1, token: '', words: 0 };
  for (let i = 0; i < toks.length; i += 1) for (let n = 1; n <= 3 && i + n <= toks.length; n += 1) { const sp = toks.slice(i, i + n); const d = lev(sp.join('').toLowerCase().replace(/[^a-z]/g, ''), 'qubirex') / 7; if (d < best.d - 1e-9 || (Math.abs(d - best.d) < 1e-9 && n < best.words)) best = { d, token: sp.join(' '), words: n }; }
  return best.d > 0.5 ? { ...best, words: 0 } : best;
}
// Candidate clips: the first brand word in each test recording.
const T = path.join(VDIR, 'qa/brand-tests');
const cands = [];
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
for (const f of fs.readdirSync(T).filter(x => /^\d-.*\.wav$/.test(x) && (!ONLY.length || ONLY.includes(x.replace('.wav', '')))).sort()) {
  const slow = path.join(TMP, f); execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', path.join(T, f), '-af', 'atempo=0.95', '-ar', '48000', '-ac', '1', slow]);
  const lf = path.join(TMP, 'lines.json'); fs.writeFileSync(lf, JSON.stringify(['Meet Qubirex.', 'With Qubirex, every student learns to code in their own language.']));
  let w; try { w = JSON.parse(execFileSync(PY, ['-I', path.join(ROOT, 'scripts/walkthrough/lib/forced_align.py'), slow, lf], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim().split('\n').pop()).words.find(x => x.w === 'qubirex'); } catch { continue; }
  if (!w) continue;
  let pcm = readPcm(slow).slice(Math.round((w.start - 0.03) * RATE), Math.round((w.end + 0.03) * RATE));
  // trim quiet edges (below −45 dB in 10 ms windows), keep 15 ms, 10 ms fades
  const L = levels(pcm, 0.01); const a = Math.max(0, L.findIndex(x => x > -45) - 1.5); const b = Math.min(L.length, L.length - [...L].reverse().findIndex(x => x > -45) + 1.5);
  pcm = pcm.slice(Math.round(a * 0.01 * RATE), Math.round(b * 0.01 * RATE)); const r = Math.round(0.01 * RATE); for (let i = 0; i < r; i += 1) { pcm[i] *= i / r; pcm[pcm.length - 1 - i] *= i / r; }
  cands.push({ name: f.replace('.wav', ''), pcm });
}
// Contexts: real voices with their word timing.
const CTX = ['institution-60s-en', 'employer-square-en'].map(id => ({ id, pcm: readPcm(path.join(VDIR, 'work', id, 'voice.wav')), t: JSON.parse(fs.readFileSync(path.join(VDIR, 'work', id, 'timing.json'), 'utf8')) }));
const results = [];
for (const c of cands) {
  const heard = [];
  for (const x of CTX) {
    const E = edit(x.pcm, x.t.starts, { brand: x.t.brand, refClip: c.pcm });
    const v = new Float32Array(E.scenes.reduce((s, y) => s + y.length, 0)); let o = 0; E.scenes.forEach(y => { v.set(y, o); o += y.length; });
    for (const m of E.brand) {
      const at = m.t; const file = path.join(TMP, `${c.name}-${x.id}-${m.t}.wav`);
      writeWav(file, v.slice(Math.max(0, Math.round((at - 0.6) * RATE)), Math.round((at + m.dur + 0.6) * RATE)));
      for (let k = 0; k < ROUNDS; k += 1) { const h = await asr(file); const bt = brandToken(h); heard.push({ ctx: `${x.id}@${m.t}`, heard: h, token: bt.token, words: bt.words }); }
    }
  }
  const ok = heard.filter(h => h.words === 1).length;
  const dist = heard.reduce((sum, h) => sum + lev((h.token || '').toLowerCase().replace(/[^a-z]/g, ''), 'qubirex'), 0) / heard.length;
  results.push({ clip: c.name, oneWord: ok, of: heard.length, meanDistance: +dist.toFixed(2), heard: heard.map(h => h.token || '?') });
  console.log(`${c.name}: ${ok}/${heard.length} one word  [${heard.map(h => h.token || '?').join(' | ')}]`);
}
results.sort((a, b) => (b.oneWord / b.of - a.oneWord / a.of) || (a.meanDistance - b.meanDistance)); // ties: closest to "Qubirex"
fs.writeFileSync(path.join(T, ONLY.length ? 'pick-final.json' : 'pick.json'), JSON.stringify(results, null, 1));
const win = cands.find(c => c.name === results[0].clip);
writeWav(path.join(VDIR, 'assets/voice/qubirex-en.wav'), win.pcm);
console.log(`winner: ${results[0].clip} (${results[0].oneWord}/${results[0].of}) → video/assets/voice/qubirex-en.wav`);
