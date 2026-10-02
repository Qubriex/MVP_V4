// src/utils/voice.js
// ─────────────────────────────────────────────────────────────────────────────
// Browser voice I/O for the learner side.
//
// Speech OUT — useSpeechOutput(): Professor Qubirex's own female voice from
// the server (/learner/tts, Google text-to-speech), part by part with the next
// part prefetched; the browser's speechSynthesis when
// the server voice is unavailable, and then only a female voice. Pause,
// resume, replay and rate work in both. `hasVoiceFor()` tells the page when
// the browser has no female voice to fall back on.
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

// Professor Qubirex has one voice, a woman's (docs/AI-VOICE-SPEC.md). The
// browser's own voices are used only when the server voice cannot be reached,
// and then only a voice known to be female; a device with none shows the
// reply as captions instead of switching to a different (often male) voice.
const FEMALE = /female|woman|shruti|swara|heera|kalpana|neerja|aditi|raveena|veena|lekha|zira|samantha|karen|moira|tessa|google (हिन्दी|हिंदी|uk english female|us english)/i;
const MALE = /\bmale\b|mohan|madhur|hemant|ravi|prabhat|david|mark|guy|daniel|rishi/i;
const isFemale = (v) => FEMALE.test(v.name) && !(MALE.test(v.name) && !/female/i.test(v.name));

function femaleVoices(bcp47) {
  if (!synth) return [];
  const base = bcp47.split('-')[0];
  return synth.getVoices().filter(v => v.lang && v.lang.toLowerCase().startsWith(base) && isFemale(v));
}

/** True when this browser has a female voice for the language (the fallback). */
export function hasVoiceFor(bcp47) {
  return femaleVoices(bcp47).length > 0;
}

function pickVoice(bcp47) {
  const ranked = femaleVoices(bcp47).sort((a, b) => (b.localService ? 0 : 1) - (a.localService ? 0 : 1));
  return ranked[0] || null;
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
// then large parts, so a whole reply is two or three requests at most.
function parts(text, firstMax = 260, max = 1200) {
  const sentences = text.match(/[^.!?।\n]+[.!?।]*\s*/g)?.map(x => x.trim()).filter(Boolean) || [];
  const out = [];
  let cur = '';
  for (const s of sentences) {
    const limit = out.length ? max : firstMax;
    if (cur && (cur.length + s.length + 1) > limit) { out.push(cur); cur = s; } else cur = cur ? `${cur} ${s}` : s;
  }
  if (cur) out.push(cur);
  return out.flatMap(p => (p.length > 1400 ? p.match(/[\s\S]{1,1400}(\s|$)/g).map(x => x.trim()) : [p]));
}

// Server voice (/learner/tts). Only "not configured" (503) turns it off for
// the page visit; a busy voice (429) or a network error is retried, so one
// bad moment never changes the voice for the rest of the lesson.
let serverVoice = true;
export const usingServerVoice = () => serverVoice;
const audioCache = new Map(); // text → object URL
const wait = (ms) => new Promise(r => setTimeout(r, ms));
async function fetchAudio(text, isCurrent) {
  const key = text;
  if (audioCache.has(key)) return audioCache.get(key);
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const res = await api.post('/learner/tts', { text }, { responseType: 'blob', timeout: 60000 });
      const url = URL.createObjectURL(res.data);
      audioCache.set(key, url);
      if (audioCache.size > 40) { const [k, u] = audioCache.entries().next().value; URL.revokeObjectURL(u); audioCache.delete(k); }
      return url;
    } catch (err) {
      lastErr = err;
      const status = err.response?.status;
      if (status === 503) { serverVoice = false; break; }
      if (status === 400 || status === 401 || status === 413) break;
      if (!isCurrent()) break;
      const after = Number(err.response?.headers?.['retry-after']) || 0;
      if (status === 429 && after > 20) break; // too long to wait mid-lesson
      await wait(status === 429 ? Math.max(after, 2) * 1000 : 1500);
      if (!isCurrent()) break;
    }
  }
  throw lastErr;
}

export function useSpeechOutput({ lang = 'te-IN', rate = 1, server = true } = {}) {
  const [speakingId, setSpeakingId] = useState(null);
  const [paused, setPaused] = useState(false);
  const [voiceIssue, setVoiceIssue] = useState('');
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

  // Browser fallback: female voice only, otherwise captions only.
  const speakBrowser = useCallback((text, run, opts) => {
    const voice = synth ? pickVoice(opts.lang || lang) : null;
    if (!voice) {
      if (runRef.current === run) { setSpeakingId(null); setVoiceIssue('The voice is busy right now, so this reply is shown as text. The next reply will be spoken again.'); }
      return;
    }
    const chunks = parts(text, 200, 240);
    chunks.forEach((part, i) => {
      const u = new SpeechSynthesisUtterance(part);
      u.lang = opts.lang || lang;
      u.rate = opts.rate || rate;
      u.voice = voice;
      if (i === chunks.length - 1) {
        u.onend = () => { if (runRef.current === run) { setSpeakingId(null); setPaused(false); opts.onEnd?.(); } };
      }
      u.onerror = () => { if (runRef.current === run && i === chunks.length - 1) setSpeakingId(null); };
      synth.speak(u);
    });
  }, [lang, rate]);

  const speak = useCallback(async (text, id = 'current', opts = {}) => {
    const clean = speakable(text);
    if (!clean) return;
    stop();
    const run = runRef.current;
    const isCurrent = () => runRef.current === run;
    setSpeakingId(id);
    setVoiceIssue('');
    if (!(server && serverVoice)) { speakBrowser(clean, run, opts); return; }
    const chunks = parts(clean);
    // Play part i while part i+1 downloads.
    let next = fetchAudio(chunks[0], isCurrent);
    for (let i = 0; i < chunks.length; i += 1) {
      let url;
      try { url = await next; } catch {
        if (!isCurrent()) return;
        speakBrowser(chunks.slice(i).join(' '), run, opts);
        return;
      }
      if (!isCurrent()) return;
      if (i + 1 < chunks.length) { next = fetchAudio(chunks[i + 1], isCurrent); next.catch(() => {}); }
      const audio = new Audio(url);
      audio.playbackRate = opts.rate || rate;
      audioRef.current = audio;
      try {
        await new Promise((resolve, reject) => {
          audio.onended = resolve;
          audio.onerror = reject;
          audio.play().catch(reject);
        });
      } catch (err) {
        if (!isCurrent()) return;
        if (err?.name === 'NotAllowedError') {
          // Autoplay blocked until the learner taps: keep her voice, ask for a tap.
          setSpeakingId(null);
          setVoiceIssue('Tap Replay to hear the reply.');
          return;
        }
        speakBrowser(chunks.slice(i).join(' '), run, opts);
        return;
      }
      if (!isCurrent()) return;
    }
    if (isCurrent()) { audioRef.current = null; setSpeakingId(null); setPaused(false); opts.onEnd?.(); }
  }, [rate, server, stop, speakBrowser]);

  const pause = useCallback(() => {
    if (audioRef.current && !audioRef.current.paused) { audioRef.current.pause(); setPaused(true); return; }
    if (synth && synth.speaking) { synth.pause(); setPaused(true); }
  }, []);
  const resume = useCallback(() => {
    if (audioRef.current && audioRef.current.paused) { audioRef.current.play().catch(() => {}); setPaused(false); return; }
    if (synth) { synth.resume(); setPaused(false); }
  }, []);

  return { speak, stop, pause, resume, speakingId, paused, voiceIssue, supported: canSpeak || typeof Audio !== 'undefined' };
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
