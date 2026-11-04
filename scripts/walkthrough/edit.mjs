#!/usr/bin/env node
// npm run walkthrough:edit [-- --music path/to/bed.mp3] [--only full,highlights,phone,internal,chapters]
// Builds every video from the recorded scenes (artifacts/walkthrough/raw):
//   qubirex-walkthrough-full.mp4 (+ .srt/.vtt in English, Telugu, Hindi), chapters.txt
//   chapter-01-public.mp4 … chapter-05-verify.mp4
//   qubirex-highlights-90s.mp4 (subtitles burned in)
//   qubirex-learner-phone.mp4
//   qubirex-internal-full.mp4 (internal only: /dev and admin pages)
// plus a PNG thumbnail per video, and checks.json (lengths, loudness, subtitles).
import fs from 'fs';
import path from 'path';
import { OUT, WORK, FFMPEG } from './lib/config.mjs';
import { loadScenes } from './lib/scenes.mjs';
import { sceneClip, cardClip, join, trimClip, finish, writeSubtitles, loudness, XFADE, ff } from './lib/edit.mjs';
import { introCard, chapterCard, closingCard, thumbnail, closeCards } from './lib/cards.mjs';

const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : null; };
const music = opt('music') && opt('music') !== true ? path.resolve(String(opt('music'))) : null;
const only = opt('only') ? String(opt('only')).split(',') : null;
const want = (k) => !only || only.includes(k);

const CHAPTERS = [
  { n: 1, file: 'chapter-01-public', title: 'The public site', sub: 'Learn in your language, see the topics, verify a Passport.' },
  { n: 2, file: 'chapter-02-learner', title: 'A learner\'s day', sub: 'A teach-first lesson, voice, reviews, the Passport and jobs.' },
  { n: 3, file: 'chapter-03-college', title: 'The college', sub: 'Who is ready, who is stuck, and what to teach next.' },
  { n: 4, file: 'chapter-04-employer', title: 'The employer', sub: 'Hire on checked skills, with the learner\'s consent.' },
  { n: 5, file: 'chapter-05-verify', title: 'Trust', sub: 'Anyone can check a Passport.' }
];
// The best moments for the 90-second cut: [scene, narration line index].
const HIGHLIGHTS = [
  ['c1-home', 2], ['c2-lesson-learn', 1], ['c2-lesson-code', 1], ['c2-lesson-practise', 1],
  ['c2-passport', 1], ['c2-jobs', 1], ['c3-heatmap', 0], ['c4-role', 1], ['c5-verify', 1]
];
const TARGET = {
  'qubirex-walkthrough-full': [12 * 60, 16 * 60], 'qubirex-highlights-90s': [75, 90], 'qubirex-learner-phone': [120, 180]
};

