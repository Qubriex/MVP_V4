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
  lesson: { persona: 'lakshmi', learning, run: (page) => lessonTo(page) },
  courses: { persona: 'lakshmi', learning, run: async (page) => { await page.goto(`${BASE}/learn/courses`); await page.waitForLoadState('networkidle'); } },
  ask: {
    // A doubt typed in Telugu during the lesson, and Professor Qubirex's answer.
    persona: 'lakshmi', learning,
    run: async (page) => {
      await lessonTo(page);
      await page.fill('[data-ask] input', 'నా loop ఎందుకు ఆగడం లేదు? while i < 5 లో print(i) మాత్రమే ఉంది.');
      await page.click('[data-ask] button[type=submit]');
      await page.waitForSelector('[data-ask-answer="0"]', { timeout: 90000 });
      await page.waitForTimeout(1500);
      await page.locator('[data-ask]').scrollIntoViewIfNeeded();
    }
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
  check: {
    persona: 'lakshmi', learning,
    run: async (page) => {
      await lessonTo(page, 'code');
      await page.click('.lj-stepper [data-step="practise"] button'); await page.waitForSelector('[data-editor]');
      await page.locator('[data-editor] textarea, textarea[data-editor]').first().fill('def multiply(a, b):\n    return a * b\n');
      await page.click('[data-run-tests]'); await page.waitForSelector('[data-practice-result="pass"]', { timeout: 90000 });
      await page.click('.lj-stepper [data-step="check"] button'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(800);
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
    run: async (page) => { await page.goto(`${BASE}/institution/home`); await page.waitForLoadState('networkidle'); const href = await page.locator('main a[href$="-eng-te?tab=Readiness"]').first().getAttribute('href'); await page.goto(`${BASE}${href}`); await page.waitForSelector('main table tbody tr'); await page.evaluate(() => window.scrollTo(0, document.querySelector('main table').getBoundingClientRect().top + scrollY - 240)); await page.waitForTimeout(400); }
  },
  whynot: {
    // "Why not ready?" for one student in the Telugu cohort.
    persona: 'placement',
    run: async (page) => { await page.goto(`${BASE}/institution/home`); await page.waitForLoadState('networkidle'); const href = await page.locator('main a[href$="-eng-te?tab=Readiness"]').first().getAttribute('href'); await page.goto(`${BASE}${href}`); await page.waitForSelector('main table'); await page.locator('main table button:has-text("Why not ready?")').nth(1).click(); await page.waitForTimeout(1200); }
  },
  overview: {
    persona: 'placement',
    run: async (page) => { await page.goto(`${BASE}/institution/home`); await page.waitForLoadState('networkidle'); const href = await page.locator('main a[href$="-eng-te?tab=Readiness"]').first().getAttribute('href'); await page.goto(`${BASE}${href.replace('Readiness', 'Overview')}`); await page.waitForLoadState('networkidle'); await page.waitForTimeout(800); await page.evaluate(() => { const h = [...document.querySelectorAll('main *')].find(e => [...e.childNodes].some(n => n.nodeType === 3 && /^Where students are now$/.test(n.textContent.trim()))); if (h) window.scrollTo(0, h.getBoundingClientRect().top + scrollY - 200); }); await page.waitForTimeout(400); }
  },
  employer: {
    persona: 'recruiter',
    // A role's candidates: readiness and verified skills, sample IDs only.
    run: async (page) => { await page.goto(`${BASE}/employer/roles`); await page.waitForLoadState('networkidle'); await page.locator('main a[href*="/employer/roles/"]').nth(1).click(); await page.waitForSelector('main button:has-text("Request")'); }
  }
};


// ─── Callout focus (revision 2) ──────────────────────────────────────────────
// Each callout shows real elements: their bounding boxes, united, plus 16 px of
// padding (CSS px at 1440×900). Defined in the page, so the boxes are exact.
// FOCUS[key][name] → a function run in the page that returns elements.
// T(re, minH): the smallest element whose own text matches re, grown to the
// first ancestor at least minH tall (a whole card).
const T_JS = `const T = (re, minH = 0, minX = -1) => { let el = [...document.querySelectorAll('body *')].find(e => [...e.childNodes].some(n => n.nodeType === 3 && re.test(n.textContent.trim())) && e.getBoundingClientRect().x > minX && e.getBoundingClientRect().width > 0); while (el && el.getBoundingClientRect().height < minH) el = el.parentElement; return el; };`;
const FOCUS = {
  courses: { default: (T) => [T(/^Python Programming$/, 140)] },
  lesson: { default: (T) => [T(/^IN ONE LINE$/i, 90)] },
  walk: { default: () => { const pre = document.querySelector('[data-walk] pre, [data-walk] code, main pre'); if (!pre) return []; const rg = document.createRange(); rg.selectNodeContents(pre); const rs = [...rg.getClientRects()].filter(q => q.width > 1 && q.width < 1000); const u = { left: Math.min(...rs.map(q => q.left)), top: Math.min(...rs.map(q => q.top)), right: Math.max(...rs.map(q => q.right)), bottom: Math.max(...rs.map(q => q.bottom)) }; return [{ getBoundingClientRect: () => ({ ...u, width: u.right - u.left, height: u.bottom - u.top }), innerText: pre.innerText, tagName: 'RANGE' }]; } }, // the code text itself, not the wide empty block
  practise: { default: () => [document.querySelector('[data-test-results]')] },
  check: { default: (T) => [T(/^The check$/, 80)] },
  passport: { default: (T) => { const id = T(/^QBX-[A-Z0-9]+$/); return [T(/^Evidence ID$/i), id, id && [...id.parentElement.querySelectorAll('button')].find(b => /copy/i.test(b.textContent))]; },
    qr: (T) => [[...document.querySelectorAll('main img, main svg, main canvas')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 50 && Math.abs(r.width - r.height) < 6; }).sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0], T(/^Valid$/)] },
  verify: { default: (T) => [T(/^Genuine and unchanged$/, 150)] },
  college: { default: () => [...document.querySelectorAll('main table thead tr'), ...[...document.querySelectorAll('main table tbody tr')].slice(0, 4)].flatMap(r => [...r.children].slice(0, 2)),
    nudge: () => [...document.querySelectorAll('main table thead tr'), ...[...document.querySelectorAll('main table tbody tr')].slice(0, 4)].flatMap(r => [...r.children].slice(-2)) },
  whynot: { default: (T) => [T(/^Divya Teja$/, 0, 900), T(/^Why not ready yet$/i, 0, 900), T(/^Start a bridge/, 0, 900)] },
  overview: { default: (T) => { const c = T(/^Hardest lessons$/, 150); return c ? [T(/^Hardest lessons$/), ...[...c.querySelectorAll('tr')].slice(0, 4)] : []; } },
  employer: { default: () => [...document.querySelectorAll('main table thead tr'), ...[...document.querySelectorAll('main table tbody tr')].slice(0, 3)].flatMap(r => [...r.children].slice(0, 3)),
    invite: () => [...document.querySelectorAll('main table thead tr'), ...[...document.querySelectorAll('main table tbody tr')].slice(0, 3)].flatMap(r => [...r.children].slice(-3)) }
};
// Every word on screen with its box (CSS px): the QA checks that no callout edge cuts one.
const WORDS_JS = () => {
  const out = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const st = n.parentElement && getComputedStyle(n.parentElement); if (!st || st.visibility === 'hidden' || st.display === 'none' || Number(st.opacity) === 0) continue;
    const re = /\S+/g; let m;
    while ((m = re.exec(n.textContent))) {
      const r = document.createRange(); r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length);
      for (const b of r.getClientRects()) if (b.width > 1 && b.height > 1 && b.right > 0 && b.bottom > 0 && b.left < innerWidth && b.top < innerHeight) out.push([+b.left.toFixed(1), +b.top.toFixed(1), +b.right.toFixed(1), +b.bottom.toFixed(1), m[0]]);
    }
  }
  return out;
};


