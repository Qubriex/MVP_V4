// e2e/learner-journey.mjs — one learner's whole journey, S0 → S11, in a real
// browser against a copy running with DEV_LOGIN_ENABLED=true and the
// scripted tutor (test learners use it unless TEST_TUTOR=live):
//   1. Telugu: invite link → set PIN (S1) → welcome → starting check (S2) →
//      lesson, "I'm ready for the check", a check that does not pass (S4) →
//      try again and pass (S3) → developer bar: Make me Ready (S7) → an
//      employer asks (S8) → say yes item by item → the employer invites to
//      Day-One (S9) → practice and the scored run → offer (S10) → hired (S11).
//      Every step checks the stage on Home's "Start here".
//   2. Hindi: S1 (Hindi) → welcome → skip the starting check → a lesson and a
//      passed check, with the page in Hindi.
//   3. Phone (390 px): S3 learner, the tab bar, Start here, the session's
//      Type instead toggle, no sideways scroll.
//   4. Every learner page at 360 px and 1440 px: no console errors, no
//      sideways scroll, and never the test tutor's "mock:" text.
//   DEV_PASS=… BASE=http://localhost:3000 node e2e/learner-journey.mjs
//   Exit code 0 only when every check passed. The run time is printed at the end.
import { createRequire } from 'module';
import path from 'path';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(path.join(process.env.NODE_PATH || '/opt/node22/lib/node_modules', 'playwright'))); }
const BASE = process.env.BASE || 'http://localhost:3000';
const BYPASS = process.env.VERCEL_BYPASS ? { extraHTTPHeaders: { 'x-vercel-protection-bypass': process.env.VERCEL_BYPASS, 'x-vercel-set-bypass-cookie': 'true' } } : {};
const PASS = process.env.DEV_PASS;
const PIN = '410585';
if (!PASS) { console.error('Set DEV_PASS to the deployment\'s DEV_LOGIN_SECRET.'); process.exit(2); }

