// scripts/diagrams-check.mjs — npm run diagrams:check
// Parses every diagram in backend/data/courses/** and backend/data/scripted/**
// with the same mermaid the app uses (in Node, on jsdom) and fails on any
// parse error, naming the file, the lesson / node and the language.
// Also exports parseDiagram() for the backend's TEACH check.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.resolve(HERE, '../../backend/data');
const DIAGRAM = /^\s*(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram(-v2)?|erDiagram|pie|mindmap|journey|gantt|timeline)\b/;

let mermaid = null;
async function load() {
  if (mermaid) return mermaid;
  const { JSDOM } = require('jsdom');
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
  for (const k of ['window', 'document', 'navigator', 'Element', 'HTMLElement', 'SVGElement', 'DOMParser', 'Node', 'MutationObserver']) {
    if (!(k in globalThis) || k === 'window' || k === 'document') { try { globalThis[k] = k === 'window' ? dom.window : dom.window[k]; } catch { /* read-only */ } }
  }
  mermaid = (await import('mermaid')).default;
  mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', suppressErrorRendering: true });
  return mermaid;
}

/** @returns {Promise<{ ok: boolean, error?: string }>} */
export async function parseDiagram(source) {
  const m = await load();
  try { await m.parse(String(source)); return { ok: true }; } catch (err) { return { ok: false, error: String(err?.message || err).split('\n').slice(0, 3).join(' ') }; }
}

/** Every diagram string in a JSON value, with where it was found. */
export function diagramsIn(value, where = []) {
  const out = [];
  const walk = (v, at) => {
    if (typeof v === 'string') { if (DIAGRAM.test(v)) out.push({ at: at.join('.'), source: v }); return; }
    if (Array.isArray(v)) { v.forEach((x, i) => walk(x, [...at, i])); return; }
    if (v && typeof v === 'object') Object.entries(v).forEach(([k, x]) => walk(x, [...at, k]));
  };
  walk(value, where);
  return out;
}

function files() {
  const out = [];
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach(e => {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p); else if (e.name.endsWith('.json')) out.push(p);
  });
  ['courses', 'scripted'].forEach(d => fs.existsSync(path.join(DATA, d)) && walk(path.join(DATA, d)));
  return out;
}

export async function checkAll() {
  const failures = [];
  let total = 0;
  for (const f of files()) {
    const doc = JSON.parse(fs.readFileSync(f, 'utf8'));
    for (const d of diagramsIn(doc)) {
      total += 1;
      const r = await parseDiagram(d.source);
      if (!r.ok) {
        const lesson = /lessons\.(\d+)/.exec(d.at)?.[1];
        const id = lesson != null ? doc.lessons?.[Number(lesson)]?.id : (doc.node || path.basename(f, '.json'));
        const lang = /\.(en|te|hi)$/.exec(d.at)?.[1] || /\.(english|telugu|hindi)\.json$/.exec(f)?.[1] || '';
        failures.push({ file: path.relative(path.resolve(DATA, '..'), f), id, lang, at: d.at, error: r.error });
      }
    }
  }
  return { total, failures };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { total, failures } = await checkAll();
  if (failures.length) {
    console.error(`diagrams:check FAILED — ${failures.length} of ${total} diagrams do not parse:`);
    failures.forEach(x => console.error(`  ${x.file} · ${x.id} · ${x.lang || '-'} · ${x.at}\n    ${x.error}`));
    process.exit(1);
  }
  console.log(`diagrams:check passed — ${total} diagrams parse.`);
}
