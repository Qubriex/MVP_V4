// e2e/learner-topics.mjs — topics, lessons, language, Back and the job flag,
// in a real browser against a copy with DEV_LOGIN_ENABLED=true:
//   1. Jobs hidden (FEATURE_LEARNER_JOBS off): no job market in the menu or
//      on Home, and /learn/market goes Home.
//   2. Back on every /learn page: the Back button and breadcrumb are there
//      (not on Home), and Back goes one level up the breadcrumb — never
//      forward, even after visiting other pages (Reviews from Home → Home;
//      Explore topics → Home; a course page → Explore topics).
//   2b. "Walk me through it" plays one clip per line, in order, never two
//      at once, and the highlight follows; the voice session never signs out.
//   3. Learning language: the lesson follows the picker (English, then
//      Telugu), and Settings shows the same choice.
//   4. Teach-first lesson "Return values" in Telugu and in English: Learn →
//      See the code (Run shows the output) → Practise (a wrong answer shows
//      what failed, the solution passes) → Check (a fresh question).
//   5. Topics flow at 1280 px and 390 px: My topics, add Java, open a lesson,
//      no sideways scroll.
//   6. Public "See our topics" and its free sample, in Hindi.
//   7. A professor marks a lesson Reviewed in Telugu; the learner sees
//      "Reviewed by … faculty".
//   DEV_PASS=… BASE=http://localhost:3000 node e2e/learner-topics.mjs
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(path.join(process.env.NODE_PATH || '/opt/node22/lib/node_modules', 'playwright'))); }
const BASE = process.env.BASE || 'http://localhost:3000';
const BYPASS = process.env.VERCEL_BYPASS ? { extraHTTPHeaders: { 'x-vercel-protection-bypass': process.env.VERCEL_BYPASS, 'x-vercel-set-bypass-cookie': 'true' } } : {};
const PASS = process.env.DEV_PASS;
if (!PASS) { console.error('Set DEV_PASS to the deployment\'s DEV_LOGIN_SECRET.'); process.exit(2); }

