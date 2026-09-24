// core/portfolio.js
// ─────────────────────────────────────────────────────────────────────────────
// AI helpers for the learner's own portfolio pages (profile, resume) and for
// speech-to-text. These sit outside the six-brain instruction cycle: nothing
// here teaches or evaluates, so ORCH is not involved.
//
// Honesty rule shared by every resume prompt: only claim skills the learner
// has mastered (verified by a Qubirex check) or declared themselves, and keep
// the two apart. Never invent employers, projects, grades or numbers.
// ─────────────────────────────────────────────────────────────────────────────
const { callAI, callAIWithAudio, safeParseJSON } = require('./instructionEngine');

const LANG_NAMES = { telugu: 'Telugu', hindi: 'Hindi', english: 'English' };

// ─── transcribeAudio() — speech in, text out ──────────────────────────────────
async function transcribeAudio({ audioBase64, mimeType, language = 'telugu' }) {
  const lang = LANG_NAMES[language] || 'Telugu';
  const system = `You transcribe a learner's speech for a tutoring app. The learner mostly speaks ${lang}, often mixing in English technical words.
Write exactly what was said: ${lang} words in ${lang} script, English words in Latin script. Do not translate, summarise or answer.
Respond ONLY with JSON: {"transcript": "..."}`;
  const text = await callAIWithAudio({ system, userMessage: 'Transcribe this recording.', audioBase64, mimeType });
  const parsed = safeParseJSON(text, { transcript: text });
  return (parsed.transcript || '').trim();
}

// ─── summaryFromSpeech() — "say it in Telugu, we'll write it in English" ─────
async function summaryFromSpeech({ transcript, language = 'telugu', name, verifiedSkills = [], targetRoles = [] }) {
  const lang = LANG_NAMES[language] || 'Telugu';
  const system = `You write the "About me" summary on a fresher's resume. The learner described themselves out loud in ${lang}.
Write 2–3 sentences of plain, confident English in the first person implied (no "I" at the start of every sentence).
Use ONLY facts the learner said, plus these verified skills if relevant: ${verifiedSkills.join(', ') || 'none'}. Target roles: ${targetRoles.join(', ') || 'not given'}.
Never invent employers, grades, numbers or projects.
Respond ONLY with JSON: {"summary": "..."}`;
  const text = await callAI({ system, userMessage: `Learner (${name || 'learner'}) said:\n${transcript}`, maxTokens: 400, temperature: 0.4 });
  return (safeParseJSON(text, { summary: text }).summary || '').trim();
}

// ─── tailorResume() — reorder skills and rewrite the summary for one JD ──────
async function tailorResume({ job, about, verifiedSkills = [], learningSkills = [], declaredSkills = [] }) {
  const allowed = [...verifiedSkills, ...declaredSkills];
  const system = `You tailor a fresher's resume to one job description.
Rewrite the summary (2–3 sentences, English) so it speaks to this role, and order the learner's skills so the ones this JD asks for come first.
Honesty rules:
- skill_order may ONLY contain skills from this list, spelled exactly: ${JSON.stringify(allowed)}
- Verified skills (proven by mastery checks): ${verifiedSkills.join(', ') || 'none'}
- Still learning (do NOT claim as known; you may say "currently learning"): ${learningSkills.join(', ') || 'none'}
- Self-declared: ${declaredSkills.join(', ') || 'none'}
- Never invent experience, employers, numbers or projects.
Respond ONLY with JSON: {"summary": "...", "skill_order": ["..."]}`;
  const jd = `${job.title} (${job.company_type}, ${job.city})\n${job.about}\nResponsibilities: ${job.responsibilities.join('; ')}\nSkills: ${job.skills.map(s => s.name + (s.required ? '' : ' (nice to have)')).join(', ')}`;
  const text = await callAI({ system, userMessage: `Current summary:\n${about || '(none)'}\n\nJob description:\n${jd}`, maxTokens: 600, temperature: 0.4 });
  const parsed = safeParseJSON(text, { summary: about || '', skill_order: allowed });
  // Enforce the allow-list server-side too — the prompt is not a guarantee.
  const order = (parsed.skill_order || []).filter(x => allowed.includes(x));
  allowed.forEach(x => { if (!order.includes(x)) order.push(x); });
  return { summary: (parsed.summary || about || '').trim(), skill_order: order };
}

