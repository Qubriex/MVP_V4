// The edit, with ffmpeg: one clip per scene (dead waits trimmed, narration
// and app audio mixed, narration ducked under the app's voice, lower-thirds),
// title cards, joins with 300 ms crossfades, subtitles and loudness.
// Every clip carries its subtitle cues and chapter marks, so they follow the
// clip into each video it is joined into.
import fs from 'fs';
import path from 'path';
import { execFileSync, spawnSync } from 'child_process';
import { RAW, WORK, FFMPEG, FPS, PACE, PHONE } from './config.mjs';
import { lowerThird, phoneBackground, phoneBezel, PHONE_SCREEN } from './cards.mjs';
import { duration } from './narration.mjs';

export const XFADE = 0.3;
/** Length of a clip's video stream (what the crossfades are timed on). */
function vdur(file) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=duration', '-of', 'default=nw=1:nk=1', file]).toString().trim();
  return Number(out) || duration(file);
}
const ENC = ['-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-movflags', '+faststart'];
const AENC = ['-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2'];

export function ff(args, label = '') {
  try {
    execFileSync(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', ...args], { stdio: ['ignore', 'ignore', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
  } catch (err) {
    throw new Error(`ffmpeg failed${label ? ` (${label})` : ''}: ${String(err.stderr || err.message).slice(-1500)}`);
  }
}

// ─── Time map: the recording with dead waits cut out ─────────────────────────
function subtract(ranges, holes) {
  let out = ranges;
  for (const [a, b] of holes) {
    out = out.flatMap(([x, y]) => (b <= x || a >= y ? [[x, y]] : [[x, Math.min(y, a)], [Math.max(x, b), y]].filter(([p, q]) => q - p > 0)));
  }
  return out;
}

/** Cuts (ms since epoch) for waits longer than 1.5 s, never while narration or app audio plays. */
export function cutsFor(ev) {
  const busy = [...ev.says.map(s => [s.at, s.at + s.dur * 1000 + 150]), ...ev.audio.map(a => [a.at, a.at + a.dur * 1000])];
  const waits = ev.waits.filter(w => w.to - w.from > PACE.maxDeadWait).map(w => [w.from + 450, w.to - 300]);
  const merged = [];
  for (const w of waits.sort((x, y) => x[0] - y[0])) {
    const last = merged[merged.length - 1];
    if (last && w[0] <= last[1]) last[1] = Math.max(last[1], w[1]); else merged.push([...w]);
  }
  return subtract(merged, busy).filter(([a, b]) => b - a > 400 && a > ev.start && b < ev.end);
}
export function mapper(ev, cuts) {
  return (t) => {
    let out = t - ev.start;
    for (const [a, b] of cuts) { if (t >= b) out -= b - a; else if (t > a) out -= t - a; }
    return Math.max(0, out / 1000);
  };
}

// ─── Subtitles ───────────────────────────────────────────────────────────────
// At most 2 lines of about 42 characters per cue, timed by length.
export function chunkText(text, max = 42) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    if ((`${cur} ${w}`).trim().length > max && cur) { lines.push(cur); cur = w; } else cur = `${cur} ${w}`.trim();
  }
  if (cur) lines.push(cur);
  // Pair lines into cues; avoid a lonely short last line.
  const cues = [];
  for (let i = 0; i < lines.length; i += 2) cues.push(lines.slice(i, i + 2).join('\n'));
  return cues;
}
function cuesFor(say, start, dur) {
  const out = [];
  for (const lang of ['en', 'te', 'hi']) {
    const parts = chunkText(say[lang] || say.en);
    const total = parts.reduce((n, p) => n + p.length, 0) || 1;
    let t = start;
    parts.forEach((p) => {
      const d = (dur * p.length) / total;
      out.push({ lang, start: t, end: t + d, text: p });
      t += d;
    });
  }
  return out;
}
const stamp = (t, sep) => {
  const ms = Math.max(0, Math.round(t * 1000));
  const h = Math.floor(ms / 3600000); const m = Math.floor(ms / 60000) % 60; const s = Math.floor(ms / 1000) % 60; const r = ms % 1000;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}${sep}${String(r).padStart(3, '0')}`;
};
export function writeSubtitles(cues, base, langs = ['en']) {
  const files = [];
  for (const lang of langs) {
    const list = cues.filter(c => c.lang === lang).sort((a, b) => a.start - b.start);
    const srt = list.map((c, i) => `${i + 1}\n${stamp(c.start, ',')} --> ${stamp(c.end - 0.04, ',')}\n${c.text}\n`).join('\n');
    const vtt = `WEBVTT\n\n${list.map(c => `${stamp(c.start, '.')} --> ${stamp(c.end - 0.04, '.')}\n${c.text}\n`).join('\n')}`;
    const suffix = lang === 'en' ? '' : `.${lang}`;
    fs.writeFileSync(`${base}${suffix}.srt`, srt); fs.writeFileSync(`${base}${suffix}.vtt`, vtt);
    files.push(`${base}${suffix}.srt`, `${base}${suffix}.vtt`);
  }
  return files;
}

// ─── One scene ───────────────────────────────────────────────────────────────
/** Builds work/<scene>.mp4 from raw/<scene>; returns { file, dur, cues, marks, highlights }. */
export async function sceneClip(id) {
  const dir = path.join(RAW, id);
  const ev = JSON.parse(fs.readFileSync(path.join(dir, 'events.json'), 'utf8'));
  if (!ev.ok) throw new Error(`Scene ${id} did not record cleanly (${ev.error || 'unknown'}); re-record it before editing.`);
  if (ev.bugs?.length) throw new Error(`Scene ${id} showed a broken screen; it is not published.`);
  fs.mkdirSync(WORK, { recursive: true });
  const cuts = cutsFor(ev);
  const at = mapper(ev, cuts);
  const total = at(ev.end);
  const phone = ev.viewport === 'phone';
  const out = path.join(WORK, `${id}.mp4`);

  // Video: frames at their real times → 30 fps, minus the cuts.
  const rel = cuts.map(([a, b]) => [(a - ev.start) / 1000, (b - ev.start) / 1000]);
  const select = rel.length ? `select='not(${rel.map(([a, b]) => `between(t,${a.toFixed(3)},${b.toFixed(3)})`).join('+')})',setpts=N/${FPS}/TB,` : '';
  const inputs = ['-f', 'concat', '-safe', '0', '-i', path.join(dir, 'frames.txt')];
  const filters = [];
  let v = '[0:v]';
  filters.push(`${v}fps=${FPS},${select}${phone ? `scale=${PHONE_SCREEN.w}:${PHONE_SCREEN.h}:flags=lanczos` : 'scale=1920:1080:flags=lanczos'},setsar=1,format=yuv420p[vb]`);
  v = '[vb]';
  let n = 1;
  if (phone) {
    inputs.push('-loop', '1', '-i', await phoneBackground(), '-loop', '1', '-i', await phoneBezel());
    filters.push(`[${n}:v]scale=1920:1080,format=yuv420p[pbg]`, `[pbg]${v}overlay=${PHONE_SCREEN.x}:${PHONE_SCREEN.y}:shortest=1[pv]`, `[pv][${n + 1}:v]overlay=0:0:shortest=1[pf]`);
    v = '[pf]'; n += 2;
  }
  // Lower-thirds, faded in and out.
  for (const [i, l] of ev.labels.entries()) {
    const s = Math.min(at(l.at), Math.max(0, total - 1));
    const d = Math.min(l.dur, Math.max(0.8, total - s - 0.2));
    inputs.push('-loop', '1', '-t', d.toFixed(2), '-i', await lowerThird(l.text, { phone }));
    filters.push(`[${n}:v]format=rgba,fade=in:st=0:d=0.35:alpha=1,fade=out:st=${(d - 0.35).toFixed(2)}:d=0.35:alpha=1,setpts=PTS+${s.toFixed(3)}/TB[l${i}]`, `${v}[l${i}]overlay=0:0:eof_action=pass[v${i}]`);
    v = `[v${i}]`; n += 1;
  }

  // Audio: narration lines and what the app played, at their times.
  const narr = []; const app = [];
  for (const s of ev.says) {
    if (!s.file || !fs.existsSync(s.file)) continue;
    inputs.push('-i', s.file);
    const ms = Math.round(at(s.at) * 1000);
    filters.push(`[${n}:a]aformat=sample_rates=48000:channel_layouts=stereo,adelay=${ms}|${ms}[n${narr.length}]`);
    narr.push(`[n${narr.length}]`); n += 1;
  }
  for (const a of ev.audio) {
    if (!a.file) continue;
    inputs.push('-i', path.join(dir, a.file));
    const ms = Math.round(at(a.at) * 1000);
    const tempo = Math.abs((a.rate || 1) - 1) > 0.01 ? `,atempo=${a.rate}` : '';
    filters.push(`[${n}:a]atrim=start=${Math.max(0, a.offset).toFixed(3)}:duration=${(a.dur * (a.rate || 1)).toFixed(3)},asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo${tempo},afade=t=out:st=${Math.max(0, a.dur - 0.12).toFixed(3)}:d=0.12,volume=1.15,adelay=${ms}|${ms}[p${app.length}]`);
    app.push(`[p${app.length}]`); n += 1;
  }
  inputs.push('-f', 'lavfi', '-t', total.toFixed(3), '-i', 'anullsrc=r=48000:cl=stereo');
  const silence = `[${n}:a]`; n += 1;
  const mix = (list, name) => (list.length === 1 ? `${list[0]}anull[${name}]` : `${list.join('')}amix=inputs=${list.length}:normalize=0:dropout_transition=0[${name}]`);
  if (narr.length) filters.push(mix(narr, 'narr'));
  if (app.length) filters.push(mix(app, 'app'));
  if (narr.length && app.length) {
    // Narration ducks under the app's own voice.
    filters.push('[app]asplit=2[appk][appm]', '[narr][appk]sidechaincompress=threshold=0.015:ratio=10:attack=15:release=450:makeup=1[nd]', `${silence}[nd][appm]amix=inputs=3:normalize=0:duration=first[aout]`);
  } else if (narr.length || app.length) {
    filters.push(`${silence}[${narr.length ? 'narr' : 'app'}]amix=inputs=2:normalize=0:duration=first[aout]`);
  } else {
    filters.push(`${silence}anull[aout]`);
  }
  // Built already from this recording: keep it.
  const fresh = fs.existsSync(out) && fs.statSync(out).mtimeMs > fs.statSync(path.join(dir, 'events.json')).mtimeMs && fs.statSync(out).mtimeMs > fs.statSync(new URL(import.meta.url)).mtimeMs;
  if (!fresh) ff([...inputs, '-filter_complex', filters.join(';'), '-map', v, '-map', '[aout]', '-t', total.toFixed(3), ...ENC, ...AENC, out], `scene ${id}`);

  const cues = ev.says.flatMap(s => cuesFor(s, at(s.at), s.dur));
  const highlights = ev.says.map(s => ({ id: s.id, start: at(s.at), dur: s.dur }));
  return { file: out, dur: vdur(out), cues, marks: [], highlights, title: ev.title, chapter: ev.chapter, id };
}

/** A still card as a clip (silent, or under music later). */
export function cardClip(png, name, secs = 3.2, { fadeIn = false } = {}) {
  fs.mkdirSync(WORK, { recursive: true });
  const out = path.join(WORK, `card-${name}.mp4`);
  const fade = fadeIn ? `,fade=in:st=0:d=0.6` : '';
  // A slow, gentle push-in keeps a still card alive.
  ff(['-loop', '1', '-framerate', String(FPS), '-t', String(secs), '-i', png, '-f', 'lavfi', '-t', String(secs), '-i', 'anullsrc=r=48000:cl=stereo',
    '-filter_complex', `[0:v]scale=2112:1188,zoompan=z='min(1+0.0009*on,1.1)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1920x1080:fps=${FPS},format=yuv420p${fade}[v]`,
    '-map', '[v]', '-map', '1:a', '-t', String(secs), ...ENC, ...AENC, out], `card ${name}`);
  return { file: out, dur: vdur(out), cues: [], marks: [], highlights: [], id: `card-${name}` };
}