const started = Date.now();
const results = [];
const check = (name, ok, detail = '') => { results.push(!!ok); console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`); return ok; };
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM || undefined,
  // A fake camera and microphone, so Day-One's camera check can pass headless.
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream']
});

async function newPage({ lang = 'telugu', width = 1280, height = 860 } = {}) {
  const ctx = await browser.newContext({ ...BYPASS, viewport: { width, height }, permissions: ['camera', 'microphone'] });
  await ctx.addInitScript((l) => { try { if (!localStorage.getItem('qubirex_ui_lang')) localStorage.setItem('qubirex_ui_lang', l); } catch { /* blocked */ } }, lang);
  const page = await ctx.newPage();
  page.errors = [];
  page.on('console', m => { if (m.type() === 'error' && !/401|403|Failed to load resource/.test(m.text())) page.errors.push(m.text().slice(0, 160)); });
  page.on('pageerror', e => page.errors.push(e.message.slice(0, 160)));
  return page;
}
const settle = (page) => page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

async function unlock(page) {
  await page.goto(`${BASE}/dev`);
  await page.waitForSelector('#dev-pass, .dx-stages', { timeout: 15000 });
  if (await page.$('#dev-pass')) {
    await page.fill('#dev-pass', PASS);
    await page.click('button[type=submit]');
  }
  await page.waitForSelector('.dx-stages [data-stage]', { timeout: 15000 });
}
async function openStage(page, key) {
  await unlock(page);
  await page.click(`.dx-stages [data-stage="${key}"]`);
  await page.waitForURL(u => /\/learn\//.test(u.pathname) || /learner-invite/.test(u.pathname), { timeout: 15000 });
  await settle(page);
}
// The app may still be finishing its own navigation (a control reloads the
// page, a result screen moves on): wait and go again rather than fail.
async function go(page, url) {
  for (let i = 0; ; i += 1) {
    try { await page.goto(url); return; } catch (e) {
      if (i >= 3 || !/interrupted|ERR_ABORTED/.test(e.message)) throw e;
      await page.waitForTimeout(700);
    }
  }
}
async function stageOnHome(page) {
  await go(page, `${BASE}/learn/dashboard`);
  const el = await page.waitForSelector('.lj-start[data-stage]', { timeout: 15000 }).catch(() => null);
  return el ? el.getAttribute('data-stage') : null;
}
async function expectStage(page, want, label) {
  const got = await stageOnHome(page);
  return check(`${label}: Home says ${want}`, got === want, `stage ${got}`);
}
const noMock = async (page) => !/\bmock[:-]/i.test(await page.textContent('body').catch(() => ''));
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

// One lesson in the session: tap to start, type instead, ask for the check,
// then answer it. `answer` is "#pass" or "#fail" (test learners only).
async function lessonAndCheck(page, answer, { ask = 'I\'m ready for the check' } = {}) {
  await go(page, `${BASE}/learn/session`);
  const tap = await page.waitForSelector('[data-tap-start]', { timeout: 15000 }).catch(() => null);
  if (tap) await tap.click();
  const toggle = await page.waitForSelector('[data-type-toggle]', { timeout: 15000 });
  if ((await toggle.getAttribute('aria-pressed')) !== 'true') await toggle.click();
  const send = async (text) => {
    await page.waitForSelector('#typed:not([disabled])', { timeout: 20000 });
    await page.fill('#typed', text);
    await page.press('#typed', 'Enter');
  };
  await send(ask);
  const banner = await page.waitForSelector('[data-check-state]', { timeout: 20000 }).catch(() => null);
  check('  “I\'m ready for the check” gives the check', !!banner);
  await send(answer);
  const res = await page.waitForSelector('.lj-result[data-result]', { timeout: 20000 }).catch(() => null);
  return res ? res.getAttribute('data-result') : null;
}

// ─── 1. The Telugu journey, S0 → S11 ──────────────────────────────────────────
const t1 = Date.now();
const me = await newPage({ lang: 'telugu' });
try {
  await openStage(me, 's0');
  check('S0: /dev opens the invite link', /learner-invite/.test(me.url()), new URL(me.url()).pathname.slice(0, 30));
  await me.fill('#p1', PIN);
  await me.fill('#p2', PIN);
  await me.click('button[type=submit]');
  await me.waitForURL('**/learn/welcome', { timeout: 15000 });
  check('S0 → S1: set PIN lands on Welcome', true);

  // Welcome: language and voice → mic test → starting check.
  for (let i = 0; i < 3; i += 1) {
    await me.locator('.ui-narrow > .ln-row:last-child .ln-btn-primary').click();
    await settle(me);
  }
  await me.waitForURL('**/learn/baseline', { timeout: 15000 });
  check('Welcome ends at the starting check', true);
  await me.click('[data-baseline-start]');
  for (let i = 0; i < 12; i += 1) {
    const q = await me.waitForSelector('[data-baseline-question]', { timeout: 8000 }).catch(() => null);
    if (!q) break;
    await me.fill('#answer', '#fail');
    await me.click('form button[type=submit]');
    await me.waitForTimeout(150);
  }
  await settle(me);
  check('Starting check finished with a placement', !await me.$('[data-baseline-question]'));
  await expectStage(me, 'S2', 'After the starting check');

  // A lesson, a check that does not pass, then one that does.
  const r1 = await lessonAndCheck(me, '#fail');
  check('A check that does not pass shows the result screen', r1 === 'fail' && !!await me.$('[data-result-screen]'), `result ${r1}`);
  check('  no mock text in the session', await noMock(me));
  await expectStage(me, 'S4', 'After a check that did not pass');
  const r2 = await lessonAndCheck(me, '#pass');
  check('Trying again and passing shows the pass result', r2 === 'pass', `result ${r2}`);
  await expectStage(me, 'S3', 'After passing');

  // From here the developer bar drives the rest: S0 now opens like the others.
  await openStage(me, 's0');
  check('The developer bar shows for the journey learner', !!await me.$('.dx-bar'));
  const control = async (key) => {
    await me.click('.dx-bar [data-dev-controls]');
    await me.click(`.dx-controls [data-control="${key}"]`);
    await me.waitForTimeout(900);
    await settle(me);
  };
  await control('ready');
  await expectStage(me, 'S7', 'Make me Ready');
  await go(me, `${BASE}/learn/passport`);
  const status = await me.waitForSelector('[data-passport-status]', { timeout: 15000 }).then(e => e.textContent()).catch(() => '');
  check('Passport shows a status line', !!status, status.slice(0, 60));

  await control('request');
  await expectStage(me, 'S8', 'An employer asked');
  await me.click('[data-start-here]');
  await me.waitForURL('**/learn/requests/**', { timeout: 15000 });
  const pipeId = new URL(me.url()).pathname.split('/').pop();
  await me.click('[data-decide="approve"]');
  await settle(me);
  check('Said yes, item by item', true, pipeId);

  // The employer, in a second window: Day-One, then offer, then hired.
  const emp = await newPage({ lang: 'english' });
  await unlock(emp);
  await emp.goto(`${BASE}/dev`);
  await emp.locator('.dx-card', { hasText: /Employer, verified/ }).locator('button').click();
  await emp.waitForURL('**/employer/home', { timeout: 15000 });
  await emp.goto(`${BASE}/employer/candidates/${pipeId}`);
  await emp.click('[data-demo="dayone"]');
  await settle(emp);
  await expectStage(me, 'S9', 'Employer invited to Day-One');

  await go(me, `${BASE}/learn/dayone`);
  await me.waitForSelector('#pre', { timeout: 15000 });
  const boxes = me.locator('section[aria-labelledby="pre"] input[type=checkbox]');
  for (let i = 0; i < await boxes.count(); i += 1) await boxes.nth(i).check();
  if (await me.$('[data-dayone-camera]')) await me.click('[data-dayone-camera]');
  await me.waitForSelector('[data-dayone-save]:not([disabled])', { timeout: 10000 });
  await me.click('[data-dayone-save]');
  await me.waitForSelector('[data-dayone-scored]:not([disabled])', { timeout: 10000 });
  await me.click('[data-dayone-scored]');
  const areas = me.locator('textarea[id^="d1-"]');
  await me.waitForSelector('textarea[id^="d1-"]', { timeout: 15000 });
  for (let i = 0; i < await areas.count(); i += 1) await areas.nth(i).fill('#pass');
  await me.click('[data-dayone-submit]');
  await me.waitForSelector('.lj-result[data-result]', { timeout: 20000 }).catch(() => {});
  check('Day-One scored run done', (await me.$('.lj-result[data-result="pass"]')) != null);

  await emp.reload(); await settle(emp);
  await emp.click('[data-stage-action="offer"]');
  await settle(emp);
  await expectStage(me, 'S10', 'Offer');
  await emp.reload(); await settle(emp);
  await emp.click('[data-stage-action="hired"]');
  await settle(emp);
  await expectStage(me, 'S11', 'Hired');
  check('No console errors on the learner side', !me.errors.length, me.errors.slice(0, 3).join(' | '));
  await emp.context().close();
} catch (e) {
  check('Telugu journey ran to the end', false, e.message.split('\n')[0]);
}
await me.context().close();
console.log(`  Telugu journey: ${Math.round((Date.now() - t1) / 1000)} s`);

// ─── 2. Hindi: welcome, skip the starting check, one passed check ─────────────
const hi = await newPage({ lang: 'hindi' });
try {
  await openStage(hi, 's1-hi');
  check('Hindi S1 opens Welcome', /\/learn\/welcome/.test(hi.url()));
  check('  the page is in Hindi', /[ऀ-ॿ]/.test(await hi.textContent('main, body')));
  await hi.goto(`${BASE}/learn/baseline`);
  await hi.click('[data-baseline-skip]');
  await hi.click('[data-baseline-skip-confirm]');
  await settle(hi);
  await expectStage(hi, 'S2', 'Hindi, starting check skipped');
  const r = await lessonAndCheck(hi, '#pass', { ask: 'मैं जाँच के लिए तैयार हूँ' });
  check('Hindi lesson and a passed check', r === 'pass', `result ${r}`);
  check('  no mock text', await noMock(hi));
} catch (e) {
  check('Hindi run ran to the end', false, e.message.split('\n')[0]);
}
await hi.context().close();

// ─── 3. Phone, 390 px ──────────────────────────────────────────────────────────
const ph = await newPage({ lang: 'telugu', width: 390, height: 844 });
try {
  await openStage(ph, 's3');
  await ph.goto(`${BASE}/learn/dashboard`);
  await ph.waitForSelector('.lj-start', { timeout: 15000 });
  check('Phone: Start here is on screen', await ph.isVisible('.lj-start'));
  check('Phone: the tab bar shows', await ph.isVisible('.ln-tabbar'));
  check('Phone: no sideways scroll on Home', await noSideScroll(ph));
  const start = await ph.$eval('[data-start-here]', el => el.getBoundingClientRect().bottom);
  const bars = await ph.evaluate(() => Math.min(...['.ln-tabbar', '.dx-bar'].map(s => document.querySelector(s)?.getBoundingClientRect().top ?? Infinity)));
  check('Phone: Start here is not hidden behind the bars', start <= bars, `${Math.round(start)} ≤ ${Math.round(bars)}`);
  await ph.goto(`${BASE}/learn/session`);
  const tap = await ph.waitForSelector('[data-tap-start]', { timeout: 15000 }).catch(() => null);
  if (tap) await tap.click();
  check('Phone: Type instead is a labelled button', /\S/.test(await ph.textContent('[data-type-toggle]').catch(() => '')));
} catch (e) {
  check('Phone run ran to the end', false, e.message.split('\n')[0]);
}
await ph.context().close();

// ─── 4. Every learner page at 360 px and 1440 px ──────────────────────────────
const PAGES = ['/learn/dashboard', '/learn/session', '/learn/path', '/learn/reviews', '/learn/passport', '/learn/record', '/learn/history', '/learn/readiness',
  '/learn/assigned', '/learn/jobs', '/learn/market', '/learn/topics', '/learn/profile', '/learn/resume', '/learn/settings', '/learn/notifications', '/learn/dayone', '/learn/welcome', '/learn/baseline'];
for (const width of [360, 1440]) {
  const p = await newPage({ lang: 'telugu', width, height: 900 });
  try {
    await openStage(p, 's7');
    const bad = [];
    for (const route of PAGES) {
      p.errors = [];
      await p.goto(`${BASE}${route}`);
      await settle(p);
      const problems = [];
      if (p.errors.length) problems.push(`errors: ${p.errors[0]}`);
      if (!await noSideScroll(p)) problems.push('sideways scroll');
      if (!await noMock(p)) problems.push('mock text');
      if (problems.length) bad.push(`${route} (${problems.join(', ')})`);
    }
    check(`All ${PAGES.length} learner pages at ${width} px: no errors, no sideways scroll, no mock text`, !bad.length, bad.slice(0, 4).join('; '));
  } catch (e) {
    check(`Page sweep at ${width} px ran`, false, e.message.split('\n')[0]);
  }
  await p.context().close();
}

await browser.close();
const secs = Math.round((Date.now() - started) / 1000);
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} checks passed in ${secs} s`);
process.exit(passed === results.length ? 0 : 1);
