// e2e/smoke.mjs — click-free smoke test of every route, signed in with the
// seed accounts (backend: npm run seed:test). For each page it records
//   • console errors and uncaught exceptions,
//   • sideways overflow at 360 px and 1440 px,
//   • document.title (every route must have its own),
//   • in Telugu mode, the share of Telugu letters among all letters, and any
//     translation key shown as text (a missing t() at the render site),
// and runs axe on Home, Learner home, College home, Employer home and Verify
// (serious or critical issues fail).
//
//   BASE=http://localhost:3000 node e2e/smoke.mjs [--out report.json]
// Needs Playwright (npm i -g playwright, or set NODE_PATH to where it is) and
// axe-core (already in node_modules).
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(path.join(process.env.NODE_PATH || '/opt/node22/lib/node_modules', 'playwright'))); }
const here = path.dirname(fileURLToPath(import.meta.url));
const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js', { paths: [path.join(here, '..')] }), 'utf8');
const BASE = process.env.BASE || 'http://localhost:3000';
// A Vercel deployment behind Deployment Protection: VERCEL_BYPASS is the
// project's "Protection Bypass for Automation" secret (never committed).
const BYPASS = process.env.VERCEL_BYPASS ? { extraHTTPHeaders: { 'x-vercel-protection-bypass': process.env.VERCEL_BYPASS, 'x-vercel-set-bypass-cookie': 'true' } } : {};
const OUT = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : null;
const PASSWORD = 'QubirexTest2026!';

const PUBLIC = ['/', '/pricing', '/learners', '/colleges', '/employers', '/demo', '/signin',
  '/legal/privacy', '/legal/terms', '/legal/dpdp', '/legal/grievance', '/developers', '/dev', '/login', '/learner-login', '/employer/login', '/employer/register', '/admin/login', '/verify', '/verify/QBX-DEMO-0000'];
