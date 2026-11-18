// Reads a script's scene table (video/scripts/<lang>/<id>.md) into JSON, so
// every scene's voice line and on-screen text comes from the script itself.
//   node video/lib/parse-script.mjs            → video/work/parsed/<lang>/<id>.json for every script
// English tables: # | Time | Voice-over | On-screen text | Visual / notes
// Telugu tables:  # | Time | English voice-over | Telugu voice-over | Back-translation | English on-screen | Telugu on-screen
// In the on-screen column "/" (and <br>) means a new line. Stage directions in
// square brackets are taken out of the words to speak ([FILL: …] and [website]
// stay, as visible blanks).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const cells = (row) => row.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map(c => c.trim().replace(/\\\|/g, '|'));
const secs = (t) => t.split('-').map(x => { const [m, s] = x.trim().split(':').map(Number); return m * 60 + s; });
const DIRECTION = /\[(?!FILL[:\]]|website\])[^\]]*\]/g;

export function directions(text) { return (text.match(DIRECTION) || []).map(d => d.slice(1, -1)); }
/** The words to speak: stage directions removed. A scene that is only blanks speaks nothing. */
export function speakable(text) {
  const t = String(text || '').replace(/^\*draft[^*]*\*\s*/i, '').replace(DIRECTION, ' ').replace(/\s+/g, ' ').trim();
  return /^(\[FILL[^\]]*\]\.?\s*)+$/.test(t) ? '' : t;
}

export function parseScript(file) {
  const md = fs.readFileSync(file, 'utf8');
  const lang = path.basename(path.dirname(file));
  const rows = md.split('\n').filter(l => /^\|\s*\d+\s*\|/.test(l)).map(cells);
  const meta = Object.fromEntries([...md.matchAll(/^- \*\*(.+?):\*\* (.+)$/gm)].map(m => [m[1].toLowerCase(), m[2].replace(/`/g, '')]));
  const signoff = /Native reviewer sign-off:\*\*\s*Name:\s*([^\s_][^\n]*?)\s+Date/.exec(md)?.[1] || null;
  const scenes = rows.map((c) => {
    const [n, time] = c;
    const [from, to] = secs(time);
    const base = { n: Number(n), time, from, to };
    if (lang === 'en') {
      const [, , voice, screen, visual] = c;
      return { ...base, voice, say: speakable(voice), directions: directions(voice), screen: screen.split(/\s*(?:\/|<br>)\s*/).filter(Boolean), visual };
    }
    const [, , voiceEn, voiceTe, back, screenEn, screenTe] = c;
    return { ...base, voiceEn, voice: voiceTe, say: speakable(voiceTe), back, directions: directions(voiceTe || voiceEn), screen: screenEn.split(/\s*(?:\/|<br>)\s*/).filter(Boolean), screenTe };
  });
  return { id: meta['script id'], lang, file: path.relative(DIR, file), meta, signoff, scenes };
}

export function loadScript(id, lang) { return parseScript(path.join(DIR, 'scripts', lang, `${id}.md`)); }

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  for (const lang of ['en', 'te']) {
    const out = path.join(DIR, 'work/parsed', lang); fs.mkdirSync(out, { recursive: true });
    for (const f of fs.readdirSync(path.join(DIR, 'scripts', lang)).filter(x => x.endsWith('.md'))) {
      const s = parseScript(path.join(DIR, 'scripts', lang, f));
      fs.writeFileSync(path.join(out, f.replace('.md', '.json')), JSON.stringify(s, null, 1));
      console.log(`${lang}/${f}: ${s.scenes.length} scenes${lang === 'te' ? `, ${s.scenes.filter(x => x.say).length} with Telugu voice, sign-off: ${s.signoff || 'none'}` : ''}`);
    }
  }
}
