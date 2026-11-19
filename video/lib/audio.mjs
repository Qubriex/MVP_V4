// Voice-over editing on raw samples (48 kHz mono float), with every timing
// moved along with the edits:
//   - one file per scene (a bad line can be voiced again on its own),
//   - holds (silence after a line, so a card can stay on screen),
//   - the brand: every "Qubirex" is the same recorded clip, so it is said
//     the same way every time.
import fs from 'fs';
import { execFileSync } from 'child_process';

export const RATE = 48000;

export function readPcm(file) {
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-ac', '1', '-ar', String(RATE), '-f', 'f32le', '-'], { maxBuffer: 1 << 30 });
  return new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4).slice();
}

export function writeWav(file, pcm) {
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'f32le', '-ar', String(RATE), '-ac', '1', '-i', '-', '-ar', String(RATE), '-ac', '2', '-c:a', 'pcm_s16le', file], { input: Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength) });
}

const at = (t) => Math.max(0, Math.round(t * RATE));
const concat = (parts) => { const n = parts.reduce((a, p) => a + p.length, 0); const out = new Float32Array(n); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out; };
// A short fade at each cut, so no click.
function faded(x, ms = 6) {
  const y = x.slice(); const n = Math.min(Math.round(RATE * ms / 1000), Math.floor(y.length / 2));
  for (let i = 0; i < n; i += 1) { const g = i / n; y[i] *= g; y[y.length - 1 - i] *= g; }
  return y;
}

/**
 * @param {Float32Array} pcm  the whole voice-over
 * @param {number[]} starts   line starts (s) in pcm
 * @param {{ pads?: number[], overrides?: (Float32Array|null)[], brand?: {start:number,end:number,line:number}[] }} edits
 * @returns {{ pcm: Float32Array, starts: number[], scenes: Float32Array[], brand: {line:number,t:number,dur:number}[] , reference: Float32Array|null }}
 */
export function edit(pcm, starts, { pads = [], overrides = [], brand = [], refClip = null } = {}) {
  const total = pcm.length / RATE;
  // 1. Scenes: line i runs from its start to the next line's start.
  let scenes = starts.map((s, i) => pcm.slice(at(s), at(i + 1 < starts.length ? starts[i + 1] : total)));
  // 2. The brand clip: the mention whose length is the median of all
  //    mentions (a typical one), with 20 ms either side.
  let reference = null; const marks = [];
  if (brand.length) {
    const sorted = [...brand].sort((a, b) => (a.end - a.start) - (b.end - b.start));
    const ref = sorted[Math.floor(sorted.length / 2)];
    reference = refClip ? faded(refClip) : faded(pcm.slice(at(ref.start - 0.02), at(ref.end + 0.02)));
    // Replace inside each scene, last mention first so earlier offsets stay right.
    const byLine = new Map();
    brand.forEach(b => { if (!overrides[b.line]) { if (!byLine.has(b.line)) byLine.set(b.line, []); byLine.get(b.line).push(b); } });
    for (const [li, list] of byLine) {
      let sc = scenes[li]; const s0 = starts[li];
      for (const b of [...list].sort((x, y) => y.start - x.start)) {
        const a = at(b.start - 0.02 - s0); const e = at(b.end + 0.02 - s0);
        sc = concat([faded(sc.slice(0, a)), reference, faded(sc.slice(e))]);
      }
      scenes[li] = sc;
    }
  }
  // 3. Lines voiced again on their own replace their scene.
  scenes = scenes.map((sc, i) => overrides[i] || sc);
  // 4. Holds after a line.
  scenes = scenes.map((sc, i) => (pads[i] ? concat([sc, new Float32Array(at(pads[i]))]) : sc));
  // New starts, and where each brand mention now sits.
  const newStarts = []; let t = 0;
  scenes.forEach(sc => { newStarts.push(t); t += sc.length / RATE; });
  const out = [];
  if (reference) {
    for (const b of brand) {
      if (overrides[b.line]) continue;
      // Position inside the edited scene: earlier mentions in the same line shift it.
      const before = brand.filter(x => x.line === b.line && x.start < b.start && !overrides[x.line]);
      const shift = before.reduce((acc, x) => acc + reference.length / RATE - (x.end - x.start + 0.04), 0);
      out.push({ line: b.line, t: +(newStarts[b.line] + (b.start - 0.02 - starts[b.line]) + shift).toFixed(2), dur: +(reference.length / RATE).toFixed(2) });
    }
  }
  return { pcm: concat(scenes), starts: newStarts, scenes, brand: out, reference };
}

export const seconds = (pcm) => pcm.length / RATE;

