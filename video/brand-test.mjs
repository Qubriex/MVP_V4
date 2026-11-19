// Brand pronunciation test (revision 2): voices "Qubirex" with several
// spellings, 3 times each, and asks a speech-to-text model (not told the
// brand) what it heard. The winner is the spelling heard as ONE word, closest
// to "Qubirex", in 3 of 3 tries.
//   node video/brand-test.mjs  → video/qa/brand-tests/*.wav + results.json
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';

const VDIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(VDIR, '..');
const OUT = path.join(VDIR, 'qa/brand-tests'); fs.mkdirSync(OUT, { recursive: true });
const dotenv = await import(path.join(ROOT, 'backend/node_modules/dotenv/lib/main.js'));
(dotenv.default || dotenv).config({ path: path.join(ROOT, 'backend/.env') });
const KEYS = [process.env.GEMINI_API_KEY_2, process.env.GEMINI_API_KEY_3, process.env.GEMINI_API_KEY].filter(Boolean);
const { TEXT_MODELS } = await import(pathToFileURL(path.join(ROOT, 'scripts/walkthrough/lib/align-check.mjs')).href);

// The four candidates from the review, plus the current spelling as a baseline.
const SPELLINGS = (process.env.SPELLINGS || 'Cube-bi-rex|Kyoo-bih-rex|Kyoobirex|Cue-bi-rex|ˈkjuːbɪrɛks').split('|');
const TRIES = 3;
const sentence = (w) => `Meet ${w}. With ${w}, every student learns to code in their own language.`;

async function tts(text) {
  for (const model of ['gemini-3.8-flash-tts', 'gemini-3.1-flash-tts-preview']) for (const key of KEYS) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify({ contents: [{ parts: [{ text }] }], generationConfig: { responseModalities: ['AUDIO'], speechConfig: { languageCode: 'en-IN', voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } } } }) }).catch(() => ({ ok: false }));
    if (!r.ok) continue;
    const part = (await r.json()).candidates?.[0]?.content?.parts?.find(x => x.inlineData?.data);
    if (part) return { pcm: Buffer.from(part.inlineData.data, 'base64'), rate: Number(/rate=(\d+)/.exec(part.inlineData.mimeType || '')?.[1]) || 24000 };
  }
  throw new Error('no TTS model answered');
}
// The ASR is told nothing about the brand: it writes what it hears.
async function asr(file) {
  const b64 = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-ac', '1', '-ar', '16000', '-b:a', '48k', '-f', 'mp3', '-']).toString('base64');
  const ask = 'Transcribe this English audio exactly as you hear it, word for word. If a word is a name you do not know, spell it the way it sounds. Plain text only.';
  for (const model of TEXT_MODELS) for (const key of KEYS) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify({ contents: [{ parts: [{ inline_data: { mime_type: 'audio/mp3', data: b64 } }, { text: ask }] }], generationConfig: { temperature: 0 } }) }).catch(() => ({ ok: false }));
    if (r.ok) { const t = (await r.json()).candidates?.[0]?.content?.parts?.map(x => x.text).join(' ').trim(); if (t) return t; }
  }
  throw new Error('no ASR model answered');
}
const lev = (a, b) => { const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]); for (let j = 1; j <= b.length; j += 1) d[0][j] = j; for (let i = 1; i <= a.length; i += 1) for (let j = 1; j <= b.length; j += 1) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length]; };
// What the ASR wrote where the brand was: the words between "Meet" and the first full stop.
const brandOf = (t) => (/meet\s+(.+?)[.,!]/i.exec(t)?.[1] || t.split(/\s+/)[1] || '').trim();

const results = [];
for (const [n, sp] of SPELLINGS.entries()) {
  const slug = `${n + 1}-${sp.replace(/[^a-z]+/gi, '-').replace(/^-|-$/g, '') || 'ipa'}`;
  const tries = [];
  for (let k = 1; k <= TRIES; k += 1) {
    const wav = path.join(OUT, `${slug}-${k}.wav`);
    if (!fs.existsSync(wav)) { // resumable: clips already made are kept
      const r = await tts(sentence(sp));
      const raw = path.join(OUT, `${slug}-${k}.raw`); fs.writeFileSync(raw, r.pcm);
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 's16le', '-ar', String(r.rate), '-ac', '1', '-i', raw, wav]); fs.rmSync(raw);
    }
    const cacheF = `${wav}.asr.txt`; const heard = fs.existsSync(cacheF) ? fs.readFileSync(cacheF, 'utf8') : await asr(wav); fs.writeFileSync(cacheF, heard); const b = brandOf(heard); const words = b.split(/[\s-]+/).filter(Boolean).length;
    tries.push({ file: path.relative(VDIR, wav), heard, brand: b, words, distance: lev(b.toLowerCase().replace(/[^a-z]/g, ''), 'qubirex') });
    console.log(`${sp} #${k}: heard "${b}" (${words} word${words > 1 ? 's' : ''})`);
  }
  results.push({ spelling: sp, oneWordAll: tries.every(t => t.words === 1), meanDistance: +(tries.reduce((s, t) => s + t.distance, 0) / TRIES).toFixed(2), tries });
}
const ok = results.filter(r => r.oneWordAll && r.spelling !== 'Cube-bi-rex').sort((a, b) => a.meanDistance - b.meanDistance); // pick among the four candidates
const pick = ok[0]?.spelling || null;
fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify({ sentence: sentence('<brand>'), pick, results }, null, 1));
console.log(pick ? `pick: ${pick}` : 'no spelling was heard as one word in 3 of 3 tries');
