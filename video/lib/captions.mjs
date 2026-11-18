// Captions (.srt) and the script with scene timings (video/scripts/<name>.md).
import fs from 'fs';

const ts = (t) => {
  const ms = Math.max(0, Math.round(t * 1000));
  const h = Math.floor(ms / 3600000); const m = Math.floor(ms / 60000) % 60; const s = Math.floor(ms / 1000) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`;
};
const mmss = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;

// Pieces of at most two lines of 42 characters, cut at sentence or clause ends.
function pieces(text, max = 84) {
  const parts = text.match(/[^.?!:;,]+[.?!:;,]*\s*/g) || [text];
  const out = []; let cur = '';
  for (const p of parts) {
    if ((cur + p).trim().length > max && cur.trim()) { out.push(cur.trim()); cur = ''; }
    cur += p;
  }
  if (cur.trim()) out.push(cur.trim());
  return out.flatMap(x => (x.length <= max ? [x] : x.match(new RegExp(`.{1,${max}}(\\s|$)`, 'g')).map(y => y.trim())));
}
const twoLines = (s, w = 42) => {
  if (s.length <= w) return s;
  const i = s.lastIndexOf(' ', Math.ceil(s.length / 2) + 6);
  return i > 0 ? `${s.slice(0, i)}\n${s.slice(i + 1)}` : s;
};

/** lines: [{ text, start, end }] in seconds of the final video. */
export function writeSrt(file, lines) {
  const cues = [];
  for (const l of lines) {
    const ps = pieces(l.text); const total = ps.reduce((a, p) => a + p.length, 0);
    let t = l.start;
    ps.forEach((p) => { const d = (l.end - l.start) * (p.length / total); cues.push({ a: t, b: t + d - 0.05, text: twoLines(p) }); t += d; });
  }
  fs.writeFileSync(file, cues.map((c, i) => `${i + 1}\n${ts(c.a)} --> ${ts(c.b)}\n${c.text}\n`).join('\n'));
  return cues.length;
}

/** The final script with scene timings; Telugu scripts carry an English back-translation. */
export function writeScript(file, { title, name, lang, total, lines, notes = [] }) {
  const te = lang === 'te';
  const head = te ? '| # | Time | Section | Telugu (spoken) | English back-translation | On screen |\n|---|---|---|---|---|---|' : '| # | Time | Section | Voice | On screen |\n|---|---|---|---|---|';
  const rows = lines.map((l, i) => `| ${i + 1} | ${mmss(l.start)}–${mmss(l.end)} | ${l.section} | ${l.text.replace(/\|/g, '\\|')} |${te ? ` ${(l.back || '').replace(/\|/g, '\\|')} |` : ''} ${(l.screen || '').replace(/\|/g, '\\|')} |`);
  const next = lines.some(l => l.next) ? `\n## Proposed for re-voicing (after the native-speaker check)\n\n| # | Telugu (proposed) | English back-translation |\n|---|---|---|\n${lines.map((l, i) => (l.next ? `| ${i + 1} | ${l.next.say.replace(/\|/g, '\\|')} | ${l.next.back.replace(/\|/g, '\\|')} |` : `| ${i + 1} | (cut) | |`)).join('\n')}\n` : '';
  fs.writeFileSync(file, `# ${title}\n\nFile: \`video/out/${name}.mp4\` · ${Math.round(total * 10) / 10} s · language: ${te ? 'Telugu (Telugu-English mix)' : 'English'}\n\n${notes.map(n => `- ${n}`).join('\n')}${notes.length ? '\n\n' : ''}${head}\n${rows.join('\n')}\n${next}`);
}
