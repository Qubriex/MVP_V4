// src/utils/speechText.js — exactly what is said aloud, and in which pieces.
// Plain functions only (no React): the server keeps byte-identical copies in
// backend/core/voice/ so pre-recorded lesson audio (npm run voice:prerender)
// is stored under the very text the page asks for (tests/structural check
// the copies match).
import { pronounce } from './pronounce.js';
import { codeSpeech } from './codeSpeech.js';

// What is said aloud: no markdown or symbols, and no English glosses in
// brackets inside Telugu/Hindi text — switching languages mid-sentence is
// what makes a voice stumble.
export function speakable(text) {
  let t = String(text || '');
  const native = /[ऀ-ॿఀ-౿]/.test(t);
  if (native) t = t.replace(/\s*\(([A-Za-z0-9 ,.'’&/-]+)\)/g, '');
  return t
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/[*_#>|~]+/g, ' ')
    .replace(/[()[\]{}"“”]/g, ' ')
    .replace(/\s*[→←↔⇒]\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Sentences grouped into parts: a short first part so speech starts quickly,
// then parts of up to about 1,400 characters (under the voice's 5,000-byte
// limit even in Telugu and Hindi), so "Listen (2 min)" is a few requests,
// not dozens. The next part downloads while the current one plays.
export const FIRST_PART = 180;
export const PART = 1400;
export function splitParts(text, firstMax = FIRST_PART, max = PART) {
  const sentences = text.match(/[^.!?।\n]+[.!?।]*\s*/g)?.map(x => x.trim()).filter(Boolean) || [];
  const out = [];
  let cur = '';
  for (const s of sentences) {
    const limit = out.length ? max : firstMax;
    if (cur && (cur.length + s.length + 1) > limit) { out.push(cur); cur = s; } else cur = cur ? `${cur} ${s}` : s;
  }
  if (cur) out.push(cur);
  return out.flatMap(p => (p.length > max + 100 ? p.match(new RegExp(`[\\s\\S]{1,${max}}(\\s|$)`, 'g')).map(x => x.trim()) : [p]));
}

/** The pieces a text is requested in (what each voice request sends). */
export const spokenParts = (text, bcp47) => splitParts(pronounce(speakable(text), bcp47));

/** One "Walk me through it" line note, as sent for its clip. */
export const walkLine = (note, bcp47) => pronounce(speakable(codeSpeech(note)), bcp47);

/** The voice language a page language tag asks for (te-IN → telugu). */
export const ttsLanguage = (bcp47) => (String(bcp47).startsWith('en') ? 'english' : String(bcp47).startsWith('hi') ? 'hindi' : 'telugu');
