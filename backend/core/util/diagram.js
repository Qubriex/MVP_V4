// core/util/diagram.js — a diagram from the AI tutor reaches the browser only
// if it can be drawn. The browser parses again before drawing (and shows
// nothing on failure); this server check drops what is certainly broken, so a
// learner never gets a diagram that would fail: an unknown diagram type,
// backslash-escaped quotes, unbalanced brackets or quotes, or code pasted in.
import { logger } from '../logger.js';

const TYPES = /^\s*(graph|flowchart)\s+(TD|TB|BT|LR|RL)\b|^\s*(sequenceDiagram|classDiagram|stateDiagram(-v2)?|erDiagram|pie|mindmap|journey|timeline)\b/;
const PAIRS = { '[': ']', '(': ')', '{': '}' };

function balanced(text) {
  const stack = [];
  let quoted = false;
  for (const ch of text) {
    if (ch === '"') { quoted = !quoted; continue; }
    if (quoted) continue;
    if (PAIRS[ch]) stack.push(PAIRS[ch]);
    else if (Object.values(PAIRS).includes(ch) && stack.pop() !== ch) return false;
  }
  return !quoted && stack.length === 0;
}

/** Why a diagram would fail to draw, or null when it looks drawable. */
export function diagramProblem(source) {
  const s = String(source || '');
  if (!s.trim()) return 'empty';
  if (s.length > 3000) return 'too long';
  if (!TYPES.test(s)) return 'unknown diagram type';
  if (/\\"/.test(s)) return 'escaped quotes';
  if (/```/.test(s)) return 'code fence';
  // Brackets are shapes only in flowcharts (an ER diagram writes ||--o{ on purpose).
  if (/^\s*(graph|flowchart)\b/.test(s) && s.split('\n').some(line => !balanced(line))) return 'unbalanced brackets or quotes';
  return null;
}

/** The diagram if drawable, else null (logged once with where it came from). */
export function safeDiagram(source, where = '') {
  if (source == null || source === '') return null;
  const problem = diagramProblem(source);
  if (!problem) return String(source);
  logger.warn('diagram_dropped', { where, problem });
  return null;
}
