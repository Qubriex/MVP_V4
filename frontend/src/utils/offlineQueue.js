// src/utils/offlineQueue.js
// Low-bandwidth mode (v4.3 §19): heartbeats and doubts made while offline are
// queued on the device with their ORIGINAL timestamps and sent when the
// connection returns. Lesson turns and checks are never queued — checks need
// a live connection because instances are generated server-side.
import api from './api';

const KEY = 'qubirex_offline_queue_v1';
const MAX = 500;

function read() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}
function write(items) {
  try { localStorage.setItem(KEY, JSON.stringify(items.slice(-MAX))); } catch { /* storage full or blocked */ }
}

export const queued = () => read().length;

/** kind: 'heartbeat' | 'doubt'; body carries its own occurred_at. */
export function enqueue(kind, body) {
  write([...read(), { kind, body, queued_at: new Date().toISOString() }]);
}

const isNetworkError = (e) => !e.response;

let flushing = false;
/** Send everything queued. Heartbeats go as one batch; doubts one by one. */
export async function flush() {
  if (flushing || !navigator.onLine) return 0;
  flushing = true;
  let sent = 0;
  try {
    let items = read();
    const beats = items.filter(i => i.kind === 'heartbeat');
    if (beats.length) {
      try {
        await api.post('/learner/session/heartbeat', { beats: beats.map(b => b.body) });
        sent += beats.length;
        items = items.filter(i => i.kind !== 'heartbeat');
        write(items);
      } catch (e) { if (isNetworkError(e)) return sent; items = items.filter(i => i.kind !== 'heartbeat'); write(items); }
    }
    for (const item of read().filter(i => i.kind === 'doubt')) {
      try {
        await api.post('/learner/doubts', item.body);
      } catch (e) { if (isNetworkError(e)) break; }
      write(read().filter(i => i !== item && !(i.kind === 'doubt' && i.queued_at === item.queued_at)));
      sent += 1;
    }
  } finally {
    flushing = false;
  }
  return sent;
}

/** Post now, or queue if the network is down. Returns 'sent' | 'queued'. */
export async function sendOrQueue(kind, path, body) {
  if (navigator.onLine) {
    try { await api.post(path, body); return 'sent'; } catch (e) { if (!isNetworkError(e)) throw e; }
  }
  enqueue(kind, body);
  return 'queued';
}

if (typeof window !== 'undefined') window.addEventListener('online', () => { flush(); });
