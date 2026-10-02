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

/** @param {{model: string, system?: string, input: string, audio?: {base64: string, mimeType: string}, temperature?: number, maxTokens?: number, json?: boolean}} req */
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

async function call({ model, system, input, audio, temperature = 0.7, maxTokens = 1024, json = false }) {
  const m = getClient().getGenerativeModel({
    model,
    systemInstruction: system,
    generationConfig: { temperature, maxOutputTokens: maxTokens, responseMimeType: json ? 'application/json' : 'text/plain' }
  });
  const parts = audio ? [{ inlineData: { mimeType: audio.mimeType, data: audio.base64 } }, { text: input }] : input;
  const result = await m.generateContent(parts);
  const usage = result.response.usageMetadata || {};
  return {
    text: result.response.text(),
    modelVersion: result.response.modelVersion || model,
    tokensIn: usage.promptTokenCount ?? null,
    tokensOut: usage.candidatesTokenCount ?? null
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
    throw Object.assign(new Error(`TTS ${res.status}: ${body.slice(0, 200)}`), { status: res.status });
  }
  const json = await res.json();
  const part = json.candidates?.[0]?.content?.parts?.find(p => p.inlineData?.data);
  if (!part) throw Object.assign(new Error('TTS returned no audio'), { status: 502 });
  const rate = Number(/rate=(\d+)/.exec(part.inlineData.mimeType || '')?.[1]) || 24000;
  return { audio: wav(Buffer.from(part.inlineData.data, 'base64'), rate), mimeType: 'audio/wav', modelVersion: model };
}

/** @param {{model: string, text: string, voice: string, style?: string}} req */
export async function speak(req) {
  const models = [req.model, ...TTS_FALLBACK_MODELS.filter(m => m !== req.model)];
  let last;
  for (const model of models) {
    try { return await ttsOnce(model, req); } catch (err) {
      last = err;
      if (err.status !== 404 && err.status !== 400) throw err; // only an unknown model moves on
    }
  }
  throw last;
}
