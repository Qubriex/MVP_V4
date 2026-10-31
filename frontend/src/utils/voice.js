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
import { pronounce } from './pronounce';
import { codeSpeech } from './codeSpeech';

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

// Sentences grouped into parts of about 400 characters (a short first part
// so speech starts quickly). Each part is one voice request; the next part
// downloads while the current one plays. Smaller parts come back faster.
/** The parts a reply is spoken in (for highlighting the part being spoken). */
export const speechParts = (text) => parts(speakable(text));
function parts(text, firstMax = 180, max = 400) {
  const sentences = text.match(/[^.!?।\n]+[.!?।]*\s*/g)?.map(x => x.trim()).filter(Boolean) || [];
  const out = [];
  let cur = '';
  for (const s of sentences) {
    const limit = out.length ? max : firstMax;
    if (cur && (cur.length + s.length + 1) > limit) { out.push(cur); cur = s; } else cur = cur ? `${cur} ${s}` : s;
  }
  if (cur) out.push(cur);
  return out.flatMap(p => (p.length > 600 ? p.match(/[\s\S]{1,500}(\s|$)/g).map(x => x.trim()) : [p]));
}

// ─── One audio element for the whole visit ─────────────────────────────────
// iPhone Safari blocks audio that starts long after a tap (a reply that takes
// 10–20 s). Playing a silent clip on the same element during a tap unlocks
// it, so later replies on that element are allowed to play.
const SILENCE = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
let player = null;
let unlocked = false;
function getPlayer() {
  if (!player && typeof Audio !== 'undefined') { player = new Audio(); player.preload = 'auto'; }
  return player;
}
function unlockAudio() {
  const p = getPlayer();
  if (!p || unlocked || !p.paused) return;
  p.src = SILENCE;
  try { Promise.resolve(p.play()).then(() => { unlocked = true; }).catch(() => {}); } catch { /* play() unsupported */ }
}
if (typeof document !== 'undefined') {
  ['pointerdown', 'keydown', 'touchend'].forEach(ev => document.addEventListener(ev, unlockAudio, { capture: true, passive: true }));
}

// ─── Server voice (/learner/tts) ───────────────────────────────────────────
// Only "not configured" (503) turns it off for the page visit. A busy voice
// (429) or a network error is retried once after a short wait; a long wait
// is not worth it mid-lesson, so the reply is shown as text instead.
let serverVoice = true;
export const usingServerVoice = () => serverVoice;
// The phone's own voice is robotic in Telugu and Hindi, so it is used only
// when the learner chose it in Settings ("Use my phone's voice"). Otherwise a
// lesson she cannot speak is read as text, with a notice.
let deviceVoice = false;
export const setDeviceVoice = (on) => { deviceVoice = !!on; };
export const deviceVoiceChosen = () => deviceVoice;
const audioCache = new Map(); // lang|text → object URL
const wait = (ms) => new Promise(r => setTimeout(r, ms));
async function fetchAudio(text, lang, isCurrent) {
  const key = `${lang || ''}|${text}`;
  if (audioCache.has(key)) return audioCache.get(key);
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const res = await api.post('/learner/tts', { text, ...(lang ? { lang } : {}) }, { responseType: 'blob', timeout: 30000 });
      const url = URL.createObjectURL(res.data);
      audioCache.set(key, url);
      if (audioCache.size > 60) { const [k, u] = audioCache.entries().next().value; URL.revokeObjectURL(u); audioCache.delete(k); }
      return url;
    } catch (err) {
      lastErr = err;
      const status = err.response?.status;
      if (status === 503) { serverVoice = false; break; }
      if ([400, 401, 413].includes(status) || !isCurrent()) break;
      const after = Number(err.response?.headers?.['retry-after']) || 0;
      if (status === 429 && after > 6) break;
      await wait(status === 429 ? Math.min(Math.max(after, 1), 3) * 1000 : 800);
      if (!isCurrent()) break;
    }
  }
  throw lastErr;
}

// Speed telemetry (admin → Quality): time to first audio and, when the page
// passes when the learner finished their turn, the whole turn.
function reportVoiceMetric(body) {
  api.post('/learner/voice-metrics', body).catch(() => {});
}

// Translation keys for why she is silent (components/learn/VoiceStatus.js).
export const VOICE_ISSUE = { busy: 'voice.issue.busy', tap: 'voice.issue.tap', none: 'voice.issue.none', text: 'voice.issue.text' };

/**
 * @param {{ lang?: string, rate?: number, server?: boolean }} opts
 * speak(text, id, { lang, rate, onEnd, turnStartedAt, quiet }) — lang 'en-IN'
 * speaks English (captions) in the same voice; quiet skips metrics/notices.
 */
