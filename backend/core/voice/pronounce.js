// src/utils/pronounce.js
// How Professor Qubirex says names and terms that a Telugu or Hindi voice
// reads wrongly when they are written in English letters (docs/AI-VOICE-SPEC.md
// §2). Applied to the text just before it is spoken; the written caption is
// unchanged. Keep this list short: Chirp 3 HD reads most English technical
// words well inside Telugu/Hindi, and every entry here changes how she sounds.
//
// The brand name: a Telugu voice drops the "Q" in "Qubirex" ("Obirex").
// NAME_OPTIONS are the spellings to compare by ear on the Settings page;
// NAME[lang] is the one in use.
export const NAME_OPTIONS = {
  te: ['క్యూబిరెక్స్', 'క్యూ బిరెక్స్', 'క్యూ-బి-రెక్స్'],
  hi: ['क्यूबिरेक्स', 'क्यू बिरेक्स', 'क्यू-बि-रेक्स']
};
export const NAME = { te: NAME_OPTIONS.te[0], hi: NAME_OPTIONS.hi[0] };

const TERMS = {
  te: [
    [/\bJSON\b/g, 'జేసన్'],
    [/\bGitHub\b/gi, 'గిట్ హబ్'],
    [/\bSQL\b/g, 'ఎస్ క్యూ ఎల్']
  ],
  hi: [
    [/\bJSON\b/g, 'जेसन'],
    [/\bSQL\b/g, 'एस क्यू एल']
  ]
};

/** @param {string} text  @param {string} bcp47 e.g. te-IN @param {string} [nameOverride] */
export function pronounce(text, bcp47 = 'te-IN', nameOverride) {
  const lang = String(bcp47).slice(0, 2);
  if (!NAME[lang]) return text;
  const name = nameOverride || NAME[lang];
  let t = String(text).replace(/\bQu?bi?ri?e?x\b/gi, name); // Qubirex, Qubriex
  (TERMS[lang] || []).forEach(([re, say]) => { t = t.replace(re, say); });
  return t;
}
