#!/usr/bin/env node
// Product screens for the videos: real screens from a running copy of the
// app (BASE_URL, default http://localhost:3000), signed in off camera as a
// sample person in the demo sandbox (DEMO_ENABLED=true on the backend). 1440×900 at deviceScaleFactor 2, the learner's
// "Learning in" language set per shot (Telugu for the "in your language"
// shots). Accounts are the demo sandbox's sample people (sample names,
// "Sample data" badge), never the TEST- seed accounts. Each shot is one still, taken once the page has settled (data
// loaded, no "Getting the audio ready…"); the video engine zooms into the
// shot's focus box. Output: video/work/shots/<lang>/<key>.png
//   node video/shots.mjs [--lang te|en] [--only walk,passport]
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const LANG = arg('lang', 'te');
const ONLY = arg('only', '').split(',').filter(Boolean);
const OUT = path.join(ROOT, 'video/work/shots', LANG);
fs.mkdirSync(OUT, { recursive: true });
const require = createRequire(import.meta.url);
const { chromium } = (() => { try { return require('playwright'); } catch { return require('/opt/node22/lib/node_modules/playwright'); } })();
// Every learner shot is in Telugu mode, in English videos too: the point of
// the product is learning in your language (brief §1.5).
const learning = 'telugu';

// Text that must never be on screen.
const FORBIDDEN = [/Getting the audio ready/i, /\bTEST-[A-Z]/, /\bTest Institution\b/i, /\bTest (College|Employer|Learner)\b/i];

const lessonTo = async (page, step) => {
  await page.goto(`${BASE}/learn/lesson/py-m3-l3`); await page.waitForSelector('[data-explain]');
  if (step === 'code') { await page.click('[data-step-panel="learn"] [data-next-step]'); await page.waitForSelector('[data-walk]'); }
};
const SHOTS = {
  walk: {
    // The code with every line explained in the learner's language.
    persona: 'lakshmi', learning,
    run: async (page) => { await lessonTo(page, 'code'); const notes = page.locator('main summary:has-text("All line notes")').first(); if (await notes.count()) { await notes.click(); await page.waitForTimeout(400); } }
  },
  practise: {
    persona: 'lakshmi', learning,
    run: async (page) => {
      await lessonTo(page, 'code'); // Practise opens after See the code
      await page.click('.lj-stepper [data-step="practise"] button'); await page.waitForSelector('[data-editor]');
      // The full answer, indentation included (typing would let the editor re-indent).
      const ed = page.locator('[data-editor] textarea, textarea[data-editor]').first();
      await ed.fill('def multiply(a, b):\n    return a * b\n');
      await page.click('[data-run-tests]'); await page.waitForSelector('[data-practice-result="pass"]', { timeout: 90000 });
      await page.locator('[data-test-results]').scrollIntoViewIfNeeded();
    }
  },
  passport: { persona: 'lakshmi', learning, run: async (page) => { await page.goto(`${BASE}/learn/passport`); await page.waitForSelector('h2:has-text("Skills")'); } },
  verify: {
    persona: 'verifier',
    run: async (page, { eid }) => {
      await page.goto(`${BASE}/verify`);
      await page.fill('main input', eid); await page.click('main button[type=submit]:has-text("Verify")');
      await page.waitForSelector('h2:has-text("Skills")');
    }
  },
  college: {
    // The Telugu cohort's readiness table: who is ready, and why not.
    persona: 'placement',
    run: async (page) => { await page.goto(`${BASE}/institution/home`); await page.waitForLoadState('networkidle'); const href = await page.locator('main a[href$="-eng-te?tab=Readiness"]').first().getAttribute('href'); await page.goto(`${BASE}${href}`); await page.waitForSelector('main table'); }
  },
  employer: {
    persona: 'recruiter',
    // A role's candidates: readiness and verified skills, sample IDs only.
    run: async (page) => { await page.goto(`${BASE}/employer/roles`); await page.waitForLoadState('networkidle'); await page.locator('main a[href*="/employer/roles/"]').nth(1).click(); await page.waitForSelector('main button:has-text("Request")'); }
  }
};

const browser = await chromium.launch({ args: ['--hide-scrollbars', '--force-color-profile=srgb', '--font-render-hinting=none'] });
// One sandbox for every shot; each shot switches to its sample person.
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const post = async (url, data) => { const r = await ctx.request.post(`${BASE}/api${url}`, { data }); if (!r.ok()) throw new Error(`${url} → ${r.status()} ${(await r.text()).slice(0, 120)}`); return r.json(); };
let current = await post('/demo/start', { persona: 'lakshmi' });
const api = async (method, url, data) => { const res = await ctx.request.fetch(`${BASE}/api${url}`, { method, data, headers: { Authorization: `Bearer ${current.token}` } }); if (!res.ok()) throw new Error(`${method} ${url} → ${res.status()}`); return res.json().catch(() => ({})); };
const eid = (await api('GET', '/learner/passport')).evidence_id;

const report = {};
for (const [key, shot] of Object.entries(SHOTS)) {
  if (ONLY.length && !ONLY.includes(key)) continue;
  const page = await ctx.newPage();
  try {
    current = await post('/demo/switch', { persona: shot.persona });
    if (shot.learning) await api('PUT', '/learner/learning-language', { value: shot.learning });
    await page.goto(`${BASE}/`);
    await page.evaluate((x) => { localStorage.clear(); if (x.token) { localStorage.setItem('qubirex_token', x.token); localStorage.setItem('qubirex_user', JSON.stringify(x.user)); localStorage.setItem('qubirex_role', x.role); } }, current);
    await shot.run(page, { eid });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(800);
    const text = await page.evaluate(() => document.body.innerText);
    const bad = FORBIDDEN.filter(re => re.test(text)).map(String);
    await page.screenshot({ path: path.join(OUT, `${key}.png`) });
    report[key] = { ok: bad.length === 0, forbidden: bad, learning: shot.learning || null, persona: shot.persona };
    console.log(`${bad.length ? '✗' : '✓'} ${key}${bad.length ? `  forbidden on screen: ${bad.join(', ')}` : ''}`);
  } catch (e) {
    report[key] = { ok: false, error: e.message.split('\n')[0] }; console.log(`✗ ${key}: ${report[key].error}`);
    await page.screenshot({ path: path.join(OUT, `${key}-failed.png`) }).catch(() => {});
  }
  await page.close();
}
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 1));
await browser.close();
