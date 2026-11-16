// An original background score, synthesised (no samples, no licence needed):
// a soft pad that starts low and reflective, light plucked notes from the
// turn to the solution, a gentle pulse under the product, a riser into the
// reveal and soft whooshes at each section change. Writes a 48 kHz stereo WAV.
import fs from 'fs';

const SR = 48000;
const midi = (n) => 440 * 2 ** ((n - 69) / 12);
// Chords as MIDI notes. Reflective (Am F C G), then hopeful (F G Am C / F G C C).
const CHORDS = {
  Am: [57, 60, 64], F: [53, 57, 60], C: [48, 55, 60, 64], G: [55, 59, 62], Em: [52, 55, 59], Dm: [50, 53, 57]
};

/**
 * @param {string} file  output WAV
 * @param {number} total seconds
 * @param {{ solution: number, product: number, whyNow: number, close: number }} at section starts (s)
 */
export function writeScore(file, total, at) {
  const n = Math.ceil(total * SR);
  const L = new Float32Array(n); const R = new Float32Array(n);
  const add = (i, l, r = l) => { if (i >= 0 && i < n) { L[i] += l; R[i] += r; } };

  // Chord plan: one chord per bar of 2.6 s (about 92 bpm, 4 beats).
  const bar = 2.6;
  const plan = [];
  for (let t = 0; t < total; t += bar) {
    let name;
    if (t < at.solution) name = ['Am', 'F', 'C', 'G'][Math.floor(t / bar) % 4];
    else if (t < at.close) name = ['F', 'G', 'Am', 'C'][Math.floor((t - at.solution) / bar) % 4];
    else name = ['F', 'G', 'C', 'C'][Math.floor((t - at.close) / bar) % 4];
    plan.push({ t, name });
  }

  // Pad: detuned sines with slow swells; louder and wider after the turn.
  for (const { t, name } of plan) {
    const s0 = Math.floor(t * SR); const len = Math.floor((bar + 1.2) * SR);
    const bright = t >= at.solution;
    const gain = (t < at.solution ? 0.05 : 0.065) / CHORDS[name].length;
    for (const note of [...CHORDS[name], CHORDS[name][0] - 12]) {
      const f = midi(note);
      for (const [det, pan] of [[-0.12, 0.3], [0.12, 0.7]]) {
        const w = 2 * Math.PI * (f * (1 + det / 100)) / SR;
        for (let k = 0; k < len; k += 1) {
          const tt = k / SR;
          const env = Math.min(1, tt / 0.9) * Math.min(1, Math.max(0, (bar + 1.2 - tt) / 1.2));
          const v = gain * env * (Math.sin(w * k) + (bright ? 0.18 : 0.08) * Math.sin(2 * w * k));
          add(s0 + k, v * (1 - pan), v * pan);
        }
      }
    }
  }

  // Plucked notes (a soft, piano-like arpeggio) from the solution on.
  const beat = bar / 4;
  for (const { t, name } of plan) {
    if (t < at.solution - 0.01) continue;
    const tones = CHORDS[name].map(x => x + 12);
    const steps = t >= at.product ? 8 : 4;
    for (let s = 0; s < steps; s += 1) {
      const start = t + (s * bar) / steps;
      if (start >= total - 0.5) break;
      const f = midi(tones[[0, 1, 2, 1, 0, 2, 1, 2][s % 8]]);
      const s0 = Math.floor(start * SR); const len = Math.floor(1.4 * SR);
      const pan = 0.35 + 0.3 * ((s % 3) / 2);
      for (let k = 0; k < len; k += 1) {
        const tt = k / SR;
        const env = Math.min(1, tt / 0.004) * Math.exp(-tt * 3.2);
        const v = 0.05 * env * (Math.sin(2 * Math.PI * f * tt) + 0.3 * Math.sin(4 * Math.PI * f * tt) * Math.exp(-tt * 6));
        add(s0 + k, v * (1 - pan), v * pan);
      }
    }
  }

  // A soft pulse (low thump on each beat) under the product and why-now.
  for (let t = at.product; t < at.close; t += beat) {
    const s0 = Math.floor(t * SR); const len = Math.floor(0.35 * SR);
    for (let k = 0; k < len; k += 1) {
      const tt = k / SR;
      const f = 55 + 60 * Math.exp(-tt * 30);
      const v = 0.11 * Math.exp(-tt * 9) * Math.sin(2 * Math.PI * f * tt);
      add(s0 + k, v);
    }
  }

  // Noise helpers: a riser into the product reveal, whooshes at section changes.
  let seed = 7;
  const noise = () => { seed = (seed * 16807) % 2147483647; return (seed / 2147483647) * 2 - 1; };
  const sweep = (from, dur, peak, rising) => {
    const s0 = Math.floor(from * SR); const len = Math.floor(dur * SR);
    let lp = 0;
    for (let k = 0; k < len; k += 1) {
      const p = k / len;
      const shape = rising ? p ** 2 : Math.sin(Math.PI * p) ** 2;
      const cutoff = rising ? 0.02 + 0.25 * p : 0.04 + 0.2 * Math.sin(Math.PI * p);
      lp += cutoff * (noise() - lp);
      add(s0 + k, peak * shape * lp * (0.8 + 0.2 * Math.sin(k / 900)), peak * shape * lp * (0.8 + 0.2 * Math.cos(k / 900)));
    }
  };
  sweep(at.product - 2.2, 2.2, 0.9, true);
  for (const t of [at.solution, at.product, at.whyNow, at.close, ...(at.extra || [])]) sweep(t - 0.35, 0.9, 0.7, false);

  // Fade in and out, then write 16-bit stereo WAV.
  const fadeIn = SR * 1.5; const fadeOut = SR * 3;
  const buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i += 1) {
    const g = Math.min(1, i / fadeIn, (n - i) / fadeOut);
    const l = Math.tanh(L[i] * g * 1.4); const r = Math.tanh(R[i] * g * 1.4);
    buf.writeInt16LE(Math.round(l * 32000), 44 + i * 4); buf.writeInt16LE(Math.round(r * 32000), 46 + i * 4);
  }
  fs.writeFileSync(file, buf);
}
