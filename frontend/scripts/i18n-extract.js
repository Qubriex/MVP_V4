#!/usr/bin/env node
// scripts/i18n-extract.js — moves user-facing English text in React files into
// src/i18n/en.json under namespaced keys and replaces it with t('key').
//   node scripts/i18n-extract.js [--dry] [files...]   (default: src/pages, src/components)
// What it changes (only inside React components, where the t() hook can live):
//   • JSX text. Text and simple values in the same element become ONE sentence
//     with {placeholders}, so Telugu and Hindi can use their own word order.
//   • Attributes people read: placeholder, title, aria-label, alt, label, …
//   • Messages: setMsg('…'), setError('…'), errMsg(e, '…'), window.confirm('…'),
//     and label/title/body/… properties of objects built inside a component.
// It adds `const { t } = useUiLang()` (or `t: tx` if `t` is taken) and the
// import. Anything it cannot change safely (module-level constants, helper
// functions) is listed in scripts/i18n-extract-report.txt for a hand edit.
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const ROOT = path.join(__dirname, '..', 'src');
const EN = path.join(ROOT, 'i18n', 'en.json');
const DRY = process.argv.includes('--dry');
const SKIP_FILES = /DevNav\.js$|__tests__|testUtils|i18n-check/;
const ATTRS = new Set(['placeholder', 'title', 'aria-label', 'alt', 'label', 'subtitle', 'hint', 'note', 'disabledReason', 'description', 'emptyText', 'caption', 'text']);
const PROPS = new Set(['label', 'title', 'body', 'cta', 'text', 'why', 'hint', 'placeholder', 'description', 'subtitle', 'note', 'message', 'empty', 'help', 'tip', 'question', 'answer']);
const SETTERS = /^set(Msg|Error|Note|Notice|Status|Message|Info|Warning|Hint|Result|Banner|Flash|Problem|Feedback)$/;
const KEEP = /^(Qubirex|Inferexaa Private Limited|QBX-[A-Z0-9-]+|[A-Z0-9_-]{1,5}|https?:\/\/\S+|\S+@\S+|•|·|—|→|←)$/;

const en = JSON.parse(fs.readFileSync(EN, 'utf8'));
const byText = new Map(); // ns|text → key
Object.entries(en).forEach(([k, v]) => { const ns = k.split('.').slice(0, -1).join('.'); byText.set(`${ns}|${v}`, k); });
const report = [];
let added = 0;

const isKey = (s) => /^[a-z][\w-]*(\.[\w-]+)+$/.test(s.trim());
const isWords = (s) => /[A-Za-z]{2,}/.test(s) && /[a-z]{2,}/.test(s) && !KEEP.test(s.trim()) && !isKey(s);
const camel = (s) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').trim().split(/\s+/).filter(Boolean)
  .filter((w, i, a) => !(a.length > 2 && ['the', 'a', 'an', 'to', 'of', 'and', 'or', 'is', 'are', 'your', 'you', 'for', 'in', 'on', 'it', 'this', 'that', 'be', 'with'].includes(w)))
  .slice(0, 4).map((w, i) => (i ? w[0].toUpperCase() + w.slice(1) : w)).join('') || 'text';
function nsOf(file) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/').replace(/\.js$/, '');
  const parts = rel.split('/');
  const side = { learn: 'learn', inst: 'inst', employer: 'emp', admin: 'adm', public: 'pub', shared: 'shared' }[parts[parts.length - 2]] || (parts[0] === 'pages' ? 'page' : 'ui');
  const name = parts[parts.length - 1];
  return `${side}.${name[0].toLowerCase()}${name.slice(1)}`;
}
function keyFor(ns, text) {
  const hit = byText.get(`${ns}|${text}`);
  if (hit) return hit;
  let base = `${ns}.${camel(text)}`; let k = base; let i = 2;
  while (en[k] !== undefined && en[k] !== text) k = `${base}${i++}`;
  en[k] = text; byText.set(`${ns}|${text}`, k); added += 1;
  return k;
}
const norm = (s) => s.replace(/\s+/g, ' ');

