// core/ai/adapters/mock.js
// Deterministic mock (spec §13): the same request always gets the same answer,
// derived from a hash of (task, system, input). Used by every test; the real
// adapters sit behind AI_ADAPTER. Tests can install a responder for scripted
// journeys with setResponder().
import crypto from 'crypto';

export const name = 'mock';
let responder = null;

/** fn(request) → string | object | undefined (undefined falls back to the hash answer) */
export function setResponder(fn) {
  responder = fn;
  return () => { responder = null; };
}

export async function generate(req) {
  const hash = crypto.createHash('sha256').update(`${req.task}\n${req.system || ''}\n${req.input}`).digest('hex');
  let out = responder ? await responder({ ...req, hash }) : undefined;
  if (out === undefined) {
    if (req.schema?.required) {
      out = Object.fromEntries(req.schema.required.map(k => [k, `mock-${k}-${hash.slice(0, 8)}`]));
    } else {
      out = `mock:${req.task}:${hash.slice(0, 16)}`;
    }
  }
  const text = typeof out === 'string' ? out : JSON.stringify(out);
  return { text, modelVersion: 'mock-1', tokensIn: Math.ceil(String(req.input).length / 4), tokensOut: Math.ceil(text.length / 4) };
}

/** Deterministic silent WAV (a few ms per character), so tests never need audio. */
export async function speak({ text }) {
  const samples = Math.min(24000, 40 * String(text).length);
  const pcm = Buffer.alloc(samples * 2);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(24000, 24);
  h.writeUInt32LE(48000, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return { audio: Buffer.concat([h, pcm]), mimeType: 'audio/wav', modelVersion: 'mock-tts-1' };
}
