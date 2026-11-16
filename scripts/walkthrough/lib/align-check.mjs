// Precise line timing: cut the voice-over at its pauses into phrases,
// transcribe every phrase (Gemini, text key), then walk the script in order
// and give each line the start of the phrase where its first words are heard.
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { pauses } from './align.mjs';

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

export async function alignByPhrases(lines, file, total, tmpDir) {
  const ps = pauses(file);
  // Speech phrases between pauses (merge tiny ones).
  let segs = []; let cur = 0;
  for (const p of ps) { if (p.start - cur > 0.05) segs.push([cur, p.start]); cur = p.end; }
  if (total - cur > 0.05) segs.push([cur, total]);
  segs = segs.reduce((acc, s) => { const last = acc[acc.length - 1]; if (last && s[1] - s[0] < 0.6) { last[1] = s[1]; return acc; } acc.push([...s]); return acc; }, []);
  fs.mkdirSync(tmpDir, { recursive: true });
  const heard = [];
  for (let i = 0; i < segs.length; i += 20) {
    const parts = [];
    segs.slice(i, i + 20).forEach(([a, b], k) => {
      const f = path.join(tmpDir, `seg-${i + k}.mp3`);
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(Math.max(0, a - 0.05)), '-t', String(b - a + 0.1), '-i', file, '-ac', '1', '-ar', '16000', f]);
      parts.push({ text: `Clip ${k}:` }, { inline_data: { mime_type: 'audio/mp3', data: fs.readFileSync(f).toString('base64') } });
      fs.rmSync(f);
    });
    parts.push({ text: `These ${parts.length / 2} clips are consecutive pieces of one English voice-over. For each clip, write exactly the words spoken in it. Return only JSON: an array of strings, one per clip.` });
    let got = null;
    const keys = [process.env.GEMINI_API_KEY_2, process.env.GEMINI_API_KEY_3, process.env.GEMINI_API_KEY].filter(Boolean);
    for (const key of [...keys, ...keys]) {
      if (got) break;
      const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent', { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseMimeType: 'application/json' } }) });
      if (r.ok) { got = JSON.parse((await r.json()).candidates[0].content.parts[0].text); break; }
      await new Promise(res => setTimeout(res, 8000)); // a per-minute limit: wait a little
    }
    if (!got) throw new Error('phrase transcription failed (text quota used up for today?)');
    heard.push(...got);
  }
  // Word alignment (longest common subsequence) between the script and what
  // was heard; each line starts at the phrase holding its first matched word.
  const canon = (w) => (/^(q|cu|ku|kyu)\w*(rex|rx|ex|ix)$/.test(w) ? 'qubirex' : ({ one: '1', two: '2', three: '3', ten: '10', four: '4', six: '6' }[w] || w));
  const words = (t) => norm(t).split(' ').filter(Boolean).map(canon);
  const S = []; lines.forEach((l, i) => words(l).forEach(w => S.push({ w, line: i })));
  const H = []; heard.forEach((t, k) => words(t || '').forEach(w => H.push({ w, seg: k })));
  const n = S.length; const m = H.length;
  const L = Array.from({ length: n + 1 }, () => new Int16Array(m + 1));
  for (let i = n - 1; i >= 0; i -= 1) for (let j = m - 1; j >= 0; j -= 1) L[i][j] = S[i].w === H[j].w ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const match = new Array(n).fill(-1);
  for (let i = 0, j = 0; i < n && j < m;) { if (S[i].w === H[j].w) { match[i] = j; i += 1; j += 1; } else if (L[i + 1][j] >= L[i][j + 1]) i += 1; else j += 1; }
  const starts = lines.map((_, li) => {
    const idx = S.findIndex((x, i) => x.line === li && match[i] >= 0);
    // The first matched word may be a few words in: use its phrase.
    const seg = idx >= 0 ? H[match[idx]].seg : 0;
    return Math.max(0, segs[seg][0] - 0.05);
  });
  for (let i = 1; i < starts.length; i += 1) if (starts[i] <= starts[i - 1]) starts[i] = starts[i - 1] + 0.5;
  return { starts, segs, heard };
}
