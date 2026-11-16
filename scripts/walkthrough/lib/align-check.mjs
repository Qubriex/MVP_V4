// Precise line timing: cut the voice-over at its pauses into phrases,
// transcribe every phrase (Gemini, text key), then walk the script in order
// and give each line the start of the phrase where its first words are heard.
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { pauses } from './align.mjs';

// Text models to try in order (each has its own daily quota).
export const TEXT_MODELS = ['gemini-3.6-flash', 'gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.5-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];

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

// Most reliable: estimate each boundary from line lengths, take every pause
// within ±3 s as a candidate, transcribe the 3 s after each candidate, and
// keep the candidate where the line's first words are actually heard.
export async function alignBySnippets(lines, file, total, tmpDir) {
  const ps = pauses(file).filter(p => p.len >= 0.12);
  const speechStart = ps.length && ps[0].start < 0.05 ? ps[0].end : 0;
  const end = ps.length && ps[ps.length - 1].end > total - 0.05 ? ps[ps.length - 1].start : total;
  const w = lines.map(l => l.length + 10); const sum = w.reduce((a, b) => a + b, 0);
  const est = []; let acc = 0;
  for (let i = 0; i < lines.length; i += 1) { est.push(speechStart + ((end - speechStart) * acc) / sum); acc += w[i]; }
  const cands = []; // { line, t }
  for (let i = 1; i < lines.length; i += 1) for (const p of ps) if (Math.abs(p.end - est[i]) < 3.2) cands.push({ line: i, t: p.end });
  fs.mkdirSync(tmpDir, { recursive: true });
  const heard = new Array(cands.length).fill('');
  for (let i = 0; i < cands.length; i += 18) {
    const parts = [];
    cands.slice(i, i + 18).forEach((c, k) => {
      const f = path.join(tmpDir, `cand-${i + k}.mp3`);
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(c.t - 0.03), '-t', '3', '-i', file, '-ac', '1', '-ar', '16000', f]);
      parts.push({ text: `Clip ${k}:` }, { inline_data: { mime_type: 'audio/mp3', data: fs.readFileSync(f).toString('base64') } });
      fs.rmSync(f);
    });
    parts.push({ text: `Each clip is 3 seconds of an English voice-over. For each clip write only the first five words spoken (or "" if silent). Return only JSON: an array of ${parts.length / 2} strings.` });
    let got = null;
    const keys = [process.env.GEMINI_API_KEY_2, process.env.GEMINI_API_KEY_3, process.env.GEMINI_API_KEY].filter(Boolean);
    for (const key of [...keys, ...keys]) {
      const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent', { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseMimeType: 'application/json' } }) });
      if (r.ok) { got = JSON.parse((await r.json()).candidates[0].content.parts[0].text); break; }
      await new Promise(res => setTimeout(res, 8000));
    }
    if (!got) throw new Error('snippet transcription failed (text quota?)');
    got.forEach((g, k) => { heard[i + k] = g; });
  }
  const canon = (t) => norm(t).split(' ').filter(Boolean).map(x => (/^(q|c|k)\w*(rex|rx|ex|ix)$/.test(x) ? 'qubirex' : ({ one: '1', ten: '10', three: '3', four: '4', six: '6' }[x] || x)));
  const starts = [Math.max(0, speechStart - 0.05)];
  const report = [];
  for (let i = 1; i < lines.length; i += 1) {
    const want = canon(lines[i]).slice(0, 3);
    let best = null;
    cands.forEach((c, k) => {
      if (c.line !== i || c.t <= starts[i - 1] + 0.4) return;
      const h = canon(heard[k]).slice(0, 3);
      const score = want.filter((x, j) => h[j] === x).length * 10 - Math.abs(c.t - est[i]);
      if (!best || score > best.score) best = { t: c.t, score, heard: heard[k] };
    });
    const ok = best && best.score > 15;
    starts.push(ok ? Math.max(0, best.t - 0.05) : Math.max(est[i], starts[i - 1] + 0.6));
    report.push({ line: i, t: starts[i], heard: best?.heard || '', matched: !!ok });
  }
  return { starts, report };
}

