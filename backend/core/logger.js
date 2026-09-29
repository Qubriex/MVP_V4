// core/logger.js
// Structured logger: one JSON object per line on stdout (stderr for errors).
// Secrets are redacted by key name before anything is written, so a stray
// `logger.info('x', req.body)` can't leak a password or PIN.
//
//   logger.info('event.name', { ...fields })
//   const log = logger.child({ reqId }); log.warn('...', {...})
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };
const REDACT = /pass(word)?|pin$|^pin|secret|token|authorization|cookie|api[_-]?key|otp|salt|private/i;

let sink = (line, level) => (level >= LEVELS.error ? process.stderr : process.stdout).write(line + '\n');
const threshold = () => LEVELS[process.env.LOG_LEVEL || (process.env.NODE_ENV === 'test' ? 'silent' : 'info')] ?? LEVELS.info;

export function redact(value, depth = 0) {
  if (value === null || typeof value !== 'object' || depth > 6) return value;
  if (value instanceof Error) return { name: value.name, message: value.message, stack: value.stack };
  if (Array.isArray(value)) return value.map(v => redact(v, depth + 1));
  const out = {};
  for (const [k, v] of Object.entries(value)) out[k] = REDACT.test(k) ? '[redacted]' : redact(v, depth + 1);
  return out;
}

function make(bound) {
  const write = (level) => (msg, fields = {}) => {
    if (LEVELS[level] < threshold()) return;
    const entry = { ts: new Date().toISOString(), level, msg, ...redact(bound), ...redact(fields) };
    let line;
    try { line = JSON.stringify(entry); } catch { line = JSON.stringify({ ts: entry.ts, level, msg, note: 'unserialisable fields' }); }
    sink(line, LEVELS[level]);
  };
  return {
    debug: write('debug'),
    info: write('info'),
    warn: write('warn'),
    error: write('error'),
    child: (fields) => make({ ...bound, ...fields })
  };
}

export const logger = make({});

/** Test hook: capture log lines instead of writing them. Returns a restore function. */
export function setSink(fn) {
  const prev = sink;
  sink = fn;
  return () => { sink = prev; };
}
