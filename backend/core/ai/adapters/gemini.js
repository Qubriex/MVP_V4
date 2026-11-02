// core/ai/adapters/gemini.js
// Google Gemini adapter. Model SDKs may be imported only under
// core/ai/adapters/ (tests/structural/sdk.test.js).
// Keys come only from core/ai/keyPool.js: text on key 1, voice on key 2,
// key 3 as the backup for both.
import { GoogleGenerativeAI } from '@google/generative-ai';
import { withGeminiKey, hasGeminiKey, _resetKeyPool } from '../keyPool.js';
import * as dal from '../../db/dal.js';

const clients = new Map(); // slot → client (one per key, never shared)
const clientFor = (key, slot) => {
  const c = clients.get(slot);
  if (c && c.key === key) return c.client;
  const client = new GoogleGenerativeAI(key);
  clients.set(slot, { key, client });
  return client;
};

export const name = 'gemini';

/** @param {{model: string, system?: string, input: string, audio?: {base64: string, mimeType: string}, temperature?: number, maxTokens?: number, json?: boolean, thinking?: boolean}} req */
// Google's rolling alias, used once if the configured model name is unknown to
// this key (404), so a renamed or retired model does not take the tutor down.
const FALLBACK_MODEL = 'gemini-flash-latest';

// Transcribing speech (audio in) is a voice job; everything else is text.
export async function generate(req) {
  const purpose = req.purpose || (req.audio ? 'voice' : 'text');
  return withGeminiKey(async (key, { slot }) => {
    const client = clientFor(key, slot);
    try {
      return await call(client, req);
    } catch (err) {
      if (err?.status === 404 && req.model !== FALLBACK_MODEL) {
        try { return await call(client, { ...req, model: FALLBACK_MODEL }); } catch (e2) { throw upstream(e2); }
      }
      throw upstream(err);
    }
  }, { purpose, label: req.task || purpose });
}

// Google's 401 / 403 (key not valid, API not enabled) are about our key, not
// the person signed in: they must never reach the browser as 401 or 403,
// which would look like their own session ending.
export function upstream(err) {
  if (err && (err.status === 401 || err.status === 403)) return Object.assign(err, { status: 502, upstreamStatus: err.status, upstream: true });
  return err;
}

// thinking: false asks the model not to spend output tokens "thinking" first
// (spoken replies, JSON helpers). Models that cannot turn thinking off answer
// 400; the call is then repeated without the setting.
async function call(client, req) {
  try {
    return await callOnce(client, req, req.thinking === false);
  } catch (err) {
    if (req.thinking === false && err?.status === 400 && /thinking/i.test(String(err.message))) return callOnce(client, req, false);
    throw err;
  }
}

async function callOnce(client, { model, system, input, audio, temperature = 0.7, maxTokens = 1024, json = false }, noThinking) {
  const m = client.getGenerativeModel({
    model,
    systemInstruction: system,
    generationConfig: {
      temperature, maxOutputTokens: maxTokens, responseMimeType: json ? 'application/json' : 'text/plain',
      ...(noThinking ? { thinkingConfig: { thinkingBudget: 0 } } : {})
    }
  });
  const parts = audio ? [{ inlineData: { mimeType: audio.mimeType, data: audio.base64 } }, { text: input }] : input;
  const result = await m.generateContent(parts);
  const usage = result.response.usageMetadata || {};
  const finish = result.response.candidates?.[0]?.finishReason || null;
  return {
    text: result.response.text(),
    modelVersion: result.response.modelVersion || model,
    tokensIn: usage.promptTokenCount ?? null,
    tokensOut: usage.candidatesTokenCount ?? null,
    truncated: finish === 'MAX_TOKENS'
  };
}

