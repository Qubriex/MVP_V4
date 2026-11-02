// core/voice/prerender.js — pre-recorded lesson audio. Fixed content is never
// generated live: every Python and Java lesson ("Listen" and each "Walk me
// through it" line) and every scripted-tutor turn is recorded once, in each
// learning mode (Telugu, Telugu + English, Hindi, Hindi + English, English),
// and stored under the same text the learner's page asks for. Live speech is
// left for AI replies and other text that changes.
//
// The text comes from speechText.js, a byte-identical copy of the browser's
// (frontend/src/utils/speechText.js), so a stored clip is found by the page.
// Recorded clips are skipped, so a run can stop (quota) and resume.
import { withContext } from '../requestContext.js';
import { catalog, lessonById, lessonView } from '../courses/catalog.js';
import { lessonFor } from '../ai/adapters/scripted.js';
import { prerecord, PINNED } from '../ai/gateway.js';
import * as dal from '../db/dal.js';
import { spokenParts, walkLine, ttsLanguage } from './speechText.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export const MODES = ['telugu', 'telugu_en', 'hindi', 'hindi_en', 'english'];
const tagOf = (mode) => (mode.startsWith('hindi') ? 'hi-IN' : mode === 'english' ? 'en-IN' : 'te-IN');
const SCRIPTED = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data/scripted');
const TURNS = ['explain', 'example', 'another_way', 'not_understood'];

/**
 * Every clip to record, in order: { id, kind, mode, language, text }.
 * Same text in two modes (English parts, code-only lines) is listed once.
 * @param {{ kinds?: string[] }} [opts] listen | notes | scripted
 */
const listCache = new Map(); // the lesson content is fixed for a deployment
export function clips({ kinds = ['listen', 'notes', 'scripted'] } = {}) {
  const key = kinds.join(',');
  if (!listCache.has(key)) listCache.set(key, buildClips(kinds));
  return listCache.get(key);
}
function buildClips(kinds) {
  const out = [];
  const seen = new Set();
  const add = (c) => { const k = `${c.language}|${c.text}`; if (c.text && !seen.has(k)) { seen.add(k); out.push(c); } };
  const nodes = fs.existsSync(SCRIPTED) ? [...new Set(fs.readdirSync(SCRIPTED).filter(f => !f.startsWith('_') && f.endsWith('.json')).map(f => f.split('.')[0]))] : [];
  for (const mode of MODES) {
    const tag = tagOf(mode);
    const language = ttsLanguage(tag);
    withContext({ learningMode: mode }, () => {
      for (const c of catalog().courses.filter(x => x.status === 'complete')) {
        for (const m of c.modules) {
          for (const l of m.lessons) {
            const v = lessonView(lessonById(l.id), mode);
            if (!v.parts) continue;
            if (kinds.includes('listen')) spokenParts(v.parts.listen, tag).forEach((text, i) => add({ id: `${l.id}:listen:${i}`, kind: 'listen', mode, language, text }));
            if (kinds.includes('notes')) v.parts.code.notes.forEach(n => add({ id: `${l.id}:line${n.line}`, kind: 'notes', mode, language, text: walkLine(n.note, tag) }));
          }
        }
      }
      if (kinds.includes('scripted')) {
        for (const slug of nodes) {
          const s = lessonFor(slug.replace(/-/g, ' '), mode);
          for (const t of TURNS) {
            const msg = s.turns?.[t]?.message;
            if (msg) spokenParts(msg, tag).forEach((text, i) => add({ id: `${slug}:${t}:${i}`, kind: 'scripted', mode, language, text }));
          }
        }
      }
    });
  }
  return out;
}

// Stored lesson audio is capped (QBX_PRERENDER_MAX_MB, default 300 MB), so
// uncompressed WAV from the Gemini voice can never fill the database; Cloud
// Text-to-Speech returns small MP3s and fits easily.
const maxBytes = () => (Number(process.env.QBX_PRERENDER_MAX_MB) || 300) * 1024 * 1024;

/** How much lesson audio is stored now. */
export async function stored() {
  const r = await dal.one('SELECT COUNT(*) AS n, COALESCE(SUM(bytes), 0) AS bytes FROM tts_cache WHERE hits >= ?', PINNED).catch(() => ({ n: 0, bytes: 0 }));
  return { clips: Number(r.n), bytes: Number(r.bytes) };
}

/**
 * Record clips from `from`, until done, out of time, out of quota or at the
 * storage cap. Returns where to resume.
 * @returns {Promise<{ total: number, next: number, recorded: number, skipped: number, chars: number, bytes: number, stopped: string|null }>}
 */
export async function run({ from = 0, budgetMs = 45000, kinds, onProgress = () => {} } = {}) {
  const list = clips({ kinds });
  const started = Date.now();
  let used = (await stored()).bytes;
  let i = from;
  let recorded = 0; let skipped = 0; let chars = 0; let bytes = 0; let stopped = null;
  for (; i < list.length; i += 1) {
    if (Date.now() - started > budgetMs) { stopped = 'time'; break; }
    if (used > maxBytes()) { stopped = 'storage'; break; }
    const c = list[i];
    try {
      const r = await prerecord({ text: c.text, language: c.language });
      if (r.recorded) { recorded += 1; chars += r.chars; bytes += r.bytes; used += r.bytes; } else skipped += 1;
    } catch (err) {
      const status = err?.cause?.status || err?.status;
      stopped = status === 429 ? 'quota' : 'error';
      break;
    }
    onProgress({ index: i + 1, total: list.length, recorded, skipped, chars, clip: c.id });
  }
  return { total: list.length, next: i, recorded, skipped, chars, bytes, stopped };
}
