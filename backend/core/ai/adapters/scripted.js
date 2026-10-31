// core/ai/adapters/scripted.js
// The scripted tutor (AI_ADAPTER=scripted): realistic, predictable lesson and
// check output with no model key, so the whole learner loop can be tested in
// minutes on dev, on staging and in end-to-end tests, and the demo's lessons
// are instant and free. Content lives in data/scripted/<node>.<language>.json
// (lesson turns, check questions, a keyword rubric and feedback), never in code.
//
// Covered tasks: TEACH.diagnosis, TEACH.instruction, TEACH.doubt,
// EVIDENCE.conceptItem, EVAL.mastery, HEALTH.ping. Callers pass the facts the
// script needs in `meta` (the model adapters ignore it). Every other task
// answers like a deployment without a key, so those pages use their own
// ready-made fallbacks.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { wantsNative, nativeDeep } from '../../language/style.js';

export const name = 'scripted';
const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../data/scripted');
const LANGS = ['telugu', 'hindi', 'english'];
const cache = new Map();

// The scripts are written in the Telugu + English (Hindi + English) mix; a
// learner who chose full Telugu / Hindi gets them through native().
function load(file) {
  const lang = file.match(/\.(telugu|hindi)\.json$/)?.[1];
  const full = lang && wantsNative(lang);
  const key = full ? `${file}|full` : file;
  if (cache.has(key)) return cache.get(key);
  let doc = null;
  try { doc = JSON.parse(fs.readFileSync(path.join(DIR, file), 'utf8')); } catch { doc = null; }
  if (doc && full) doc = nativeDeep(doc, lang === 'telugu' ? 'te' : 'hi');
  cache.set(key, doc);
  return doc;
}

export const slugOf = (label) => String(label || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const langOf = (l) => { const m = String(l || '').replace(/_en$/, ''); return LANGS.includes(m) ? m : 'english'; };
const fill = (s, vars) => String(s || '').replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));

/** The common phrases for a language. */
export const common = (language) => load(`_common.${langOf(language)}.json`);

/** A node's lesson script, or a generic one filled with the skill name. */
export function lessonFor(nodeLabel, language) {
  const lang = langOf(language);
  const doc = load(`${slugOf(nodeLabel)}.${lang}.json`);
  if (doc) return doc;
  const g = common(lang).generic;
  const v = { skill: nodeLabel || 'this skill' };
  const turn = (k) => ({ message: fill(g[k], v), captionEn: null, code: null, mermaid: null });
  return {
    node: nodeLabel, language: lang, generic: true,
    diagnosis: { message: fill(g.diag, v), captionEn: null },
    turns: { explain: turn('explain'), example: turn('example'), another_way: turn('another'), not_understood: turn('confused') },
    doubt: { answer: fill(g.doubt, v), captionEn: null },
    check: { questions: g.q.map(q => fill(q, v)), rubric: { groups: [[String(nodeLabel || '').toLowerCase()], ['example', 'for example', 'ఉదాహరణ', 'उदाहरण']], minChars: 40 }, feedback: { good: g.good, missing: g.missing, next: g.next } }
  };
}

// What the learner asked for, in any of the three languages.
const ASKS = [
  ['not_understood', /(don'?t|do not|didn'?t) (understand|get)|not clear|confus|అర్థం కాలే|అర్ధం కాలే|తెలియలేదు|समझ नहीं|समझ में नहीं|नहीं समझ/i],
  ['another_way', /another way|different way|explain again|other way|ఇంకో విధంగా|వేరే విధంగా|మరో విధంగా|दूसरे तरीके|अलग तरीके|फिर से समझा/i],
  ['example', /example|show me|ఉదాహరణ|उदाहरण|मिसाल/i]
];
export function intentOf(text) {
  const hit = ASKS.find(([, re]) => re.test(String(text || '')));
  return hit ? hit[0] : null;
}

const json = (o) => JSON.stringify(o);

