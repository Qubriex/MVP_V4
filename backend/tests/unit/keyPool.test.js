// The Gemini key pool: text on key 1, voice on key 2, key 3 as the backup for
// both, with failover when another key could help. Keys are fake and the
// calls are mocked; the real API is never called.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { withGeminiKey, keyStatus, hasGeminiKey, fingerprint, _resetKeyPool } from '../../core/ai/keyPool.js';
import { logger } from '../../core/logger.js';

const K1 = 'fake-text-key-111111';
const K2 = 'fake-voice-key-222222';
const K3 = 'fake-backup-key-333333';
const VARS = ['GEMINI_API_KEY', 'GEMINI_API_KEY_2', 'GEMINI_API_KEY_3', 'GEMINI_API_KEYS'];
const saved = {};
const err = (status, extra = {}) => Object.assign(new Error(`upstream ${status}`), { status, ...extra });
// A call that fails with the given errors for the given keys, then answers with the key's name.
const fake = (failures) => vi.fn(async (key) => {
  const queue = failures[key];
  if (queue && queue.length) throw queue.shift();
  return { servedBy: key };
});

let logs;
beforeEach(() => {
  VARS.forEach(v => { saved[v] = process.env[v]; delete process.env[v]; });
  process.env.GEMINI_API_KEY = K1; process.env.GEMINI_API_KEY_2 = K2; process.env.GEMINI_API_KEY_3 = K3;
  _resetKeyPool();
  logs = [];
  for (const level of ['info', 'warn', 'error']) vi.spyOn(logger, level).mockImplementation((msg, meta) => { logs.push(JSON.stringify([msg, meta])); });
});
afterEach(() => {
  VARS.forEach(v => { if (saved[v] === undefined) delete process.env[v]; else process.env[v] = saved[v]; });
  vi.restoreAllMocks(); vi.useRealTimers();
});

describe('each job has its own key', () => {
  it('text uses key 1, voice uses key 2', async () => {
    expect((await withGeminiKey(fake({}), { purpose: 'text' })).servedBy).toBe(K1);
    expect((await withGeminiKey(fake({}), { purpose: 'voice' })).servedBy).toBe(K2);
  });
  it('key 3 is only the backup: never used while the main key answers', async () => {
    const fn = fake({});
    for (let i = 0; i < 5; i += 1) { await withGeminiKey(fn, { purpose: 'text' }); await withGeminiKey(fn, { purpose: 'voice' }); }
    expect(fn.mock.calls.map(c => c[0])).not.toContain(K3);
  });
  it('with only one key set, text and voice both use it (works as before)', async () => {
    delete process.env.GEMINI_API_KEY_2; delete process.env.GEMINI_API_KEY_3;
    expect((await withGeminiKey(fake({}), { purpose: 'voice' })).servedBy).toBe(K1);
    expect((await withGeminiKey(fake({}), { purpose: 'text' })).servedBy).toBe(K1);
  });
  it('GEMINI_API_KEYS replaces the single variables; empty slots are skipped', async () => {
    process.env.GEMINI_API_KEYS = `listed-a, , listed-c`;
    expect((await withGeminiKey(fake({}), { purpose: 'text' })).servedBy).toBe('listed-a');
    expect((await withGeminiKey(fake({}), { purpose: 'voice' })).servedBy).toBe('listed-c'); // slot 2 empty → backup
    expect(keyStatus().slots.map(s => s.status)).toEqual(['ok', 'missing', 'ok']);
  });
  it('no key at all: "not set" (503), as before', async () => {
    VARS.forEach(v => delete process.env[v]);
    expect(hasGeminiKey()).toBe(false);
    await expect(withGeminiKey(fake({}))).rejects.toMatchObject({ status: 503, message: 'GEMINI_API_KEY is not set' });
  });
});

