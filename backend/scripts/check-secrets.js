// scripts/check-secrets.js
// Closed core, open protocol (spec §2, §10): calibrated parameters, rubric
// texts, generators, mutants, CKB lexicons, prompts and the canary set live in
// secure-config/, a separate private repository mounted at runtime. This check
// fails if any of them appears in this repository:
//   secure-config/**   — never, in any form
//   *.rubric.*, mutants/**, prompts/**  — only as placeholders whose first line
//                        is exactly PLACEHOLDER_MARKER (no real content)
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
  return findViolations(repoFiles(root), (f) => fs.readFileSync(path.join(root, f), 'utf8'));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const violations = checkRepository();
  if (violations.length) {
    console.error('Secrets separation check FAILED:\n  ' + violations.join('\n  '));
    process.exit(1);
  }
  console.log('Secrets separation check passed.');
}
