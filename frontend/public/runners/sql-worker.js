/* runners/sql-worker.js — runs a learner's SQL on a small practice database
   with sql.js (SQLite in WebAssembly), inside a Web Worker. Message in:
   { code, setup, tests }. Tests: { name, expected } compares the rows of the
   learner's last query (as JSON) with expected; { name, check, expected }
   runs a checking query after the learner's statements. */
let SQL = null;
async function boot() {
  if (!SQL) {
    importScripts('/vendor/sqljs/sql-wasm.js');
    SQL = await initSqlJs({ locateFile: (f) => `/vendor/sqljs/${f}` });
  }
  return SQL;
}
const rowsOf = (res) => (res.length ? res[res.length - 1].values : []);
const table = (res) => (res.length ? [res[res.length - 1].columns.join(' | '), ...res[res.length - 1].values.map(r => r.join(' | '))].join('\n') : '(no rows)');
self.onmessage = async (e) => {
  const { code, setup = '', tests = [] } = e.data;
  try {
    const S = await boot();
    const fresh = () => { const db = new S.Database(); if (setup) db.run(setup); return db; };
    let db = fresh(); let res = []; let error = null;
    try { res = db.exec(code); } catch (ex) { error = String(ex.message || ex); }
    const results = tests.map(t => {
      if (error) return { name: t.name, hidden: !!t.hidden, passed: false, got: error, expected: t.expected };
      let got;
      try { got = JSON.stringify(t.check ? rowsOf(db.exec(t.check)) : rowsOf(res)); } catch (ex) { got = String(ex.message || ex); }
      return { name: t.name, hidden: !!t.hidden, passed: got === t.expected, got, expected: t.expected };
    });
    db.close();
    self.postMessage({ ok: !error, output: error ? '' : table(res), error, results });
  } catch (ex) {
    self.postMessage({ ok: false, output: '', error: String(ex.message || ex), results: [] });
  }
};