function componentOf(p) {
  let fn = p.getFunctionParent(); let comp = null;
  while (fn) {
    let name = fn.node.id?.name;
    if (!name && fn.parentPath.isVariableDeclarator()) name = fn.parentPath.node.id.name;
    if (!name && fn.parentPath.isExportDefaultDeclaration()) name = 'Default';
    if (name && /^[A-Z]/.test(name)) comp = fn;
    fn = fn.parentPath.getFunctionParent();
  }
  return comp;
}

function processFile(file) {
  const src = fs.readFileSync(file, 'utf8');
  let ast;
  try { ast = parser.parse(src, { sourceType: 'module', plugins: ['jsx'] }); } catch (e) { report.push(`${file}: parse error ${e.message}`); return; }
  const ns = nsOf(file);
  const edits = []; // { start, end, text }
  const comps = new Map(); // fn node → { path, name }
  const taken = new Set();
  const use = (p, start, end, buildText) => {
    const comp = componentOf(p);
    if (!comp) { report.push(`${path.relative(ROOT, file)}:${p.node.loc.start.line} outside a component: ${JSON.stringify(src.slice(start, end)).slice(0, 90)}`); return false; }
    if (!comps.has(comp.node)) {
      const own = comp.scope.getOwnBinding('t');
      const fromHook = own && own.path.isVariableDeclarator() && /useUiLang\(\)/.test(src.slice(own.path.node.start, own.path.node.end));
      comps.set(comp.node, { path: comp, fn: fromHook ? 't' : null, ownT: !!own });
    }
    const c = comps.get(comp.node);
    const inner = p.scope.getBinding('t');
    const clash = (inner && inner.scope.block !== comp.node) || (c.ownT && !c.fn);
    if (clash) c.needTx = true;
    for (let i = edits.length - 1; i >= 0; i--) if (edits[i].start < end && start < edits[i].end) return false;
    edits.push({ start, end, comp: c, build: buildText });
    return true;
  };

  traverse(ast, {
    JSXElement(p) { handleChildren(p); },
    JSXFragment(p) { handleChildren(p); },
    JSXAttribute(p) {
      const n = p.node; const name = n.name.name;
      if (!ATTRS.has(name) || !n.value) return;
      let str = null;
      if (n.value.type === 'StringLiteral') str = n.value.value;
      else if (n.value.type === 'JSXExpressionContainer' && n.value.expression.type === 'StringLiteral') str = n.value.expression.value;
      if (str == null || !isWords(str)) return;
      const k = keyFor(ns, norm(str).trim());
      use(p, n.value.start, n.value.end, (tf) => `{${tf}('${k}')}`);
    },
    StringLiteral(p) {
      const v = p.node.value; if (!isWords(v)) return;
      const par = p.parent;
      if (p.parentPath.isJSXAttribute() || p.parentPath.isJSXExpressionContainer() || p.parentPath.isImportDeclaration() || p.parentPath.isExportDeclaration()) return;
      let ok = false;
      if (par.type === 'ObjectProperty' && par.value === p.node && PROPS.has(par.key.name || par.key.value)) ok = true;
      if (par.type === 'CallExpression' && par.arguments.includes(p.node)) {
        const c = par.callee; const name = c.name || c.property?.name;
        const idx = par.arguments.indexOf(p.node);
        if (SETTERS.test(name || '') && idx === 0) ok = true;
        if (name === 'errMsg' && idx === 1) ok = true;
        if (['confirm', 'alert', 'prompt'].includes(name) && idx === 0) ok = true;
        if (['success', 'error', 'info'].includes(name) && c.object && /toast/i.test(c.object.name || '')) ok = true;
      }
      if (par.type === 'ConditionalExpression' && p.parentPath.parentPath.isJSXExpressionContainer()) ok = true;
      if (par.type === 'LogicalExpression' && p.parentPath.parentPath.isJSXExpressionContainer()) ok = true;
      if (!ok) return;
      const k = keyFor(ns, norm(v).trim());
      use(p, p.node.start, p.node.end, (tf) => `${tf}('${k}')`);
    },
    TemplateLiteral(p) {
      const par = p.parent;
      let ok = false;
      if (par.type === 'CallExpression' && par.arguments[0] === p.node) { const name = par.callee.name || par.callee.property?.name; if (SETTERS.test(name || '') || ['confirm', 'alert'].includes(name)) ok = true; }
      if (par.type === 'ObjectProperty' && par.value === p.node && PROPS.has(par.key.name || par.key.value)) ok = true;
      if (par.type === 'JSXExpressionContainer' && !p.parentPath.parentPath.isJSXAttribute()) ok = true;
      if (par.type === 'JSXExpressionContainer' && p.parentPath.parentPath.isJSXAttribute() && ATTRS.has(p.parentPath.parent.name.name)) ok = true;
      if (!ok) return;
      const text = p.node.quasis.map(q => q.value.cooked).join(' ');
      if (!isWords(text)) return;
      const vars = []; let tpl = '';
      for (let i = 0; i < p.node.quasis.length; i++) {
        tpl += p.node.quasis[i].value.cooked;
        const ex = p.node.expressions[i];
        if (!ex) continue;
        if (!simple(ex)) { report.push(`${path.relative(ROOT, file)}:${p.node.loc.start.line} template with logic: ${src.slice(p.node.start, p.node.end).slice(0, 100)}`); return; }
        const nm = varName(ex, vars); vars.push([nm, src.slice(ex.start, ex.end)]); tpl += `{${nm}}`;
      }
      const k = keyFor(ns, norm(tpl).trim());
      const args = vars.length ? `, { ${vars.map(([n, e]) => (n === e ? n : `${n}: ${e}`)).join(', ')} }` : '';
      const lead = /^\s/.test(tpl) ? "' ' + " : ''; const trail = /\s$/.test(tpl) && tpl.trim() ? " + ' '" : '';
      use(p, p.node.start, p.node.end, (tf) => `${lead}${tf}('${k}'${args})${trail}`);
    }
  });

  function simple(ex) {
    return ['Identifier', 'MemberExpression', 'OptionalMemberExpression', 'NumericLiteral'].includes(ex.type)
      || (['CallExpression', 'OptionalCallExpression'].includes(ex.type) && !src.slice(ex.start, ex.end).includes('<') && ex.arguments.length <= 3 && !/[?]/.test(src.slice(ex.start, ex.end).replace(/\?\./g, '')))
      || (ex.type === 'BinaryExpression' && !/[?<]/.test(src.slice(ex.start, ex.end)));
  }
  function varName(ex, vars) {
    let base = ex.type === 'Identifier' ? ex.name : ex.property?.name || ex.callee?.property?.name || ex.callee?.name || 'value';
    base = String(base).replace(/[^A-Za-z0-9_]/g, '') || 'value';
    if (/^\d/.test(base)) base = 'v' + base;
    let n = base; let i = 2;
    while (vars.some(([x, e]) => x === n && e !== src.slice(ex.start, ex.end))) n = base + i++;
    return n;
  }

  function handleChildren(p) {
    const kids = p.node.children;
    // Split children into runs of text + simple expressions (a "sentence").
    let run = [];
    const flush = () => {
      if (!run.length) return;
      const texts = run.filter(c => c.type === 'JSXText');
      const words = texts.map(c => c.value).join(' ');
      if (!isWords(words)) { run = []; return; }
      const exprs = run.filter(c => c.type === 'JSXExpressionContainer');
      const first = run.find(c => !(c.type === 'JSXText' && !c.value.trim()));
      const last = [...run].reverse().find(c => !(c.type === 'JSXText' && !c.value.trim()));
      if (!first) { run = []; return; }
      const vars = []; let tpl = '';
      for (const c of run) {
        if (c.type === 'JSXText') tpl += c.value;
        else { const ex = c.expression; const nm = varName(ex, vars); vars.push([nm, src.slice(ex.start, ex.end)]); tpl += `{${nm}}`; }
      }
      const lead = /^[ \t]+\S/.test(first.type === 'JSXText' ? first.value : '') ? "{' '}" : '';
      const trailRaw = last.type === 'JSXText' ? last.value : '';
      const trail = /\S[ \t]+$/.test(trailRaw) ? "{' '}" : '';
      const text = norm(tpl).trim();
      if (!/[A-Za-z]{2,}/.test(text.replace(/\{\w+\}/g, ''))) { run = []; return; }
      const k = keyFor(ns, text);
      const args = vars.length ? `, { ${vars.map(([n, e]) => (n === e ? n : `${n}: ${e}`)).join(', ')} }` : '';
      const start = first.type === 'JSXText' ? first.start + first.value.search(/\S/) : first.start;
      const end = last.type === 'JSXText' ? last.start + last.value.trimEnd().length : last.end;
      if (exprs.length === 0 && texts.length === 1 && KEEP.test(text)) { run = []; return; }
      use(p, start, end, (tf) => `${lead}{${tf}('${k}'${args})}${trail}`);
      run = [];
    };
    for (const c of kids) {
      if (c.type === 'JSXText') run.push(c);
      else if (c.type === 'JSXExpressionContainer' && c.expression.type !== 'JSXEmptyExpression' && simple(c.expression) && run.some(r => r.type === 'JSXText' && r.value.trim())) run.push(c);
      else if (c.type === 'JSXExpressionContainer' && c.expression.type !== 'JSXEmptyExpression' && simple(c.expression)) run.push(c);
      else { flush(); }
    }
    flush();
  }

  if (!edits.length) return;
  // Decide the translator name per component and add the hook.
  for (const c of comps.values()) {
    if (c.fn) continue;
    c.fn = c.needTx ? 'tx' : 't';
    const body = c.path.node.body;
    const decl = `const { t${c.fn === 'tx' ? ': tx' : ''} } = useUiLang();`;
    if (body.type === 'BlockStatement') edits.push({ start: body.start + 1, end: body.start + 1, text: `\n  ${decl}` });
    else { edits.push({ start: body.start, end: body.start, text: `{ ${decl} return (` }); edits.push({ start: body.end, end: body.end, text: '); }' }); }
  }
  let out = src;
  edits.sort((a, b) => b.start - a.start || b.end - a.end);
  for (const e of edits) out = out.slice(0, e.start) + (e.text != null ? e.text : e.build(e.comp.fn)) + out.slice(e.end);
  if (!/import\s*\{[^}]*\buseUiLang\b[^}]*\}\s*from/.test(out)) {
    const rel = path.relative(path.dirname(file), path.join(ROOT, 'context', 'UiLangContext')).replace(/\\/g, '/');
    const imp = `import { useUiLang } from '${rel.startsWith('.') ? rel : './' + rel}';\n`;
    const m = [...out.matchAll(/^import .*?;\s*$/gms)].pop();
    const at = m ? m.index + m[0].length : 0;
    out = out.slice(0, at) + (m ? '\n' : '') + imp + out.slice(at).replace(/^\n/, '');
  }
  if (!DRY) fs.writeFileSync(file, out);
  return edits.length;
}

const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.js') ? [path.join(d, e.name)] : []));
const files = (args.length ? args.map(a => path.resolve(a)) : [...walk(path.join(ROOT, 'pages')), ...walk(path.join(ROOT, 'components'))]).filter(f => !SKIP_FILES.test(f));
let total = 0;
for (const f of files) total += processFile(f) || 0;
if (!DRY) fs.writeFileSync(EN, JSON.stringify(en, null, 2) + '\n');
fs.writeFileSync(path.join(__dirname, 'i18n-extract-report.txt'), report.join('\n') + '\n');
console.log(`${files.length} files, ${total} edits, ${added} new keys, ${report.length} left for a hand edit (scripts/i18n-extract-report.txt)`);
