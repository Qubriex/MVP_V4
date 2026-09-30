// tests/structural/importGraph.js
// Static import graph for the structural walls. Follows every static import,
// re-export and literal dynamic import transitively. A dynamic import with a
// computed specifier inside a checked closure is itself a violation: the wall
// must be provable from the source.
import fs from 'fs';
import path from 'path';

const IMPORT_RE = /(?:^|[\s;])(?:import|export)\s+(?:[\s\S]*?\sfrom\s+)?['"]([^'"]+)['"]/g;
const DYNAMIC_RE = /import\(\s*([^)]*?)\s*\)/g;

/**
 * Remove comments with a scanner that respects string and template literals,
 * so text like "core/match/*" inside a line comment cannot open a block
 * comment and hide the imports that follow (a checker that goes blind would
 * let a wall violation pass silently).
 */
export function stripComments(source) {
  let out = '';
  let i = 0;
  const n = source.length;
  while (i < n) {
    const c = source[i];
    const d = source[i + 1];
    if (c === '/' && d === '/') { while (i < n && source[i] !== '\n') i += 1; continue; }
    if (c === '/' && d === '*') { const end = source.indexOf('*/', i + 2); i = end < 0 ? n : end + 2; out += ' '; continue; }
    if (c === '"' || c === "'" || c === '`') {
      const q = c; out += c; i += 1;
      while (i < n && source[i] !== q) { if (source[i] === '\\') { out += source[i]; i += 1; } out += source[i]; i += 1; }
      out += q; i += 1; continue;
    }
    out += c; i += 1;
  }
  return out;
}

export function parseImports(source) {
  const code = stripComments(source);
  const specs = new Set();
  const computed = [];
  for (const m of code.matchAll(IMPORT_RE)) specs.add(m[1]);
  for (const m of code.matchAll(DYNAMIC_RE)) {
    const lit = /^['"]([^'"]+)['"]$/.exec(m[1].trim());
    if (lit) specs.add(lit[1]); else computed.push(m[1].trim());
  }
  return { specs: [...specs], computed };
}

function resolveFile(fromFile, spec) {
  const base = path.resolve(path.dirname(fromFile), spec);
  for (const candidate of [base, `${base}.js`, `${base}.mjs`, path.join(base, 'index.js')]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/**
 * @param {string} root   repository (backend) root
 * @param {string[]} entries  files relative to root
 * @returns {{ files: Map<string, string[]>, packages: Set<string>, computed: Array<{file: string, expr: string}>, missing: Array<{file: string, spec: string}> }}
 *   files: relative path → chain of relative paths from an entry (for messages)
 */
export function closure(root, entries) {
  const files = new Map();
  const packages = new Set();
  const computed = [];
  const missing = [];
  const queue = entries.map(e => [path.resolve(root, e), [e]]);
  while (queue.length) {
    const [abs, chain] = queue.shift();
    const rel = path.relative(root, abs).split(path.sep).join('/');
    if (files.has(rel)) continue;
    files.set(rel, chain);
    const { specs, computed: dyn } = parseImports(fs.readFileSync(abs, 'utf8'));
    dyn.forEach(expr => computed.push({ file: rel, expr }));
    for (const spec of specs) {
      if (spec.startsWith('.') || spec.startsWith('/')) {
        const target = resolveFile(abs, spec);
        if (!target) { missing.push({ file: rel, spec }); continue; }
        const trel = path.relative(root, target).split(path.sep).join('/');
        queue.push([target, [...chain, trel]]);
      } else {
        packages.add(spec.startsWith('node:') ? spec.slice(5) : spec);
      }
    }
  }
  return { files, packages, computed, missing };
}

/** All .js/.mjs files under root, as relative paths, skipping node_modules and the given prefixes. */
export function listSourceFiles(root, { skip = [] } = {}) {
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      const abs = path.join(dir, entry.name);
      const rel = path.relative(root, abs).split(path.sep).join('/');
      if (skip.some(s => rel === s || rel.startsWith(`${s}/`))) continue;
      if (entry.isDirectory()) walk(abs);
      else if (/\.(m?js|cjs)$/.test(entry.name)) out.push(rel);
    }
  };
  walk(root);
  return out;
}