export function useSpeechOutput({ lang = 'te-IN', rate = 1, server = true } = {}) {
  const [speakingId, setSpeakingId] = useState(null);
  const [paused, setPaused] = useState(false);
  const [issue, setIssue] = useState(serverVoice ? '' : 'none');
  const [part, setPart] = useState(null); // { id, index, text } — the part being spoken
  const runRef = useRef(0);
  const lastRef = useRef(null);
  const usingPlayer = useRef(false);

  // Voices load asynchronously on some browsers; re-render once they arrive.
  const [, setVoicesReady] = useState(0);
  useEffect(() => {
    if (!synth) return undefined;
    const onVoices = () => setVoicesReady(n => n + 1);
    synth.addEventListener?.('voiceschanged', onVoices);
    return () => { synth.removeEventListener?.('voiceschanged', onVoices); synth.cancel(); };
  }, []);
  useEffect(() => () => { runRef.current += 1; if (usingPlayer.current) player?.pause(); }, []);

  const stop = useCallback(() => {
    runRef.current += 1;
    if (usingPlayer.current && player) { player.pause(); usingPlayer.current = false; }
    if (synth) synth.cancel();
    setSpeakingId(null);
    setPaused(false);
    setPart(null);
  }, []);

  // The phone's voice, only when chosen in Settings and only a female one;
  // otherwise the reply stays as text with a notice.
  const speakBrowser = useCallback((text, run, opts) => {
    const l = opts.lang || lang;
    const voice = deviceVoice && synth ? pickVoice(l) : null;
    if (!voice) {
      if (runRef.current === run) { setSpeakingId(null); setPart(null); if (!opts.quiet) setIssue(deviceVoice ? (serverVoice ? 'busy' : 'none') : 'text'); }
      return;
    }
    const chunks = parts(pronounce(text, l), 200, 240);
    chunks.forEach((p, i) => {
      const u = new SpeechSynthesisUtterance(p);
      u.lang = l;
      u.rate = opts.rate || rate;
      u.voice = voice;
      u.onstart = () => { if (runRef.current === run) setPart({ id: opts.id, index: i, text: p }); };
      if (i === chunks.length - 1) {
        u.onend = () => { if (runRef.current === run) { setSpeakingId(null); setPaused(false); setPart(null); opts.onEnd?.(); } };
      }
      u.onerror = () => { if (runRef.current === run && i === chunks.length - 1) { setSpeakingId(null); setPart(null); } };
      synth.speak(u);
    });
  }, [lang, rate]);

  const speak = useCallback(async (text, id = 'current', opts = {}) => {
    const clean = speakable(text);
    if (!clean) return;
    stop();
    const run = runRef.current;
    const isCurrent = () => runRef.current === run;
    const l = opts.lang || lang;
    const o = { ...opts, id, lang: l };
    if (!opts.quiet) { lastRef.current = { text, id, opts }; setIssue(''); }
    setSpeakingId(id);
    if (!(server && serverVoice)) { speakBrowser(clean, run, o); return; }
    const spoken = pronounce(clean, l);
    const chunks = parts(spoken);
    const shown = parts(clean); // same sentence boundaries, without spelling changes
    // Spoken in the language of the text: the learning language, or English captions.
    const ttsLang = l.startsWith('en') ? 'english' : l.startsWith('hi') ? 'hindi' : 'telugu';
    const t0 = Date.now();
    let next = fetchAudio(chunks[0], ttsLang, isCurrent);
    const p = getPlayer();
    for (let i = 0; i < chunks.length; i += 1) {
      let url;
      try { url = await next; } catch {
        if (!isCurrent()) return;
        speakBrowser(shown.slice(i).join(' '), run, o);
        return;
      }
      if (!isCurrent()) return;
      if (i + 1 < chunks.length) { next = fetchAudio(chunks[i + 1], ttsLang, isCurrent); next.catch(() => {}); }
      usingPlayer.current = true;
      p.src = url;
      p.playbackRate = opts.rate || rate;
      setPart({ id, index: i, text: shown[i] || chunks[i] });
      try {
        await new Promise((resolve, reject) => {
          p.onended = resolve;
          p.onerror = reject;
          p.play().then(() => {
            if (i === 0 && !opts.quiet) {
              const firstMs = Date.now() - t0;
              reportVoiceMetric({ first_audio_ms: firstMs, ...(opts.turnStartedAt ? { turn_ms: Date.now() - opts.turnStartedAt } : {}), chars: clean.length });
            }
          }).catch(reject);
        });
      } catch (err) {
        if (!isCurrent()) return;
        if (err?.name === 'NotAllowedError') {
          // Blocked until the learner taps: keep her voice and offer Replay.
          setSpeakingId(null); setPart(null);
          if (!opts.quiet) setIssue('tap');
          return;
        }
        speakBrowser(shown.slice(i).join(' '), run, o);
        return;
      }
      if (!isCurrent()) return;
    }
    if (isCurrent()) { usingPlayer.current = false; setSpeakingId(null); setPaused(false); setPart(null); opts.onEnd?.(); }
  }, [lang, rate, server, stop, speakBrowser]);

  const replay = useCallback(() => {
    const last = lastRef.current;
    if (last) speak(last.text, last.id, last.opts);
  }, [speak]);

  const pause = useCallback(() => {
    if (usingPlayer.current && player && !player.paused) { player.pause(); setPaused(true); return; }
    if (synth && synth.speaking) { synth.pause(); setPaused(true); }
  }, []);
  const resume = useCallback(() => {
    if (usingPlayer.current && player && player.paused) { player.play().catch(() => {}); setPaused(false); return; }
    if (synth) { synth.resume(); setPaused(false); }
  }, []);
  const setRate = useCallback((r) => { if (usingPlayer.current && player) player.playbackRate = r; }, []);

  return {
    speak, stop, pause, resume, replay, setRate, speakingId, paused, part,
    issue, voiceIssueKey: issue ? VOICE_ISSUE[issue] : '', hasLast: () => !!lastRef.current,
    supported: canSpeak || typeof Audio !== 'undefined'
  };
}

