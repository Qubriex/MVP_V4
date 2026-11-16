// Line start times in a voice-over that reads the lines in order with a pause
// between them: choose, among the pauses, the set of boundaries that best fits
// each line's expected length (by its number of characters), preferring the
// longer pauses between paragraphs. Dynamic programming, no network.
import { spawnSync } from 'child_process';

export function pauses(file, ffmpeg = 'ffmpeg') {
  const err = spawnSync(ffmpeg, ['-hide_banner', '-i', file, '-af', 'silencedetect=n=-38dB:d=0.18', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
  const s = [...err.matchAll(/silence_start: ([\d.]+)/g)].map(m => Number(m[1]));
  const e = [...err.matchAll(/silence_end: ([\d.]+)/g)].map(m => Number(m[1]));
  return e.map((end, i) => ({ start: s[i], end, len: end - s[i] })).filter(x => Number.isFinite(x.start));
}

/** @returns {number[]} start of each line (seconds); the first is the speech start. */
export function alignLines(lines, file, total, ffmpeg) {
  const ps = pauses(file, ffmpeg);
  const speechStart = ps.length && ps[0].start < 0.05 ? ps[0].end : 0;
  const lastPause = ps.length && ps[ps.length - 1].end > total - 0.05 ? ps[ps.length - 1].start : total;
  const chars = lines.map(l => l.length + 12); // a little fixed time per line
  const sum = chars.reduce((a, b) => a + b, 0);
  const speech = lastPause - speechStart;
  const expected = []; let acc = 0;
  for (let i = 0; i < lines.length - 1; i += 1) { acc += chars[i]; expected.push(speechStart + (speech * acc) / sum); }
  const cand = ps.filter(p => p.end > speechStart + 0.5 && p.end < lastPause - 0.5);
  // DP: f[k][j] = best cost with boundary k at candidate j.
  const K = expected.length; const M = cand.length;
  const cost = (k, j) => ((cand[j].end - expected[k]) / 2.5) ** 2 - 6 * Math.min(cand[j].len, 1.2);
  let prev = cand.map((_, j) => ({ c: cost(0, j), from: -1 }));
  const back = [prev];
  for (let k = 1; k < K; k += 1) {
    const cur = [];
    let best = { c: Infinity, j: -1 };
    for (let j = 0; j < M; j += 1) {
      if (j > 0 && prev[j - 1].c < best.c) best = { c: prev[j - 1].c, j: j - 1 };
      cur.push({ c: best.c + cost(k, j), from: best.j });
    }
    back.push(cur); prev = cur;
  }
  let j = prev.reduce((b, x, i) => (x.c < prev[b].c ? i : b), 0);
  const picks = [];
  for (let k = K - 1; k >= 0; k -= 1) { picks.unshift(j); j = back[k][j].from; }
  return [speechStart, ...picks.map(i => Math.max(0, cand[i].end - 0.05))];
}
