// e2e/no-ugly-errors.mjs — nothing broken ever reaches the screen.
// Every route on every side (public, learner, college, employer, admin), in
// English, Telugu and Hindi, at 1440 px and 390 px. A page fails if its text
// or any visible SVG shows:
//   "Syntax error", "mermaid version", "Error:", "Exception", a stack trace,
//   "undefined", "NaN", "[object Object]", "mock:", raw diagram source,
// or if a visible element has aria-roledescription="error" (a library's
// error graphic). Lessons are opened at "See the code" too, so diagrams and
// the code panel are covered.
//   BASE=http://localhost:3000 node e2e/no-ugly-errors.mjs [--quick]
// --quick: English and Telugu at 1440 px only.
import { createRequire } from 'module';
import path from 'path';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(path.join(process.env.NODE_PATH || '/opt/node22/lib/node_modules', 'playwright'))); }
const BASE = process.env.BASE || 'http://localhost:3000';
const BYPASS = process.env.VERCEL_BYPASS ? { extraHTTPHeaders: { 'x-vercel-protection-bypass': process.env.VERCEL_BYPASS, 'x-vercel-set-bypass-cookie': 'true' } } : {};
const PASSWORD = 'QubirexTest2026!';
const QUICK = process.argv.includes('--quick');
const LANGS = QUICK ? ['english', 'telugu'] : ['english', 'telugu', 'hindi'];
const WIDTHS = QUICK ? [1440] : [1440, 390];