const started = Date.now();
const results = [];
const check = (name, ok, detail = '') => { results.push(!!ok); console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`); return ok; };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const TELUGU = /[ఀ-౿]/;
const HINDI = /[ऀ-ॿ]/;

async function newContext({ width = 1280, height = 860 } = {}) {
  const ctx = await browser.newContext({ ...BYPASS, viewport: { width, height } });
  await ctx.addInitScript(() => { try { localStorage.setItem('qubirex_ui_lang', 'english'); } catch { /* blocked */ } });
  return ctx;
}
async function newPage(ctx) {
  const page = await ctx.newPage();
  page.errors = [];
  page.on('console', m => { if (m.type() === 'error' && !/401|403|503|Failed to load resource/.test(m.text())) page.errors.push(m.text().slice(0, 160)); });
  page.on('pageerror', e => page.errors.push(e.message.slice(0, 160)));
  return page;
}
const settle = (page) => page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
async function unlock(page) {
  await page.goto(`${BASE}/dev`);
  await page.waitForSelector('#dev-pass, .dx-stages, .dx-cards', { timeout: 15000 });
  if (await page.$('#dev-pass')) { await page.fill('#dev-pass', PASS); await page.click('button[type=submit]'); }
  await page.waitForSelector('.dx-cards', { timeout: 15000 });
}
async function openStage(page, key) {
  await unlock(page);
  await page.click(`.dx-stages [data-stage="${key}"]`);
  await page.waitForURL(u => /\/learn\//.test(u.pathname), { timeout: 15000 });
  await settle(page);
}
async function openCard(page, label, home) {
  await unlock(page);
  await page.locator('.dx-card', { hasText: label }).first().locator('button').click();
  await page.waitForURL(`**${home}`, { timeout: 15000 });
  await settle(page);
}
const noSideways = (page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
async function setLearning(page, value) {
  const sel = page.locator('[data-learning-language] select').first();
  await sel.waitFor({ timeout: 10000 });
  await sel.selectOption(value);
  await page.waitForFunction((v) => document.querySelector('[data-learning-language]')?.getAttribute('data-learning-language') === v, value, { timeout: 10000 });
  await settle(page);
}

async function setLearningApi(page, value) {
  await page.evaluate(async (v) => {
    const token = localStorage.getItem('qubirex_token');
    await fetch('/api/learner/learning-language', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ value: v }) });
  }, value);
}

// One lesson, every step, in the current learning language.
async function teachFirst(page, lessonId, script, label) {
  await page.goto(`${BASE}/learn/lesson/${lessonId}`);
  await page.waitForSelector('[data-lesson-page] [data-explain]', { timeout: 15000 });
  const explain = await page.textContent('[data-explain]');
  check(`${label}: the lesson teaches first, in the learning language`, script.test(explain), explain.slice(0, 60));
  check(`${label}: the stepper shows Learn → See the code → Practise → Check`, (await page.$$('.lj-stepper [data-step]')).length === 4);
  await page.click('.lj-stepper [data-step="learn"] button');
  await page.click('[data-simpler]');
  check(`${label}: "Explain simpler" gives a simpler explanation`, !!(await page.waitForSelector('[data-extra="simpler"]', { timeout: 5000 }).catch(() => null)));
  await page.click('[data-feedback="explain"] button[aria-label]');
  await page.fill('[data-ask-input]', script === TELUGU ? 'return ఎందుకు వాడతాం?' : 'Why do we use return?');
  await page.press('[data-ask-input]', 'Enter');
  const asked = await page.waitForSelector('[data-ask-answer="0"]', { timeout: 15000 }).then(e => e.textContent()).catch(() => '');
  check(`${label}: a question asked during the lesson is answered`, asked.length > 20, asked.replace(/\s+/g, ' ').slice(0, 70));
  await page.click('[data-step-panel="learn"] [data-next-step]');
  await page.click('[data-run-example]');
  const out = await page.waitForSelector('[data-output]', { timeout: 120000 }).then(e => e.textContent()).catch(() => '');
  check(`${label}: Run shows the example's output`, /177/.test(out), out.replace(/\s+/g, ' ').slice(0, 80));
  const walk = await page.$('[data-walk]');
  if (walk) {
    await walk.click();
    check(`${label}: the walkthrough highlights code lines`, !!(await page.waitForSelector('.lj-code-line.is-active', { timeout: 10000 }).catch(() => null)));
    const stop = await page.$('[data-walk]'); if (stop) await stop.click().catch(() => {});
  }
  await page.locator('[data-next-step]').last().click();
  await page.waitForSelector('[data-editor]', { timeout: 10000 });
  for (let i = 0; i < 3; i += 1) {
    await page.fill('[data-editor]', 'def total_bill(price, qty):\n    print(price * qty)\n');
    await page.click('[data-run-tests]');
    await page.waitForSelector('[data-practice-result]', { timeout: 120000 });
  }
  check(`${label}: a wrong answer shows what failed`, (await page.getAttribute('[data-practice-result]', 'data-practice-result')) === 'fail' && !!(await page.$('[data-test-results] [data-passed="no"]')));
  await page.click('[data-solution]');
  const solution = await page.waitForSelector('[data-solution-text]', { timeout: 10000 }).then(e => e.textContent());
  await page.fill('[data-editor]', solution);
  await page.click('[data-run-tests]');
  await page.waitForFunction(() => document.querySelector('[data-practice-result]')?.getAttribute('data-practice-result') === 'pass', null, { timeout: 120000 }).catch(() => {});
  check(`${label}: the right answer passes every test`, (await page.getAttribute('[data-practice-result]', 'data-practice-result')) === 'pass');
  await page.locator('[data-next-step]').last().click();
  await page.click('[data-start-check]');
  const q = await page.waitForSelector('[data-check-question]', { timeout: 15000 }).then(e => e.textContent()).catch(() => '');
  check(`${label}: only then the check, with a fresh question`, q.length > 10, q.replace(/\s+/g, ' ').slice(0, 60));
  await page.fill('[data-check-question] textarea', '#pass');
  await page.click('[data-check-question] button[type=submit]');
  const next = await page.waitForSelector('[data-next-lesson]', { timeout: 15000 }).catch(() => null);
  check(`${label}: the result is shown, with the next lesson`, !!next);
}

