// core/ai/gateway.js
// Every model call goes through generate() (spec §8.11). Callers name a task;
// the routing table picks adapter and model. Model SDKs are imported only by
// core/ai/adapters/*.
//
//   generate({ task, system, input, schema?, audio?, temperature?, maxTokens?,
//              promptId?, promptVersion?, institutionId? })
//     → { text, json?, modelId, modelVersion, adapter }
//
// - timeout (ai.timeoutMs, 20 s) or a 5xx → one retry, then the route's fallback
// - schema ({ required: [...] }) → parse + check, one repair retry, then a
//   typed GatewayError('schema_failed')
// - every call is logged to model_calls {task, model, prompt, tokens, ms, institution}
//
// Phase 0 (foundation) scope: routing, fallback, schema repair and logging.
// The prompt registry, cost meter, lesson cache and canary arrive with the
// Quality step. Eval routes will pin exact model versions there.
import * as dal from '../db/dal.js';
import { ulid } from '../db/ulid.js';
import params from '../../config/params.js';
import { logger } from '../logger.js';
import * as gemini from './adapters/gemini.js';
import * as mock from './adapters/mock.js';

const ADAPTERS = { gemini, mock };
const DEFAULT_MODEL = { gemini: process.env.GEMINI_MODEL || 'gemini-3.6-flash', mock: 'mock' };

export class GatewayError extends Error {
  constructor(code, message, cause) {
    super(message);
    this.name = 'GatewayError';
    this.code = code; // timeout | upstream | schema_failed | unknown_task
    this.cause = cause;
  }
}

// Tests always use the deterministic mock. Elsewhere the default is gemini:
// without a key its calls fail (503) and the frontend shows sample content,
// rather than mock text reaching a learner. AI_ADAPTER=mock opts in explicitly.
function defaultAdapter() {
  if (process.env.AI_ADAPTER) return process.env.AI_ADAPTER;
  return process.env.NODE_ENV === 'test' ? 'mock' : 'gemini';
}

/** Task → { adapter, model, fallback? }. One adapter for every task until routes are split by cost (§8.11). */
export function route(task) {
  const adapter = defaultAdapter();
  if (!ADAPTERS[adapter]) throw new GatewayError('unknown_task', `Unknown AI adapter "${adapter}"`);
  return { adapter, model: DEFAULT_MODEL[adapter], fallback: null, task };
}

const withTimeout = (p, ms) => new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new GatewayError('timeout', `Model call timed out after ${ms} ms`)), ms);
  p.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
});

const retryable = (err) => err instanceof GatewayError ? err.code === 'timeout' : !err.status || err.status >= 500;

export function parseJson(text) {
  if (!text) return undefined;
  const stripped = String(text).trim().replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '');
  try { return JSON.parse(stripped); } catch { return undefined; }
}

const satisfies = (obj, schema) => obj && typeof obj === 'object' && (schema.required || []).every(k => k in obj);

