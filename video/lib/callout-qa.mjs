// Callout QA (revision 2). For a product still and the callout's source box
// (CSS px at 1440×900; the still is 2×):
//   cut:   words whose box crosses an edge of the callout (partly inside, partly out);
//   flat:  the share of pixels that are one flat colour (> 70% = an empty box).
import fs from 'fs';
import { execFileSync } from 'child_process';

export function calloutQa(still, wordsFile, [x0, y0, x1, y1]) {
  const words = fs.existsSync(wordsFile) ? JSON.parse(fs.readFileSync(wordsFile, 'utf8')) : [];
  const cut = words.filter(([l, t, r, b]) => {
    const ix = Math.min(r, x1) - Math.max(l, x0); const iy = Math.min(b, y1) - Math.max(t, y0);
    if (ix <= 1.5 || iy <= 1.5) return false; // outside (a brush of under 1.5 px is not a cut)
    const area = (r - l) * (b - t);
    return ix * iy < area * 0.9; // partly outside: the edge cuts through this word
  }).map(w => w[4]);
  // Empty box: the share of 32×32 px tiles (16 CSS px, about one text line, at 2×) that are one flat colour with
  // no detail at all. Text, lines and images make tiles non-flat.
  const W = Math.round((x1 - x0) * 2); const H = Math.round((y1 - y0) * 2);
  const buf = execFileSync('ffmpeg', ['-v', 'error', '-i', still, '-vf', `crop=${W}:${H}:${Math.round(x0 * 2)}:${Math.round(y0 * 2)}`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 28 });
  const T = 32; let tiles = 0; let flatTiles = 0;
  for (let ty = 0; ty + T <= H; ty += T) for (let tx = 0; tx + T <= W; tx += T) {
    let mn = 765; let mx = 0;
    for (let y = ty; y < ty + T; y += 1) for (let x = tx; x < tx + T; x += 1) { const i = (y * W + x) * 3; const v = buf[i] + buf[i + 1] + buf[i + 2]; if (v < mn) mn = v; if (v > mx) mx = v; }
    tiles += 1; if (mx - mn < 24) flatTiles += 1;
  }
  const flat = tiles ? flatTiles / tiles : 1;
  return { cut, flat: +flat.toFixed(3), ok: cut.length === 0 && flat <= 0.7 };
}