/** A piece of a clip (for the highlights). */
export function trimClip(clip, start, dur, name) {
  const out = path.join(WORK, `cut-${name}.mp4`);
  ff(['-ss', start.toFixed(3), '-i', clip.file, '-t', dur.toFixed(3), '-af', `afade=t=in:st=0:d=0.15,afade=t=out:st=${Math.max(0, dur - 0.25).toFixed(3)}:d=0.25`, ...ENC, ...AENC, out], `trim ${name}`);
  const cues = clip.cues.filter(c => c.end > start && c.start < start + dur).map(c => ({ ...c, start: Math.max(0, c.start - start), end: Math.min(dur, c.end - start) }));
  return { file: out, dur: vdur(out), cues, marks: [], highlights: [], id: name };
}

/** Joins clips with 300 ms crossfades (video and audio); shifts cues and marks. */
export function join(clips, name) {
  const out = path.join(WORK, `${name}.mp4`);
  if (clips.length === 1) { fs.copyFileSync(clips[0].file, out); return { ...clips[0], file: out }; }
  const inputs = clips.flatMap(c => ['-i', c.file]);
  const f = [];
  // Every input cut or padded to exactly its video length, so audio and video stay together.
  clips.forEach((c, i) => {
    f.push(`[${i}:v]trim=duration=${c.dur.toFixed(3)},setpts=PTS-STARTPTS,fps=${FPS},format=yuv420p,setsar=1[iv${i}]`);
    f.push(`[${i}:a]aresample=48000,apad,atrim=duration=${c.dur.toFixed(3)},asetpts=PTS-STARTPTS[ia${i}]`);
  });
  let v = '[iv0]'; let a = '[ia0]'; let offset = 0;
  const cues = []; const marks = [];
  clips.forEach((c, i) => {
    const start = i === 0 ? 0 : offset;
    cues.push(...c.cues.map(q => ({ ...q, start: q.start + start, end: q.end + start })));
    marks.push(...(c.marks || []).map(m => ({ ...m, t: m.t + start })));
    if (c.markTitle) marks.push({ t: start, title: c.markTitle });
    if (i === 0) { offset = c.dur - XFADE; return; }
    f.push(`${v}[iv${i}]xfade=transition=fade:duration=${XFADE}:offset=${offset.toFixed(3)}[v${i}]`);
    f.push(`${a}[ia${i}]acrossfade=d=${XFADE}:c1=tri:c2=tri[a${i}]`);
    v = `[v${i}]`; a = `[a${i}]`;
    offset += c.dur - XFADE;
  });
  ff([...inputs, '-filter_complex', f.join(';'), '-map', v, '-map', a, ...ENC, ...AENC, out], `join ${name}`);
  return { file: out, dur: vdur(out), cues, marks, highlights: [], id: name };
}

