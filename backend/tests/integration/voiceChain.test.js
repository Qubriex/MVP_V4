// The voice chain on the key pool: engines per key, Google's reasons, model
// discovery, byte-limited parts and pre-recorded lesson audio. Google is
// never called: fetch is replaced and the keys are fake.
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { freshDb } from '../helpers/setup.js';
import * as dal from '../../core/db/dal.js';
import * as g from '../../core/ai/adapters/gemini.js';
import { keyStatus } from '../../core/ai/keyPool.js';
import { splitSpeechBytes, synthesize, prerecord } from '../../core/ai/gateway.js';

const realFetch = globalThis.fetch;
const KEYS = { GEMINI_API_KEY: 'fake-text', GEMINI_API_KEY_2: 'fake-voice', GEMINI_API_KEY_3: 'fake-backup' };
const res = (status, body) => ({ ok: status < 300, status, headers: { get: () => null }, json: async () => body, text: async () => JSON.stringify(body) });
const pcm = Buffer.alloc(200).toString('base64');
const geminiAudio = { candidates: [{ content: { parts: [{ inlineData: { data: pcm, mimeType: 'audio/L16;rate=24000' } }] } }] };
const notSupported = { error: { code: 401, message: 'API keys are not supported by this API. Expected OAuth2 access token or other authentication credentials', status: 'UNAUTHENTICATED' } };
let calls;
function install(handler) {
  calls = [];
  globalThis.fetch = async (url, init = {}) => {
    const key = init.headers?.['x-goog-api-key'];
    calls.push({ url: String(url), key });
    return handler(String(url), key, init.body ? JSON.parse(init.body) : null);
  };
}

beforeAll(async () => { await freshDb(); });
beforeEach(async () => { Object.assign(process.env, KEYS); g._resetTtsEngines(); await dal.run('DELETE FROM ai_voice_models'); });
afterEach(() => { globalThis.fetch = realFetch; Object.keys(KEYS).forEach(k => delete process.env[k]); delete process.env.AI_ADAPTER; delete process.env.GEMINI_TTS_MODEL; });

