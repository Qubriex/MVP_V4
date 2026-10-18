#!/usr/bin/env node
// scripts/i18n-consts.js — converts the English text in named module-level
// constants (status maps, nav lists, help docs) into translation keys, so the
// render site can call t(VALUE). Usage: node scripts/i18n-consts.js file:CONST[,CONST] ...
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const ROOT = path.join(__dirname, '..', 'src');
const EN = path.join(ROOT, 'i18n', 'en.json');
const en = JSON.parse(fs.readFileSync(EN, 'utf8'));
const isKey = (s) => /^[a-z][\w-]*(\.[\w-]+)+$/.test(s.trim());
const isWords = (s) => /[A-Za-z]{2,}/.test(s) && /[a-z]{2,}/.test(s) && !isKey(s) && !/^(ln-|in-|sk-|ui-|pb-|\.|\/|var\(|https?:|[a-z_]+$|[a-z]+[A-Z]\w*$|[a-z]{2}-[A-Z]{2}$)/.test(s);
const camel = (s) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').trim().split(/\s+/).filter(Boolean).slice(0, 4).map((w, i) => (i ? w[0].toUpperCase() + w.slice(1) : w)).join('') || 'text';
function nsOf(file) {
  const parts = path.relative(ROOT, file).replace(/\.js$/, '').split('/');
  const side = { learn: 'learn', inst: 'inst', employer: 'emp', admin: 'adm', public: 'pub', shared: 'shared' }[parts[parts.length - 2]] || (parts[0] === 'pages' ? 'page' : 'ui');
  const name = parts[parts.length - 1];
  return `${side}.${name[0].toLowerCase()}${name.slice(1)}`;
}
let added = 0;
for (const arg of process.argv.slice(2)) {
  const [rel, list] = arg.split(':');
  const file = path.resolve(rel); const names = new Set(list.split(','));
  const src = fs.readFileSync(file, 'utf8');
  const ast = parser.parse(src, { sourceType: 'module', plugins: ['jsx'] });
  const edits = [];
  traverse(ast, {
    StringLiteral(p) {
      if (!isWords(p.node.value)) return;
      const d = p.findParent(x => x.isVariableDeclarator());
      if (!d || !names.has(d.node.id.name) || p.getFunctionParent()) return;
      const ns = `${nsOf(file)}.${d.node.id.name.toLowerCase().replace(/_(\w)/g, (m, c) => c.toUpperCase())}`;
      const text = p.node.value;
      let k = Object.keys(en).find(x => x.startsWith(ns + '.') && en[x] === text);
      if (!k) { const base = `${ns}.${camel(text)}`; k = base; let i = 2; while (en[k] !== undefined) k = base + i++; en[k] = text; added += 1; }
      edits.push([p.node.start, p.node.end, `'${k}'`]);
    }
  });
  let out = src;
  edits.sort((a, b) => b[0] - a[0]).forEach(([s, e, t]) => { out = out.slice(0, s) + t + out.slice(e); });
  fs.writeFileSync(file, out);
  console.log(rel, edits.length);
}
fs.writeFileSync(EN, JSON.stringify(en, null, 2) + '\n');
console.log('new keys', added);
