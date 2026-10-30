// core/ai/intent.js — what a learner's own words ask for, independent of the
// tutor (live or scripted). "I'm ready for the check", typed or spoken, in
// English, Telugu or Hindi ("check" or "test"), always starts the check, like the button does.
const READY = /\bready for (the |my |a )?(mastery )?(check|test)\b|^\s*(i'?m|i am) ready\b|(చెక్|టెస్ట్)‌?\s*(కు|కి)\s*సిద్ధం|సిద్ధంగా ఉన్నాను|(जाँच|जांच|चेक|टेस्ट)\s*के\s*लिए\s*तैयार|मैं तैयार (हूँ|हूं)/i;

/** True for a short message that asks for the check. Long answers never match. */
export const asksForCheck = (text) => String(text || '').length <= 80 && READY.test(String(text || ''));