describe('the voice engines on one key', () => {
  it('Cloud TTS refused for this key type → the Gemini voice speaks; the key stays usable', async () => {
    install((url) => {
      if (url.includes('texttospeech')) return res(401, notSupported);
      if (url.endsWith('pageSize=200')) return res(200, { models: [{ name: 'models/gemini-3.8-flash-tts', supportedGenerationMethods: ['generateContent'] }] });
      return res(200, geminiAudio);
    });
    const out = await g.speak({ text: 'హలో', voice: 'Kore', language: 'telugu' });
    expect(out.engine).toBe('gemini-3.8-flash-tts');
    expect(out.slot).toBe(2);
    expect(calls.filter(c => c.url.includes('texttospeech') || c.url.includes(':generateContent')).every(c => c.key === 'fake-voice')).toBe(true);
    expect(keyStatus().slots[1].status).toBe('ok');
    // Cloud TTS rests for this key: not asked again on the next line.
    await g.speak({ text: 'మళ్ళీ', voice: 'Kore', language: 'telugu' });
    expect(calls.filter(c => c.url.includes('texttospeech'))).toHaveLength(1);
  });

  it('a model that is not found (404) → the next model; GEMINI_TTS_MODEL is only an override', async () => {
    process.env.GEMINI_TTS_MODEL = 'gemini-old-tts';
    install((url) => {
      if (url.includes('texttospeech')) return res(403, { error: { status: 'PERMISSION_DENIED', details: [{ reason: 'SERVICE_DISABLED', metadata: { consumer: 'projects/711146201037' } }] } });
      if (url.endsWith('pageSize=200')) return res(200, { models: [{ name: 'models/gemini-2.5-pro-preview-tts', supportedGenerationMethods: ['generateContent'] }, { name: 'models/gemini-3.1-flash-tts-preview', supportedGenerationMethods: ['generateContent'] }] });
      if (url.includes('gemini-old-tts')) return res(404, { error: { code: 404, status: 'NOT_FOUND', message: 'models/gemini-old-tts is not found' } });
      return res(200, geminiAudio);
    });
    const out = await g.speak({ text: 'नमस्ते', voice: 'Kore', language: 'hindi' });
    expect(out.engine).toBe('gemini-3.1-flash-tts-preview'); // newest Flash before Pro
  });

  it('the voice key out of quota on every engine → the backup key speaks', async () => {
    install((url, key) => {
      if (url.endsWith('pageSize=200')) return res(200, { models: [{ name: 'models/gemini-3.8-flash-tts', supportedGenerationMethods: ['generateContent'] }] });
      if (key === 'fake-voice') return res(429, { error: { status: 'RESOURCE_EXHAUSTED', message: 'quota' } });
      return url.includes('texttospeech') ? res(200, { audioContent: Buffer.from('mp3').toString('base64') }) : res(200, geminiAudio);
    });
    const out = await g.speak({ text: 'Hello', voice: 'Kore', language: 'english' });
    expect(out.slot).toBe(3);
    expect(keyStatus().slots[1].status).toBe('cooling');
  });

  it('ranks speech models: newest Flash, then Flash-Lite, then Pro; non-preview first', () => {
    expect(g.rankTtsModels(['gemini-2.5-pro-preview-tts', 'gemini-2.5-flash-preview-tts', 'gemini-3.8-flash-lite-tts', 'gemini-3.8-flash-tts', 'gemini-3.1-flash-tts-preview']))
      .toEqual(['gemini-3.8-flash-tts', 'gemini-3.1-flash-tts-preview', 'gemini-2.5-flash-preview-tts', 'gemini-3.8-flash-lite-tts', 'gemini-2.5-pro-preview-tts']);
  });

  it('reads Google\'s reason and says what to do, in plain words', () => {
    expect(g.googleReason(401, JSON.stringify(notSupported)).reason).toBe('API_KEYS_NOT_SUPPORTED');
    const blocked = g.googleReason(403, JSON.stringify({ error: { status: 'PERMISSION_DENIED', details: [{ reason: 'API_KEY_SERVICE_BLOCKED', metadata: { consumer: 'projects/711146201037' } }] } }));
    expect(blocked).toMatchObject({ reason: 'API_KEY_SERVICE_BLOCKED', project: '711146201037' });
    expect(g.whatToDo('cloud-tts:te-IN-Chirp3-HD-Kore', { reason: 'SERVICE_DISABLED', project: '711146201037' }).todo).toMatch(/Enable Cloud Text-to-Speech API in Google Cloud project 711146201037/);
    expect(g.whatToDo('cloud-tts:te-IN-Chirp3-HD-Kore', { reason: 'API_KEY_SERVICE_BLOCKED' }).todo).toMatch(/Allow Cloud Text-to-Speech API for this key/);
  });

  it('the voice check lists every key × engine with reason and what to do, never a key', async () => {
    install((url) => {
      if (url.includes('texttospeech')) return res(401, notSupported);
      if (url.endsWith('pageSize=200')) return res(200, { models: [{ name: 'models/gemini-3.8-flash-tts', supportedGenerationMethods: ['generateContent'] }] });
      return res(200, geminiAudio);
    });
    const d = await g.voiceDiagnosis({ fresh: true });
    expect(d.slots.map(s => s.slot)).toEqual([2, 3, 1]);
    const s2 = d.slots[0];
    expect(s2.engines.filter(e => e.engine.startsWith('cloud-tts')).map(e => e.language)).toEqual(['telugu', 'hindi', 'english']);
    expect(s2.engines.find(e => e.engine.startsWith('cloud-tts'))).toMatchObject({ ok: false, status: 401, reason: 'API_KEYS_NOT_SUPPORTED' });
    expect(s2.engines.find(e => e.engine === 'gemini-3.8-flash-tts')).toMatchObject({ ok: true });
    const out = JSON.stringify(d);
    for (const k of Object.values(KEYS)) expect(out).not.toContain(k);
  });
});

