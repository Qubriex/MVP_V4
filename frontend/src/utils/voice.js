// src/utils/voice.js
// ─────────────────────────────────────────────────────────────────────────────
// Browser voice I/O for the learner side.
//
// Speech OUT — useSpeechOutput(): Professor Qubirex's own female voice from
// the server (/learner/tts, Gemini text-to-speech), part by part with the next
// part prefetched; the browser's speechSynthesis (female voice preferred) when
// the server voice is unavailable. Pause, resume, replay and rate work in
// both. `hasVoiceFor()` tells the page when the browser has no voice at all.
//
// Speech IN — useSpeechInput(): on-device SpeechRecognition when the browser
// has it (Chrome/Edge/Android), giving live interim text. Otherwise it
// records with MediaRecorder and hands back an audio Blob, which the page
// posts to the server for transcription (/learner/session/voice or
// /learner/transcribe). Typing is always available as the last fallback.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState } from 'react';
import api from './api';

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

// Professor Qubirex speaks with a woman's voice (docs/AI-VOICE-SPEC.md).
// Browser fallback: prefer voices known or named as female, avoid male ones.
const FEMALE = /female|woman|shruti|swara|heera|kalpana|neerja|aditi|raveena|veena|lekha|zira|samantha|karen|moira|tessa|google/i;
const MALE = /\bmale\b|mohan|madhur|hemant|ravi|prabhat|david|mark|guy|daniel|rishi/i;

function pickVoice(bcp47, variant) {
  const base = bcp47.split('-')[0];
  const matches = synth.getVoices().filter(v => v.lang && v.lang.toLowerCase().startsWith(base));
  if (!matches.length) return null;
  const score = (v) => (FEMALE.test(v.name) ? 2 : 0) - (MALE.test(v.name) && !/female/i.test(v.name) ? 3 : 0) + (v.localService ? 0 : 1);
  const ranked = [...matches].sort((a, b) => score(b) - score(a));
  return variant === 'B' && ranked[1] && score(ranked[1]) >= score(ranked[0]) - 1 ? ranked[1] : ranked[0];
}

