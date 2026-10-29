// src/components/learn/evidenceText.js — plain words for the passport's three
// separate truths (v4.3 §9.3): the label (computed today), the evidence level
// L (how strongly assessed) and the assurance level A (whose answer). They are
// never merged into one word.
import { uiLocale } from '../../context/UiLangContext';
export const LABEL = {
  Confirmed: { text: 'learn.evidenceText.label.confirmedMastery', cls: 'ln-tag-success' },
  Partial: { text: 'learn.evidenceText.label.partialMastery', cls: 'ln-tag-info' },
  Foundational: { text: 'learn.evidenceText.label.foundational', cls: 'ln-tag-warning' },
  none: { text: 'learn.evidenceText.label.notYetMastered', cls: 'ln-tag-neutral' }
};
export const LEVEL = { L1: 'learn.evidenceText.level.l1RubricValidated', L2: 'learn.evidenceText.level.l2ExecutionVerified', L3: 'learn.evidenceText.level.l3FacultyConfirmed', L4: 'learn.evidenceText.level.l4ExternallyCorroborated' };
export const ASSURANCE = { A1: 'learn.evidenceText.assurance.a1ProvenanceChecked', A2: 'learn.evidenceText.assurance.a2ChallengeBound', A3: 'learn.evidenceText.assurance.a3Supervised' };
export const MISSING = {
  mastery: 'learn.evidenceText.missing.masterThisNodeFirst',
  more_demonstrations: 'learn.evidenceText.missing.showItAgainAt',
  time_span: 'learn.evidenceText.missing.spreadThosePassesOver',
  consistency: 'learn.evidenceText.missing.passMostOfYour',
  strong_pass: 'learn.evidenceText.missing.giveOneClearlyStrong',
  execution_evidence: 'learn.evidenceText.missing.passACheckWhere',
  freshness: 'learn.evidenceText.missing.yourReviewIsOverdue',
  challenge_bound: 'learn.evidenceText.missing.passASpokenChallenge',
  second_kind: 'learn.evidenceText.missing.secondKind'
};
// Freshness in words: Fresh (85%+), Ageing (60–84%), Needs refresh (under 60%).
export const FRESH = { fresh: ['fresh.fresh', 'ln-tag-success'], ageing: ['fresh.ageing', 'ln-tag-warning'], stale: ['fresh.stale', 'ln-tag-danger'] };
export const freshBand = (f) => (f >= 0.85 ? 'fresh' : f >= 0.6 ? 'ageing' : 'stale');
export const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString(uiLocale(), { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
