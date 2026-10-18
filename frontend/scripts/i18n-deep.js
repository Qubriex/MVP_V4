#!/usr/bin/env node
// scripts/i18n-deep.js — second pass after i18n-extract.js: English string
// literals inside components that are rendered indirectly (nested ternaries,
// arguments to local helpers like stage('offer', 'Offer recorded.')).
//   node scripts/i18n-deep.js --list    show candidates
//   node scripts/i18n-deep.js           apply (t() must already be in scope)
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const ROOT = path.join(__dirname, '..', 'src');
const EN = path.join(ROOT, 'i18n', 'en.json');
const en = JSON.parse(fs.readFileSync(EN, 'utf8'));
const LIST = process.argv.includes('--list');
const ATTRS = new Set(['placeholder', 'title', 'aria-label', 'alt', 'label', 'subtitle', 'hint', 'note', 'disabledReason', 'description', 'emptyText', 'caption', 'text', 'kicker']);
const isKey = (s) => /^[a-z][\w-]*(\.[\w-]+)+$/.test(s.trim());
const human = (s) => /[a-z]{2,}/.test(s) && !isKey(s) && (/\s/.test(s.trim()) || /^[A-Z][a-z]+[.!?]?$/.test(s.trim()) || /^\s*\(/.test(s))
  && !/^(ln-|in-|sk-|ui-|pb-|is-|var\(|\/|https?:|#|\.|[\w-]+\.(js|css|png|csv|json)$)/.test(s.trim()) && !/^[a-z-]+$/.test(s.trim()) && !/[{}<>;=]|=>/.test(s);
const camel = (s) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').trim().split(/\s+/).filter(Boolean).slice(0, 4).map((w, i) => (i ? w[0].toUpperCase() + w.slice(1) : w)).join('') || 'text';
function nsOf(file) {
  const parts = path.relative(ROOT, file).replace(/\.js$/, '').split('/');
  const side = { learn: 'learn', inst: 'inst', employer: 'emp', admin: 'adm', public: 'pub', shared: 'shared' }[parts[parts.length - 2]] || (parts[0] === 'pages' ? 'page' : 'ui');
  const name = parts[parts.length - 1]; return `${side}.${name[0].toLowerCase()}${name.slice(1)}`;
}
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.js') ? [path.join(d, e.name)] : []));
const SKIP = /DevNav|learn\/Resume\.js|__tests__|shared\/ui\/index/;
// Values that are data or ids, not interface text (file:line).
const KEEP_AT = new Set(['pages/learn/JobMarket.js:20', 'pages/learn/JobMarket.js:82', 'pages/employer/Roles.js:131', 'pages/learn/Settings.js:30', 'components/shared/ui/Modal.js:12', 'pages/inst/Cohort.js:223']);
let total = 0; let added = 0;
for (const file of [...walk(path.join(ROOT, 'pages')), ...walk(path.join(ROOT, 'components'))].filter(f => !SKIP.test(f))) {
  const src = fs.readFileSync(file, 'utf8');
  const ast = parser.parse(src, { sourceType: 'module', plugins: ['jsx'] });
  const edits = [];
  traverse(ast, {
    StringLiteral(p) {
      const v = p.node.value; if (!human(v)) return;
      if (KEEP_AT.has(`${path.relative(ROOT, file)}:${p.node.loc.start.line}`)) return;
      const fn = p.getFunctionParent(); if (!fn) return;
      // t must be in scope here
      const tb = p.scope.getBinding('t') || p.scope.getBinding('tx'); if (!tb) return;
      const tf = p.scope.getBinding('t') && /useUiLang\(\)/.test(src.slice(p.scope.getBinding('t').path.node.start, p.scope.getBinding('t').path.node.end)) ? 't' : (p.scope.getBinding('tx') ? 'tx' : null);
      if (!tf) return;
      const par = p.parent;
      if (p.findParent(x => x.isImportDeclaration())) return;
      const attr = p.findParent(x => x.isJSXAttribute()); if (attr && !ATTRS.has(attr.node.name.name) && !(par.type === 'CallExpression' || par.type === 'ArrayExpression')) return;
      if (par.type === 'ObjectProperty' && par.key === p.node) return;
      if (par.type === 'MemberExpression' || par.type === 'OptionalMemberExpression') return;
      if (['BinaryExpression', 'SwitchCase', 'JSXAttribute'].includes(par.type)) return;
      if (par.type === 'CallExpression') {
        const c = par.callee; const nm = c.property?.name || c.name || '';
        if (['t', 'tx', 'includes', 'startsWith', 'endsWith', 'split', 'replace', 'match', 'test', 'get', 'post', 'put', 'delete', 'patch', 'join', 'indexOf', 'setItem', 'getItem', 'removeItem', 'querySelector', 'toLocaleDateString', 'toLocaleString', 'set', 'has', 'append', 'createElement', 'setAttribute', 'log', 'warn', 'error', 'dropCached', 'useCachedGet', 'fetchCached', 'navigate', 'Blob', 'speak', 'useSpeechInput', 'push'].includes(nm)) return;
      }
      if (par.type === 'NewExpression') return;
      if (p.findParent(x => x.isCallExpression() && ['api', 'axios'].includes(x.node.callee.object?.name))) return;
      const ns = nsOf(file); const text = v.replace(/\s+/g, ' ').trim();
      let k = Object.keys(en).find(x => x.startsWith(ns + '.') && en[x] === text);
      if (!k) { const base = `${ns}.${camel(text)}`; k = base; let i = 2; while (en[k] !== undefined) k = base + i++; if (!LIST) { en[k] = text; added += 1; } }
      const lead = /^\s/.test(v) ? "' ' + " : ''; const trail = /\s$/.test(v) ? " + ' '" : '';
      const inJsxText = par.type === 'JSXExpressionContainer';
      edits.push([p.node.start, p.node.end, `${lead}${tf}('${k}')${trail}`, text, p.node.loc.start.line, inJsxText]);
    }
  });
  if (!edits.length) continue;
  total += edits.length;
  if (LIST) { edits.forEach(e => console.log(`${path.relative(ROOT, file)}:${e[4]}  ${JSON.stringify(e[3]).slice(0, 100)}`)); continue; }
  let out = src; edits.sort((a, b) => b[0] - a[0]).forEach(([s, e, t]) => { out = out.slice(0, s) + t + out.slice(e); });
  fs.writeFileSync(file, out);
}
if (!LIST) fs.writeFileSync(EN, JSON.stringify(en, null, 2) + '\n');
console.log('candidates', total, 'new keys', added);