const ROLES = {
  learner: { login: async (p) => { await p.goto(`${BASE}/learner-login`); await p.fill('#lref', 'TEST-LRNR-001'); await p.fill('#leng', 'QX-FSD-T01'); await p.fill('#lpin', '410585'); await p.click('form button[type=submit]'); await p.waitForURL(/\/learn\//); },
    routes: ['/learn/dashboard', '/learn/record', '/learn/reviews', '/learn/passport', '/learn/jobs', '/learn/courses', '/learn/courses/python', '/learn/lesson/py-m3-l3', '/learn/profile', '/learn/resume', '/learn/settings', '/learn/session'] },
  college: { login: async (p) => { await p.goto(`${BASE}/login`); await p.fill('#em', 'test.institution@qubirex.local'); await p.fill('#pw', PASSWORD); await p.click('form button[type=submit]'); await p.waitForURL(/\/institution\/(?!invite)/); },
    routes: ['/institution/home', '/institution/team', '/institution/students', '/institution/students/add', '/institution/cohorts', '/institution/cohorts/new', '/institution/curriculum', '/institution/benchmark', '/institution/review', '/institution/bridges', '/institution/placements', '/institution/board-report', '/institution/profile'],
    discover: { from: '/institution/cohorts', pattern: /^\/institution\/cohorts\/(?!new$)[^/]+$/, extra: (h) => [h, `${h}/live`] } },
  employer: { login: async (p) => { await p.goto(`${BASE}/employer/login`); await p.fill('#em', 'test.employer@qubirex.local'); await p.fill('#pw', PASSWORD); await p.click('form button[type=submit]'); await p.waitForURL(/\/employer\/(home|company)/); },
    routes: ['/employer/home', '/employer/company', '/employer/team', '/employer/api-keys', '/employer/roles', '/employer/pipeline', '/employer/sponsor', '/employer/colleges', '/employer/verify-bulk', '/employer/templates', '/employer/billing'] },
  admin: { login: async (p) => { await p.goto(`${BASE}/admin/login`); await p.fill('#em', 'test.admin@qubirex.local'); await p.fill('#pw', PASSWORD); await p.click('form button[type=submit]'); await p.waitForURL(/\/admin\/(?!login)/); },
    routes: ['/admin/overview', '/admin/employers', '/admin/ontology', '/admin/quality', '/admin/messages'] }
};
const AXE_PAGES = new Set(['/', '/demo', '/dev', '/learn/dashboard', '/institution/home', '/employer/home', '/verify']);

const results = [];
const titles = new Map();

async function settle(page) {
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(300);
}
const overflow = (page) => page.evaluate(() => {
  const w = document.documentElement.clientWidth;
  const over = document.documentElement.scrollWidth - w;
  if (over <= 1) return null;
  // The widest offenders, to make the report useful.
  const bad = [...document.querySelectorAll('body *')].filter(el => el.getBoundingClientRect().right > w + 1 && getComputedStyle(el).position !== 'fixed')
    .slice(0, 3).map(el => `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}`);
  return { by: over, bad };
});
const teluguShare = (page) => page.evaluate(() => {
  const text = document.body.innerText;
  const te = (text.match(/[ఀ-౿]/g) || []).length;
  const la = (text.match(/[A-Za-z]/g) || []).length;
  return te + la ? Math.round((te / (te + la)) * 100) : 0;
});

async function checkRoute(context, route, role) {
  const page = await context.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  page.on('pageerror', e => errors.push(`pageerror: ${e.message.slice(0, 200)}`));
  const r = { role, route, errors };
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}${route}`); await settle(page);
  r.finalUrl = page.url().replace(BASE, '');
  r.title = await page.title();
  r.overflow1440 = await overflow(page);
  await page.setViewportSize({ width: 360, height: 780 }); await page.waitForTimeout(250);
  r.overflow360 = await overflow(page);
  if (AXE_PAGES.has(route)) {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(900); // let fade-in animations finish
    await page.addScriptTag({ content: AXE });
    const ax = await page.evaluate(async () => (await window.axe.run(document, { resultTypes: ['violations'] })).violations
      .filter(v => ['serious', 'critical'].includes(v.impact)).map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, detail: v.nodes.slice(0, 8).map(n => `${n.target.join(' ')} ${n.any[0]?.data ? `${n.any[0].data.fgColor} on ${n.any[0].data.bgColor} = ${n.any[0].data.contrastRatio}` : ''}`) })));
    r.axe = ax;
  }
  // Telugu mode on the same page.
  await page.evaluate(() => localStorage.setItem('qubirex_ui_lang', 'telugu'));
  await page.reload(); await settle(page);
  r.teluguPct = await teluguShare(page);
  // A translation key shown as text means a t() call is missing at the render site.
  r.rawKeys = await page.evaluate(() => [...new Set(document.body.innerText.match(/\b(?:learn|inst|emp|adm|page|shared|ui|pub|nav|title|home|verify|demo|price)\.[a-zA-Z0-9]+(?:\.[a-zA-Z0-9]+)+\b/g) || [])].slice(0, 5));
  r.titleTe = await page.title();
  await page.evaluate(() => localStorage.setItem('qubirex_ui_lang', 'english'));
  await page.close();
  if (!titles.has(r.title)) titles.set(r.title, []);
  titles.get(r.title).push(route);
  results.push(r);
  const flags = [errors.length && `${errors.length} console error(s)`, r.overflow360 && `overflow@360 +${r.overflow360.by}px ${r.overflow360.bad.join(',')}`, r.overflow1440 && 'overflow@1440',
    r.axe?.length && `axe: ${r.axe.map(a => a.id).join(',')}`, r.rawKeys.length && `raw keys: ${r.rawKeys.join(', ')}`].filter(Boolean);
  console.log(`${flags.length ? '✗' : '✓'} [${role}] ${route} — "${r.title}" · te ${r.teluguPct}%${flags.length ? ' · ' + flags.join(' · ') : ''}`);
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
try {
  const pub = await browser.newContext({ ...BYPASS });
  for (const route of PUBLIC) await checkRoute(pub, route, 'public');
  await pub.close();
  for (const [role, cfg] of Object.entries(ROLES)) {
    const ctx = await browser.newContext({ ...BYPASS });
    const p = await ctx.newPage();
    await cfg.login(p);
    let routes = [...cfg.routes];
    if (cfg.discover) {
      await p.goto(`${BASE}${cfg.discover.from}`); await settle(p);
      const href = (await p.$$eval('a[href]', as => as.map(a => a.getAttribute('href')))).find(h => cfg.discover.pattern.test(h));
      if (href) routes.push(...cfg.discover.extra(href));
    }
    await p.close();
    for (const route of routes) await checkRoute(ctx, route, role);
    await ctx.close();
  }
} finally { await browser.close(); }

const dupes = [...titles.entries()].filter(([, rs]) => rs.length > 1);
const fails = {
  console: results.filter(r => r.errors.length).length,
  overflow360: results.filter(r => r.overflow360).length,
  overflow1440: results.filter(r => r.overflow1440).length,
  axe: results.filter(r => r.axe?.length).length,
  duplicateTitles: dupes.length,
  lowTelugu: results.filter(r => r.teluguPct < 50).length,
  rawKeys: results.filter(r => r.rawKeys.length).length
};
console.log('\nDuplicate titles:', dupes.length ? dupes.map(([t, rs]) => `"${t}" ← ${rs.join(', ')}`).join('; ') : 'none');
console.log('Telugu share (median):', results.map(r => r.teluguPct).sort((a, b) => a - b)[Math.floor(results.length / 2)] + '%');
console.log('Summary:', JSON.stringify(fails));
if (OUT) fs.writeFileSync(OUT, JSON.stringify({ results, fails }, null, 2));
process.exit(fails.console || fails.rawKeys || fails.overflow360 || fails.overflow1440 || fails.axe || fails.duplicateTitles ? 1 : 0);