describe('long text and pre-recorded audio', () => {
  it('a Telugu text of about 6,000 bytes becomes 2 parts, each under 5,000 bytes', () => {
    const text = 'ఒక function ఒక value ని return చేస్తుంది. '.repeat(85);
    expect(Buffer.byteLength(text)).toBeGreaterThan(5800);
    const parts = splitSpeechBytes(text);
    expect(parts).toHaveLength(2);
    parts.forEach(p => expect(Buffer.byteLength(p)).toBeLessThan(5000));
    expect(parts.join(' ').replace(/\s+/g, ' ')).toBe(text.trim().replace(/\s+/g, ' '));
  });

  it('a long text is spoken in parts on one engine and joined into one clip', async () => {
    process.env.AI_ADAPTER = 'gemini';
    install((url) => (url.includes('texttospeech') ? res(200, { audioContent: Buffer.from('MP3PART').toString('base64') }) : res(200, { models: [] })));
    const out = await synthesize({ text: 'ఒక function ఒక value ని return చేస్తుంది. '.repeat(85), language: 'telugu' });
    expect(out.mimeType).toBe('audio/mpeg');
    expect(out.audio.toString()).toBe('MP3PARTMP3PART');
    expect(calls.filter(c => c.url.includes('texttospeech'))).toHaveLength(2);
  });

  it('a pre-recorded clip is served from storage without a live call', async () => {
    process.env.AI_ADAPTER = 'gemini';
    install((url) => (url.includes('texttospeech') ? res(200, { audioContent: Buffer.from('LESSON').toString('base64') }) : res(200, { models: [] })));
    const text = 'Variable అంటే పేరు రాసిన ఒక డబ్బా.';
    expect((await prerecord({ text, language: 'telugu' })).recorded).toBe(true);
    expect((await prerecord({ text, language: 'telugu' })).recorded).toBe(false); // already there: skipped
    g._resetTtsEngines();
    install(() => { throw new Error('no live call expected'); });
    const { _clearSpeechMemory } = await import('../../core/ai/gateway.js');
    _clearSpeechMemory();
    const out = await synthesize({ text, language: 'telugu' });
    expect(out.cached).toBe(true);
    expect(out.audio.toString()).toBe('LESSON');
    expect(calls).toHaveLength(0);
  });
});

describe('key health is shared between instances', () => {
  it('a key another instance disabled is skipped here too', async () => {
    const { withGeminiKey, fingerprint, _readSharedAgain } = await import('../../core/ai/keyPool.js');
    const until = new Date(Date.now() + 20 * 60000).toISOString();
    await dal.run('INSERT INTO ai_key_health (slot, fingerprint, status, until, last_error_code, updated_at) VALUES (?, ?, ?, ?, ?, ?)', 1, fingerprint('fake-text'), 'disabled', until, '401', new Date().toISOString());
    _readSharedAgain();
    const used = [];
    await withGeminiKey(async (key) => { used.push(key); return 'ok'; }, { purpose: 'text' });
    expect(used).toEqual(['fake-backup']);
    expect(keyStatus().slots[0].status).toBe('disabled');
    await dal.run('DELETE FROM ai_key_health');
  });
  it('a key disabled here is written for the other instances (fingerprint only)', async () => {
    const { withGeminiKey } = await import('../../core/ai/keyPool.js');
    await withGeminiKey(async (key) => { if (key === 'fake-text') throw Object.assign(new Error('bad key'), { status: 401 }); return 'ok'; }, { purpose: 'text' });
    await new Promise(r => setTimeout(r, 50));
    const rows = await dal.all('SELECT * FROM ai_key_health');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ slot: 1, status: 'disabled' });
    expect(JSON.stringify(rows)).not.toContain('fake-text');
  });
});

describe('WAV from the newer speech models', () => {
  it('a model that already sends a WAV is not wrapped twice, and WAV parts join into one clean WAV', async () => {
    const finished = g.wavFromPcm(Buffer.alloc(100, 1), 24000);
    install((url) => {
      if (url.includes('texttospeech')) return res(401, notSupported);
      if (url.endsWith('pageSize=200')) return res(200, { models: [{ name: 'models/gemini-3.8-flash-tts', supportedGenerationMethods: ['generateContent'] }] });
      return res(200, { candidates: [{ content: { parts: [{ inlineData: { data: finished.toString('base64'), mimeType: 'audio/wav' } }] } }] });
    });
    const one = await g.speak({ text: 'హలో', voice: 'Kore', language: 'telugu' });
    expect(one.audio.equals(finished)).toBe(true);
    expect(one.audio.indexOf('RIFF', 4)).toBe(-1);
    const { joinAudio } = await import('../../core/ai/gateway.js');
    const joined = joinAudio([{ audio: finished, mimeType: 'audio/wav' }, { audio: finished, mimeType: 'audio/wav' }]);
    expect(joined.audio.indexOf('RIFF', 4)).toBe(-1);
    expect(g.pcmOf(joined.audio).pcm.length).toBe(200);
  });
});