const LESSONS = ['py-m1-l1', 'py-m1-l2', 'py-m1-l4', 'py-m4-l5', 'py-m6-l1', 'jv-m3-l2', 'jv-m4-l3', 'jv-m5-l6', 'jv-m7-l1'];
const SIDES = {
  public: { routes: ['/', '/pricing', '/learners', '/colleges', '/employers', '/demo', '/signin', '/topics', '/legal/privacy', '/legal/terms', '/developers', '/login', '/learner-login', '/employer/login', '/admin/login', '/verify', '/verify/QBX-DEMO-0000'] },
  learner: {
    login: async (p) => { await p.goto(`${BASE}/learner-login`); await p.fill('#lref', 'TEST-LRNR-001'); await p.fill('#leng', 'QX-FSD-T01'); await p.fill('#lpin', '410585'); await p.click('form button[type=submit]'); await p.waitForURL(/\/learn\//); },
    routes: ['/learn/dashboard', '/learn/record', '/learn/history', '/learn/reviews', '/learn/assigned', '/learn/passport', '/learn/readiness', '/learn/jobs', '/learn/courses', '/learn/courses/python', '/learn/courses/java',
      ...LESSONS.map(l => `/learn/lesson/${l}`), ...LESSONS.slice(0, 4).map(l => `/learn/lesson/${l}#code`), '/learn/modules/py-m3/test', '/learn/modules/py-m3/project', '/learn/profile', '/learn/resume', '/learn/settings', '/learn/notifications', '/learn/session']
  },
  college: {
    login: async (p) => { await p.goto(`${BASE}/login`); await p.fill('#em', 'test.institution@qubirex.local'); await p.fill('#pw', PASSWORD); await p.click('form button[type=submit]'); await p.waitForURL(/\/institution\/(?!invite)/); },
    routes: ['/institution/home', '/institution/team', '/institution/students', '/institution/cohorts', '/institution/curriculum', '/institution/topics', '/institution/benchmark', '/institution/review', '/institution/bridges', '/institution/placements', '/institution/board-report', '/institution/profile']
  },
  employer: {
    login: async (p) => { await p.goto(`${BASE}/employer/login`); await p.fill('#em', 'test.employer@qubirex.local'); await p.fill('#pw', PASSWORD); await p.click('form button[type=submit]'); await p.waitForURL(/\/employer\/(home|company)/); },
    routes: ['/employer/home', '/employer/company', '/employer/team', '/employer/roles', '/employer/pipeline', '/employer/sponsor', '/employer/colleges', '/employer/templates', '/employer/billing']
  },
  admin: {
    login: async (p) => { await p.goto(`${BASE}/admin/login`); await p.fill('#em', 'test.admin@qubirex.local'); await p.fill('#pw', PASSWORD); await p.click('form button[type=submit]'); await p.waitForURL(/\/admin\/(?!login)/); },
    routes: ['/admin/overview', '/admin/employers', '/admin/ontology', '/admin/quality', '/admin/voice', '/admin/messages']
  }
};

// What must never be on screen. Plain words only, so a real lesson word
// ("Full-stack developer", a "Stack" lesson) does not count as an error.
const FORBIDDEN = [
  [/Syntax error/i, 'Syntax error'], [/mermaid version/i, 'mermaid version'], [/\bError:/, 'Error:'], [/\bException\b/, 'Exception'],
  [/stack trace|\bat \S+ \(\S+:\d+:\d+\)/i, 'stack trace'], [/\bundefined\b/, 'undefined'], [/\bNaN\b/, 'NaN'], [/\[object Object\]/, '[object Object]'],
  [/\bmock:/, 'mock:'], [/^\s*(graph|flowchart) (TD|LR|TB)\b/m, 'diagram source']
];

const results = [];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
// One sign-in per side, reused for every language and width (sign-in is rate-limited).
const sessions = {};
async function sessionFor(side) {
  if (!SIDES[side].login) return undefined;
  if (!sessions[side]) {
    sessions[side] = (async () => {
      const ctx = await browser.newContext({ ...BYPASS });
      const page = await ctx.newPage();
      await SIDES[side].login(page);
      await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
      const state = await ctx.storageState();
      await ctx.close();
      return state;
    })();
  }
  return sessions[side];
}
async function sweep(side, lang, width) {
  let storageState;
  try { storageState = await sessionFor(side); } catch (err) { results.push({ side, lang, width, route: '(sign-in)', found: [`could not sign in: ${String(err.message).slice(0, 80)}`] }); return; }
  const ctx = await browser.newContext({ ...BYPASS, viewport: { width, height: 900 }, ...(storageState ? { storageState } : {}) });
  await ctx.addInitScript((l) => { try { localStorage.setItem('qubirex_ui_lang', l); } catch { /* blocked */ } }, lang);
  const page = await ctx.newPage();
  const def = SIDES[side];
  try {
    if (side === 'learner') {
      await page.goto(`${BASE}/learn/dashboard`);
      await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
      await page.evaluate(async (v) => { await fetch('/api/learner/learning-language', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('qubirex_token')}` }, body: JSON.stringify({ value: v }) }); }, lang);
    }
  } catch (err) { results.push({ side, lang, width, route: '(sign-in)', found: [`could not sign in: ${String(err.message).slice(0, 80)}`] }); await ctx.close(); return; }
  for (const r of def.routes) {
    const [route, step] = r.split('#');
    await page.goto(`${BASE}${route}`);
    await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
    if (step) { await page.evaluate((s) => document.querySelector(`li[data-step="${s}"] button`)?.click(), step); await page.waitForTimeout(1500); }
    await page.waitForTimeout(600);
    const seen = await page.evaluate(() => {
      const text = document.body.innerText || '';
      const svgText = [...document.querySelectorAll('svg')].filter(s => s.getBoundingClientRect().width > 0).map(s => s.textContent || '').join('\n');
      const errorGraphic = [...document.querySelectorAll('[aria-roledescription="error"], .error-icon')].some(e => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0; });
      return { text, svgText, errorGraphic };
    });
    const found = FORBIDDEN.filter(([re]) => re.test(seen.text) || re.test(seen.svgText)).map(([, name]) => name);
    if (seen.errorGraphic) found.push('error graphic');
    if (found.length) {
      const sample = found.map(f => { const re = FORBIDDEN.find(x => x[1] === f)?.[0]; const m = re && (re.exec(seen.text) || re.exec(seen.svgText)); const src = m ? (m.input || '') : ''; return m ? src.slice(Math.max(0, m.index - 40), m.index + 40).replace(/\s+/g, ' ') : f; });
      results.push({ side, lang, width, route: r, found, sample });
    }
    results.push({ side, lang, width, route: r, ok: !found.length });
  }
  await ctx.close();
}

const jobs = [];
for (const side of Object.keys(SIDES)) for (const lang of LANGS) for (const width of WIDTHS) jobs.push([side, lang, width]);
const started = Date.now();
const workers = Array.from({ length: 4 }, async () => { while (jobs.length) { const j = jobs.shift(); await sweep(...j); } });
await Promise.all(workers);
await browser.close();

const pages = results.filter(r => 'ok' in r);
const bad = results.filter(r => r.found);
for (const b of bad) console.log(`✗ ${b.side} · ${b.lang} · ${b.width}px · ${b.route}: ${b.found.join(', ')}${b.sample ? ` — "${b.sample.join(' | ')}"` : ''}`);
console.log(`${pages.length - bad.filter(b => b.route !== '(sign-in)').length}/${pages.length} pages clean (${LANGS.length} languages × ${WIDTHS.length} widths) in ${Math.round((Date.now() - started) / 1000)} s`);
process.exit(bad.length ? 1 : 0);
