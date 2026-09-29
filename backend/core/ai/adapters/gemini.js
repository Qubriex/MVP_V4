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
export async function generate({ model, system, input, audio, temperature = 0.7, maxTokens = 1024, json = false }) {
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