// Sequential and drift-proof: transcribe the 3 s after every pause once
// (cached), then walk the script — each line takes the first pause after the
// previous line where its own first words are heard.
export async function alignSequential(lines, file, total, tmpDir) {
  const ps = pauses(file).filter(p => p.len >= 0.12 && p.end < total - 0.3);
  const speechStart = ps.length && ps[0].start < 0.05 ? ps[0].end : 0;
  fs.mkdirSync(tmpDir, { recursive: true });
  const cacheFile = path.join(tmpDir, 'after-pauses.json');
  const sig = `${fs.statSync(file).size}:${ps.length}`;
  let cache = fs.existsSync(cacheFile) ? JSON.parse(fs.readFileSync(cacheFile, 'utf8')) : null;
  if (!cache || cache.sig !== sig) {
    const heard = [];
    for (let i = 0; i < ps.length; i += 18) {
      const parts = [];
      ps.slice(i, i + 18).forEach((p, k) => {
        const f = path.join(tmpDir, `p-${i + k}.mp3`);
        execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(p.end - 0.03), '-t', '3', '-i', file, '-ac', '1', '-ar', '16000', f]);
        parts.push({ text: `Clip ${k}:` }, { inline_data: { mime_type: 'audio/mp3', data: fs.readFileSync(f).toString('base64') } });
        fs.rmSync(f);
      });
      parts.push({ text: `Each clip is 3 seconds of an English voice-over. For each clip write only the first five words spoken (or "" if silent). Return only JSON: an array of ${parts.length / 2} strings.` });
      let got = null;
      const keys = [process.env.GEMINI_API_KEY_2, process.env.GEMINI_API_KEY_3, process.env.GEMINI_API_KEY].filter(Boolean);
      // Quotas are per model: fall back to another text model.
      const tries = TEXT_MODELS.flatMap(m => keys.map(k => [m, k]));
      for (const [model, key] of tries) {
        if (got) break;
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseMimeType: 'application/json' } }), signal: AbortSignal.timeout(60000) }).catch(() => ({ ok: false }));
        if (r.ok) { try { got = JSON.parse((await r.json()).candidates[0].content.parts[0].text); } catch { got = null; } }
      }
      if (!got) throw new Error('pause transcription failed (text quota?)');
      heard.push(...got.slice(0, parts.length / 2));
    }
    cache = { sig, pauses: ps.map(p => p.end), heard };
    fs.writeFileSync(cacheFile, JSON.stringify(cache));
  }
  const canon = (t) => norm(t).split(' ').filter(Boolean).map(x => (/^(q|c|k)\w*(rex|rx|ex|ix|rec|ec)$/.test(x) ? 'qubirex' : ({ one: '1', ten: '10', three: '3', four: '4', six: '6', nine: '9', eight: '8' }[x] || x)));
  const starts = [Math.max(0, speechStart - 0.05)]; const report = [];
  for (let i = 1; i < lines.length; i += 1) {
    const want = canon(lines[i]).slice(0, 3);
    let pick = null;
    for (let k = 0; k < cache.pauses.length; k += 1) {
      const t = cache.pauses[k];
      if (t <= starts[i - 1] + 0.6) continue;
      const h = canon(cache.heard[k] || '');
      // The line's first words, at the start of the clip (or one or two words in).
      const hit = [0, 1, 2].some(off => want.filter((x, j) => h[j + off] === x).length >= Math.min(2, want.length));
      if (hit) { pick = { t, heard: cache.heard[k] }; break; }
    }
    starts.push(pick ? Math.max(0, pick.t - 0.05) : starts[i - 1] + 3);
    report.push({ line: i, t: starts[i], heard: pick?.heard || '', matched: !!pick });
  }
  return { starts, report };
}
