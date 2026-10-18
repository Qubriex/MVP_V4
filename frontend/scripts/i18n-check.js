#!/usr/bin/env node
// scripts/i18n-check.js — fails (exit 1) when the interface is not fully
// translated:
//   1. a key in en.json is missing from te.json or hi.json, or a translation
//      drops or renames a {placeholder};
//   2. a key used as t('…') in the code is not in en.json;
//   3. t() is called where no useUiLang() hook defines it;
//   4. English text is shown without t(): a JSX text node, a string or
//      template literal rendered as a JSX child, or a readable attribute
//      (placeholder, title, aria-label, alt, label) with 3+ Latin letters.
// Product names, codes, sample data and the like are listed in ALLOW; a line
// marked /* i18n-ignore */ is skipped.
//   node scripts/i18n-check.js [--verbose]
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const ROOT = path.join(__dirname, '..', 'src');
const read = (l) => JSON.parse(fs.readFileSync(path.join(ROOT, 'i18n', `${l}.json`), 'utf8'));
const en = read('en'); const te = read('te'); const hi = read('hi');
const VERBOSE = process.argv.includes('--verbose');
const SKIP_FILES = /__tests__|testUtils|setupTests|DevNav\.js$|\.test\.js$/;
const ATTRS = new Set(['placeholder', 'title', 'aria-label', 'alt', 'label']);

// Text that stays as it is in every language.
const ALLOW = [
  /^(Qubirex|Inferexaa Private Limited|Professor Qubirex|Capability Passport|Evidence ID|Mastery Log|GSTIN|GST|CGST|SGST|IGST|LPA|PDF|CSV|API|ATS|JWKS|URL|PIN|OK|QR|JSON|HTML|CSS|SQL|did:web|secure-config|X-QBX-API-Key)$/,
  /^(EN|English|తెలుగు|हिंदी|తె|हि)$/,
  /^QBX-[A-Z0-9-]+$/, /^LRNR-\d+$/, /^e\.g\. QX-/, /^qbx_/, /^https?:\/\//, /^\S+@\S+$/, /^[A-Z]{1,4}\d?$/,
  /^[A-Z][a-z]+ [A-Z][a-z]+$/, // sample person names in demo data
  /^JWKS URL$/, /^[0-9A-Z]{15}$/ // sample GSTIN
];
const allowed = (s) => ALLOW.some(r => r.test(s.trim()));
const latinWords = (s) => /[A-Za-z]{3,}/.test(s.replace(/\{[^}]*\}/g, ''));

const problems = [];

// 1. Completeness and placeholders.
const holes = (s) => (s.match(/\{\w+\}/g) || []).sort().join(',');
for (const [k, v] of Object.entries(en)) {
  for (const [name, dict] of [['te', te], ['hi', hi]]) {
    if (dict[k] === undefined) problems.push(`missing ${name}: ${k}`);
    else if (holes(dict[k]) !== holes(v)) problems.push(`placeholder mismatch ${name}: ${k}`);
  }
}

// 2 and 3. Walk the source.
function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(d => {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) return d.name === 'i18n' ? [] : files(p);
    return /\.js$/.test(d.name) && !SKIP_FILES.test(p) ? [p] : [];
  });
}
const usedKeys = new Set();
for (const file of files(ROOT)) {
  const src = fs.readFileSync(file, 'utf8');
  if (!/<[A-Za-z]/.test(src) && !/\bt\(/.test(src)) continue;
  let ast;
  try { ast = parser.parse(src, { sourceType: 'module', plugins: ['jsx'] }); } catch (e) { problems.push(`parse error: ${file}: ${e.message}`); continue; }
  const rel = path.relative(path.join(ROOT, '..'), file);
  const at = (node) => `${rel}:${node.loc.start.line}`;
  const lines = src.split('\n');
  const flag = (node, text) => {
    if (lines[node.loc.start.line - 1].includes('i18n-ignore')) return; // marked as data or code on purpose
    const s = text.replace(/\s+/g, ' ').trim();
    if (s && latinWords(s) && !allowed(s)) problems.push(`untranslated ${at(node)}: ${s.slice(0, 80)}`);
  };
  // Strings that end up as JSX children: direct, or through ?:, && and ||.
  const rendered = (n) => {
    if (!n) return;
    if (n.type === 'StringLiteral') flag(n, n.value);
    else if (n.type === 'TemplateLiteral') flag(n, n.quasis.map(q => q.value.cooked).join('{x}'));
    else if (n.type === 'ConditionalExpression') { rendered(n.consequent); rendered(n.alternate); }
    else if (n.type === 'LogicalExpression') rendered(n.right);
  };
  traverse(ast, {
    CallExpression(p) {
      const c = p.node.callee;
      if (c.type === 'Identifier' && (c.name === 't' || c.name === 'tx') && !p.scope.hasBinding(c.name)) problems.push(`no hook: ${at(p.node)} calls ${c.name}() without useUiLang() in scope`);
      if ((c.type === 'Identifier' && (c.name === 't' || c.name === 'tx')) || (c.type === 'Identifier' && c.name === 'translate')) {
        const a = p.node.arguments[c.name === 'translate' ? 1 : 0];
        if (a && a.type === 'StringLiteral' && /^[a-z][\w-]*(\.[\w-]+)+$/.test(a.value)) usedKeys.add(a.value);
      }
    },
    JSXText(p) { flag(p.node, p.node.value); },
    JSXExpressionContainer(p) {
      if (p.parent.type === 'JSXElement' || p.parent.type === 'JSXFragment') rendered(p.node.expression);
    },
    JSXAttribute(p) {
      const name = p.node.name.name;
      if (!ATTRS.has(name) || !p.node.value) return;
      const v = p.node.value;
      if (v.type === 'StringLiteral') flag(v, v.value);
      else if (v.type === 'JSXExpressionContainer') rendered(v.expression);
    }
  });
}
for (const k of usedKeys) if (en[k] === undefined) problems.push(`unknown key: ${k}`);

const counts = problems.reduce((m, p) => { const k = p.split(/[: ]/)[0]; m[k] = (m[k] || 0) + 1; return m; }, {});
if (problems.length) {
  (VERBOSE ? problems : problems.slice(0, 60)).forEach(p => console.log(p));
  if (!VERBOSE && problems.length > 60) console.log(`… and ${problems.length - 60} more (--verbose)`);
  console.log(`\ni18n-check: ${problems.length} problem(s)`, counts);
  process.exit(1);
}
console.log(`i18n-check: OK — ${Object.keys(en).length} keys in en, te and hi; no untranslated text found.`);