// 20 ms RMS levels (dBFS) of a mono buffer.
export function levels(pcm, win = 0.02) {
  const n = Math.round(win * RATE); const out = [];
  for (let i = 0; i + n <= pcm.length; i += n) { let e = 0; for (let j = i; j < i + n; j += 1) e += pcm[j] * pcm[j]; out.push(10 * Math.log10(e / n + 1e-12)); }
  return out;
}
/**
 * Isolated bursts: a short loud run (< 0.4 s, peak above −30 dB) with silence
 * (< −65 dB) for at least 0.1 s on both sides (or the file's end). The voice engine leaves
 * one at the end of its stream: heard as a click or pop on the end card.
 */
export function bursts(pcm) {
  const L = levels(pcm); const W = 0.02; const out = [];
  const Q = -65; const quiet = (i) => i < 0 || i >= L.length || L[i] < Q;
  for (let i = 0; i < L.length; i += 1) {
    if (L[i] < -30) continue; // only loud onsets
    if (![1, 2, 3, 4, 5].every(k => quiet(i - k))) { while (i < L.length && !quiet(i)) i += 1; continue; }
    // the run of sound, allowing one-window dropouts inside it
    let j = i; while (j < L.length && (!quiet(j) || (j + 1 < L.length && !quiet(j + 1)))) j += 1;
    const len = (j - i) * W;
    if (len < 0.4 && [0, 1, 2, 3, 4].every(k => quiet(j + k))) out.push({ t: +(i * W).toFixed(2), len: +len.toFixed(2), db: +Math.max(...L.slice(i, j)).toFixed(1) });
    i = j;
  }
  return out;
}
/** Removes isolated bursts (the engine's start and end-of-stream clicks): a burst at the end is cut off, others are faded to silence (10 ms ramps). */
export function trimTailBurst(pcm) {
  const bs = bursts(pcm); if (!bs.length) return { pcm, cut: null, all: [] };
  let out = pcm.slice(); const end = pcm.length / RATE;
  const tail = bs.find(x => x.t + x.len >= end - 0.05);
  if (tail) out = out.slice(0, Math.round(tail.t * RATE));
  const r = Math.round(0.01 * RATE);
  for (const x of bs.filter(y => y !== tail)) { const a = Math.round(x.t * RATE); const b = Math.min(out.length, Math.round((x.t + x.len) * RATE)); for (let k = a; k < b; k += 1) out[k] = 0; for (let k = 1; k <= r; k += 1) { if (a - k >= 0) out[a - k] *= k / r; if (b + k - 1 < out.length) out[b + k - 1] *= k / r; } }
  const f = Math.round(0.02 * RATE); for (let k = 0; k < f && k < out.length; k += 1) out[out.length - 1 - k] *= k / f;
  return { pcm: out, cut: tail || bs[0], all: bs };
}
export const exists = (f) => fs.existsSync(f);
/**
 * Tightens every line to its speech: from 0.1 s before the first sound to 0.25 s
 * after the last (runs of at least 60 ms above −40 dB count as speech; a breath
 * blip does not). Returns the new buffer, line starts, and a mapper for times in
 * the old buffer (brand marks).
 */
export function tightenLines(pcm, starts, { pre = 0.1, post = 0.25 } = {}) {
  const L = levels(pcm, 0.01); const total = pcm.length / RATE; const W = 0.01;
  const speech = (a, b) => { let first = null; let last = null; let run = 0;
    for (let t = a; t < b - 1e-9; t += W) { const k = Math.round(t / W); if (k < L.length && L[k] > -40) { run += 1; if (run >= 6) { if (first == null) first = t - (run - 1) * W; last = t + W; } } else run = 0; }
    return [first ?? a, last ?? b]; };
  const segs = starts.map((a, i) => { const b = i + 1 < starts.length ? starts[i + 1] : total; const [f0, l0] = speech(a, b); return [Math.max(a, f0 - pre), Math.min(b, l0 + post)]; });
  const parts = []; const newStarts = []; let o = 0;
  segs.forEach(([a, b]) => { newStarts.push(o / RATE); const x = pcm.slice(Math.round(a * RATE), Math.round(b * RATE)); parts.push(x); o += x.length; });
  const out = new Float32Array(o); let p = 0; parts.forEach(x => { out.set(x, p); p += x.length; });
  const map = (t, line) => newStarts[line] + (t - segs[line][0]);
  return { pcm: out, starts: newStarts, map, segs };
}
/** Scene boundaries at the quietest 10 ms near each aligned start (−0.3 to +0.1 s), so no word is split between scenes. */
export function snapStarts(pcm, starts) {
  const L = levels(pcm, 0.01);
  return starts.map((s, i) => { if (i === 0) return s; let best = s; let lo = Infinity; for (let t = s - 0.3; t <= s + 0.1; t += 0.01) { const k = Math.round(t / 0.01); if (k >= 0 && k < L.length && L[k] < lo) { lo = L[k]; best = t; } } return +best.toFixed(3); });
}