function instruction(meta) {
  const s = lessonFor(meta.nodeLabel, meta.language);
  const c = common(meta.language);
  const base = { behaviourSignal: meta.behaviourSignal || 'engaged', approachesUsed: [meta.approach || 'native_concept'], culturalExampleUsed: null };
  if (meta.learnerRequestedCheck) {
    return { ...base, message: c.ready, captionEn: meta.language === 'english' ? null : common('english').ready, decision: 'CHECK', mermaid: null, code: null };
  }
  // After a failed check the tutor explains another way; after a pass it congratulates.
  if (meta.behaviourSignal === 'accelerating') {
    return { ...base, message: c.advance, captionEn: meta.language === 'english' ? null : common('english').advance, decision: 'CONTINUE', mermaid: null, code: null };
  }
  let kind = intentOf(meta.lastMessage);
  if (!kind && meta.behaviourSignal === 'confused') kind = 'another_way';
  if (!kind) kind = ['explain', 'example', 'another_way'][Math.min(2, Math.max(0, (meta.aiTurns || 1) - 1))];
  const turn = s.turns[kind] || s.turns.explain;
  const prefix = meta.behaviourSignal === 'confused' ? `${c.loop} ` : '';
  const capPrefix = meta.behaviourSignal === 'confused' && turn.captionEn ? `${common('english').loop} ` : '';
  return { ...base, message: prefix + turn.message, captionEn: turn.captionEn ? capPrefix + turn.captionEn : null, decision: 'CONTINUE', mermaid: turn.mermaid || null, code: turn.code || null };
}

/** The check question for this attempt: the node's template, filled from the seeded parameters. */
export function questionFor({ nodeLabel, language, context, variant = 0 }) {
  const s = lessonFor(nodeLabel, language);
  const qs = s.check.questions;
  return fill(qs[Math.abs(variant) % qs.length], { context, skill: nodeLabel });
}

/** Rule-based grading: keyword groups from the rubric, answer length, then feedback. */
export function grade({ nodeLabel, language, answer, theta = 0.7 }) {
  const s = lessonFor(nodeLabel, language);
  const text = String(answer || '').toLowerCase();
  const groups = s.check.rubric.groups || [];
  const matched = groups.filter(alts => alts.some(a => text.includes(String(a).toLowerCase())));
  let score = groups.length ? 0.3 + 0.7 * (matched.length / groups.length) : 0.5;
  const short = text.replace(/\s+/g, ' ').trim().length < (s.check.rubric.minChars || 40);
  if (short) score = Math.min(score, 0.45);
  score = Math.round(score * 100) / 100;
  const missingTerms = groups.filter(g => !matched.includes(g)).map(g => g[0]);
  const fb = s.check.feedback;
  const c = common(language).generic;
  const good = matched.length ? fb.good : c.good;
  const missing = missingTerms.length ? `${fb.missing} (${missingTerms.join(', ')})` : '';
  const passed = score >= theta;
  return {
    passed, score,
    evaluation: `Matched ${matched.length} of ${groups.length} rubric groups${short ? '; answer too short' : ''}.`,
    feedbackForLearner: [good, missing, fb.next].filter(Boolean).join(' '),
    whatWasGood: matched.length ? good : '',
    whatWasMissing: missing || (short ? c.missing : ''),
    nextTime: fb.next,
    loopApproachIfFailed: short ? 'vocabulary_barrier' : 'concept_not_understood',
    recommendedApproach: 'analogy',
    understandingGaps: missingTerms
  };
}

const notConfigured = (task) => Object.assign(new Error(`GEMINI_API_KEY is not set (the scripted tutor covers lessons and checks; ${task} has its own fallback)`), { status: 503 });

export async function generate(req) {
  const m = req.meta || {};
  let out;
  switch (req.task) {
    case 'TEACH.diagnosis': {
      const s = lessonFor(m.nodeLabel, m.language);
      out = json({ message: s.diagnosis.message, captionEn: s.diagnosis.captionEn, decision: 'DIAGNOSE', behaviourSignal: 'engaged' });
      break;
    }
    case 'TEACH.instruction': out = json(instruction(m)); break;
    case 'TEACH.doubt': {
      const s = lessonFor(m.nodeLabel, m.language);
      out = json({ answer: s.doubt.answer, approach_used: 'scripted' });
      break;
    }
    case 'EVIDENCE.conceptItem': out = json({ question: questionFor(m) }); break;
    case 'EVAL.mastery': out = json(grade({ ...m, theta: m.theta ?? 0.7 })); break;
    case 'HEALTH.ping': out = 'ok'; break;
    default: throw notConfigured(req.task);
  }
  return { text: out, modelVersion: 'scripted-1', tokensIn: 0, tokensOut: 0 };
}

export async function speak() { throw notConfigured('TEACH.speak'); }
