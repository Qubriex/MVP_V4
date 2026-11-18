// Numbers come only from video/facts.json. Stories build their number beats
// here, so the chart, the label and the source line always agree; QA then
// checks the voice against the same file.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const FACTS = JSON.parse(fs.readFileSync(path.join(DIR, 'facts.json'), 'utf8'));
export const PRON = JSON.parse(fs.readFileSync(path.join(DIR, 'pronunciation.json'), 'utf8'));

const get = (key) => { const f = FACTS[key]; if (!f) throw new Error(`No fact "${key}" in facts.json`); return f; };

/** Number beats for one language ('en' | 'te'). */
export const facts = (lang) => ({
  stat: (key) => { const f = get(key); return { type: 'stat', fact: key, value: f.value ?? f.pct, decimals: f.decimals ?? 0, suffix: f.unit ? f.unit[lang] : '%', label: f.label[lang], source: f.source }; },
  caps: (key) => { const f = get(key); return { type: 'caps', fact: key, pct: f.pct, label: f.label[lang], source: f.source }; },
  people: (key) => { const f = get(key); return { type: 'people', fact: key, big: f.screen[lang], label: f.label[lang], source: f.source }; },
  bars: (key) => { const f = get(key); return { type: 'bars', fact: key, rows: f.rowLabels[lang].map((l, i) => [l, f.rows[i][1]]), unit: '%', label: f.label[lang], source: f.source }; },
  donut: (key) => { const f = get(key); return { type: 'donut', fact: key, pct: f.pct, label: f.label[lang], source: f.source }; },
  falling: (key) => { const f = get(key); return { type: 'falling', fact: key, from: f.from, to: f.to, change: f.change, unit: f.unit[lang], label: f.label[lang], fromLabel: f.fromLabel, toLabel: f.toLabel, source: f.source }; },
  quote: (translation) => { const f = get('quote'); return { type: 'quote', fact: 'quote', text: translation || f.text, original: translation ? f.text : null, who: f.whoLine[lang], source: f.where }; }
});

/** The words sent to the voice: names spelled the agreed way (pronunciation.json). */
export const spoken = (text, lang) => Object.entries(PRON).filter(([k]) => !k.startsWith('_'))
  .reduce((t, [name, p]) => (p.tts && p.tts[lang] ? t.split(name).join(p.tts[lang]) : t), text);
