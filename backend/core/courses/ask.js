// core/courses/ask.js — "Ask anytime" inside a lesson. The answer stays within
// the lesson plan and the lesson then carries on where it was:
//   "explain simpler", "another example", "explain in Telugu / Hindi / English",
//   "slower" — answered from the lesson's own content;
//   any other question — the live tutor answers it about this lesson when a
//   model is available, otherwise the explanation lines closest to the question.
import { answerDoubt } from '../brains/teachBrain.js';
import { currentTutor } from '../requestContext.js';
import { languagePair } from './catalog.js';

const INTENTS = [
  ['simpler', /simpl|easy|easier|సులభ|సింపుల్|आसान|सरल/i],
  ['example', /example|another|ఉదాహరణ|उदाहरण|मिसाल/i],
  ['slower', /slow|నెమ్మది|धीरे/i],
  ['lang_te', /telugu|తెలుగు/i],
  ['lang_hi', /hindi|हिंदी|हिन्दी/i],
  ['lang_en', /english|ఇంగ్లీష్|अंग्रेज़ी|अंग्रेजी/i]
];
const LIVE_LANGS = new Set(['telugu', 'hindi']);

export const askIntent = (q) => (INTENTS.find(([, re]) => re.test(String(q || ''))) || [null])[0];

const words = (s) => String(s || '').toLowerCase().split(/[^a-z0-9ऀ-ॿఀ-౿_]+/).filter(w => w.length > 2);

/** Explanation and code-note lines that share the most words with the question. */
function closestLines(lesson, question, code) {
  const q = new Set(words(question));
  const lines = [...(lesson.explain?.[code] || []), ...(lesson.code?.notes || []).map(n => n.note?.[code]).filter(Boolean)];
  const scored = lines.map((l, i) => ({ l, i, s: words(l).filter(w => q.has(w)).length })).sort((a, b) => b.s - a.s || a.i - b.i);
  const best = scored.filter(x => x.s > 0).slice(0, 3).sort((a, b) => a.i - b.i).map(x => x.l);
  return best.length ? best : (lesson.simpler?.[code] || lines.slice(0, 2));
}

/**
 * @returns {Promise<{ answer: string, kind: string, language?: string, rate?: number, source: 'lesson'|'tutor' }>}
 */
export async function askLesson(lesson, question, learning) {
  const { main } = languagePair(learning);
  const kind = askIntent(question);
  if (kind === 'simpler') return { kind, answer: (lesson.simpler?.[main] || []).join(' '), source: 'lesson' };
  if (kind === 'example') return { kind, answer: (lesson.anotherExample?.[main] || []).join(' '), source: 'lesson' };
  if (kind === 'slower') return { kind, answer: (lesson.explain?.[main] || []).join(' '), rate: 0.8, source: 'lesson' };
  if (kind && kind.startsWith('lang_')) {
    const code = kind.slice(5);
    return { kind: 'language', language: { te: 'telugu', hi: 'hindi', en: 'english' }[code], answer: (lesson.explain?.[code] || []).join(' '), source: 'lesson' };
  }
  const language = { te: 'telugu', hi: 'hindi', en: 'english' }[main];
  if (currentTutor() !== 'scripted' && LIVE_LANGS.has(language) && process.env.GEMINI_API_KEY) {
    try {
      const plan = `${lesson.title.en}. Lesson plan: ${(lesson.explain?.en || []).join(' ')} Code: ${lesson.code?.source || ''}`;
      const r = await answerDoubt({ questionText: `${question}\n\n(Answer only about this lesson. ${plan})`, nodeLabel: lesson.title.en, clusterLabel: lesson.module_id, language });
      if (r?.answer) return { kind: 'question', answer: r.answer, source: 'tutor' };
    } catch { /* the lesson's own lines below */ }
  }
  return { kind: 'question', answer: closestLines(lesson, question, main).join(' '), source: 'lesson' };
}
