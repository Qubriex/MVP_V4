// core/evidence/assurance.js
// Authenticity gate and authorship assurance (v4.3 §7.1, §7.11).
//   A0 Unassured — bulk paste, or a voice transcript edited away: counts for
//                  learning progress only, never a demonstration; the check
//                  is not evaluated and the learner answers again.
//   A1 Provenance-checked — voice with ≤ 30% transcript edits, or typed with
//                  ≤ 20% pasted text and no single paste > 80 characters.
//   A2 (instance-bound spoken challenge) and A3 (supervised) are earned by
//   the challenge and supervised tests, not by this gate.
import params from '../../config/params.js';

export const ORDER = { A0: 0, A1: 1, A2: 2, A3: 3 };

/**
 * @param {{mode?: 'voice'|'typed', pasted_chars?: number, paste_events?: number, largest_paste?: number, edit_ratio?: number, tab_hidden_ms?: number}|null} provenance
 * @param {string} answer
 * @returns {{ assurance: 'A0'|'A1', reason: string|null, provenance: object }}
 */
export function authenticityGate(provenance, answer) {
  const answerChars = String(answer || '').length;
  if (!provenance || !['voice', 'typed'].includes(provenance.mode)) {
    return { assurance: 'A0', reason: 'no_provenance', provenance: { mode: 'typed', answer_chars: answerChars } };
  }
  const p = {
    mode: provenance.mode,
    answer_chars: answerChars,
    pasted_chars: Math.max(0, Number(provenance.pasted_chars) || 0),
    paste_events: Math.max(0, Number(provenance.paste_events) || 0),
    largest_paste: Math.max(0, Number(provenance.largest_paste) || 0),
    edit_ratio: Math.min(1, Math.max(0, Number(provenance.edit_ratio) || 0)),
    tab_hidden_ms: Math.max(0, Number(provenance.tab_hidden_ms) || 0),
    device_id: provenance.device_id ? String(provenance.device_id).slice(0, 64) : null
  };
  if (p.mode === 'voice') {
    if (p.pasted_chars > 0 && p.pasted_chars / Math.max(1, answerChars) > params.get('evidence.assurance.a1MaxPastedRatio')) {
      return { assurance: 'A0', reason: 'bulk_paste', provenance: p };
    }
    return p.edit_ratio <= params.get('evidence.assurance.a1MaxVoiceEditRatio')
      ? { assurance: 'A1', reason: null, provenance: p }
      : { assurance: 'A0', reason: 'transcript_edited_away', provenance: p };
  }
  const pastedShare = p.pasted_chars / Math.max(1, answerChars);
  if (pastedShare > params.get('evidence.assurance.a1MaxPastedRatio') || p.largest_paste > params.get('evidence.assurance.a1MaxSinglePaste')) {
    return { assurance: 'A0', reason: 'bulk_paste', provenance: p };
  }
  return { assurance: 'A1', reason: null, provenance: p };
}