// ─── Speech (text → audio) ────────────────────────────────────────────────────
// One voice for Professor Qubirex (Kore, female) in every language. Engines,
// in order, on the voice key (keyPool: 2 → 3 → 1):
//   1. Cloud Text-to-Speech, Chirp 3 HD (small MP3s, its own large quota);
//   2. the Gemini speech models this key offers, newest Flash first, then
//      Pro (read from the model list every hour; the model that last worked
//      for this key is tried first; GEMINI_TTS_MODEL is an optional override).
// An engine that fails on a key rests for that key only: a model that is not
// found or out of quota never stops the others, and a Cloud TTS refusal does
// not take the key away from the Gemini voice.
const TTS_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const TTS_FALLBACK_MODELS = ['gemini-2.5-flash-preview-tts'];
const CLOUD = 'cloud-tts';

function wav(pcm, sampleRate = 24000) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(sampleRate, 24); h.writeUInt32LE(sampleRate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}
export { wav as wavFromPcm };

// Google's reason for an error, from the JSON body: details[].reason
// (SERVICE_DISABLED, API_KEY_SERVICE_BLOCKED, BILLING_DISABLED,
// API_KEY_INVALID…) or error.status (RESOURCE_EXHAUSTED, NOT_FOUND…).
export function googleReason(status, body) {
  let j = null;
  try { j = JSON.parse(body); } catch { j = null; }
  const e = j?.error || {};
  const msg = String(e.message || body || '');
  if (/API keys are not supported by this API/i.test(msg)) return { reason: 'API_KEYS_NOT_SUPPORTED', message: msg };
  const details = Array.isArray(e.details) ? e.details : [];
  const reason = details.map(d => d.reason).find(Boolean) || e.status || (status === 429 ? 'RESOURCE_EXHAUSTED' : status === 404 ? 'NOT_FOUND' : null);
  const project = details.map(d => d.metadata?.consumer || d.metadata?.containerInfo).find(Boolean) || (/projects\/(\d+)/.exec(msg)?.[0] ?? null);
  return { reason, project: project ? String(project).replace(/^projects\//, '') : null, message: msg };
}

function failure(label, res, body) {
  const g = googleReason(res.status, body);
  return upstream(Object.assign(new Error(`${label} ${res.status}${g.reason ? ` ${g.reason}` : ''}: ${g.message.slice(0, 160)}`),
    { status: res.status, retryAfter: retryAfter(res, body), reason: g.reason, project: g.project }));
}

async function ttsOnce(key, model, { text, voice, style }) {
  const res = await fetch(`${TTS_ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ parts: [{ text: style ? `${style}\n${text}` : text }] }],
      generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } }
    })
  });
  if (!res.ok) throw failure('TTS', res, await res.text().catch(() => ''));
  const json = await res.json();
  const part = json.candidates?.[0]?.content?.parts?.find(p => p.inlineData?.data);
  if (!part) throw Object.assign(new Error('TTS returned no audio'), { status: 502 });
  const rate = Number(/rate=(\d+)/.exec(part.inlineData.mimeType || '')?.[1]) || 24000;
  return { audio: wav(Buffer.from(part.inlineData.data, 'base64'), rate), mimeType: 'audio/wav', modelVersion: model };
}

// Cloud Text-to-Speech: Chirp 3 HD has the same prebuilt voices as Gemini
// (Kore), so she sounds the same. Standard-A (female) only if HD is not offered.
const CLOUD_TTS = 'https://texttospeech.googleapis.com/v1/text:synthesize';
export const LOCALES = { telugu: 'te-IN', hindi: 'hi-IN', english: 'en-IN' };

async function cloudOnce(key, name, languageCode, text) {
  const res = await fetch(CLOUD_TTS, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({ input: { text }, voice: { languageCode, name }, audioConfig: { audioEncoding: 'MP3' } })
  });
  if (!res.ok) throw failure('Cloud TTS', res, await res.text().catch(() => ''));
  const json = await res.json();
  if (!json.audioContent) throw Object.assign(new Error('Cloud TTS returned no audio'), { status: 502 });
  return { audio: Buffer.from(json.audioContent, 'base64'), mimeType: 'audio/mpeg', modelVersion: `${CLOUD}:${name}` };
}

async function cloudSpeak(key, { text, voice, language }) {
  const lc = LOCALES[language] || LOCALES.telugu;
  try { return await cloudOnce(key, `${lc}-Chirp3-HD-${voice}`, lc, text); } catch (err) {
    if (err.status !== 400 && err.status !== 404) throw err;
    return cloudOnce(key, `${lc}-Standard-A`, lc, text);
  }
}

// Seconds Google asks us to wait, from the Retry-After header or the
// RetryInfo detail ("retryDelay": "37s") in the error body.
function retryAfter(res, body) {
  const h = Number(res.headers?.get?.('retry-after'));
  if (h > 0) return h;
  const m = /"retryDelay":\s*"(\d+)/.exec(body || '');
  return m ? Number(m[1]) : null;
}

const KEY_LEVEL = new Set(['API_KEY_INVALID', 'API_KEY_SERVICE_BLOCKED', 'SERVICE_DISABLED', 'BILLING_DISABLED', 'PERMISSION_DENIED']);
const isKeyLevel = (err) => err.upstreamStatus === 401 || err.upstreamStatus === 403 || err.status === 401 || err.status === 403 || KEY_LEVEL.has(err.reason);

// How long an engine rests on one key after it failed there.
const resting = new Map(); // fingerprint:engine → time it may be tried again
export function restFor(err) {
  if (err.reason === 'API_KEYS_NOT_SUPPORTED') return 6 * 3600 * 1000; // this key type can never call it
  if (err.status === 429) return (err.retryAfter || 60) * 1000;
  if (isKeyLevel(err)) return 30 * 60 * 1000;
  if (err.status === 400 || err.status === 404) return 60 * 60 * 1000;
  return 0;
}
const ttsModels = new Map(); // slot → { fingerprint, at, list }
const remembered = new Map(); // fingerprint → { model, at }
export const _resetTtsEngines = () => { resting.clear(); ttsModels.clear(); remembered.clear(); _resetKeyPool(); };

/** Newest Flash speech model first, then Flash-Lite, then Pro; non-preview before preview. */
export function rankTtsModels(list) {
  const family = (m) => (/pro/.test(m) ? 2 : /lite/.test(m) ? 1 : /flash/.test(m) ? 0 : 3);
  const version = (m) => Number(/(\d+(?:\.\d+)?)/.exec(m)?.[1] || 0);
  return [...new Set(list)].sort((a, b) => family(a) - family(b) || version(b) - version(a) || (/preview/.test(a) ? 1 : 0) - (/preview/.test(b) ? 1 : 0));
}

async function modelsFor(key, slot, fingerprint) {
  const c = ttsModels.get(slot);
  if (c && c.fingerprint === fingerprint && Date.now() - c.at < 3600000) return c.list;
  let list = [];
  try {
    const res = await fetch(`${TTS_ENDPOINT}?pageSize=200`, { headers: { 'x-goog-api-key': key } });
    const json = res.ok ? await res.json() : { models: [] };
    list = (json.models || []).filter(m => /tts/i.test(m.name) && (m.supportedGenerationMethods || []).includes('generateContent')).map(m => m.name.replace(/^models\//, ''));
  } catch { list = []; }
  ttsModels.set(slot, { fingerprint, at: Date.now(), list: rankTtsModels(list) });
  return ttsModels.get(slot).list;
}
/** The speech models the first voice key offers, best first. */
export const availableTtsModels = () => (hasGeminiKey() ? withGeminiKey((key, { slot, fingerprint }) => modelsFor(key, slot, fingerprint), { purpose: 'voice', label: 'tts-models' }).catch(() => []) : Promise.resolve([]));

// The model that last spoke for this key, kept in the database so a new
// instance starts with a model that works.
async function rememberedModel(fingerprint) {
  const m = remembered.get(fingerprint);
  if (m && Date.now() - m.at < 600000) return m.model;
  let model = m?.model || null;
  try { model = (await dal.one('SELECT model FROM ai_voice_models WHERE fingerprint = ? ORDER BY worked_at DESC LIMIT 1', fingerprint))?.model || model; } catch { /* no table yet */ }
  remembered.set(fingerprint, { model, at: Date.now() });
  return model;
}
function rememberModel(slot, fingerprint, model) {
  if (remembered.get(fingerprint)?.model === model) return;
  remembered.set(fingerprint, { model, at: Date.now() });
  dal.run(`INSERT INTO ai_voice_models (slot, fingerprint, model, worked_at) VALUES (?, ?, ?, ?)
    ON CONFLICT (slot, fingerprint) DO UPDATE SET model = excluded.model, worked_at = excluded.worked_at`, slot, fingerprint, model, new Date().toISOString()).catch(() => {});
}

async function engineList(key, slot, fingerprint, req) {
  const found = await modelsFor(key, slot, fingerprint);
  const models = [...new Set([process.env.GEMINI_TTS_MODEL, await rememberedModel(fingerprint), ...found, ...TTS_FALLBACK_MODELS].filter(Boolean))];
  const list = [[CLOUD, () => cloudSpeak(key, req)], ...models.map(m => [m, () => ttsOnce(key, m, req)])];
  // A long text spoken in parts keeps one engine, so the parts join cleanly.
  if (req.prefer) list.sort((a, b) => (b[0] === req.prefer) - (a[0] === req.prefer));
  return list;
}

// Every engine on one key. When none answers, the error says why: a rate
// limit (429, with the wait), a key problem (the pool disables the key), or
// "nothing here works" (the pool moves to the next key without retrying).
async function speakWithKey(key, slot, fingerprint, req) {
  const engines = await engineList(key, slot, fingerprint, req);
  const now = Date.now();
  const errors = [];
  for (const [name, run] of engines) {
    if ((resting.get(`${fingerprint}:${name}`) || 0) > now) continue;
    try {
      const out = await run();
      if (name !== CLOUD) rememberModel(slot, fingerprint, name);
      return { ...out, engine: name, slot };
    } catch (err) {
      errors.push([name, err]);
      const ms = restFor(err);
      if (ms) resting.set(`${fingerprint}:${name}`, Date.now() + ms);
      if (err.status === 429 && name !== CLOUD) break; // a Gemini quota is per project: the other models share it
    }
  }
  const limited = errors.filter(([, e]) => e.status === 429);
  if (limited.length || !errors.length) {
    const waits = errors.length ? limited.map(([, e]) => e.retryAfter || 60) : engines.map(([n]) => Math.ceil(((resting.get(`${fingerprint}:${n}`) || now) - now) / 1000));
    throw Object.assign(new Error('The voice is busy on this key'), { status: 429, retryAfter: Math.max(1, Math.min(...waits.filter(w => w > 0), 60)) });
  }
  const gemini = errors.filter(([n]) => n !== CLOUD).map(([, e]) => e);
  if (gemini.length && gemini.every(isKeyLevel)) throw gemini[0];
  throw Object.assign(new Error('No voice engine answered on this key'), { status: 502, nextKey: true });
}

export async function speak(req) {
  return withGeminiKey((key, { slot, fingerprint }) => speakWithKey(key, slot, fingerprint, req), { purpose: 'voice', label: 'speak' });
}

// ─── Voice check (health, Admin → Voice check) ─────────────────────────────────
// Every engine on every voice key, once, with Google's reason and what to do.
// Results are kept for an hour (a fresh check is asked for explicitly), so
// health checks do not use up the speech quota.
const WHAT_TO_DO = {
  API_KEYS_NOT_SUPPORTED: 'This kind of key (from Google AI Studio) cannot call Cloud Text-to-Speech. In Google Cloud Console → APIs & Services → Credentials → Create credentials → API key, make a standard key, allow Generative Language API and Cloud Text-to-Speech API, and use it in this slot.',
  SERVICE_DISABLED: 'Enable {api} in Google Cloud project {project}: APIs & Services → Enable APIs and services → search "{api}" → Enable.',
  API_KEY_SERVICE_BLOCKED: 'Allow {api} for this key: APIs & Services → Credentials → this key → API restrictions → tick {api} → Save.',
  BILLING_DISABLED: 'Turn on billing for Google Cloud project {project}: Billing → Link a billing account.',
  API_KEY_INVALID: 'This key is not valid (deleted or mistyped). Create a new key and replace it in Vercel.',
  PERMISSION_DENIED: 'This key may not use {api}. Check the key\'s API restrictions and that {api} is enabled in project {project}.',
  RESOURCE_EXHAUSTED: 'The daily or per-minute quota for {engine} is used up for this Google project. It comes back by itself; for more, raise the quota or use a key from another Google Cloud project.',
  NOT_FOUND: '{engine} is not available to this key; the other models are used instead.'
};
export function whatToDo(engine, err) {
  const api = engine.startsWith(CLOUD) ? 'Cloud Text-to-Speech API' : 'Generative Language API';
  const reason = err.reason || (err.status === 429 ? 'RESOURCE_EXHAUSTED' : err.status === 404 ? 'NOT_FOUND' : (err.upstreamStatus || err.status) === 401 ? 'API_KEY_INVALID' : null);
  const text = WHAT_TO_DO[reason] || 'Try again later; if it keeps failing, check the key in Google Cloud Console.';
  return { reason, todo: text.replace(/\{api\}/g, api).replace(/\{project\}/g, err.project || 'that owns this key').replace(/\{engine\}/g, engine) };
}

const checked = new Map(); // fingerprint:engine:language → { at, row }
async function probe(fingerprint, engine, language, run, fresh) {
  const k = `${fingerprint}:${engine}:${language}`;
  const c = checked.get(k);
  if (!fresh && c && Date.now() - c.at < 3600000) return c.row;
  const t0 = Date.now();
  let row;
  try { const r = await run(); row = { engine, language, ok: true, voice: r.modelVersion, ms: Date.now() - t0 }; } catch (err) {
    const w = whatToDo(engine, err);
    row = { engine, language, ok: false, status: err.upstreamStatus || err.status || null, reason: w.reason, todo: w.todo };
  }
  checked.set(k, { at: Date.now(), row });
  return row;
}

/**
 * Every voice key × engine: Cloud TTS Chirp 3 HD in te-IN / hi-IN / en-IN and
 * each Gemini speech model the key offers. Slots by fingerprint, never keys.
 */
export async function voiceDiagnosis({ voice = 'Kore', fresh = false } = {}) {
  const { orderFor } = await import('../keyPool.js');
  const SAY = { telugu: 'నమస్కారం', hindi: 'नमस्ते', english: 'Hello' };
  const slots = [];
  for (const s of orderFor('voice')) {
    const models = await modelsFor(s.key, s.slot, s.fingerprint);
    const engines = [];
    for (const language of ['telugu', 'hindi', 'english']) {
      engines.push(await probe(s.fingerprint, `${CLOUD}:${LOCALES[language]}-Chirp3-HD-${voice}`, language, () => cloudOnce(s.key, `${LOCALES[language]}-Chirp3-HD-${voice}`, LOCALES[language], SAY[language]), fresh));
    }
    for (const m of [...new Set([process.env.GEMINI_TTS_MODEL, ...models].filter(Boolean))]) {
      engines.push(await probe(s.fingerprint, m, 'telugu', () => ttsOnce(s.key, m, { text: SAY.telugu, voice }), fresh));
    }
    slots.push({ slot: s.slot, fingerprint: s.fingerprint, models, engines });
  }
  return { slots };
}
