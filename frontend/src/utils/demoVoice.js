// src/utils/demoVoice.js — speech for the public demo. The demo has no
// sign-in, so the server voice (/learner/tts) is not available; this uses the
// browser's own voices. It must be called from a tap (autoplay rules) and
// reports honestly when the browser has no voice for the language.

const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;

function voicesNow() {
  if (!synth) return Promise.resolve([]);
  const v = synth.getVoices();
  if (v.length) return Promise.resolve(v);
  // Chrome loads voices after the first call; wait briefly for them.
  return new Promise((resolve) => {
    const done = () => { synth.removeEventListener?.('voiceschanged', done); resolve(synth.getVoices()); };
    synth.addEventListener?.('voiceschanged', done);
    setTimeout(done, 1200);
  });
}

/** The best voice for a BCP-47 tag (te-IN, hi-IN, en-IN), or null. */
export async function voiceFor(bcp47) {
  const all = await voicesNow();
  const base = bcp47.split('-')[0];
  return all.find(v => v.lang === bcp47) || all.find(v => v.lang?.toLowerCase().startsWith(base)) || null;
}

export const canDemoSpeak = !!synth;

/**
 * Speak text; resolves 'done' when finished, 'novoice' when the browser has
 * no voice for that language, 'unsupported' without speech synthesis.
 */
export async function demoSpeak(text, bcp47, { onStart } = {}) {
  if (!synth) return 'unsupported';
  const voice = await voiceFor(bcp47);
  if (!voice) return 'novoice';
  synth.cancel();
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = voice.lang; u.voice = voice; u.rate = 0.95;
    u.onstart = () => onStart?.();
    u.onend = () => resolve('done');
    u.onerror = () => resolve('done');
    synth.speak(u);
  });
}

export function demoStop() { synth?.cancel(); }