// path → parent, as in src/components/learn/BackBar.js
const BACK = [
  ['/learn/record', '/learn/dashboard'], ['/learn/history', '/learn/dashboard'], ['/learn/reviews', '/learn/dashboard'],
  ['/learn/assigned', '/learn/dashboard'], ['/learn/passport', '/learn/dashboard'], ['/learn/readiness', '/learn/passport'],
  ['/learn/courses', '/learn/dashboard'], ['/learn/courses/python', '/learn/courses'], ['/learn/lesson/py-m1-l1', '/learn/courses/python'],
  ['/learn/modules/py-m3/test', '/learn/courses/python'], ['/learn/modules/py-m3/project', '/learn/courses/python'],
  ['/learn/skill/test-node-4-4', '/learn/record'], ['/learn/profile', '/learn/dashboard'], ['/learn/resume', '/learn/profile'],
  ['/learn/settings', '/learn/profile'], ['/learn/notifications', '/learn/settings']
];

try {
  const ctx = await newContext();
  const me = await newPage(ctx);
  await openStage(me, 'topics');

  // 1. Jobs hidden
  await me.goto(`${BASE}/learn/dashboard`); await settle(me);
  const nav = await me.textContent('nav').catch(() => '');
  check('Jobs hidden: no Job market in the menu', !/job market/i.test(nav));
  check('Jobs hidden: Home is learning only', !(await me.$('[data-market-snapshot], [data-jobs-section]')));
  await me.goto(`${BASE}/learn/market`);
  await me.waitForURL('**/learn/dashboard', { timeout: 10000 }).catch(() => {});
  check('Jobs hidden: /learn/market goes Home', me.url().endsWith('/learn/dashboard'), me.url());
  check('Home has no Back button', !(await me.$('[data-backbar]')));

  // 2. Back on every /learn page
  for (const [from, parent] of BACK) {
    const p = await newPage(ctx);
    await p.goto(`${BASE}${from}`);
    const bar = await p.waitForSelector('[data-backbar] [data-back]', { timeout: 15000 }).catch(() => null);
    const crumbs = bar ? (await p.textContent('[data-backbar] nav')).trim() : '';
    if (bar) { await bar.click(); await p.waitForURL(`**${parent}`, { timeout: 10000 }).catch(() => {}); }
    check(`Back on ${from} → ${parent}`, !!bar && new URL(p.url()).pathname === parent && /Home/.test(crumbs), `${new URL(p.url()).pathname} · ${crumbs.slice(0, 50)}`);
    await p.close();
  }
  await me.goto(`${BASE}/learn/courses/python`); await settle(me);
  if (!(await me.$('[data-lesson="py-m3-l2"] a'))) await me.click('[data-module="py-m3"] .lj-module-head');
  await me.click('[data-lesson="py-m3-l2"] a');
  await me.waitForSelector('[data-lesson-page]', { timeout: 15000 });
  await me.click('[data-backbar] [data-back]');
  await me.waitForURL('**/learn/courses/python', { timeout: 10000 }).catch(() => {});
  check('Back from a lesson returns to the course page it was opened from', new URL(me.url()).pathname === '/learn/courses/python');

  // Back never jumps forward: walk a trail in one tab, then go Back up it.
  const backTo = async (want) => {
    await me.click('[data-backbar] [data-back]');
    await me.waitForURL(`**${want}`, { timeout: 10000 }).catch(() => {});
    return new URL(me.url()).pathname;
  };
  await me.goto(`${BASE}/learn/courses`); await settle(me);
  await me.click('[data-course="python"] a, a[href="/learn/courses/python"]');
  await me.waitForURL('**/learn/courses/python', { timeout: 10000 });
  let at = await backTo('/learn/courses');
  check('Back from a course page goes to Explore topics', at === '/learn/courses', at);
  at = await backTo('/learn/dashboard');
  check('Back from Explore topics goes Home, not forward to the course', at === '/learn/dashboard', at);
  await me.goto(`${BASE}/learn/record`); await settle(me);
  await me.goto(`${BASE}/learn/reviews`); await settle(me);
  at = await backTo('/learn/dashboard');
  check('Reviews after Skill path: Back goes Home, not to Skill path', at === '/learn/dashboard', at);
  await me.goto(`${BASE}/learn/dashboard`); await settle(me);
  const toReviews = await me.$('a[href="/learn/reviews"]');
  if (toReviews) { await toReviews.click(); await me.waitForURL('**/learn/reviews', { timeout: 10000 }).catch(() => {}); } else await me.goto(`${BASE}/learn/reviews`);
  at = await backTo('/learn/dashboard');
  check('Reviews opened from Home: Back goes Home', at === '/learn/dashboard', at);
  await me.goto(`${BASE}/learn/history`); await settle(me);
  at = await backTo('/learn/dashboard');
  check('Attempt history: Back goes Home', at === '/learn/dashboard', at);

  // 2b. "Walk me through it": one clip per line, in order, never overlapping.
  // The voice is stubbed with a short silent clip so this runs without a key.
  {
    const wp = await newPage(ctx);
    const n = 3200; const wav = Buffer.alloc(44 + n);
    wav.write('RIFF', 0); wav.writeUInt32LE(36 + n, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
    wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(8000, 28); wav.writeUInt16LE(1, 32); wav.writeUInt16LE(8, 34); wav.write('data', 36); wav.writeUInt32LE(n, 40); wav.fill(128, 44);
    let ttsCalls = 0;
    await wp.route('**/api/learner/tts', r => { ttsCalls += 1; return r.fulfill({ status: 200, contentType: 'audio/wav', body: wav }); });
    await wp.addInitScript(() => {
      window.__walk = { log: [], playing: 0, overlap: false };
      const orig = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function play() {
        if (!this.__logged) {
          this.__logged = true;
          this.addEventListener('playing', () => { if (this.src.startsWith('data:')) return; window.__walk.playing += 1; if (window.__walk.playing > 1) window.__walk.overlap = true; });
          ['ended', 'pause'].forEach(ev => this.addEventListener(ev, () => { window.__walk.playing = Math.max(0, window.__walk.playing - 1); }));
        }
        return orig.call(this);
      };
      new MutationObserver(() => {
        const el = document.querySelector('[data-walk-index]');
        const i = el?.getAttribute('data-walk-index');
        const line = document.querySelector('.lj-code-line.is-active')?.getAttribute('data-line');
        if (i != null && i !== '-1' && window.__walk.log[window.__walk.log.length - 1]?.i !== i) window.__walk.log.push({ i, line });
      }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-walk-index', 'class'] });
    });
    await wp.goto(`${BASE}/learn/lesson/py-m3-l3`);
    await wp.waitForSelector('li[data-step] button', { timeout: 15000 });
    await wp.evaluate(() => document.querySelector('li[data-step="code"] button')?.click());
    const walkBtn = await wp.waitForSelector('[data-walk]', { timeout: 15000 }).catch(() => null);
    const notes = await wp.$$eval('.lj-notes li', els => els.length).catch(() => 0);
    if (walkBtn) await walkBtn.click();
    await wp.waitForFunction(() => !document.querySelector('[data-walk-stop]') && window.__walk.log.length > 0, null, { timeout: 30000 }).catch(() => {});
    const w = await wp.evaluate(() => window.__walk);
    const order = w.log.map(x => Number(x.i));
    check('Walkthrough: one clip per line, made before playback', ttsCalls === notes && notes > 0, `${ttsCalls} clips for ${notes} lines`);
    check('Walkthrough: every line plays in order', order.length === notes && order.every((v, k) => v === k), order.join(','));
    check('Walkthrough: never two lines at once', !w.overlap);
    check('Walkthrough: the highlight follows each line', w.log.every(x => x.line), w.log.map(x => x.line).join(','));
    // Controls, with 4-second clips so a line is still playing while we tap.
    const long = Buffer.alloc(44 + 32000, 128); wav.copy(long, 0, 0, 44); long.writeUInt32LE(36 + 32000, 4); long.writeUInt32LE(32000, 40);
    await wp.unroute('**/api/learner/tts');
    await wp.route('**/api/learner/tts', r => r.fulfill({ status: 200, contentType: 'audio/wav', body: long }));
    await wp.reload(); await wp.waitForSelector('li[data-step] button', { timeout: 15000 });
    await wp.evaluate(() => document.querySelector('li[data-step="code"] button')?.click());
    await (await wp.waitForSelector('[data-walk]', { timeout: 15000 })).click();
    const idxIs = (v) => wp.waitForFunction(x => document.querySelector('[data-walk-index]')?.getAttribute('data-walk-index') === x, v, { timeout: 5000 }).then(() => true).catch(() => false);
    await wp.waitForSelector('[data-walk-pause]', { timeout: 15000 }).catch(() => {});
    await wp.click('[data-walk-next]').catch(() => {});
    const nextOk = await idxIs('1');
    await wp.click('[data-walk-prev]').catch(() => {});
    const prevOk = await idxIs('0');
    await wp.click('[data-walk-pause]').catch(() => {});
    const paused = await wp.waitForSelector('[data-walk-state="paused"]', { timeout: 5000 }).then(() => true).catch(() => false);
    await wp.click('[data-walk-replay]').catch(() => {});
    const replayed = await wp.waitForSelector('[data-walk-state="playing"][data-walk-index="0"]', { timeout: 5000 }).then(() => true).catch(() => false);
    check('Walkthrough: Next, Previous, Pause and Replay line work', nextOk && prevOk && paused && replayed, JSON.stringify({ nextOk, prevOk, paused, replayed }));
    await wp.click('[data-walk-stop]').catch(() => {});
    // Audio fails: the highlight stays and the text shows.
    await wp.unroute('**/api/learner/tts');
    await wp.route('**/api/learner/tts', r => r.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"x"}' }));
    await wp.evaluate(() => document.querySelector('li[data-step="practise"] button')?.click());
    await wp.evaluate(() => document.querySelector('li[data-step="code"] button')?.click());
    await wp.waitForTimeout(300);
    await wp.reload(); await wp.waitForSelector('li[data-step] button', { timeout: 15000 });
    await wp.evaluate(() => document.querySelector('li[data-step="code"] button')?.click());
    await (await wp.waitForSelector('[data-walk]', { timeout: 15000 })).click();
    const textMode = await wp.waitForSelector('[data-walk-text]', { timeout: 20000 }).catch(() => null);
    check('Walkthrough without audio: highlight kept, text shown', !!textMode && !!(await wp.$('.lj-code-line.is-active')) && !!(await wp.$('[data-line-note]')));
    await wp.close();
  }

  // 2c. Opening and using the voice session never signs the learner out.
  {
    const vp = await newPage(ctx);
    await vp.goto(`${BASE}/learn/session`);
    await vp.waitForTimeout(4000);
    const typed = await vp.$('textarea, input[type=text]');
    if (typed) { await typed.fill('I am ready for the check'); await typed.press('Enter').catch(() => {}); await vp.waitForTimeout(3000); }
    const out = { url: new URL(vp.url()).pathname, token: await vp.evaluate(() => !!localStorage.getItem('qubirex_token')) };
    check('Voice session: opening and using it never signs out', out.url.startsWith('/learn/') && out.token, JSON.stringify(out));
    await vp.goto(`${BASE}/learn/dashboard`); await settle(vp);
    check('Voice session: still signed in afterwards', new URL(vp.url()).pathname === '/learn/dashboard');
    await vp.close();
  }
  await me.waitForTimeout(61000); // the learner's 30-a-minute request limit

  // 3. Learning language
  await me.goto(`${BASE}/learn/lesson/py-m3-l3`);
  await me.waitForSelector('[data-explain]', { timeout: 15000 });
  await setLearning(me, 'english');
  check('Learning language English: the lesson is in English', !TELUGU.test(await me.textContent('[data-explain]')));
  await setLearning(me, 'telugu');
  await me.waitForFunction(() => /[\u0C00-\u0C7F]/.test(document.querySelector('[data-explain]')?.textContent || ''), null, { timeout: 15000 }).catch(() => {});
  check('Learning language Telugu: the lesson is in Telugu', TELUGU.test(await me.textContent('[data-explain]')));
  await me.goto(`${BASE}/learn/settings`);
  const s = await me.waitForSelector('[data-settings-learning-language] [data-learning-language]', { timeout: 15000 }).then(e => e.getAttribute('data-learning-language')).catch(() => null);
  check('Settings shows the same learning language', s === 'telugu', s);

  // 4. Teach-first "Return values", Telugu then English
  await teachFirst(me, 'py-m3-l3', TELUGU, 'Return values (Telugu)');
  await me.goto(`${BASE}/learn/lesson/py-m3-l3`); await me.waitForSelector('[data-explain]', { timeout: 15000 });
  await setLearning(me, 'english');
  await teachFirst(me, 'py-m3-l3', /return/i, 'Return values (English)');
  await setLearning(me, 'telugu');

  await me.goto(`${BASE}/learn/courses/python`); await settle(me);
  if (!(await me.$('[data-lesson="py-m3-l3"]'))) await me.click('[data-module="py-m3"] .lj-module-head');
  check('Module 3 progress shows "Return values" done', ['done', 'confirmed'].includes(await me.getAttribute('[data-lesson="py-m3-l3"]', 'data-status')), await me.getAttribute('[data-lesson="py-m3-l3"]', 'data-status'));

  // 4b. A lesson opened from a skill page goes back to that skill page
  await me.goto(`${BASE}/learn/skill/test-node-4-4`); await settle(me);
  const toLesson = await me.$('button:has-text("lesson"), [role=tab]:has-text("Lesson")');
  if (toLesson) {
    await toLesson.click();
    await me.waitForURL('**/learn/session**', { timeout: 15000 }).catch(() => {});
    await me.locator('[data-back]').first().click();
    await me.waitForURL('**/learn/skill/test-node-4-4', { timeout: 10000 }).catch(() => {});
    check('A lesson opened from a skill page: Back returns to that skill page', new URL(me.url()).pathname === '/learn/skill/test-node-4-4', me.url());
  } else check('A lesson opened from a skill page: Back returns to that skill page', false, 'no lesson button on the skill page');

  // 5. Topics flow, desktop
  await me.goto(`${BASE}/learn/courses`); await settle(me);
  check('My topics shows Python', !!(await me.$('[data-course="python"]')));
  await me.goto(`${BASE}/learn/courses/javascript`); await settle(me);
  check('Draft topics say they need faculty review', /faculty review/i.test(await me.textContent('main').catch(() => '')));
  await me.goto(`${BASE}/learn/courses/java`); await settle(me);
  check('Java opens with 9 modules', (await me.$$('[data-module]')).length === 9);
  // Lesson answers share the learner's per-minute AI limit (30); the lessons above used much of it.
  await me.waitForTimeout(61000);
  await me.goto(`${BASE}/learn/lesson/jv-m1-l1`); await me.waitForSelector('[data-lesson-page]', { timeout: 15000 });
  await me.click('[data-testout]');
  await me.waitForSelector('[data-testout-answer="0"]', { timeout: 10000 });
  for (const i of [0, 1]) await me.fill(`[data-testout-answer="${i}"]`, 'not sure');
  await me.click('[data-testout-send]');
  check('Test-out not passed: the lesson stays open to learn', (await me.waitForSelector('[data-testout-result]', { timeout: 10000 }).then(e => e.getAttribute('data-testout-result')).catch(() => '')) === 'learn');
  await me.goto(`${BASE}/learn/lesson/jv-m1-l1`); await me.waitForSelector('[data-lesson-page]', { timeout: 15000 });
  await me.click('[data-testout]');
  await me.waitForSelector('[data-testout-answer="0"]', { timeout: 10000 });
  for (const i of [0, 1]) await me.fill(`[data-testout-answer="${i}"]`, '#pass');
  await me.click('[data-testout-send]');
  check('Test-out passed: the lesson is Known', (await me.waitForSelector('[data-testout-result]', { timeout: 10000 }).then(e => e.getAttribute('data-testout-result')).catch(() => '')) === 'known');
  // The rest of Java Module 1, then its test and project, through the same API the pages use.
  const m1 = JSON.parse(fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), '../../backend/data/courses/java/m1.json'), 'utf8'));
  const api = (method, url, body) => me.evaluate(async ([m, u, b]) => {
    const token = localStorage.getItem('qubirex_token');
    const r = await fetch(`/api/learner${u}`, { method: m, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: b ? JSON.stringify(b) : undefined });
    return { status: r.status, body: await r.json().catch(() => null) };
  }, [method, url, body]);
  for (const l of m1.lessons.slice(1)) await api('POST', `/lessons/${l.id}/testout`, { answers: ['#pass', '#pass'] });
  const t = await api('POST', '/modules/jv-m1/test', { answers: m1.test.questions.map(q => q.answer) });
  const proj = await api('GET', '/modules/jv-m1/project');
  const done = await api('POST', '/modules/jv-m1/project', { results: (proj.body?.runner_tests || []).map(x => ({ name: x.name, passed: true })) });
  check('Java Module 1 test and project pass', t.body?.passed === true && done.body?.module?.completed === true, JSON.stringify(done.body?.module || t.body).slice(0, 120));
  await me.goto(`${BASE}/learn/passport`); await settle(me);
  const javaGroup = await me.waitForSelector('[data-passport-group="java"]', { timeout: 15000 }).then(e => e.textContent()).catch(() => '');
  check('The Passport shows the skill under Java', /Fundamentals/.test(javaGroup), javaGroup.replace(/\s+/g, ' ').slice(0, 80));
  check('No console errors on the topic pages', me.errors.length === 0, me.errors.slice(0, 2).join(' | '));

  // 5b. Topics flow at 390 px
  const phoneCtx = await newContext({ width: 390, height: 844 });
  const phone = await newPage(phoneCtx);
  await openStage(phone, 'topics');
  for (const url of ['/learn/courses', '/learn/courses/python', '/learn/lesson/py-m3-l3', '/learn/modules/py-m3/test']) {
    await phone.goto(`${BASE}${url}`); await settle(phone);
    check(`390 px: ${url} has no sideways scroll and a Back button`, (await noSideways(phone)) && !!(await phone.$('[data-backbar] [data-back]')));
  }
  await phoneCtx.close();

  // 6. Public "See our topics"
  const pub = await newPage(await newContext());
  await pub.goto(`${BASE}/topics`);
  await pub.waitForSelector('[data-public-course="python"]', { timeout: 15000 });
  check('See our topics lists Python and Java as ready', !!(await pub.$('[data-public-course="java"]')));
  await pub.click('[data-public-course="python"] [data-sample-link]');
  await pub.waitForSelector('[data-readout]', { timeout: 15000 });
  await pub.click('[data-lang="hindi"]');
  await pub.waitForFunction(() => /[ऀ-ॿ]/.test(document.querySelector('[data-part="explain"]')?.textContent || ''), null, { timeout: 15000 }).catch(() => {});
  check('The free sample reads in Hindi', HINDI.test(await pub.textContent('[data-part="explain"]')));

  // 7. A professor reviews; the learner sees the badge
  const prof = await newPage(await newContext());
  await openCard(prof, 'Professor', '/institution/home');
  await prof.goto(`${BASE}/institution/topics`); await settle(prof);
  await prof.waitForSelector('[data-topic-course="python"]', { timeout: 15000 });
  if (!(await prof.$('[data-topic-lesson="py-m1-l1"]'))) await prof.click('[data-topic-course="python"] .lj-module-head');
  await prof.waitForSelector('[data-topic-lesson="py-m1-l1"] button', { timeout: 15000 });
  await prof.click('[data-topic-lesson="py-m1-l1"] button');
  await prof.click('[data-review-lang="telugu"]');
  await prof.waitForSelector('[data-mark-reviewed]', { timeout: 15000 });
  check('The professor reads the lesson in Telugu', TELUGU.test(await prof.textContent('[data-review-panel]')));
  await prof.click('[data-mark-reviewed]');
  await prof.waitForSelector('[data-review-panel] [role=status]', { timeout: 10000 }).catch(() => {});
  // /dev keeps one developer session at a time: open the learner again.
  await openStage(me, 'topics');
  await prof.click('[data-topic-lesson="py-m1-l1"] button');
  await prof.click('[data-topic-lesson="py-m3-l3"] button').catch(() => {});
  if (!(await prof.$('[data-topic-lesson="py-m3-l3"]'))) await prof.click('[data-topic-course="python"] .lj-module-head');
  const fb = await prof.waitForSelector('[data-topic-lesson="py-m3-l3"]', { timeout: 10000 }).then(e => e.textContent()).catch(() => '');
  const ups = Number(await prof.getAttribute('[data-topic-lesson="py-m3-l3"] [data-up]', 'data-up').catch(() => 0));
  check('👍 feedback from the lesson reaches the professor view', ups >= 1, `${ups} 👍 · ${fb.replace(/\s+/g, ' ').slice(0, 30)}`);
  await me.goto(`${BASE}/learn/lesson/py-m1-l1`);
  await me.waitForSelector('[data-lesson-page]', { timeout: 15000 });
  check('The learner sees "Reviewed by … faculty"', /Reviewed by .* faculty/.test(await me.textContent('[data-lesson-page]')));

  // 8. Ask Qubirex and an open review question follow the learning language (S3 learner, reviews due).
  await openStage(me, 's3');
  await setLearningApi(me, 'telugu');
  await me.goto(`${BASE}/learn/dashboard`); await settle(me);
  await me.fill('#cmd-learner', 'loop ante enti?');
  await me.press('#cmd-learner', 'Enter');
  const tel = await me.waitForSelector('[data-ask-msg="qbx"]', { timeout: 20000 }).then(e => e.textContent()).catch(() => '');
  check('Ask Qubirex: "loop ante enti?" with Telugu chosen gets a Telugu answer', TELUGU.test(tel), tel.slice(0, 60));
  await me.selectOption('[data-ask-language] select', 'english');
  await me.waitForFunction(() => { const m = [...document.querySelectorAll('[data-ask-msg="qbx"]')].pop(); return m && !/[\u0C00-\u0C7F]/.test(m.textContent); }, null, { timeout: 20000 }).catch(() => {});
  const eng = await me.$$eval('[data-ask-msg="qbx"]', els => els[els.length - 1].textContent).catch(() => '');
  check('Ask Qubirex: switching to English answers the same question again in English', !TELUGU.test(eng) && eng.length > 10, eng.slice(0, 60));
  await me.keyboard.press('Escape');

  await me.goto(`${BASE}/learn/reviews`); await settle(me);
  const startBtn = me.locator('main button:has-text("Start"), main button:has-text("Continue")').first();
  await startBtn.click();
  const q1 = await me.waitForSelector('[data-review-question]', { timeout: 15000 }).then(e => e.textContent()).catch(() => '');
  const inst1 = await me.getAttribute('[data-review-question]', 'data-review-question').catch(() => null);
  await setLearning(me, 'hindi');
  await me.waitForFunction(() => /[\u0900-\u097F]/.test(document.querySelector('[data-review-question]')?.textContent || ''), null, { timeout: 20000 }).catch(() => {});
  const q2 = await me.textContent('[data-review-question]').catch(() => '');
  const inst2 = await me.getAttribute('[data-review-question]', 'data-review-question').catch(() => null);
  check('Reviews: switching language on an open question shows the same question in Hindi', TELUGU.test(q1) && HINDI.test(q2) && inst1 && inst1 === inst2, `${inst1 === inst2 ? 'same instance' : 'different'} · ${q2.slice(0, 50)}`);
  await setLearningApi(me, 'telugu');
} catch (e) {
  check('Run finished without an error', false, e.message.slice(0, 200));
} finally {
  await browser.close();
}
const failed = results.filter(r => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed in ${Math.round((Date.now() - started) / 1000)} s`);
process.exit(failed ? 1 : 0);
