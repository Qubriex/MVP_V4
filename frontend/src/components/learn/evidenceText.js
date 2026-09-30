// src/components/learn/evidenceText.js — plain words for the passport's three
// separate truths (v4.3 §9.3): the label (computed today), the evidence level
// L (how strongly assessed) and the assurance level A (whose answer). They are
// never merged into one word.
export const LABEL = {
  Confirmed: { text: 'Confirmed mastery', cls: 'ln-tag-success' },
  Partial: { text: 'Partial mastery', cls: 'ln-tag-info' },
  Foundational: { text: 'Foundational', cls: 'ln-tag-warning' },
  none: { text: 'Not yet mastered', cls: 'ln-tag-neutral' }
};
export const LEVEL = { L1: 'L1 · Rubric-validated', L2: 'L2 · Execution-verified', L3: 'L3 · Faculty-confirmed', L4: 'L4 · Externally corroborated' };
export const ASSURANCE = { A1: 'A1 · Provenance-checked', A2: 'A2 · Challenge-bound', A3: 'A3 · Supervised' };
export const MISSING = {
  mastery: 'Master this node first.',
  more_demonstrations: 'Show it again: at least 3 passes since you mastered it.',
  time_span: 'Spread those passes over at least 14 days (your reviews do this).',
  consistency: 'Pass most of your recent reviews.',
  strong_pass: 'Give one clearly strong answer.',
  execution_evidence: 'Pass a check where your code is run.',
  freshness: 'Your review is overdue — take it to keep the skill fresh.',
  challenge_bound: 'Pass a spoken challenge on your own question, or a supervised test (Day-One). Spoken challenges are not switched on yet.'
};
export const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
