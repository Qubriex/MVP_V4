// e2e/demo.mjs — the working demo end to end in a real browser, against a
// copy running with DEMO_ENABLED=true (local, staging or production):
//   - every persona starts from /demo and its home loads, with the demo bar
//     and no console errors, at 1440 px and 360 px (no sideways scroll);
//   - the cross-side loop through the UI: the recruiter pastes a JD and saves
//     a role → finds candidates → requests Lakshmi → switches to Lakshmi and
//     says yes → switches back → the candidate is unlocked → Day-One → the
//     message is in the Demo inbox;
//   - the placement head starts a bridge programme → Lakshmi sees it;
//   - the Verifier sees “DEMO — not a real credential”;
//   - Reset my demo gives a fresh copy; Exit demo clears the session.
//   BASE=http://localhost:3000 node e2e/demo.mjs
import { createRequire } from 'module';
import path from 'path';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(path.join(process.env.NODE_PATH || '/opt/node22/lib/node_modules', 'playwright'))); }
const BASE = process.env.BASE || 'http://localhost:3000';
// A Vercel deployment behind Deployment Protection: VERCEL_BYPASS is the
// project's "Protection Bypass for Automation" secret (never committed).
const BYPASS = process.env.VERCEL_BYPASS ? { extraHTTPHeaders: { 'x-vercel-protection-bypass': process.env.VERCEL_BYPASS, 'x-vercel-set-bypass-cookie': 'true' } } : {};
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`); };
const PERSONAS = [['lakshmi', 'Lakshmi Prasanna', '/learn/dashboard'], ['arjun', 'Arjun Verma', '/learn/welcome'], ['placement', 'Sunita Reddy', '/institution/home'],
  ['professor', 'Ravi Kumar', '/institution/home'], ['recruiter', 'Meera Iyer', '/employer/home'], ['verifier', 'Verifier', '/verify/']];

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const errorsOf = (page) => {
  const errors = [];
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|401|404/.test(m.text())) errors.push(m.text().slice(0, 160)); });
  page.on('pageerror', e => errors.push(e.message.slice(0, 160)));
  return errors;
};
const settle = (page) => page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

async function start(page, name) {
  await page.goto(`${BASE}/demo`);
  await page.evaluate(() => localStorage.setItem('qubirex_ui_lang', 'english'));
  await page.reload();
  const card = page.locator('.dm-persona', { hasText: name }).first();
  await card.locator('button:not([disabled])').waitFor({ timeout: 10000 });
  const t0 = Date.now();
  await card.locator('button').click();
  await page.waitForURL(u => !u.pathname.startsWith('/demo'), { timeout: 15000 });
  await settle(page);
  return Date.now() - t0;
}
async function switchTo(page, persona, home) {
  await page.selectOption('.dm-bar select', persona);
  await page.waitForURL(`**${home}`, { timeout: 15000 });
  await settle(page);
}

try {
  // ── Every persona ────────────────────────────────────────────────────────────
  const timings = [];
  for (const [key, name, home] of PERSONAS) {
    const ctx = await browser.newContext({ ...BYPASS, viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errors = errorsOf(page);
    const ms = await start(page, name);
    timings.push(ms);
    const at = new URL(page.url()).pathname;
    const bar = await page.locator('.dm-bar').textContent({ timeout: 8000 }).catch(() => '');
    const wide = await overflow(page);
    await page.setViewportSize({ width: 360, height: 780 }); await page.waitForTimeout(300);
    const narrow = await overflow(page);
    check(`${name} starts and lands on ${home}`, at.startsWith(home) && /Demo · sample data/.test(bar) && !errors.length && wide <= 1 && narrow <= 1,
      `${at}, ${ms} ms, overflow ${wide}/${narrow}px${errors.length ? `, errors: ${errors.join(' | ')}` : ''}`);
    if (key === 'verifier') {
      const banner = await page.locator('.dm-verify-banner').textContent({ timeout: 8000 }).catch(() => '');
      check('Verifier sees the DEMO banner', /DEMO — not a real credential/.test(banner));
    }
    await ctx.close();
  }
  console.log(`  start → home loaded: median ${timings.sort((a, b) => a - b)[Math.floor(timings.length / 2)]} ms, max ${timings[timings.length - 1]} ms`);

  // ── Every page of each side, inside a sandbox, at 1440 and 360 px ─────────────
  const SWEEP = {
    'Lakshmi Prasanna': ['/learn/dashboard', '/learn/record', '/learn/reviews', '/learn/passport', '/learn/jobs', '/learn/market', '/learn/topics', '/learn/profile', '/learn/resume', '/learn/settings'],
    'Sunita Reddy': ['/institution/home', '/institution/team', '/institution/students', '/institution/cohorts', '/institution/curriculum', '/institution/benchmark', '/institution/review', '/institution/bridges', '/institution/placements', '/institution/board-report', '/institution/profile'],
    'Meera Iyer': ['/employer/home', '/employer/company', '/employer/team', '/employer/roles', '/employer/pipeline', '/employer/sponsor', '/employer/colleges', '/employer/verify-bulk', '/employer/templates', '/employer/billing']
  };
  for (const [name, paths] of Object.entries(SWEEP)) {
    const sctx = await browser.newContext({ ...BYPASS, viewport: { width: 1440, height: 900 } });
    const sp = await sctx.newPage();
    const sErrors = errorsOf(sp);
    await start(sp, name);
    const bad = [];
    for (const p of paths) {
      sErrors.length = 0;
      await sp.setViewportSize({ width: 1440, height: 900 });
      await sp.goto(`${BASE}${p}`); await settle(sp);
      const wide = await overflow(sp);
      await sp.setViewportSize({ width: 360, height: 780 }); await sp.waitForTimeout(250);
      const narrow = await overflow(sp);
      const ended = new URL(sp.url()).pathname !== p;
      if (wide > 1 || narrow > 1 || sErrors.length || ended || !(await sp.locator('.dm-bar').count())) bad.push(`${p}${ended ? ' (redirected)' : ''}${wide > 1 || narrow > 1 ? ` overflow ${wide}/${narrow}` : ''}${sErrors.length ? ` ${sErrors[0]}` : ''}`);
    }
    check(`${name}: ${paths.length} pages work in the demo at 1440 and 360 px`, !bad.length, bad.join(' | '));
    await sctx.close();
  }

  // ── The cross-side loop, through the UI ──────────────────────────────────────
  const ctx = await browser.newContext({ ...BYPASS, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = errorsOf(page);
  await start(page, 'Meera Iyer');
  const me = await (await page.request.get(`${BASE}/api/demo/me`)).json();
  await page.goto(`${BASE}/employer/roles?new=1`); await settle(page);
  await page.fill('#r-title', 'Frontend developer (demo run)');
  await page.fill('#r-jd', me.sample_jd);
  await page.click('button:has-text("Pick out the skills")');
  await page.locator('form button[type=submit]:not([disabled])').waitFor({ timeout: 10000 });
  await page.click('form button[type=submit]');
  await page.waitForURL(/\/employer\/roles\/[^/?]+$/, { timeout: 15000 }); await settle(page);
  check('Recruiter turns a pasted JD into a role', /\/employer\/roles\//.test(page.url()));

  const row = page.locator(`[data-ref="${me.lakshmi_ref}"]`);
  await row.waitFor({ timeout: 10000 });
  check('Search shows anonymous candidates, Lakshmi among them', await row.count() === 1 && !/Lakshmi/.test(await row.textContent()));
  await row.locator('[data-demo="request"]').click();
  await page.waitForTimeout(800);

  await switchTo(page, 'lakshmi', '/learn/dashboard');
  await page.goto(`${BASE}/learn/jobs`); await settle(page);
  await page.locator('[data-demo="approve"]').first().click();
  await page.waitForTimeout(800);
  check('Switch to Lakshmi and approve the request', !(await page.locator('[data-demo="approve"]').count()));

  await switchTo(page, 'recruiter', '/employer/home');
  await page.goto(`${BASE}/employer/pipeline`); await settle(page);
  await page.click('a:has-text("Lakshmi Prasanna")');
  await page.waitForURL(/\/employer\/candidates\//); await settle(page);
  await page.locator('main h1', { hasText: 'Lakshmi Prasanna' }).waitFor({ timeout: 10000 }).catch(() => {});
  const unlocked = await page.textContent('main');
  check('Switch back: the candidate is unlocked', /Lakshmi Prasanna/.test(unlocked) && /QBX-/.test(unlocked), unlocked.replace(/\s+/g, ' ').slice(0, 160));
  await page.click('[data-demo="dayone"]');
  await page.waitForTimeout(800);
  await page.click('.dm-bar button:has-text("Demo inbox")');
  await page.getByText(/WhatsApp to Lakshmi Prasanna/).first().waitFor({ timeout: 8000 }).catch(() => {});
  const inbox = await page.locator('.sk-drawer, [role="dialog"]').last().textContent({ timeout: 5000 }).catch(() => '');
  check('Day-One sent: it is in the Demo inbox, not sent', /Day-One/i.test(inbox) && /WhatsApp to Lakshmi Prasanna/.test(inbox), inbox.replace(/\s+/g, ' ').slice(0, 120));
  await page.keyboard.press('Escape');

  // ── College bridge → learner sees it ──────────────────────────────────────────
  await switchTo(page, 'placement', '/institution/home');
  await page.goto(`${BASE}/institution/bridges`); await settle(page);
  await page.click('[data-demo="bridge"]');
  // A skill Lakshmi has not mastered yet, so it becomes a task on her side.
  await page.locator('label', { hasText: 'Joins' }).locator('input[type=checkbox]').first().check();
  await page.locator('input[name=scope][value=cohort]').check().catch(() => {});
  await page.fill('#br-title', 'React hooks catch-up (demo run)');
  await page.screenshot({ path: process.env.SHOTS ? `${process.env.SHOTS}/bridge-form.png` : '/dev/null', fullPage: true }).catch(() => {});
  await page.click('form button[type=submit]');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: process.env.SHOTS ? `${process.env.SHOTS}/bridge-after.png` : '/dev/null', fullPage: true }).catch(() => {});
  await switchTo(page, 'lakshmi', '/learn/dashboard');
  // Lakshmi's "Today" lists the bridge skill her college assigned.
  const today = page.locator('section[aria-label="Today"]');
  await today.getByText(/Joins/).first().waitFor({ timeout: 8000 }).catch(() => {});
  const dash = await today.textContent().catch(() => '');
  check('College starts a bridge programme; Lakshmi sees it', /college/i.test(dash) && /Joins/.test(dash), dash.replace(/\s+/g, ' ').slice(0, 120));

  // ── Story progress, Reset, Exit ────────────────────────────────────────────────
  await page.click('.dm-bar button:has-text("Guided story")');
  const story = await page.locator('.dm-story').textContent({ timeout: 5000 }).catch(() => '');
  const doneCount = await page.locator('.dm-story li.is-done').count();
  check('Guided story tracks progress', doneCount >= 6, `${doneCount}/8 steps done`);
  await page.keyboard.press('Escape');
  await page.click('.dm-bar button:has-text("Reset my demo")');
  await page.click('.dm-bar button:has-text("Yes, start fresh")');
  await page.waitForTimeout(1500); await settle(page);
  const after = await (await page.request.get(`${BASE}/api/demo/me`)).json();
  check('Reset my demo gives a fresh copy', after.lakshmi_ref !== me.lakshmi_ref && after.inbox_count === 0, `${me.lakshmi_ref} → ${after.lakshmi_ref}`);
  await page.click('.dm-bar-exit');
  await page.waitForURL('**/demo', { timeout: 10000 });
  const left = await page.evaluate(() => ({ token: localStorage.getItem('qubirex_token'), demo: localStorage.getItem('qubirex_demo') }));
  const meAfter = await page.request.get(`${BASE}/api/demo/me`);
  check('Exit demo clears the session', !left.token && !left.demo && meAfter.status() === 401 && !(await page.locator('.dm-bar').count()));
  check('No console errors in the loop', !errors.length, errors.slice(0, 3).join(' | '));
  void story;
  await ctx.close();
} finally {
  await browser.close();
}
const failed = results.filter(r => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
