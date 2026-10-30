/* runners/js-worker.js — runs a learner's JavaScript inside a Web Worker: no
   page, no DOM, no cookies; network calls are switched off, and the page ends
   the worker if it runs too long. Tests: { name, call, expected } compares
   JSON.stringify(result) with expected; { name, output } compares console.log text. */
self.fetch = undefined; self.XMLHttpRequest = undefined; self.WebSocket = undefined; self.importScripts = undefined;
const show = (v) => (typeof v === 'string' ? v : JSON.stringify(v));
function run(code, extra) {
  const lines = [];
  const consoleLike = { log: (...a) => lines.push(a.map(show).join(' ')), error: (...a) => lines.push(a.map(show).join(' ')) };
  let value; let error = null;
  try {
    // eslint-disable-next-line no-new-func
    value = new Function('console', `"use strict";\n${code}\n${extra ? `return (${extra});` : ''}`)(consoleLike);
  } catch (e) { error = `${e.name}: ${e.message}`; }
  return { value, output: lines.join('\n'), error };
}
self.onmessage = (e) => {
  const { code, tests = [] } = e.data;
  const first = run(code);
  const results = tests.map(t => {
    if (t.call) {
      const r = run(code, t.call);
      const got = r.error || show(r.value);
      return { name: t.name, hidden: !!t.hidden, passed: !r.error && got === t.expected, got, expected: t.expected, call: t.hidden ? null : t.call };
    }
    const printed = first.output.trim();
    return { name: t.name, hidden: !!t.hidden, passed: !first.error && printed === String(t.output).trim(), got: first.error || printed, expected: t.output };
  });
  self.postMessage({ ok: !first.error, output: first.output, error: first.error, results });
};
