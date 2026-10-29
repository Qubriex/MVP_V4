// e2e/dev-login.mjs — the developer login end to end, in a real browser,
// against a running copy started with DEV_LOGIN_ENABLED=true:
//   unlock /dev (a wrong passcode first), open every role card and check its
//   home page loads with no console errors and the developer bar showing,
//   switch role from the bar, check the bar clears the learner's phone tab
//   bar, run "Skip waits", and end the session.
//   DEV_PASS=… BASE=http://localhost:3000 node e2e/dev-login.mjs
import { createRequire } from 'module';
import path from 'path';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(path.join(process.env.NODE_PATH || '/opt/node22/lib/node_modules', 'playwright'))); }
const BASE = process.env.BASE || 'http://localhost:3000';
const PASS = process.env.DEV_PASS;
if (!PASS) { console.error('Set DEV_PASS to the deployment\'s DEV_LOGIN_SECRET.'); process.exit(2); }

const CARDS = [
  ['learner_te', 'Learner (Telugu)', '/learn/dashboard'],
  ['learner_hi', 'Learner (Hindi)', '/learn/dashboard'],
  ['learner_new', 'Learner, first time', '/learn/welcome'],
  ['college_admin', 'College admin', '/institution/home'],
  ['professor', 'Professor', '/institution/home'],
  ['employer_verified', 'Employer, verified', '/employer/home'],
  ['employer_pending', 'Employer, verification pending', '/employer/home'],
  ['admin', 'Platform admin', '/admin/overview']
];
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`); };

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
const page = await ctx.newPage();
let errors = [];
page.on('console', m => { if (m.type() === 'error' && !/401|Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 160)); });
page.on('pageerror', e => errors.push(e.message.slice(0, 160)));
const settle = () => page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

try {
  await page.goto(`${BASE}/dev`);
  await page.evaluate(() => localStorage.setItem('qubirex_ui_lang', 'english'));
  await page.reload();
  await page.waitForSelector('#dev-pass');
  check('/dev asks for the passcode', true);

  await page.fill('#dev-pass', 'not-the-passcode');
  await page.click('button[type=submit]');
  const wrong = await page.waitForSelector('[role=alert]', { timeout: 5000 }).then(e => e.textContent()).catch(() => '');
  check('A wrong passcode is refused', /not right|did not work/i.test(wrong), wrong);

  await page.fill('#dev-pass', PASS);
  await page.click('button[type=submit]');
  await page.waitForSelector('.dx-cards');
  check('The right passcode shows the role cards', (await page.$$('.dx-card')).length === 9);
  await page.waitForSelector('.dx-build dd', { timeout: 5000 }).catch(() => {});
  check('Build info shows', !!(await page.$('.dx-build')), (await page.textContent('.dx-build').catch(() => '')).replace(/\s+/g, ' ').slice(0, 120));

  const timings = [];
  for (const [key, label, home] of CARDS) {
    errors = [];
    await page.goto(`${BASE}/dev`); await page.waitForSelector('.dx-cards');
    const card = page.locator('.dx-card', { hasText: label }).first();
    const t0 = Date.now();
    await card.locator('button').click();
    await page.waitForURL(`**${home}`, { timeout: 15000 }).catch(() => {});
    await settle();
    timings.push(Date.now() - t0);
    const bar = await page.textContent('.dx-bar').catch(() => '');
    const at = new URL(page.url()).pathname;
    check(`${label} opens ${home}`, at === home && bar.includes(label) && !errors.length, `${at}, ${Date.now() - t0} ms${errors.length ? `, errors: ${errors.join(' | ')}` : ''}`);
  }
  console.log(`  sign-in (click → home loaded): median ${timings.sort((a, b) => a - b)[Math.floor(timings.length / 2)]} ms, max ${timings[timings.length - 1]} ms`);

  // Switch role from the bar: no passcode, straight to the other side.
  errors = [];
  await page.selectOption('.dx-bar select', 'learner_te');
  await page.waitForURL('**/learn/dashboard', { timeout: 15000 }).catch(() => {});
  await settle();
  check('Switch role from the bar', new URL(page.url()).pathname === '/learn/dashboard' && (await page.textContent('.dx-bar')).includes('Learner (Telugu)') && !errors.length);

  // Language from the bar.
  await page.click('.dx-bar-langs button:has-text("తెలుగు")');
  const lang = await page.getAttribute('html', 'lang');
  await page.click('.dx-bar-langs button:has-text("EN")');
  check('Language switch in the bar', lang === 'te', `html lang=${lang}`);

  // Phone width: the bar sits above the learner tab bar and adds no sideways scroll.
  await page.setViewportSize({ width: 360, height: 780 });
  await page.waitForTimeout(300);
  const geo = await page.evaluate(() => {
    const bar = document.querySelector('.dx-bar')?.getBoundingClientRect();
    const tabs = document.querySelector('.ln-tabbar')?.getBoundingClientRect();
    return { barBottom: bar?.bottom, tabsTop: tabs?.top, over: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
  check('On a phone the bar sits above the tab bar', geo.tabsTop != null && geo.barBottom <= geo.tabsTop + 1 && geo.over <= 1, JSON.stringify(geo));
  await page.setViewportSize({ width: 1280, height: 860 });

  // All pages: every route listed, ids filled from the seed; one click opens a
  // deep page signed in as the right test account.
  await page.goto(`${BASE}/dev`); await page.waitForSelector('.dx-pages');
  await page.waitForFunction(() => !document.querySelector('.dx-page-list button code')?.textContent.includes(':'), null, { timeout: 8000 }).catch(() => {});
  const listed = await page.$$eval('.dx-page-list button', bs => bs.map(b => ({ text: b.textContent, disabled: b.disabled })));
  check('All pages lists every route with ids filled in', listed.length >= 75 && listed.every(b => !b.disabled && !/:/.test(b.text)), `${listed.length} links, ${listed.filter(b => b.disabled).length} without an id`);
  errors = [];
  const deep = page.locator('.dx-page-list button', { hasText: /^\/institution\/bridges\/./ }).first();
  const deepPath = (await deep.textContent()).trim();
  await deep.click();
  await page.waitForURL(`**${deepPath}`, { timeout: 15000 }).catch(() => {});
  await settle();
  check('A deep link opens signed in as the right account', new URL(page.url()).pathname === deepPath && (await page.textContent('.dx-bar')).includes('College admin') && !errors.length, deepPath);
  errors = [];
  await page.goto(`${BASE}/dev`); await page.waitForSelector('.dx-pages');
  const cand = page.locator('.dx-page-list button', { hasText: /^\/employer\/candidates\/./ }).first();
  const candPath = (await cand.textContent()).trim();
  await cand.click();
  await page.waitForURL(`**${candPath}`, { timeout: 15000 }).catch(() => {});
  await settle();
  check('…and switches account when the page needs another side', (await page.textContent('.dx-bar')).includes('Employer, verified') && !errors.length, candPath);

  // Skip waits from /dev.
  await page.goto(`${BASE}/dev`); await page.waitForSelector('.dx-tools');
  await page.click('.dx-tools button:has-text("Skip waits")');
  const done = await page.waitForSelector('[role=status]:has-text("Done")', { timeout: 10000 }).then(e => e.textContent()).catch(() => '');
  check('Skip waits', /verified/.test(done), done);

  // End the developer session: signed out, back on a locked /dev.
  await page.goto(`${BASE}/learn/dashboard`); await settle();
  await page.click('.dx-bar-end');
  await page.waitForSelector('#dev-pass', { timeout: 10000 }).catch(() => {});
  const left = await page.evaluate(() => ({ token: localStorage.getItem('qubirex_token'), dev: localStorage.getItem('qubirex_dev') }));
  check('End developer session', new URL(page.url()).pathname === '/dev' && !left.token && !left.dev && !(await page.$('.dx-bar')));
} finally {
  await browser.close();
}
const failed = results.filter(r => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