describe('failover to the backup key', () => {
  it('401 on the text key → backup serves; key 1 disabled for 30 min', async () => {
    const r = await withGeminiKey(fake({ [K1]: [err(401)] }), { purpose: 'text' });
    expect(r.servedBy).toBe(K3);
    const s1 = keyStatus().slots[0];
    expect(s1.status).toBe('disabled');
    expect(new Date(s1.until).getTime() - Date.now()).toBeGreaterThan(29 * 60 * 1000);
    // The next text call goes straight to the backup.
    const fn = fake({});
    expect((await withGeminiKey(fn, { purpose: 'text' })).servedBy).toBe(K3);
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it('a 502 that hides Google\'s 403 (upstreamStatus) counts as a key problem too', async () => {
    const r = await withGeminiKey(fake({ [K2]: [err(502, { upstreamStatus: 403 })] }), { purpose: 'voice' });
    expect(r.servedBy).toBe(K3);
    expect(keyStatus().slots[1].status).toBe('disabled');
  });
  it('429 with Retry-After 10 → backup serves; the main key is back after 10 s', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const r = await withGeminiKey(fake({ [K2]: [err(429, { retryAfter: 10 })] }), { purpose: 'voice' });
    expect(r.servedBy).toBe(K3);
    expect(keyStatus().slots[1].status).toBe('cooling');
    vi.setSystemTime(Date.now() + 11000);
    expect(keyStatus().slots[1].status).toBe('ok');
    expect((await withGeminiKey(fake({}), { purpose: 'voice' })).servedBy).toBe(K2);
  });
  it('503 twice on the main key → retried once, then the backup serves', async () => {
    const fn = fake({ [K1]: [err(503), err(503)] });
    const r = await withGeminiKey(fn, { purpose: 'text' });
    expect(r.servedBy).toBe(K3);
    expect(fn.mock.calls.map(c => c[0])).toEqual([K1, K1, K3]);
  });
  it('one 503 then success → same key, no switch', async () => {
    const fn = fake({ [K1]: [err(503)] });
    expect((await withGeminiKey(fn, { purpose: 'text' })).servedBy).toBe(K1);
  });
  it('a timeout or network error is treated like a 5xx', async () => {
    const fn = fake({ [K2]: [new Error('fetch failed'), new Error('fetch failed')] });
    expect((await withGeminiKey(fn, { purpose: 'voice' })).servedBy).toBe(K3);
  });
  it('400 → no switch, the error is returned', async () => {
    const fn = fake({ [K1]: [err(400)] });
    await expect(withGeminiKey(fn, { purpose: 'text' })).rejects.toMatchObject({ status: 400 });
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it('every key rate-limited → 429 with a wait (the voice player waits, it does not switch off)', async () => {
    const e = await withGeminiKey(fake({ [K2]: [err(429, { retryAfter: 20 })], [K3]: [err(429, { retryAfter: 30 })] }), { purpose: 'voice' }).catch(x => x);
    expect(e).toMatchObject({ status: 429, code: 'ai_unavailable' });
    expect(e.retryAfter).toBeGreaterThan(0);
    // Both still cooling: the next call does not even try, and still says 429.
    const again = await withGeminiKey(fake({}), { purpose: 'voice' }).catch(x => x);
    expect(again).toMatchObject({ status: 429 });
  });
  it('every key fails → ai_unavailable (503, never 401), with the friendly message', async () => {
    const e = await withGeminiKey(fake({ [K1]: [err(401)], [K3]: [err(403)] }), { purpose: 'text' }).catch(x => x);
    expect(e).toMatchObject({ status: 503, code: 'ai_unavailable' });
    expect(e.message).toMatch(/busy/i);
  });
  it('a failover is logged with slots and reason, and counted', async () => {
    await withGeminiKey(fake({ [K1]: [err(429)] }), { purpose: 'text', label: 'teach' });
    expect(logs.some(l => l.includes('ai_failover') && l.includes('"from":1') && l.includes('"to":3') && l.includes('"reason":429') && l.includes('teach'))).toBe(true);
    expect(keyStatus().failovers_24h).toBe(1);
    expect(keyStatus().last_served).toMatchObject({ slot: 3, purpose: 'text' });
  });
  it('a streamed call fails over only before its first chunk', async () => {
    // Before the first chunk: the error reaches the pool, so it switches.
    expect((await withGeminiKey(fake({ [K1]: [err(503), err(503)] }), { purpose: 'text' })).servedBy).toBe(K3);
    // After the first chunk the stream is already the caller's: the pool has
    // returned, so a later error cannot switch keys mid-stream.
    const fn = vi.fn(async (key) => ({ key, chunks: (async function* () { yield 'a'; throw err(503); })() }));
    const s = await withGeminiKey(fn, { purpose: 'text' });
    const got = [];
    await expect((async () => { for await (const c of s.chunks) got.push(c); })()).rejects.toMatchObject({ status: 503 });
    expect(got).toEqual(['a']); expect(fn).toHaveBeenCalledTimes(1); expect(s.key).toBe(K1);
  });
});

describe('keys are never shown', () => {
  it('status shows slots, roles and fingerprints only', async () => {
    await withGeminiKey(fake({ [K1]: [err(401, { message: `bad key ${K1}` })] }), { purpose: 'text' }).catch(() => {});
    const out = JSON.stringify(keyStatus());
    for (const k of [K1, K2, K3]) { expect(out).not.toContain(k); expect(out).not.toContain(k.slice(-4)); }
    expect(out).toContain(fingerprint(K1));
    expect(keyStatus().roles).toEqual({ 1: 'text', 2: 'voice', 3: 'backup' });
  });
  it('logs and the final error never hold a key', async () => {
    const e = await withGeminiKey(fake({ [K1]: [err(401)], [K3]: [err(401)] }), { purpose: 'text' }).catch(x => x);
    const all = logs.join('\n') + JSON.stringify({ message: e.message, ...e });
    for (const k of [K1, K2, K3]) expect(all).not.toContain(k);
  });
});
