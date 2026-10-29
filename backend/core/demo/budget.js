// core/demo/budget.js — the demo's AI cost guardrails (spec B4).
//   Per sandbox: DEMO_AI_PER_SANDBOX text calls (default 25) and
//   DEMO_VOICE_SECONDS of voice (default 480 = 8 minutes).
//   All demos together: DEMO_AI_DAILY_LIMIT calls a day (default 1500, UTC).
// Each charge is one conditional UPDATE, so concurrent requests cannot
// overspend. Past a limit the gateway answers like a deployment without an AI
// key (code 'demo_limit'), and the pages fall back to their ready-made sample
// lessons, checks and role profiles: the demo keeps working, just not live.
import * as dal from '../db/dal.js';

const num = (v, d) => (Number.isFinite(Number(v)) && Number(v) >= 0 && v !== '' && v != null ? Number(v) : d);
export const demoLimits = (env = process.env) => ({
  perSandboxCalls: num(env.DEMO_AI_PER_SANDBOX, 25),
  perSandboxVoiceSeconds: num(env.DEMO_VOICE_SECONDS, 480),
  dailyCalls: num(env.DEMO_AI_DAILY_LIMIT, 1500)
});
export const DEMO_LIMIT_MESSAGE = 'Demo limit reached — sign up through your college to keep learning. The rest of the demo uses ready-made sample lessons.';
const today = () => new Date().toISOString().slice(0, 10);

const limitError = (scope) => Object.assign(new Error(DEMO_LIMIT_MESSAGE), { code: 'demo_limit', scope });

/** Count one AI use against the sandbox and the day; throws code 'demo_limit' when over. */
export async function chargeDemoAi(sandboxId, { calls = 0, voiceSeconds = 0 } = {}) {
  const L = demoLimits();
  const sb = await dal.run(`UPDATE demo_sandboxes SET ai_calls = ai_calls + ?, voice_seconds = voice_seconds + ?
    WHERE id = ? AND ai_calls + ? <= ? AND voice_seconds + ? <= ?`, calls, voiceSeconds, sandboxId, calls, L.perSandboxCalls, voiceSeconds, L.perSandboxVoiceSeconds);
  if (!sb.changes) throw limitError('sandbox');
  await dal.run('INSERT INTO demo_ai_usage (day, calls, voice_seconds) VALUES (?, 0, 0) ON CONFLICT (day) DO NOTHING', today());
  const day = await dal.run('UPDATE demo_ai_usage SET calls = calls + ?, voice_seconds = voice_seconds + ? WHERE day = ? AND calls + ? <= ?',
    calls + (voiceSeconds ? 1 : 0), voiceSeconds, today(), calls + (voiceSeconds ? 1 : 0), L.dailyCalls);
  if (!day.changes) throw limitError('daily');
}

/** What the demo bar shows: this sandbox's use, and whether the demo is in cached mode. */
export async function demoAiState(sandboxId) {
  const L = demoLimits();
  const sb = await dal.one('SELECT ai_calls, voice_seconds FROM demo_sandboxes WHERE id = ?', sandboxId);
  const day = await dal.one('SELECT calls FROM demo_ai_usage WHERE day = ?', today());
  const noKey = !process.env.GEMINI_API_KEY && (process.env.AI_ADAPTER || 'gemini') !== 'mock';
  const dailyOut = Number(day?.calls || 0) >= L.dailyCalls;
  const sandboxOut = Number(sb?.ai_calls || 0) >= L.perSandboxCalls;
  return {
    calls: Number(sb?.ai_calls || 0), calls_limit: L.perSandboxCalls,
    voice_seconds: Number(sb?.voice_seconds || 0), voice_limit: L.perSandboxVoiceSeconds,
    mode: noKey ? 'cached_no_key' : dailyOut ? 'cached_daily' : sandboxOut ? 'limit_reached' : 'live'
  };
}
