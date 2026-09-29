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