// ─── explainJobAloud() — "Read JD aloud in Telugu" ─────────────────────────────
// Not a word-for-word translation: a short spoken walk-through of the JD in
// the learner's language, English technical terms kept as they are.
async function explainJobAloud({ job, language = 'telugu' }) {
  const lang = LANG_NAMES[language] || 'Telugu';
  const system = `You read a job description aloud to a fresher in ${lang}. Speak naturally in ${lang} script, keeping English technical terms (React, SQL, Git…) in English.
Cover: the role and company type, what they will do day to day, the skills asked for (say which are "nice to have"), location, work mode and salary. 6–9 short sentences, suitable for text-to-speech. No lists, no markdown.
Respond ONLY with JSON: {"text": "...", "captionEn": "one-sentence English summary"}`;
  const jd = `${job.title} — ${job.company_type}, ${job.city} (${job.mode}), ₹${job.salary_min}–${job.salary_max} LPA, ${job.experience}\n${job.about}\nResponsibilities: ${job.responsibilities.join('; ')}\nSkills: ${job.skills.map(x => x.name + (x.required ? '' : ' (nice to have)')).join(', ')}`;
  const text = await callAI({ system, userMessage: jd, maxTokens: 900, temperature: 0.5 });
  const parsed = safeParseJSON(text, { text, captionEn: null });
  return { text: (parsed.text || '').trim(), caption_en: parsed.captionEn || null };
}

// ─── explainTopicAloud() — "Listen to a 2-min intro" on an emerging topic ────
async function explainTopicAloud({ topic, language = 'telugu' }) {
  const lang = LANG_NAMES[language] || 'Telugu';
  const system = `You give a fresher a spoken two-minute introduction to an emerging job topic, in ${lang} script, keeping English technical terms in English.
Explain what the field is with one everyday example from India, what the new roles do, and what to learn first, in order. About 12–16 short sentences for text-to-speech. No lists, no markdown, no invented statistics.
Respond ONLY with JSON: {"text": "...", "captionEn": "one-sentence English summary"}`;
  const brief = `${topic.name} (${topic.sector}, ${topic.growth})\n${topic.desc}\nNew roles: ${topic.roles.join(', ')}\nLearning order: ${topic.steps.map(x => x.name).join(' → ')}`;
  const text = await callAI({ system, userMessage: brief, maxTokens: 1400, temperature: 0.6 });
  const parsed = safeParseJSON(text, { text, captionEn: null });
  return { text: (parsed.text || '').trim(), caption_en: parsed.captionEn || null };
}

// ─── interviewTurn() — voice interview practice for one JD ─────────────────────
// Stateless: the client sends the whole short transcript each turn. Five
// questions, each followed by one line of feedback, then a wrap-up.
const INTERVIEW_QUESTIONS = 5;
async function interviewTurn({ job, language = 'telugu', turns = [], verifiedSkills = [] }) {
  const lang = LANG_NAMES[language] || 'Telugu';
  const asked = turns.filter(x => x.role === 'interviewer').length;
  const done = asked >= INTERVIEW_QUESTIONS;
  const system = `You are a friendly interviewer running a practice interview for "${job.title}" (${job.company_type}). Speak ${lang}, in ${lang} script, keeping English technical terms in English. The candidate is a fresher; verified skills: ${verifiedSkills.join(', ') || 'none listed'}.
JD skills: ${job.skills.map(x => x.name).join(', ')}.
${asked === 0 ? 'Greet the candidate in one line and ask the first question.' : done
    ? 'The interview is over. Give warm, specific feedback on the last answer, then 2–3 sentences on overall strengths and one thing to practise.'
    : `Give one short line of honest, kind feedback on the last answer, then ask question ${asked + 1} of ${INTERVIEW_QUESTIONS}.`}
Mix question types: one about themselves, technical questions on the JD skills, one scenario, one about a project. Never mark answers right/wrong in a harsh way.
Respond ONLY with JSON: {"text": "what you say, ${lang}", "captionEn": "one-line English gloss", "done": ${done}}`;
  const history = turns.slice(-10).map(x => `${x.role === 'interviewer' ? 'Interviewer' : 'Candidate'}: ${x.text}`).join('\n') || '(start)';
  const text = await callAI({ system, userMessage: history, maxTokens: 600, temperature: 0.6 });
  const parsed = safeParseJSON(text, { text, captionEn: null, done });
  return { text: (parsed.text || '').trim(), caption_en: parsed.captionEn || null, done, question_number: done ? null : asked + 1, total: INTERVIEW_QUESTIONS };
}

module.exports = { transcribeAudio, summaryFromSpeech, tailorResume, explainJobAloud, explainTopicAloud, interviewTurn };
