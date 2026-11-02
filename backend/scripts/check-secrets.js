// scripts/check-secrets.js
// Closed core, open protocol (spec §2, §10): calibrated parameters, rubric
// texts, generators, mutants, CKB lexicons, prompts and the canary set live in
// secure-config/, a separate private repository mounted at runtime. This check
// fails if any of them appears in this repository:
//   secure-config/**   — never, in any form
//   *.rubric.*, mutants/**, prompts/**  — only as placeholders whose first line
//                        is exactly PLACEHOLDER_MARKER (no real content)
// It also fails if anything shaped like a Google API key (AIza… or the newer
// AQ.… keys) is in any file git would commit, or in frontend/build when it
// exists, so a Gemini key can never be committed or shipped to browsers.
// It checks every file git would commit (tracked + untracked, not ignored).
// Run by CI (npm run check:secrets) and by tests/structural/secrets.test.js.
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export const PLACEHOLDER_MARKER = '<!-- qubirex:placeholder -->';
const MAX_PLACEHOLDER_BYTES = 2048;

const RULES = [
  { name: 'secure-config', test: (f) => /(^|\/)secure-config\//.test(f), placeholderAllowed: false },
  { name: 'rubric', test: (f) => /\.rubric\./.test(path.basename(f)), placeholderAllowed: true },
  { name: 'mutants', test: (f) => /(^|\/)mutants\//.test(f), placeholderAllowed: true },
  { name: 'prompts', test: (f) => /(^|\/)prompts\//.test(f), placeholderAllowed: true }
];

// Google API keys: the classic AIza… form and the newer AQ.… form. Built from
// parts so this file itself does not look like a key.
export const GOOGLE_KEY = new RegExp(['AI' + 'za[0-9A-Za-z_-]{35}', 'AQ' + '\\.[0-9A-Za-z_-]{40,}'].join('|'));
const BINARY = /\.(png|jpe?g|gif|webp|ico|woff2?|ttf|eot|mp3|wav|ogg|mp4|pdf|zip|gz|wasm|map)$/i;

/** Files that hold something shaped like a Google API key (names only, never the match). */
export function findKeys(files, read) {
  const out = [];
  for (const f of files) {
    if (BINARY.test(f)) continue;
    let content = '';
    try { content = read(f); } catch { continue; }
    if (GOOGLE_KEY.test(content)) out.push(`${f}: looks like a Google API key — remove it and rotate the key`);
  }
  return out;
}

function buildFiles(root) {
  const dir = path.join(root, 'frontend', 'build');
  if (!fs.existsSync(dir)) return [];
  const out = [];
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach(e => (e.isDirectory() ? walk(path.join(d, e.name)) : out.push(path.relative(root, path.join(d, e.name)))));
  walk(dir);
  return out;
}

export function isPlaceholder(content) {
  const text = String(content);
  return Buffer.byteLength(text) <= MAX_PLACEHOLDER_BYTES && text.split(/\r?\n/, 1)[0].trim() === PLACEHOLDER_MARKER;
}

/**
 * @param {string[]} files repo-relative paths
 * @param {(file: string) => string} read returns file content
 * @returns {string[]} violations
 */
export function findViolations(files, read) {
  const out = [];
  for (const f of files) {
    const rule = RULES.find(r => r.test(f));
    if (!rule) continue;
    if (!rule.placeholderAllowed) { out.push(`${f}: ${rule.name} content must never be in this repository`); continue; }
    let content = '';
    try { content = read(f); } catch { content = ''; }
    if (!isPlaceholder(content)) out.push(`${f}: ${rule.name} file with real content (only "${PLACEHOLDER_MARKER}" placeholders are allowed)`);
  }
  return out;
}

export function repoRoot(from = path.dirname(fileURLToPath(import.meta.url))) {
  return execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: from, encoding: 'utf8' }).trim();
}

export function repoFiles(root = repoRoot()) {
  return execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8' })
    .split('\0').filter(Boolean);
}

export function checkRepository(root = repoRoot()) {
  const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
  const files = repoFiles(root);
  return [...findViolations(files, read), ...findKeys([...files, ...buildFiles(root)], read)];
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const violations = checkRepository();
  if (violations.length) {
    console.error('Secrets separation check FAILED:\n  ' + violations.join('\n  '));
    process.exit(1);
  }
  console.log('Secrets separation check passed.');
}