// Subtitle-only narration (no server voice answered): burn the English
// subtitles into every video, so the words are on screen.
const recordedIndex = fs.existsSync(path.join(OUT, 'recorded.json')) ? JSON.parse(fs.readFileSync(path.join(OUT, 'recorded.json'), 'utf8')) : {};
const subtitleOnly = !!recordedIndex._narration?.subtitleOnly;
const fmt = (t) => { const s = Math.floor(t); return s >= 3600 ? `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const log = (m) => console.log(m);

fs.mkdirSync(WORK, { recursive: true });
const scenes = await loadScenes();
const recorded = new Map();
const clipOf = async (id) => {
  if (!recorded.has(id)) { log(`  scene ${id}`); recorded.set(id, await sceneClip(id)); }
  return recorded.get(id);
};
const results = [];
const deliver = async (name, clip, { langs = ['en'], burn = false, kicker, thumbAt } = {}) => {
  const out = path.join(OUT, `${name}.mp4`);
  const subBase = path.join(OUT, name);
  writeSubtitles(clip.cues, subBase, langs);
  const done = finish(clip, out, { music, burn: burn || subtitleOnly ? `${subBase}.srt` : null });
  // Thumbnail: a frame from a moment that shows the product.
  const frame = path.join(WORK, `${name}-thumb.jpg`);
  ff(['-ss', String(Math.min(done.dur - 1, thumbAt ?? done.dur * 0.3)), '-i', out, '-frames:v', '1', '-q:v', '2', frame], 'thumbnail frame');
  const png = await thumbnail(name, frame, clip.thumbTitle || 'Qubirex walkthrough', kicker || 'Qubirex');
  fs.copyFileSync(png, path.join(OUT, `${name}.png`));
  const loud = loudness(out);
  const size = fs.statSync(out).size;
  results.push({ name, file: `${name}.mp4`, seconds: Number(done.dur.toFixed(1)), length: fmt(done.dur), mb: Number((size / 1048576).toFixed(1)), lufs: loud.lufs, peak: loud.peak, marks: clip.marks, cues: clip.cues.filter(c => c.lang === 'en').length, target: TARGET[name] || null });
  log(`✓ ${name}.mp4 ${fmt(done.dur)} · ${(size / 1048576).toFixed(1)} MB · ${loud.lufs} LUFS`);
  return done;
};

const external = scenes.filter(s => !s.cuts);
const byChapter = (n) => external.filter(s => s.chapter === n);

try {
  // Cards.
  const intro = cardClip(await introCard(), 'intro', 5.0, { fadeIn: true });
  const closing = cardClip(await closingCard(), 'closing', 7.0);
  const shortIntro = cardClip(await introCard(), 'intro-short', 2.4, { fadeIn: true });
  const shortClosing = cardClip(await closingCard(), 'closing-short', 3.2);

  // Chapters (each opens with its card).
  const chapterClips = [];
  if (want('chapters') || want('full') || want('internal')) {
    for (const c of CHAPTERS) {
      const parts = [cardClip(await chapterCard(c.n, c.title, c.sub), `ch${c.n}`, 3.0)];
      for (const s of byChapter(c.n)) parts.push(await clipOf(s.id));
      const j = join(parts, c.file);
      j.markTitle = `${c.n}. ${c.title}`;
      j.thumbTitle = c.title;
      chapterClips.push(j);
      if (want('chapters')) await deliver(c.file, j, { kicker: `Chapter ${c.n}`, thumbAt: parts[0].dur + 6 });
    }
  }

  if (want('full')) {
    const full = join([intro, ...chapterClips, closing], 'full');
    full.marks = [{ t: 0, title: 'Introduction' }, ...full.marks];
    full.thumbTitle = 'See Qubirex in 15 minutes';
    await deliver('qubirex-walkthrough-full', full, { langs: ['en', 'te', 'hi'], kicker: 'Full walkthrough', thumbAt: intro.dur + 40 });
    // YouTube chapters: the first at 0:00, each at least 10 s long.
    fs.writeFileSync(path.join(OUT, 'chapters.txt'), `${full.marks.map(m => `${fmt(m.t)} ${m.title}`).join('\n')}\n${fmt(full.dur - closing.dur)} Talk to us\n`);
  }

  if (want('highlights')) {
    const parts = [shortIntro];
    for (const [id, i] of HIGHLIGHTS) {
      const c = await clipOf(id);
      const h = c.highlights[i];
      if (!h) throw new Error(`Highlight ${id}#${i}: no such narration line`);
      parts.push(trimClip(c, Math.max(0, h.start - 0.25), h.dur + 1.1, `hl-${id}-${i}`));
    }
    parts.push(shortClosing);
    const hl = join(parts, 'highlights');
    hl.thumbTitle = 'Qubirex in 90 seconds';
    await deliver('qubirex-highlights-90s', hl, { burn: true, kicker: 'Highlights', thumbAt: 20 });
  }

  if (want('phone')) {
    const ph = scenes.filter(s => (s.cuts || []).includes('phone'));
    const parts = [shortIntro];
    for (const s of ph) parts.push(await clipOf(s.id));
    parts.push(shortClosing);
    const j = join(parts, 'phone');
    j.thumbTitle = 'Qubirex on a phone';
    await deliver('qubirex-learner-phone', j, { kicker: 'Learner · phone', thumbAt: 12 });
  }

  if (want('internal')) {
    const internal = scenes.filter(s => (s.cuts || []).includes('internal'));
    const parts = [cardClip(await chapterCard('internal', 'For the team', '/dev, Voice check and Evaluator quality. Internal only.'), 'internal', 3.0)];
    for (const s of internal) parts.push(await clipOf(s.id));
    const ic = join(parts, 'internal-chapter');
    ic.markTitle = 'Internal: /dev and admin';
    const full = join([intro, ...chapterClips, ic, closing], 'internal-full');
    full.marks = [{ t: 0, title: 'Introduction' }, ...full.marks];
    full.thumbTitle = 'Internal walkthrough';
    await deliver('qubirex-internal-full', full, { kicker: 'Internal only', thumbAt: intro.dur + 40 });
  }
} finally {
  await closeCards();
}

// Checks: length targets, loudness, subtitle lines.
const subsOk = (name) => {
  const f = path.join(OUT, `${name}.srt`);
  if (!fs.existsSync(f)) return true;
  return fs.readFileSync(f, 'utf8').split('\n\n').every(b => { const lines = b.trim().split('\n').slice(2); return lines.length <= 2 && lines.every(l => l.length <= 46); });
};
for (const r of results) {
  r.in_target = r.target ? r.seconds >= r.target[0] && r.seconds <= r.target[1] : null;
  r.loudness_ok = r.lufs != null && Math.abs(r.lufs + 16) <= 1.5 && r.peak <= -0.5;
  r.subtitles_ok = subsOk(r.name);
}
fs.writeFileSync(path.join(OUT, 'checks.json'), JSON.stringify(results, null, 1));
log('\nVideo                              length   MB    LUFS   target  subs');
for (const r of results) log(`${r.file.padEnd(35)}${r.length.padStart(6)} ${String(r.mb).padStart(6)} ${String(r.lufs).padStart(6)}   ${r.in_target == null ? '  –  ' : r.in_target ? ' ok  ' : ' OFF '}  ${r.subtitles_ok ? 'ok' : 'LONG'}`);
void FFMPEG; void XFADE;
