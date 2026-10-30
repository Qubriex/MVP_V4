// src/utils/codeRunner.js — runs a learner's code in the browser, never on
// the API server: Python (Pyodide), JavaScript (a sandboxed worker) and SQL
// (sql.js) each run in a Web Worker that is ended after the time limit.
// Java has no browser runner yet: it is checked by its structure (what the
// task asks the code to contain) and the example's known output is shown.
const WORKER = { python: '/runners/python-worker.js', javascript: '/runners/js-worker.js', sql: '/runners/sql-worker.js' };
// The first Python run downloads the runtime (about 12 MB, cached after).
const LIMIT_MS = { python: 60000, javascript: 4000, sql: 15000 };

/**
 * @param {{ language: 'python'|'javascript'|'sql'|'java', code: string, tests?: object[], setup?: string, stdin?: string, expectedOutput?: string }} job
 * @returns {Promise<{ ok: boolean, output: string, error: string|null, results: object[], timedOut?: boolean, runner: string }>}
 */
export function runCode({ language, code, tests = [], setup = '', stdin = '', expectedOutput = null }) {
  if (language === 'java') return Promise.resolve(checkJava(code, tests, expectedOutput));
  const url = WORKER[language];
  if (!url || typeof Worker === 'undefined') return Promise.resolve({ ok: false, output: '', error: 'This browser cannot run code here.', results: [], runner: 'none' });
  return new Promise((resolve) => {
    const w = new Worker(url);
    const timer = setTimeout(() => { w.terminate(); resolve({ ok: false, output: '', error: 'timeout', timedOut: true, results: [], runner: language }); }, LIMIT_MS[language] + (language === 'python' && /^\s*(import|from)\s+(numpy|pandas)\b/m.test(code) ? 120000 : 0));
    w.onmessage = (e) => { clearTimeout(timer); w.terminate(); resolve({ ...e.data, runner: language }); };
    w.onerror = (e) => { clearTimeout(timer); w.terminate(); resolve({ ok: false, output: '', error: e.message || 'The runner stopped.', results: [], runner: language }); };
    w.postMessage({ code, tests, setup, stdin });
  });
}

// Java, until the server sandbox exists: each test names something the code
// must contain ({ pattern }) or must not contain ({ absent }).
function checkJava(code, tests, expectedOutput) {
  const src = String(code || '');
  const results = tests.map(t => {
    const re = new RegExp(t.pattern || t.absent, t.flags || 'm');
    const passed = t.absent ? !re.test(src) : re.test(src);
    return { name: t.name, hidden: !!t.hidden, passed, got: passed ? 'ok' : 'missing', expected: t.expected || t.name };
  });
  return { ok: true, output: expectedOutput || '', error: null, results, runner: 'java-structure' };
}