/** Runs ffmpeg and returns its stderr (for measurements). */
function ffRead(args) {
  const r = spawnSync(FFMPEG, ['-hide_banner', '-nostats', ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return String(r.stderr || '');
}

/** Final pass: loudness to about −16 LUFS (measured, then applied linearly), optional music bed, optional burned subtitles. */
export function finish(clip, out, { music = null, burn = null } = {}) {
  const inputs = ['-i', clip.file];
  let pre = '[0:a]';
  let bed = '';
  if (music && fs.existsSync(music)) {
    inputs.push('-stream_loop', '-1', '-i', music);
    bed = `[1:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=0.07,atrim=duration=${clip.dur.toFixed(3)}[m];[0:a][m]amix=inputs=2:normalize=0:duration=first[mx];`;
    pre = '[mx]';
  }
  const err = ffRead([...inputs, '-filter_complex', `${bed}${pre}loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json[o]`, '-map', '[o]', '-f', 'null', '-']);
  let m = null;
  try { m = JSON.parse(err.slice(err.lastIndexOf('{'), err.lastIndexOf('}') + 1)); } catch { m = null; }
  const ln = m && Number.isFinite(Number(m.input_i))
    ? `loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`
    : 'loudnorm=I=-16:TP=-1.5:LRA=11';
  const af = `${bed}${pre}${ln},aresample=48000[a]`;
  const vf = burn ? `[0:v]subtitles='${burn.replace(/'/g, "\\'")}':force_style='FontName=Inter,FontSize=12,Bold=1,PrimaryColour=&H00FFFFFF,BackColour=&H38000000,BorderStyle=4,Outline=0,Shadow=0,MarginV=52,MarginL=60,MarginR=60,Alignment=2'[v]` : null;
  ff([...inputs, '-filter_complex', vf ? `${vf};${af}` : af, '-map', vf ? '[v]' : '0:v', '-map', '[a]', ...(vf ? ENC : ['-c:v', 'copy']), ...AENC, '-movflags', '+faststart', out], `finish ${path.basename(out)}`);
  return { ...clip, file: out, dur: duration(out) };
}

/** Integrated loudness (LUFS) and true peak (dBTP) of a finished file. */
export function loudness(file) {
  const e = ffRead(['-i', file, '-af', 'ebur128=peak=true', '-f', 'null', '-']);
  const i = e.match(/I:\s+(-?[\d.]+) LUFS/g); const p = e.match(/Peak:\s+(-?[\d.]+) dBFS/g);
  return { lufs: i ? Number(i[i.length - 1].match(/-?[\d.]+/)[0]) : null, peak: p ? Number(p[p.length - 1].match(/-?[\d.]+/)[0]) : null };
}
export const PHONE_SIZE = PHONE;
