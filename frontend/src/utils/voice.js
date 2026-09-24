// src/utils/voice.js
// ─────────────────────────────────────────────────────────────────────────────
// Browser voice I/O for the learner side.
//
// Speech OUT — useSpeechOutput(): the browser's speechSynthesis, with pause,
// resume, replay and rate. Text is spoken sentence by sentence (Chrome cuts
// off long utterances). Telugu/Hindi voices ship with Android and most
// desktop Chrome builds; `hasVoiceFor()` tells the page when none exists so
// it can say captions only.
//
// Speech IN — useSpeechInput(): on-device SpeechRecognition when the browser
// has it (Chrome/Edge/Android), giving live interim text. Otherwise it
// records with MediaRecorder and hands back an audio Blob, which the page
// posts to the server for transcription (/learner/session/voice or
// /learner/transcribe). Typing is always available as the last fallback.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState } from 'react';

const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
const Recognition = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;

export const canSpeak = !!synth;
export const canRecognise = !!Recognition;
export const canRecord = typeof window !== 'undefined' && !!window.MediaRecorder && !!navigator.mediaDevices?.getUserMedia;

export function hasVoiceFor(bcp47) {
  if (!synth) return false;
  const base = bcp47.split('-')[0];
  return synth.getVoices().some(v => v.lang && v.lang.toLowerCase().startsWith(base));
}

function pickVoice(bcp47, variant) {
  const base = bcp47.split('-')[0];
  const matches = synth.getVoices().filter(v => v.lang && v.lang.toLowerCase().startsWith(base));
  if (!matches.length) return null;
  return variant === 'B' && matches[1] ? matches[1] : matches[0];
}

// Split on sentence ends (Latin and Devanagari danda) but keep them.
function chunk(text) {
  return String(text || '').match(/[^.!?।\n]+[.!?।]*\s*/g)?.map(s => s.trim()).filter(Boolean) || [];
}

export function useSpeechOutput({ lang = 'te-IN', rate = 1, variant = 'A' } = {}) {
  const [speakingId, setSpeakingId] = useState(null);
  const [paused, setPaused] = useState(false);
  const runRef = useRef(0);

  // Voices load asynchronously on some browsers; re-render once they arrive.
  const [, setVoicesReady] = useState(0);
  useEffect(() => {
    if (!synth) return undefined;
    const onVoices = () => setVoicesReady(n => n + 1);
    synth.addEventListener?.('voiceschanged', onVoices);
    return () => { synth.removeEventListener?.('voiceschanged', onVoices); synth.cancel(); };
  }, []);

  const stop = useCallback(() => {
    runRef.current += 1;
    if (synth) synth.cancel();
    setSpeakingId(null);
    setPaused(false);
  }, []);

  const speak = useCallback((text, id = 'current', opts = {}) => {
    if (!synth || !text) return;
    stop();
    const run = runRef.current;
    const parts = chunk(text);
    const voice = pickVoice(opts.lang || lang, variant);
    setSpeakingId(id);
    parts.forEach((part, i) => {
      const u = new SpeechSynthesisUtterance(part);
      u.lang = opts.lang || lang;
      u.rate = opts.rate || rate;
      if (voice) u.voice = voice;
      if (i === parts.length - 1) {
        u.onend = () => { if (runRef.current === run) { setSpeakingId(null); setPaused(false); opts.onEnd?.(); } };
      }
      u.onerror = () => { if (runRef.current === run && i === parts.length - 1) setSpeakingId(null); };
      synth.speak(u);
    });
  }, [lang, rate, variant, stop]);

  const pause = useCallback(() => { if (synth && synth.speaking) { synth.pause(); setPaused(true); } }, []);
  const resume = useCallback(() => { if (synth) { synth.resume(); setPaused(false); } }, []);

  return { speak, stop, pause, resume, speakingId, paused, supported: canSpeak };
}

export function useSpeechInput({ lang = 'te-IN', onFinal, onAudio } = {}) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState('');
  const recRef = useRef(null);
  const finalRef = useRef('');
  const mediaRef = useRef(null);
  const handlers = useRef({ onFinal, onAudio });
  handlers.current = { onFinal, onAudio };

  const start = useCallback(async () => {
    setError('');
    setInterim('');
    finalRef.current = '';
    if (Recognition) {
      const rec = new Recognition();
      rec.lang = lang;
      rec.interimResults = true;
      rec.continuous = true;
      rec.onresult = (e) => {
        let live = '';
        for (let i = e.resultIndex; i < e.results.length; i += 1) {
          if (e.results[i].isFinal) finalRef.current += e.results[i][0].transcript + ' ';
          else live += e.results[i][0].transcript;
        }
        setInterim((finalRef.current + live).trim());
      };
      rec.onerror = (e) => { if (e.error !== 'aborted' && e.error !== 'no-speech') setError(e.error === 'not-allowed' ? 'Microphone permission was blocked.' : 'Could not hear that. Try again or type.'); };
      rec.onend = () => {
        setListening(false);
        const text = finalRef.current.trim();
        setInterim('');
        if (text) handlers.current.onFinal?.(text);
      };
      recRef.current = rec;
      rec.start();
      setListening(true);
      return;
    }
    if (canRecord) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const rec = new MediaRecorder(stream);
        const chunks = [];
        rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
        rec.onstop = () => {
          stream.getTracks().forEach(tr => tr.stop());
          setListening(false);
          const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
          if (blob.size) handlers.current.onAudio?.(blob);
        };
        mediaRef.current = rec;
        rec.start();
        setListening(true);
      } catch (e) {
        setError('Microphone permission was blocked.');
      }
      return;
    }
    setError('Voice input is not available in this browser. Please type instead.');
  }, [lang]);

  const stop = useCallback(() => {
    if (recRef.current) { recRef.current.stop(); recRef.current = null; }
    if (mediaRef.current && mediaRef.current.state !== 'inactive') { mediaRef.current.stop(); mediaRef.current = null; }
  }, []);

  useEffect(() => () => {
    if (recRef.current) recRef.current.abort();
    if (mediaRef.current && mediaRef.current.state !== 'inactive') mediaRef.current.stop();
  }, []);

  return { start, stop, listening, interim, error, supported: canRecognise || canRecord, onDevice: canRecognise };
}
