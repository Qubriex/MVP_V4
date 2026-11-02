// core/ai/keyPool.js — the only place that reads the Gemini keys.
//
// Three keys, each with its own job, so voice and text never use up each
// other's limits:
//   GEMINI_API_KEY    slot 1 — text (tutor, checks, Ask Qubirex, helpers)
//   GEMINI_API_KEY_2  slot 2 — voice (spoken replies, transcribing speech)
//   GEMINI_API_KEY_3  slot 3 — backup for both, used only when the main key
//                              for that job fails or does not answer
// GEMINI_API_KEYS (comma-separated) replaces the three when set. Empty slots
// are skipped; with a single key everything works as before.
//
// withGeminiKey(fn, { purpose }) runs fn(apiKey, { slot }) on the job's main
// key and moves on to the backup when another key could help:
//   401 / 403 / "API key not valid…" → slot disabled for 30 min, next key now
//   429                              → slot cooling for Retry-After (60 s), next key now
//   5xx / timeout / network          → same key once more after ~500 ms, then next key
//   400 / 404 / anything else        → no switch (another key gets the same answer)
// When no key can answer, it throws ai_unavailable (503) and the callers show
// the friendly "busy" message or the scripted / cached content.
//
// A key is only ever named as slot N plus a fingerprint (first 6 hex of its
// SHA-256). Key values are never logged, returned or put in errors.
import crypto from 'crypto';
import { logger } from '../logger.js';

const DISABLED_MS = 30 * 60 * 1000;
const COOL_MS = 60 * 1000;
const ROLE = { text: [1, 3], voice: [2, 3] };
const BUDGET = { text: 25000, voice: 40000 };

/** The configured slots: [{ slot, key, fingerprint }] (missing slots left out). */
function slots() {
  const list = process.env.GEMINI_API_KEYS
    ? process.env.GEMINI_API_KEYS.split(',').map(s => s.trim())
    : [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY_2, process.env.GEMINI_API_KEY_3];
  return list.slice(0, 3).map((key, i) => ({ slot: i + 1, key: (key || '').trim() }))
    .filter(s => s.key)
    .map(s => ({ ...s, fingerprint: fingerprint(s.key) }));
}
export const fingerprint = (key) => crypto.createHash('sha256').update(String(key)).digest('hex').slice(0, 6);

/** True when at least one key is set. */
export const hasGeminiKey = () => slots().length > 0;

// Slot health, per instance: slot → { status, until, lastError, lastErrorAt, fingerprint }.
const health = new Map();
let lastServed = null;
const failovers = []; // times of failovers in the last 24 h
export const _resetKeyPool = () => { health.clear(); failovers.length = 0; lastServed = null; };

function usable(s, now = Date.now()) {
  const h = health.get(s.slot);
  if (!h || h.fingerprint !== s.fingerprint) return true; // a replaced key starts healthy
  return !(h.until > now);
}
function mark(s, status, ms, code) {
  health.set(s.slot, { status, until: Date.now() + ms, lastError: code, lastErrorAt: new Date().toISOString(), fingerprint: s.fingerprint });
}

/**
 * The order to try keys in for a job: its main key, then the backup. If
 * neither is set (a one-key setup), any key that is set.
 */
function orderFor(purpose) {
  const all = slots();
  const want = (ROLE[purpose] || ROLE.text).map(n => all.find(s => s.slot === n)).filter(Boolean);
  const seen = new Set();
  return (want.length ? want : all).filter(s => (seen.has(s.key) ? false : seen.add(s.key)));
}

const statusOf = (err) => err?.upstreamStatus || err?.status || null;
const KEY_PROBLEM = /api key (not valid|expired|disabled|restricted|invalid)|API_KEY_INVALID|permission denied/i;
const wait = (ms) => new Promise(r => setTimeout(r, ms));

function classify(err) {
  const st = statusOf(err);
  if (st === 401 || st === 403 || KEY_PROBLEM.test(String(err?.message || ''))) return 'invalid';
  if (st === 429) return 'limit';
  if (!st || st >= 500 || err?.name === 'AbortError' || /timeout|ETIMEDOUT|ECONNRESET|fetch failed/i.test(String(err?.message || ''))) return 'transient';
  return 'request'; // 400, 404, safety block…: the same on every key
}