// The callout box: the elements' box plus 16 px, with every edge moved to the
// nearest gap between words (never through a word): first looking inward
// toward the elements, then outward up to 60 px.
function fitBox([l0, t0, r0, b0], words, P = 16) {
  let [l, t, r, b] = [l0 - P, t0 - P, r0 + P, b0 + P];
  const freeX = (x, top, bot) => !words.some(([wl, wt, wr, wb]) => wl < x - 1.5 && wr > x + 1.5 && wb > top + 1.5 && wt < bot - 1.5);
  const freeY = (y, left, right) => !words.some(([wl, wt, wr, wb]) => wt < y - 1.5 && wb > y + 1.5 && wr > left + 1.5 && wl < right - 1.5);
  const pick = (start, toward, away, free) => { for (let d = 0; d <= Math.abs(start - toward); d += 1) { const v = start + Math.sign(toward - start) * d; if (free(v)) return v; } for (let d = 1; d <= 60; d += 1) { const v = start + Math.sign(away - start) * d; if (free(v)) return v; } return start; };
  for (let pass = 0; pass < 3; pass += 1) {
    l = pick(l, l0, -1e9, x => freeX(x, t, b)); r = pick(r, r0, 1e9, x => freeX(x, t, b));
    t = pick(t, t0, -1e9, y => freeY(y, l, r)); b = pick(b, b0, 1e9, y => freeY(y, l, r));
  }
  return [Math.max(0, l), Math.max(0, t), Math.min(1440, r), Math.min(900, b)].map(v => Math.round(v));
}
const browser = await chromium.launch({ args: ['--hide-scrollbars', '--force-color-profile=srgb', '--font-render-hinting=none'] });
// One sandbox for every shot; each shot switches to its sample person.
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const post = async (url, data) => { const r = await ctx.request.post(`${BASE}/api${url}`, { data }); if (!r.ok()) throw new Error(`${url} → ${r.status()} ${(await r.text()).slice(0, 120)}`); return r.json(); };
let current = await post('/demo/start', { persona: 'lakshmi' });
const api = async (method, url, data) => { const res = await ctx.request.fetch(`${BASE}/api${url}`, { method, data, headers: { Authorization: `Bearer ${current.token}` } }); if (!res.ok()) throw new Error(`${method} ${url} → ${res.status()}`); return res.json().catch(() => ({})); };
const eid = (await api('GET', '/learner/passport')).evidence_id;

