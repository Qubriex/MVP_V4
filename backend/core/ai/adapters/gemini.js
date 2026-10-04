// core/ai/adapters/gemini.js
// Google Gemini adapter. Model SDKs may be imported only under
// core/ai/adapters/ (tests/structural/sdk.test.js).
import { GoogleGenerativeAI } from '@google/generative-ai';

let client = null;
const getClient = () => {
  if (!process.env.GEMINI_API_KEY) throw Object.assign(new Error('GEMINI_API_KEY is not set'), { status: 503 });
  client = client || new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  return client;
};

export const name = 'gemini';

/** @param {{model: string, system?: string, input: string, audio?: {base64: string, mimeType: string}, temperature?: number, maxTokens?: number, json?: boolean, thinking?: boolean}} req */
// Google's rolling alias, used once if the configured model name is unknown to
// this key (404), so a renamed or retired model does not take the tutor down.
const FALLBACK_MODEL = 'gemini-flash-latest';

export async function generate(req) {
  try {
    return await call(req);
  } catch (err) {
    if (err?.status === 404 && req.model !== FALLBACK_MODEL) return call({ ...req, model: FALLBACK_MODEL });
    throw err;
  }
}

// thinking: false asks the model not to spend output tokens "thinking" first
// (spoken replies, JSON helpers). Models that cannot turn thinking off answer
// 400; the call is then repeated without the setting.
async function call(req) {
  try {
    return await callOnce(req, req.thinking === false);
  } catch (err) {
    if (req.thinking === false && err?.status === 400 && /thinking/i.test(String(err.message))) return callOnce(req, false);
    throw err;
  }
}

async function callOnce({ model, system, input, audio, temperature = 0.7, maxTokens = 1024, json = false }, noThinking) {
  const m = getClient().getGenerativeModel({
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
// Gemini's TTS models return 24 kHz 16-bit mono PCM; it is wrapped as WAV so
// any browser can play it. One prebuilt voice per persona keeps Professor
// Qubirex sounding the same on every device (docs/AI-VOICE-SPEC.md).
const TTS_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const TTS_FALLBACK_MODELS = ['gemini-2.5-flash-preview-tts', 'gemini-2.5-flash-tts'];

function wav(pcm, sampleRate = 24000) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(sampleRate, 24); h.writeUInt32LE(sampleRate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

async function ttsOnce(model, { text, voice, style }) {
  if (!process.env.GEMINI_API_KEY) throw Object.assign(new Error('GEMINI_API_KEY is not set'), { status: 503 });
  const res = await fetch(`${TTS_ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
    body: JSON.stringify({
      contents: [{ parts: [{ text: style ? `${style}\n${text}` : text }] }],
      generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } }
    })
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw Object.assign(new Error(`TTS ${res.status}: ${body.slice(0, 200)}`), { status: res.status, retryAfter: retryAfter(res, body) });
  }
  const json = await res.json();
  const part = json.candidates?.[0]?.content?.parts?.find(p => p.inlineData?.data);
  if (!part) throw Object.assign(new Error('TTS returned no audio'), { status: 502 });
  const rate = Number(/rate=(\d+)/.exec(part.inlineData.mimeType || '')?.[1]) || 24000;
  return { audio: wav(Buffer.from(part.inlineData.data, 'base64'), rate), mimeType: 'audio/wav', modelVersion: model };
}

// Google Cloud Text-to-Speech with the same key: Chirp 3 HD has the same
// prebuilt voices as Gemini (Kore, Aoede), so she sounds the same, returns
// small MP3s, and has its own, much larger quota. Standard-A is the female
// Standard voice for each locale, used only if the HD voice is not offered.
const CLOUD_TTS = 'https://texttospeech.googleapis.com/v1/text:synthesize';
const LOCALES = { telugu: 'te-IN', hindi: 'hi-IN', english: 'en-IN' };

async function cloudOnce(name, languageCode, text) {
  const res = await fetch(CLOUD_TTS, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
    body: JSON.stringify({ input: { text }, voice: { languageCode, name }, audioConfig: { audioEncoding: 'MP3' } })
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw Object.assign(new Error(`Cloud TTS ${res.status}: ${body.slice(0, 200)}`), { status: res.status, retryAfter: retryAfter(res, body) });
  }
  const json = await res.json();
  if (!json.audioContent) throw Object.assign(new Error('Cloud TTS returned no audio'), { status: 502 });
  return { audio: Buffer.from(json.audioContent, 'base64'), mimeType: 'audio/mpeg', modelVersion: `cloud-tts:${name}` };
}

async function cloudSpeak({ text, voice, language }) {
  if (!process.env.GEMINI_API_KEY) throw Object.assign(new Error('GEMINI_API_KEY is not set'), { status: 503 });
  const lc = LOCALES[language] || LOCALES.telugu;
  try { return await cloudOnce(`${lc}-Chirp3-HD-${voice}`, lc, text); } catch (err) {
    if (err.status !== 400 && err.status !== 404) throw err;
    return cloudOnce(`${lc}-Standard-A`, lc, text);
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

// An engine that is out of quota, switched off for this key, or unknown is
// skipped for a while instead of being asked again on every sentence.
const resting = new Map(); // engine → time it may be tried again
const restFor = (err) => {
  if (err.status === 429) return (err.retryAfter || 60) * 1000;
  if (err.status === 401 || err.status === 403) return 10 * 60 * 1000;
  if (err.status === 400 || err.status === 404) return 60 * 60 * 1000;
  return 0;
};
export const _resetTtsEngines = () => resting.clear();

/**
 * Speech in Professor Qubirex's one voice. Tries Cloud TTS (Chirp 3 HD),
 * then the Gemini TTS models, all with the same female voice; it never
 * changes to another voice to get past a failure.
 * @param {{model: string, text: string, voice: string, language?: string, style?: string}} req
 */
export async function speak(req) {
  if (!process.env.GEMINI_API_KEY) throw Object.assign(new Error('GEMINI_API_KEY is not set'), { status: 503 });
  const engines = [
    ['cloud-tts', () => cloudSpeak(req)],
    ...[req.model, ...TTS_FALLBACK_MODELS.filter(m => m !== req.model)].map(m => [m, () => ttsOnce(m, req)])
  ];
  const now = Date.now();
  let last = null;
  for (const [name, run] of engines) {
    if ((resting.get(name) || 0) > now) continue;
    try { return await run(); } catch (err) {
      last = err;
      const ms = restFor(err);
      if (ms) resting.set(name, Date.now() + ms);
    }
  }
  if (!last) {
    // Every engine is resting: report a rate limit so the page waits and retries.
    const soonest = Math.min(...engines.map(([n]) => resting.get(n) || now));
    throw Object.assign(new Error('All voice engines are resting'), { status: 429, retryAfter: Math.max(1, Math.ceil((soonest - now) / 1000)) });
  }
  throw last;
}
