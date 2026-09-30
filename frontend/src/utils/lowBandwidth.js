// src/utils/lowBandwidth.js
// Low-bandwidth mode (v4.3 §19): text-first lessons (no automatic speech),
// voice uploaded as Opus at 16 kbps, the next two lessons' outlines cached on
// the device, heartbeats and doubts queued offline. Suggested automatically
// when the browser reports Save-Data or a 2G connection.
import { useEffect, useState } from 'react';

const KEY = 'qubirex_low_bandwidth';

export function slowConnection() {
  const c = typeof navigator !== 'undefined' && navigator.connection;
  return !!(c && (c.saveData || ['slow-2g', '2g'].includes(c.effectiveType)));
}

export function isLowBandwidth() {
  try {
    const v = localStorage.getItem(KEY);
    if (v != null) return v === '1';
  } catch { /* storage blocked */ }
  return slowConnection();
}

export function setLowBandwidth(on) {
  try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* storage blocked */ }
  window.dispatchEvent(new Event('qubirex-lowbw'));
}

export function useLowBandwidth() {
  const [on, setOn] = useState(isLowBandwidth);
  useEffect(() => {
    const update = () => setOn(isLowBandwidth());
    window.addEventListener('qubirex-lowbw', update);
    return () => window.removeEventListener('qubirex-lowbw', update);
  }, []);
  return [on, setLowBandwidth];
}

/** MediaRecorder options: Opus at 16 kbps in low-bandwidth mode, 32 kbps otherwise. */
export function recorderOptions(lowBandwidth) {
  const opus = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus'].find(t => window.MediaRecorder?.isTypeSupported?.(t));
  const opts = { audioBitsPerSecond: lowBandwidth ? 16000 : 32000 };
  if (opus) opts.mimeType = opus;
  return opts;
}

// Outline cache: the next two lessons' titles, objectives and a short summary,
// so a learner on a weak connection can review what is coming while offline.
const CACHE = 'qubirex_node_outlines_v1';
export function cacheOutlines(outlines) {
  try { localStorage.setItem(CACHE, JSON.stringify({ at: new Date().toISOString(), outlines })); } catch { /* ignore */ }
}
export function cachedOutlines() {
  try { return JSON.parse(localStorage.getItem(CACHE) || 'null'); } catch { return null; }
}
