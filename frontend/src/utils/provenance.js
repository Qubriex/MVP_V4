// src/utils/provenance.js
// Answer provenance for the authenticity gate (v4.3 §7.11). The browser
// reports how an answer was produced; the server grades A0/A1:
//   voice: share of the transcript edited before submit (≤ 30% → A1)
//   typed: pasted characters (≤ 20% of the answer) and the largest single paste (≤ 80)
// Nothing here stores audio or keystrokes — only these counts are sent.

/** Levenshtein distance, bounded to keep long answers cheap. */
export function editDistance(a = '', b = '') {
  const s = a.slice(0, 2000); const t = b.slice(0, 2000);
  if (!s.length) return t.length;
  if (!t.length) return s.length;
  let prev = Array.from({ length: t.length + 1 }, (_, j) => j);
  for (let i = 1; i <= s.length; i += 1) {
    const cur = [i];
    for (let j = 1; j <= t.length; j += 1) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (s[i - 1] === t[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[t.length];
}

export const editRatio = (original, final) => (original ? Math.min(1, editDistance(original, final) / Math.max(original.length, 1)) : 1);

/** A fresh tracker for one answer. */
export const newTracker = () => ({ mode: 'typed', original: '', pasted_chars: 0, paste_events: 0, largest_paste: 0, hiddenSince: null, tab_hidden_ms: 0 });

export function recordPaste(tracker, text) {
  const n = String(text || '').length;
  return { ...tracker, pasted_chars: tracker.pasted_chars + n, paste_events: tracker.paste_events + 1, largest_paste: Math.max(tracker.largest_paste, n) };
}

/** The provenance object posted with a check answer. */
export function provenanceFor(tracker, finalText) {
  if (tracker.mode === 'voice') {
    return { mode: 'voice', edit_ratio: Number(editRatio(tracker.original, finalText).toFixed(3)), pasted_chars: tracker.pasted_chars, paste_events: tracker.paste_events, largest_paste: tracker.largest_paste, tab_hidden_ms: tracker.tab_hidden_ms };
  }
  return { mode: 'typed', pasted_chars: tracker.pasted_chars, paste_events: tracker.paste_events, largest_paste: tracker.largest_paste, tab_hidden_ms: tracker.tab_hidden_ms };
}