const RP = path.join(OUT, 'report.json');
const report = ONLY.length && fs.existsSync(RP) ? JSON.parse(fs.readFileSync(RP, 'utf8')) : {};
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
    // The callout areas: wait until each focus has visible text (or an image), then measure.
    const focus = {};
    for (const [name, fn] of Object.entries(FOCUS[key] || {})) {
      let box = null;
      for (let tries = 0; tries < 20 && !box; tries += 1) {
        box = await page.evaluate(`(() => { ${T_JS} const els = (${fn.toString()})(T).filter(Boolean); if (!els.length) return null;
          const rs = els.map(e => e.getBoundingClientRect()).filter(r => r.width > 2 && r.height > 2); if (!rs.length) return null;
          const text = els.map(e => e.innerText || '').join(' ').trim(); const img = els.some(e => /^(IMG|SVG|CANVAS|svg)$/.test(e.tagName));
          if (text.length < 3 && !img) return null;
          return [Math.min(...rs.map(r => r.left)), Math.min(...rs.map(r => r.top)), Math.max(...rs.map(r => r.right)), Math.max(...rs.map(r => r.bottom))]; })()`);
        if (!box) await page.waitForTimeout(500);
      }
      if (!box) throw new Error(`callout "${name}": its element never had content`);
      focus[name] = box;
    }
    const words = await page.evaluate(WORDS_JS);
    for (const name of Object.keys(focus)) focus[name] = fitBox(focus[name], words);
    await page.screenshot({ path: path.join(OUT, `${key}.png`) });
    fs.writeFileSync(path.join(OUT, `${key}.words.json`), JSON.stringify(words));
    report[key] = { ok: bad.length === 0, forbidden: bad, learning: shot.learning || null, persona: shot.persona, focus };
    console.log(`${bad.length ? '✗' : '✓'} ${key}  callouts: ${Object.entries(focus).map(([n, b]) => `${n} ${b.join(',')}`).join('; ') || '—'}${bad.length ? `  forbidden on screen: ${bad.join(', ')}` : ''}`);
  } catch (e) {
    report[key] = { ok: false, error: e.message.split('\n')[0] }; console.log(`✗ ${key}: ${report[key].error}`);
    await page.screenshot({ path: path.join(OUT, `${key}-failed.png`) }).catch(() => {});
  }
  await page.close();
}
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 1));
await browser.close();
