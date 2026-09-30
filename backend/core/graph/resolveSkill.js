// core/graph/resolveSkill.js
// Text → canonical skill (v4.3 §3.2). Never a silent default: text that does
// not resolve goes to the ontology review queue, and an approved alias becomes
// a permanent part of the ontology.
//
//   exact alias            → { skill, conf: 1.0, via: 'alias' }
//   token Jaccard ≥ 0.60   → { skill, conf: jaccard, via: 'token' }
//   otherwise              → { skill: null, conf: 0, via: 'unmapped' } + review queue
import * as dal from '../db/dal.js';
import { ulid } from '../db/ulid.js';
import params from '../../config/params.js';

const FILLER_PHRASES = [/\bintroduction to\b/g, /\bintro to\b/g, /\bfundamentals of\b/g];
const FILLER_WORDS = new Set(['basics', 'basic', 'advanced', 'introduction', 'fundamentals', 'the', 'a', 'an']);

/** lowercase, NFKC, "&" → "and", punctuation → space, drop filler, collapse spaces */
export function normalise(text) {
  let t = String(text || '').normalize('NFKC').toLowerCase().replace(/&/g, ' and ');
  t = t.replace(/[^\p{L}\p{N}]+/gu, ' ');
  FILLER_PHRASES.forEach(re => { t = t.replace(re, ' '); });
  return t.split(/\s+/).filter(w => w && !FILLER_WORDS.has(w)).join(' ');
}

export const tokens = (t) => new Set(normalise(t).split(' ').filter(Boolean));

export function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  a.forEach(x => { if (b.has(x)) inter += 1; });
  return inter / (a.size + b.size - inter);
}

/** Queue text the ontology cannot place; repeated text counts occurrences. */
export async function queueForReview(text, source, context = null) {
  const norm = normalise(text);
  if (!norm) return;
  const existing = await dal.one('SELECT id FROM ontology_review_queue WHERE text_norm = ?', norm);
  if (existing) {
    await dal.run("UPDATE ontology_review_queue SET occurrences = occurrences + 1 WHERE id = ? AND status = 'pending'", existing.id);
  } else {
    await dal.run(`INSERT INTO ontology_review_queue (id, text, text_norm, source, context_json, occurrences, status, created_at)
      VALUES (?, ?, ?, ?, ?, 1, 'pending', ?)`, ulid(), String(text).slice(0, 300), norm, source, context ? JSON.stringify(context) : null, dal.nowIso());
  }
}

/**
 * @param {string} text
 * @param {{ source?: string, context?: object, queue?: boolean }} [opts]
 * @returns {{ skill: {skill_id: string, name: string}|null, conf: number, via: 'alias'|'token'|'unmapped' }}
 */
export async function resolveSkill(text, { source = 'unknown', context = null, queue = true } = {}) {
  const t = normalise(text);
  if (!t) return { skill: null, conf: 0, via: 'unmapped' };
  const exact = await dal.one('SELECT s.skill_id, s.name FROM skill_aliases a JOIN skills s ON s.skill_id = a.skill_id WHERE a.alias_norm = ?', t);
  if (exact) return { skill: exact, conf: 1.0, via: 'alias' };

  const tt = tokens(t);
  const like = [...tt].map(() => "(' ' || a.alias_norm || ' ') LIKE ?").join(' OR ');
  const cands = await dal.all(`SELECT a.alias_norm, s.skill_id, s.name FROM skill_aliases a JOIN skills s ON s.skill_id = a.skill_id WHERE ${like}`,
    ...[...tt].map(w => `% ${w} %`));
  let best = null;
  for (const c of cands) {
    const j = jaccard(tt, tokens(c.alias_norm));
    if (!best || j > best.j || (j === best.j && c.alias_norm.length < best.alias_norm.length)) best = { ...c, j };
  }
  if (best && best.j >= params.get('graph.resolveJaccard')) {
    return { skill: { skill_id: best.skill_id, name: best.name }, conf: Math.round(best.j * 100) / 100, via: 'token' };
  }
  if (queue) await queueForReview(text, source, context);
  return { skill: null, conf: 0, via: 'unmapped' };
}
