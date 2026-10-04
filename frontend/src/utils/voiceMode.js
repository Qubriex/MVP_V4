// src/utils/voiceMode.js
// Voice-mode helpers for the lesson (docs/AI-VOICE-SPEC.md §8):
//   playCue()           — a short soft sound when the microphone opens (hands-free)
//   useBargeIn()        — while she speaks, listen for the learner starting to talk,
//                         so they can interrupt her
//   parseVoiceCommand() — "repeat", "slower", "say it in English", "give an
//                         example", "I'm ready for the test" (English, Telugu, Hindi)
//   FILLER              — a short "one moment" said while a reply is being written
import { useEffect, useRef } from 'react';

let ctx = null;
const audioCtx = () => {
  const AC = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
};

/** Two soft rising notes, about a quarter of a second. */
export function playCue() {
  const c = audioCtx();
  if (!c) return;
  const now = c.currentTime;
  [[660, 0], [880, 0.11]].forEach(([f, t]) => {
    const o = c.createOscillator(); const g = c.createGain();
    o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, now + t);
    g.gain.exponentialRampToValueAtTime(0.12, now + t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.12);
    o.connect(g).connect(c.destination);
    o.start(now + t); o.stop(now + t + 0.14);
  });
}

/**
 * Calls onVoice() when the learner starts speaking while `active` (she is
 * talking). Uses the microphone with echo cancellation, learns the room's
 * noise level for half a second, then needs a clear, sustained voice
 * (about a third of a second well above it) so her own voice and small
 * sounds do not trigger it.
 */
export function useBargeIn({ active, onVoice }) {
  const cb = useRef(onVoice);
  cb.current = onVoice;
  useEffect(() => {
    if (!active || !navigator.mediaDevices?.getUserMedia) return undefined;
    let stream = null; let raf = 0; let stopped = false; let source = null;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      } catch { return; }
      if (stopped) { stream.getTracks().forEach(t => t.stop()); return; }
      const c = audioCtx(); if (!c) return;
      source = c.createMediaStreamSource(stream);
      const an = c.createAnalyser(); an.fftSize = 1024;
      source.connect(an);
      const buf = new Float32Array(an.fftSize);
      const started = performance.now();
      let floor = 0.01; let samples = 0; let loudSince = 0;
      const tick = () => {
        if (stopped) return;
        an.getFloatTimeDomainData(buf);
        let sum = 0; for (let i = 0; i < buf.length; i += 1) sum += buf[i] * buf[i];
        const rms = Math.sqrt(sum / buf.length);
        const t = performance.now();
        if (t - started < 500) { floor = (floor * samples + rms) / (samples + 1); samples += 1; }
        else if (rms > Math.max(0.05, floor * 4)) { if (!loudSince) loudSince = t; else if (t - loudSince > 350) { stopped = true; cb.current?.(); return; } }
        else loudSince = 0;
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    })();
    return () => { stopped = true; cancelAnimationFrame(raf); source?.disconnect(); stream?.getTracks().forEach(t => t.stop()); };
  }, [active]);
}

// Short utterances only (up to six words), so a real answer that happens to
// contain "again" is never mistaken for a command.
const COMMANDS = [
  ['repeat', /^(please )?(repeat|say (it|that) again|again|once more|pardon)\b|మళ్ళీ చెప్ప|మళ్ళీ|ఇంకోసారి|फिर से|दोबारा|दुबारा/i],
  ['slower', /\b(slower|slow down|more slowly)\b|నెమ్మదిగా|మెల్లగా|धीरे/i],
  ['english', /\b(in english|english please|say it in english)\b|ఇంగ్లీష్|ఇంగ్లిష్|అంగ్లంలో|अंग्रेज़ी|अंग्रेजी|इंग्लिश/i],
  ['example', /\b(give (me )?an example|example please|for example)\b|ఉదాహరణ|उदाहरण/i],
  ['ready', /\b(i'?m ready|ready for (the )?(test|check)|test me|check me)\b|పరీక్షకు సిద్ధం|టెస్ట్ పెట్టండి|టెస్ట్|टेस्ट|परीक्षा के लिए तैयार|तैयार हूँ/i]
];
/** @returns {'repeat'|'slower'|'english'|'example'|'ready'|null} */
export function parseVoiceCommand(text) {
  const t = String(text || '').trim();
  if (!t || t.split(/\s+/).length > 6) return null;
  return (COMMANDS.find(([, re]) => re.test(t)) || [null])[0];
}

export const FILLER = { 'te-IN': 'ఒక్క క్షణం…', 'hi-IN': 'एक पल…', 'en-IN': 'One moment…' };