async function logCall(entry) {
  try {
    await dal.run(`INSERT INTO model_calls (id, task, adapter, model_id, model_version, prompt_id, prompt_version, tokens_in, tokens_out, ms, cost, institution_id, status, error, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ulid(), entry.task, entry.adapter, entry.model, entry.modelVersion ?? null, entry.promptId ?? null, entry.promptVersion ?? null,
    entry.tokensIn ?? null, entry.tokensOut ?? null, entry.ms, null, entry.institutionId ?? null, entry.status, entry.error ?? null, dal.nowIso());
  } catch (err) {
    logger.warn('ai.log_failed', { error: err.message });
  }
}

async function callOnce(r, req) {
  const adapter = ADAPTERS[r.adapter];
  return withTimeout(adapter.generate({ ...req, model: r.model, json: !!req.schema }), params.get('ai.timeoutMs'));
}

async function callWithRetry(r, req) {
  const retries = params.get('ai.retries');
  let lastErr;
  for (let i = 0; i <= retries; i += 1) {
    try { return { result: await callOnce(r, req), route: r }; } catch (err) {
      lastErr = err;
      if (!retryable(err)) break;
    }
  }
  if (r.fallback) {
    try { return { result: await callOnce(r.fallback, req), route: r.fallback, fellBack: true }; } catch (err) { lastErr = err; }
  }
  throw lastErr instanceof GatewayError ? lastErr : new GatewayError('upstream', 'The model call failed', lastErr);
}

/** True when a model call failed only because no model key is configured. */
export const aiNotConfigured = (err) => /GEMINI_API_KEY is not set/.test(err?.cause?.message || err?.message || '');
export const AI_NOT_CONFIGURED = 'The AI tutor is not set up on this deployment yet (GEMINI_API_KEY). Everything else works.';

export async function generate(req) {
  if (!req?.task) throw new GatewayError('unknown_task', 'generate() needs a task');
  const r = route(req.task);
  const started = Date.now();
  const base = { task: req.task, adapter: r.adapter, model: r.model, promptId: req.promptId, promptVersion: req.promptVersion, institutionId: req.institutionId };
  try {
    let { result, route: used, fellBack } = await callWithRetry(r, req);
    let json;
    if (req.schema) {
      json = parseJson(result.text);
      for (let repair = 0; !satisfies(json, req.schema) && repair < params.get('ai.schemaRepairs'); repair += 1) {
        ({ result, route: used } = await callWithRetry(r, {
          ...req,
          input: `${req.input}\n\nYour previous answer was not valid JSON with the keys ${JSON.stringify(req.schema.required || [])}. Answer again with only that JSON.`
        }));
        json = parseJson(result.text);
      }
      if (!satisfies(json, req.schema)) {
        await logCall({ ...base, ms: Date.now() - started, status: 'schema_failed', modelVersion: result.modelVersion, tokensIn: result.tokensIn, tokensOut: result.tokensOut });
        throw new GatewayError('schema_failed', `Model output for ${req.task} did not match its schema`);
      }
    }
    await logCall({ ...base, adapter: used.adapter, model: used.model, ms: Date.now() - started, status: fellBack ? 'fallback' : 'ok', modelVersion: result.modelVersion, tokensIn: result.tokensIn, tokensOut: result.tokensOut });
    return { text: result.text, json, modelId: used.model, modelVersion: result.modelVersion, adapter: used.adapter };
  } catch (err) {
    if (!(err instanceof GatewayError && err.code === 'schema_failed')) {
      await logCall({ ...base, ms: Date.now() - started, status: 'error', error: String(err.message).slice(0, 300) });
    }
    throw err;
  }
}

// ─── Speech ───────────────────────────────────────────────────────────────────
// Professor Qubirex's voice (docs/AI-VOICE-SPEC.md): one female prebuilt
// voice per variant, the same on every device. GEMINI_TTS_MODEL and
// GEMINI_TTS_VOICE override the defaults.
export const TTS_VOICES = { A: 'Kore', B: 'Aoede' };
const TTS_MODEL = () => process.env.GEMINI_TTS_MODEL || 'gemini-2.5-flash-preview-tts';
const ttsCache = new Map(); // per instance; replays and repeated lines cost nothing
const TTS_CACHE_MAX = 64;

/**
 * @param {{ text: string, variant?: 'A'|'B', institutionId?: string|null }} req
 * @returns {Promise<{ audio: Buffer, mimeType: string, cached: boolean }>}
 */
export async function synthesize({ text, variant = 'A', institutionId = null }) {
  const r = route('TEACH.speak');
  const voice = process.env.GEMINI_TTS_VOICE || TTS_VOICES[variant] || TTS_VOICES.A;
  const key = `${r.adapter}|${voice}|${text}`;
  const hit = ttsCache.get(key);
  if (hit) return { ...hit, cached: true };
  const started = Date.now();
  const model = r.adapter === 'mock' ? 'mock' : TTS_MODEL();
  try {
    const out = await withTimeout(ADAPTERS[r.adapter].speak({ model, text, voice }), Math.max(params.get('ai.timeoutMs'), 30000));
    await logCall({ task: 'TEACH.speak', adapter: r.adapter, model, modelVersion: out.modelVersion, ms: Date.now() - started, status: 'ok', institutionId, tokensIn: text.length });
    ttsCache.set(key, { audio: out.audio, mimeType: out.mimeType });
    if (ttsCache.size > TTS_CACHE_MAX) ttsCache.delete(ttsCache.keys().next().value);
    return { audio: out.audio, mimeType: out.mimeType, cached: false };
  } catch (err) {
    await logCall({ task: 'TEACH.speak', adapter: r.adapter, model, ms: Date.now() - started, status: 'error', institutionId, error: String(err.message).slice(0, 300) });
    throw err instanceof GatewayError ? err : new GatewayError('upstream', 'Speech synthesis failed', err);
  }
}