/**
 * Run fn with the job's key, failing over to the backup.
 * @template T
 * @param {(apiKey: string, info: { slot: number }) => Promise<T>} fn
 * @param {{ purpose?: 'text'|'voice', label?: string, budgetMs?: number }} [opts]
 * @returns {Promise<T>}
 */
export async function withGeminiKey(fn, { purpose = 'text', label = purpose, budgetMs } = {}) {
  const order = orderFor(purpose);
  if (!order.length) throw Object.assign(new Error('GEMINI_API_KEY is not set'), { status: 503 });
  const started = Date.now();
  const budget = budgetMs || BUDGET[purpose] || BUDGET.text;
  let last = null;
  let from = null;
  for (const s of order) {
    if (!usable(s)) continue;
    if (from && from !== s.slot) {
      failovers.push(Date.now());
      logger.warn('ai_failover', { from, to: s.slot, reason: statusOf(last) || 'network', purpose: label });
    }
    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (Date.now() - started > budget) break;
      try {
        const out = await fn(s.key, { slot: s.slot });
        lastServed = { slot: s.slot, purpose, at: new Date().toISOString() };
        if (health.get(s.slot)?.fingerprint === s.fingerprint) health.delete(s.slot);
        return out;
      } catch (err) {
        last = err;
        const kind = classify(err);
        if (kind === 'request') throw err;
        if (kind === 'invalid') { mark(s, 'disabled', DISABLED_MS, statusOf(err) || 'key'); logger.warn('key_invalid', { slot: s.slot, fingerprint: s.fingerprint }); break; }
        if (kind === 'limit') { mark(s, 'cooling', (Number(err.retryAfter) || COOL_MS / 1000) * 1000, 429); break; }
        if (attempt === 0) { await wait(400 + Math.floor(Math.random() * 200)); continue; }
        health.set(s.slot, { ...(health.get(s.slot) || { status: 'ok', until: 0 }), lastError: statusOf(err) || 'network', lastErrorAt: new Date().toISOString(), fingerprint: s.fingerprint });
      }
    }
    from = s.slot;
  }
  // Nothing answered. A rate limit stays a 429 with the wait, so the voice
  // player waits and retries (a 503 would switch the voice off for the visit);
  // voice otherwise answers 502, text the usual "AI busy" 503.
  const now = Date.now();
  const resting = order.map(s => health.get(s.slot)).filter(h => h && h.until > now && h.status === 'cooling');
  const limited = statusOf(last) === 429 || (!last && resting.length);
  const status = limited ? 429 : purpose === 'voice' ? 502 : 503;
  const out = Object.assign(new Error('The AI is busy. Please try again in a minute.'), { status, code: 'ai_unavailable', upstreamStatus: statusOf(last) || undefined });
  const waitS = last?.retryAfter || (resting.length ? Math.ceil((Math.min(...resting.map(h => h.until)) - now) / 1000) : null);
  if (limited && waitS) out.retryAfter = Math.max(1, waitS);
  throw out;
}

/** For /api/health and the admin card: slots, fingerprints and status. Never key values. */
export function keyStatus() {
  const set = new Map(slots().map(s => [s.slot, s]));
  const now = Date.now();
  while (failovers.length && failovers[0] < now - 86400000) failovers.shift();
  return {
    roles: { 1: 'text', 2: 'voice', 3: 'backup' },
    slots: [1, 2, 3].map((n) => {
      const s = set.get(n);
      if (!s) return { slot: n, status: 'missing' };
      const h = health.get(n);
      const current = h && h.fingerprint === s.fingerprint ? h : null;
      const status = current && current.until > now ? current.status : 'ok';
      return { slot: n, fingerprint: s.fingerprint, status, until: status === 'ok' ? null : new Date(current.until).toISOString(), last_error: current?.lastError ?? null, last_error_at: current?.lastErrorAt ?? null };
    }),
    failovers_24h: failovers.length,
    last_served: lastServed
  };
}
