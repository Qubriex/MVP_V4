// The music bed: one soft, warm pad (original, synthesised here, so no
// licence is needed). Sustained chords that change slowly, no melody, no
// repeating figure, and no sound effects of any kind (no whoosh, riser, click
// or tick). Fades in over 1 s and out over 2 s. The same family for every video.
import { writeWav, RATE } from './audio.mjs';

// D major, warm voicings (Hz). Each chord lasts 8 s and blends into the next.
const CHORDS = [
  [146.83, 220.0, 277.18, 329.63, 440.0],   // Dmaj9 (D A C# E A)
  [123.47, 185.0, 220.0, 293.66, 369.99],   // Bm7   (B F# A D F#)
  [98.0, 146.83, 246.94, 293.66, 369.99],   // Gmaj7 (G D B D F#)
  [110.0, 164.81, 220.0, 277.18, 329.63]    // A6sus (A E A C# E)
];

export function writePad(file, seconds) {
  const n = Math.ceil(seconds * RATE);
  const out = new Float32Array(n);
  const LEN = 8; const XF = 3; // chord length and crossfade (s)
  // Each partial: a sine plus a quieter octave, two voices detuned for warmth.
  for (let c = 0; c * LEN < seconds + XF; c += 1) {
    const notes = CHORDS[c % CHORDS.length];
    const t0 = c * LEN - XF / 2; const t1 = (c + 1) * LEN + XF / 2;
    const a = Math.max(0, Math.floor(t0 * RATE)); const b = Math.min(n, Math.ceil(t1 * RATE));
    notes.forEach((f, k) => {
      const amp = 0.06 / (1 + k * 0.35);
      for (const det of [-0.0025, 0.0025]) {
        const w = 2 * Math.PI * f * (1 + det) / RATE; const w2 = w * 2;
        const ph = (k * 1.7 + det * 400) % (2 * Math.PI);
        for (let i = a; i < b; i += 1) {
          const t = i / RATE;
          // Chord envelope: slow rise and fall at the crossfades.
          const e = Math.min(1, (t - t0) / XF, (t1 - t) / XF);
          if (e <= 0) continue;
          const env = Math.sin(Math.PI / 2 * e) ** 2;
          const breath = 0.85 + 0.15 * Math.sin(2 * Math.PI * 0.07 * t + k); // gentle movement
          out[i] += amp * env * breath * (Math.sin(w * i + ph) + 0.18 * Math.sin(w2 * i + ph * 1.3));
        }
      }
    });
  }
  // Soft low-pass (two one-pole stages, ~1.4 kHz): nothing bright or hissy.
  const k = 1 - Math.exp(-2 * Math.PI * 1400 / RATE);
  for (let pass = 0; pass < 2; pass += 1) { let y = 0; for (let i = 0; i < n; i += 1) { y += k * (out[i] - y); out[i] = y; } }
  // Fade in 1 s, out 2 s; then a safe peak.
  let peak = 0;
  for (let i = 0; i < n; i += 1) {
    const t = i / RATE; const g = Math.min(1, t / 1, (seconds - t) / 2);
    out[i] *= Math.max(0, g); peak = Math.max(peak, Math.abs(out[i]));
  }
  if (peak > 0) for (let i = 0; i < n; i += 1) out[i] *= 0.5 / peak;
  writeWav(file, out);
}