// ─── "Walk me through it": one clip per code line ──────────────────────────
// Every line's clip is fetched (and cached) before the first one plays, then
// the clips play one after another on the one audio element, so two lines can
// never overlap. The highlight moves when a clip actually starts. A line whose
// audio failed keeps its highlight and shows its text; Next moves on.
// state: idle | preparing | playing | paused | text
export function useLineWalk({ lang = 'te-IN', rate = 1 } = {}) {
  const [state, setState] = useState('idle');
  const [index, setIndex] = useState(-1);
  const clips = useRef([]);
  const runRef = useRef(0);
  const rateRef = useRef(rate);
  rateRef.current = rate;
  const ttsLang = lang.startsWith('en') ? 'english' : lang.startsWith('hi') ? 'hindi' : 'telugu';

  const halt = () => { runRef.current += 1; const p = getPlayer(); if (p) { p.onended = null; p.onplaying = null; p.onerror = null; p.pause(); } };
  useEffect(() => halt, []);

  const playAt = useCallback((i) => {
    halt();
    const run = runRef.current;
    const mine = () => runRef.current === run;
    if (i < 0 || i >= clips.current.length) { setState('idle'); setIndex(-1); return; }
    const url = clips.current[i];
    const p = getPlayer();
    if (!url || !p) { setIndex(i); setState('text'); return; }
    p.src = url;
    p.playbackRate = rateRef.current;
    p.onplaying = () => { if (mine()) { setIndex(i); setState('playing'); } };
    p.onended = () => { if (mine()) setTimeout(() => { if (mine()) playAt(i + 1); }, 250); };
    p.onerror = () => { if (mine()) { setIndex(i); setState('text'); } };
    Promise.resolve(p.play()).catch(err => {
      if (!mine()) return;
      setIndex(i);
      setState(err?.name === 'NotAllowedError' ? 'paused' : 'text');
    });
  }, []);

  /** @param {string[]} notes the line notes, in order */
  const start = useCallback(async (notes) => {
    halt();
    const run = runRef.current;
    setState('preparing'); setIndex(-1);
    const spoken = notes.map(n => pronounce(speakable(codeSpeech(n)), lang));
    const urls = new Array(spoken.length).fill(null);
    if (serverVoice) {
      let next = 0;
      const worker = async () => {
        while (next < spoken.length && runRef.current === run) {
          const k = next; next += 1;
          try { urls[k] = await fetchAudio(spoken[k], ttsLang, () => runRef.current === run); } catch { urls[k] = null; }
        }
      };
      await Promise.all([worker(), worker(), worker()]);
    }
    if (runRef.current !== run) return;
    clips.current = urls;
    playAt(0);
  }, [lang, ttsLang, playAt]);

  const pause = useCallback(() => { const p = getPlayer(); if (p && !p.paused) { p.pause(); setState('paused'); } }, []);
  const resume = useCallback(() => {
    const p = getPlayer();
    if (!p || !clips.current[index]) return;
    Promise.resolve(p.play()).then(() => setState('playing')).catch(() => setState('text'));
  }, [index]);
  const stop = useCallback(() => { halt(); setState('idle'); setIndex(-1); }, []);

  return {
    state, index, start, pause, resume, stop,
    active: state !== 'idle',
    next: () => playAt(index + 1),
    prev: () => playAt(Math.max(0, index - 1)),
    replay: () => playAt(Math.max(0, index)),
    // Used by the Playwright check: false when no clip could be made.
    hasAudio: () => clips.current.some(Boolean)
  };
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
