/* runners/python-worker.js — runs a learner's Python in Pyodide (WebAssembly),
   inside a Web Worker: no page access, no network calls from the code, and the
   page ends the worker if it runs too long. Message in: { code, tests, stdin }.
   Tests: { name, call, expected } compares repr(eval(call)) with expected
   (_qbx_out(fn, *args) gives what fn printed);
   { name, stdin, output } runs the whole program and compares what it printed. */
let ready = null;
function boot() {
  if (!ready) {
    importScripts('/vendor/pyodide/pyodide.js');
    ready = loadPyodide({ indexURL: '/vendor/pyodide/' });
  }
  return ready;
}

const HARNESS = `
import sys, io, json, builtins
def _qbx_run(src, stdin_text):
    out = io.StringIO()
    feed = iter(stdin_text.split("\\n")) if stdin_text else iter([])
    def _input(prompt=""):
        out.write(str(prompt))
        try:
            return next(feed)
        except StopIteration:
            return ""
    def _qbx_out(fn, *args, **kwargs):
        buf = io.StringIO()
        prev = sys.stdout
        sys.stdout = buf
        try:
            fn(*args, **kwargs)
        finally:
            sys.stdout = prev
        return buf.getvalue()
    g = {"__name__": "__main__", "input": _input, "_qbx_out": _qbx_out}
    old = sys.stdout
    sys.stdout = out
    err = None
    try:
        exec(src, g)
    except Exception as e:
        err = f"{type(e).__name__}: {e}"
    finally:
        sys.stdout = old
    return g, out.getvalue(), err
`;

self.onmessage = async (e) => {
  const { code, tests = [], stdin = '' } = e.data;
  try {
    const py = await boot();
    py.runPython(HARNESS);
    const run = py.globals.get('_qbx_run');
    const first = run(code, stdin);
    const globals = first.get(0); const output = first.get(1); const error = first.get(2) ?? null;
    const results = [];
    for (const t of tests) {
      if (t.call) {
        let got = null; let err = null;
        try {
          py.globals.set('_qbx_g', globals);
          got = py.runPython(`repr(eval(${JSON.stringify(t.call)}, _qbx_g))`);
        } catch (ex) { err = String(ex.message || ex).split('\n').filter(Boolean).pop(); }
        results.push({ name: t.name, hidden: !!t.hidden, passed: err == null && got === t.expected, got: err || got, expected: t.expected, call: t.hidden ? null : t.call });
      } else if (t.output != null) {
        const r = run(code, t.stdin || '');
        const printed = String(r.get(1)).trim(); const err = r.get(2) ?? null;
        results.push({ name: t.name, hidden: !!t.hidden, passed: !err && printed === String(t.output).trim(), got: err || printed, expected: t.output, stdin: t.hidden ? null : t.stdin });
      }
    }
    self.postMessage({ ok: !error, output, error, results });
  } catch (ex) {
    self.postMessage({ ok: false, output: '', error: String(ex.message || ex), results: [] });
  }
};