// What is said aloud: no markdown or symbols, and no English glosses in
// brackets inside Telugu/Hindi text — switching languages mid-sentence is
// what makes a voice stumble.
export function speakable(text) {
  let t = String(text || '');
  const native = /[ऀ-ॿఀ-౿]/.test(t);
  if (native) t = t.replace(/\s*\(([A-Za-z0-9 ,.'’&/-]+)\)/g, '');
  return t
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/[*_#>|~]+/g, ' ')
    .replace(/[()[\]{}"“”]/g, ' ')
    .replace(/\s*[→←↔⇒]\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Sentences grouped into parts: a short first part so speech starts quickly,
// then larger parts, so there are few gaps between them.
function parts(text, firstMax = 220, max = 480) {
  const sentences = text.match(/[^.!?।\n]+[.!?।]*\s*/g)?.map(x => x.trim()).filter(Boolean) || [];
  const out = [];
  let cur = '';
  for (const s of sentences) {
    const limit = out.length ? max : firstMax;
    if (cur && (cur.length + s.length + 1) > limit) { out.push(cur); cur = s; } else cur = cur ? `${cur} ${s}` : s;
  }
  if (cur) out.push(cur);
  return out;
}

// Server voice (Gemini TTS through /learner/tts). Turned off for the rest of
// the page visit after a failure, so a missing key costs one request only.
let serverVoice = true;
export const usingServerVoice = () => serverVoice;
const audioCache = new Map(); // `${variant}|${text}` → object URL
async function fetchAudio(text, variant) {
  const key = `${variant}|${text}`;
  if (audioCache.has(key)) return audioCache.get(key);
  const res = await api.post('/learner/tts', { text, variant }, { responseType: 'blob', timeout: 45000 });
  const url = URL.createObjectURL(res.data);
  audioCache.set(key, url);
  if (audioCache.size > 40) { const [k, u] = audioCache.entries().next().value; URL.revokeObjectURL(u); audioCache.delete(k); }
  return url;
}

export function useSpeechOutput({ lang = 'te-IN', rate = 1, variant = 'A', server = true } = {}) {
  const [speakingId, setSpeakingId] = useState(null);
  const [paused, setPaused] = useState(false);
  const runRef = useRef(0);
  const audioRef = useRef(null);

  // Voices load asynchronously on some browsers; re-render once they arrive.
  const [, setVoicesReady] = useState(0);
  useEffect(() => {
    if (!synth) return undefined;
    const onVoices = () => setVoicesReady(n => n + 1);
    synth.addEventListener?.('voiceschanged', onVoices);
    return () => { synth.removeEventListener?.('voiceschanged', onVoices); synth.cancel(); };
  }, []);
  useEffect(() => () => { runRef.current += 1; audioRef.current?.pause(); }, []);

  const stop = useCallback(() => {
    runRef.current += 1;
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    if (synth) synth.cancel();
    setSpeakingId(null);
    setPaused(false);
  }, []);

  const speakBrowser = useCallback((chunks, run, opts) => {
    if (!synth || !chunks.length) { if (runRef.current === run) setSpeakingId(null); return; }
    const voice = pickVoice(opts.lang || lang, opts.variant || variant);
    chunks.forEach((part, i) => {
      const u = new SpeechSynthesisUtterance(part);
      u.lang = opts.lang || lang;
      u.rate = opts.rate || rate;
      u.pitch = 1.05;
      if (voice) u.voice = voice;
      if (i === chunks.length - 1) {
        u.onend = () => { if (runRef.current === run) { setSpeakingId(null); setPaused(false); opts.onEnd?.(); } };
      }
      u.onerror = () => { if (runRef.current === run && i === chunks.length - 1) setSpeakingId(null); };
      synth.speak(u);
    });
  }, [lang, rate, variant]);

  const speak = useCallback(async (text, id = 'current', opts = {}) => {
    const clean = speakable(text);
    if (!clean) return;
    stop();
    const run = runRef.current;
    const v = opts.variant || variant;
    setSpeakingId(id);
    const chunks = parts(clean);
    if (!(server && serverVoice)) { speakBrowser(parts(clean, 200, 240), run, opts); return; }
    // Server voice: play part i while part i+1 downloads.
    let next = fetchAudio(chunks[0], v);
    for (let i = 0; i < chunks.length; i += 1) {
      let url;
      try { url = await next; } catch (err) {
        if (runRef.current !== run) return;
        serverVoice = false; // e.g. 503 with no model key: use the browser voice from now on
        speakBrowser(parts(chunks.slice(i).join(' '), 200, 240), run, opts);
        return;
      }
      if (runRef.current !== run) return;
      if (i + 1 < chunks.length) { next = fetchAudio(chunks[i + 1], v); next.catch(() => {}); }
      const audio = new Audio(url);
      audio.playbackRate = opts.rate || rate;
      audioRef.current = audio;
      try {
        await new Promise((resolve, reject) => {
          audio.onended = resolve;
          audio.onerror = reject;
          audio.play().catch(reject);
        });
      } catch {
        if (runRef.current !== run) return;
        // Autoplay blocked or decode error: fall back for the rest.
        speakBrowser(parts(chunks.slice(i).join(' '), 200, 240), run, opts);
        return;
      }
      if (runRef.current !== run) return;
    }
    if (runRef.current === run) { audioRef.current = null; setSpeakingId(null); setPaused(false); opts.onEnd?.(); }
  }, [rate, variant, server, stop, speakBrowser]);

  const pause = useCallback(() => {
    if (audioRef.current && !audioRef.current.paused) { audioRef.current.pause(); setPaused(true); return; }
    if (synth && synth.speaking) { synth.pause(); setPaused(true); }
  }, []);
  const resume = useCallback(() => {
    if (audioRef.current && audioRef.current.paused) { audioRef.current.play().catch(() => {}); setPaused(false); return; }
    if (synth) { synth.resume(); setPaused(false); }
  }, []);

  return { speak, stop, pause, resume, speakingId, paused, supported: canSpeak || typeof Audio !== 'undefined' };
}

export function useSpeechInput({ lang = 'te-IN', onFinal, onAudio, recorder = undefined } = {}) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState('');
  const recRef = useRef(null);
  const finalRef = useRef('');
  const mediaRef = useRef(null);
  const handlers = useRef({ onFinal, onAudio, recorder });
  handlers.current = { onFinal, onAudio, recorder };

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
        let rec;
        try { rec = new MediaRecorder(stream, handlers.current.recorder); } catch { rec = new MediaRecorder(stream); }
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
