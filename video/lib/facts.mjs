// Numbers come only from video/facts.json (the kit's file, with the chart
// values each fact needs). Layouts build their number beats here, so the
// chart, the label and the source line always agree; QA checks the voice
// against the same file. founder_fill holds what only the founder can supply:
// an empty field renders as a visible [FILL: …] placeholder.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW = JSON.parse(fs.readFileSync(path.join(DIR, 'facts.json'), 'utf8'));
export const FACTS = RAW.facts;
export const FILL = RAW.founder_fill;
export const PRON = JSON.parse(fs.readFileSync(path.join(DIR, 'pronunciation.json'), 'utf8'));

const get = (key) => { const f = FACTS[key]; if (!f) throw new Error(`No fact "${key}" in facts.json`); return f; };
const src = (f) => String(f.source || '').replace(/^Sources?:\s*/, '');

/** A founder value, or a visible blank. */
export const fill = (key, hint) => (FILL[key] ? FILL[key] : `[FILL: ${hint || key}]`);
/** The website as shown on screen. */
export const website = () => (FILL.website ? FILL.website.replace(/^https?:\/\//, '').replace(/\/$/, '') : '[website]');

/** Number beats. Labels are English (on-screen text is English in every video). */
export const facts = {
  stat: (key, label) => { const f = get(key); return { type: 'stat', fact: key, value: f.value ?? f.pct, decimals: f.decimals ?? 0, suffix: f.unit ? f.unit.en : '%', label: label || f.label.en, source: src(f) }; },
  caps: (key, label) => { const f = get(key); return { type: 'caps', fact: key, pct: f.pct, label: label || f.label.en, source: src(f) }; },
  people: (key, o = {}) => { const f = get(key); return { type: 'people', fact: key, big: o.big || '1 in 10', label: o.label ?? f.label.en, yet: o.yet, source: src(f) }; },
  bars: (key) => { const f = get(key); return { type: 'bars', fact: key, rows: f.rowLabels.en.map((l, i) => [l, f.rows[i][1]]), unit: '%', label: f.label.en, source: src(f) }; },
  donut: (key, label) => { const f = get(key); return { type: 'donut', fact: key, pct: f.pct, label: label || f.label.en, source: src(f) }; },
  falling: (key) => { const f = get(key); return { type: 'falling', fact: key, from: f.from, to: f.to, change: f.change, unit: f.unit.en, label: f.label.en, fromLabel: f.fromLabel, toLabel: f.toLabel, source: src(f) }; },
  quote: () => { const f = get('quote'); return { type: 'quote', fact: 'quote', text: f.text, who: f.whoLine.en, source: f.where }; },
  screen: (key) => get(key).screen,
  source: (key) => src(get(key))
};

// Whole numbers before a word, as words (revision 2: "100 students" was heard
// as "Hundreds students"). Decimals, percentages, years and lakh figures stay.
const ONES = 'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split(' ');
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
export const numberWords = (n) => (n < 20 ? ONES[n] : n < 100 ? TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : '') : n < 1000 ? `${ONES[Math.floor(n / 100)]} hundred${n % 100 ? ` and ${numberWords(n % 100)}` : ''}` : `${numberWords(Math.floor(n / 1000))} thousand${n % 1000 ? ` ${n % 1000 < 100 ? 'and ' : ''}${numberWords(n % 1000)}` : ''}`);
export const wordsForNumbers = (text) => text.replace(/(^|[^\d.,%-])(\d{1,2},\d{3}|\d{1,5})(?=[ -][A-Za-z])(?![ -](?:lakh|crore|percent)\b)/g, (m, pre, num) => { const n = Number(num.replace(/,/g, '')); return n >= 1900 && n <= 2100 && !num.includes(',') ? m : pre + numberWords(n); });

/** The words sent to the voice: names spelled the agreed way (pronunciation.json); in English, numbers before a word as words. */
export const spoken = (text, lang) => [...PRON.terms].reduce((t, term) => {
  const say = term[`tts_${lang}`];
  if (!say) return t;
  return lang === 'en' ? t.replace(new RegExp(`\\b${term.word}\\b`, 'g'), say) : t.split(term.word).join(say);
}, lang === 'en' ? wordsForNumbers(text) : text);
