// scripts/vendor-runtimes.js — copies the in-browser code runners from
// node_modules into public/vendor before a build or dev start, so they are
// served from our own site (no third-party script host): Pyodide (Python in
// WebAssembly) and sql.js (SQLite in WebAssembly). public/vendor is not committed.
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'public', 'vendor');
const copies = [
  ['pyodide', ['pyodide.js', 'pyodide.asm.js', 'pyodide.asm.wasm', 'python_stdlib.zip', 'pyodide-lock.json'], 'pyodide'],
  ['sql.js/dist', ['sql-wasm.js', 'sql-wasm.wasm'], 'sqljs']
];
for (const [pkg, files, dir] of copies) {
  const from = path.join(root, 'node_modules', pkg);
  const to = path.join(out, dir);
  fs.mkdirSync(to, { recursive: true });
  for (const f of files) fs.copyFileSync(path.join(from, f), path.join(to, f));
}
console.log(`runners copied to ${path.relative(root, out)}`);
