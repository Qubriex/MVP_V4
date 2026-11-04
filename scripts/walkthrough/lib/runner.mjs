// Plays one scene (data from scenes/*.js) in a real browser, with a visible
// cursor and human pacing, and writes raw/<scene>/: frames, frames.txt,
// events.json (narration, captions, waits to trim, app audio) and, when a
// screen breaks, a screenshot in bugs/.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { BASE, BYPASS, DESKTOP, PHONE, PACE, RAW, BUGS, devPasscode, playwright } from './config.mjs';
import { Capture } from './capture.mjs';

const INPAGE = fs.readFileSync(new URL('./inpage.js', import.meta.url), 'utf8');
const rand = (a, b) => a + Math.random() * (b - a);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2);

export class SceneError extends Error {}

/** Signs in as a /dev test account off camera: the passcode never reaches the page. */
async function devSignIn(ctx, key) {
  const pass = devPasscode();
  if (!pass) throw new SceneError('DEV_LOGIN_SECRET is not set (needed to sign in as a test account off camera).');
  const headers = BYPASS || {};
  const u = await ctx.request.post(`${BASE}/api/dev/unlock`, { data: { passcode: pass }, headers });
  if (!u.ok()) throw new SceneError(`/dev unlock failed (${u.status()})`);
  const r = await ctx.request.post(`${BASE}/api/dev/login`, { data: { account_key: key }, headers });
  if (!r.ok()) throw new SceneError(`/dev sign-in as ${key} failed (${r.status()}): ${(await r.text()).slice(0, 120)}`);
  return r.json();
}

/** Off-camera API call as the signed-in account (setup before a scene). */
export async function apiAs(ctx, session, method, url, data) {
  const res = await ctx.request.fetch(`${BASE}/api${url}`, { method, data, headers: { Authorization: `Bearer ${session.token}`, ...(BYPASS || {}) } });
  if (!res.ok()) throw new SceneError(`setup ${method} ${url} → ${res.status()}`);
  return res.json().catch(() => ({}));
}

export async function launch() {
  const { chromium } = playwright();
  return chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--hide-scrollbars', '--force-color-profile=srgb', '--font-render-hinting=none', '--disable-features=Translate'] });
}

/**
 * @param {import('playwright').Browser} browser
 * @param {object} scene
 * @param {{ narration: Record<string, { file: string|null, dur: number }>, record?: boolean }} opts
 */
export async function recordScene(browser, scene, { narration, log = console.log }) {
  const dir = path.join(RAW, scene.id);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(path.join(dir, 'audio'), { recursive: true });
  fs.mkdirSync(BUGS, { recursive: true });

  const phone = scene.viewport === 'phone';
  const ctx = await browser.newContext({
    viewport: phone ? { width: PHONE.width, height: PHONE.height } : { width: DESKTOP.width, height: DESKTOP.height },
    ...(phone ? { isMobile: true, hasTouch: true, deviceScaleFactor: 1 } : {}),
    locale: 'en-IN', timezoneId: 'Asia/Kolkata', colorScheme: 'light', reducedMotion: 'no-preference',
    extraHTTPHeaders: BYPASS || undefined
  });
  const zoom = phone ? 1 : DESKTOP.width / DESKTOP.layout;
  await ctx.addInitScript(`(${INPAGE})(${JSON.stringify({ zoom, lang: scene.uiLang || 'english', record: scene.record !== false })})`);

  const ev = { id: scene.id, title: scene.title, chapter: scene.chapter, viewport: scene.viewport || 'desktop', start: 0, end: 0, says: [], labels: [], waits: [], audio: [], bugs: [], ok: false };
  const audioRaw = [];
  const audioData = new Map();
  await ctx.exposeBinding('__qbxAudio', (_src, e) => {
    if (e.type === 'data') { audioData.set(e.src, Buffer.from(e.b64, 'base64')); return; }
    audioRaw.push(e);
  });

  let session = null;
  if (scene.account) session = await devSignIn(ctx, scene.account);
  else if (scene.unlock) {
    // /dev opened already unlocked: the passcode is sent off camera, never typed on screen.
    const u = await ctx.request.post(`${BASE}/api/dev/unlock`, { data: { passcode: devPasscode() }, headers: BYPASS || {} });
    if (!u.ok()) throw new SceneError(`/dev unlock failed (${u.status()})`);
  }
  if (session) {
    // The app reads the session from storage; no developer marker, so no developer bar.
    await ctx.addInitScript((s) => {
      try {
        if (!localStorage.getItem('qubirex_token')) {
          localStorage.setItem('qubirex_token', s.token); localStorage.setItem('qubirex_user', JSON.stringify(s.user)); localStorage.setItem('qubirex_role', s.role);
        }
      } catch { /* blocked */ }
    }, { token: session.token, user: session.user, role: session.role });
  }
  const api = (method, url, data) => apiAs(ctx, session, method, url, data);
  // apiAsAccount: an off-camera call as another test account, through a separate request context.
  const apiAsAccount = async (key, method, url, data) => {
    const { request } = playwright();
    const req = await request.newContext({ extraHTTPHeaders: BYPASS || undefined });
    try {
      await req.post(`${BASE}/api/dev/unlock`, { data: { passcode: devPasscode() } });
      const r = await req.post(`${BASE}/api/dev/login`, { data: { account_key: key } });
      const tok = (await r.json()).token;
      const res = await req.fetch(`${BASE}/api${url}`, { method, data, headers: { Authorization: `Bearer ${tok}` } });
      return res.json();
    } finally { await req.dispose(); }
  };
  const devJson = async (url) => { await ctx.request.post(`${BASE}/api/dev/unlock`, { data: { passcode: devPasscode() }, headers: BYPASS || {} }); return (await ctx.request.get(`${BASE}/api/dev${url}`, { headers: BYPASS || {} })).json(); };
  const vars = (scene.setup && (await scene.setup({ api, ctx, session, apiAsAccount, devJson }))) || {};

  let page = await ctx.newPage();
  const cap = new Capture(dir);
  const mouse = { x: (phone ? PHONE.width : DESKTOP.width) * 0.62, y: (phone ? PHONE.height : DESKTOP.height) * 0.55 };
  let busyUntil = 0; // narration still speaking until
  let shown = false;

  const settle = async (max = 8000) => {
    const t = Date.now();
    await page.waitForLoadState('networkidle', { timeout: max }).catch(() => {});
    await page.waitForFunction(() => !document.querySelector('[aria-busy="true"], .ui-spinner, .spinner, .loading'), null, { timeout: max }).catch(() => {});
    const d = Date.now() - t;
    if (d > 300) ev.waits.push({ from: t, to: Date.now() });
  };
  const waitTracked = async (fn) => { const t = Date.now(); const out = await fn(); if (Date.now() - t > 300) ev.waits.push({ from: t, to: Date.now() }); return out; };

  const check = async (where) => {
    const hits = await page.evaluate(() => window.__qbx?.ugly() || []).catch(() => []);
    const real = scene.allowUgly ? hits.filter(h => !scene.allowUgly.some(a => h.includes(a))) : hits;
    if (real.length) {
      const shot = path.join(BUGS, `${scene.id}-${Date.now()}.png`);
      await page.screenshot({ path: shot }).catch(() => {});
      ev.bugs.push({ page: new URL(page.url()).pathname, where, what: real, screenshot: path.relative(path.dirname(BUGS), shot) });
      throw new SceneError(`broken screen at ${new URL(page.url()).pathname} (${where}): ${real.join('; ')}`);
    }
  };

  const target = async (sel, opts = {}) => {
    // Only what is on screen (a page can hold hidden copies, such as a phone menu).
    const vis = /visible=/.test(sel) ? sel : `${sel} >> visible=true`;
    const loc = opts.text ? page.locator(vis, { hasText: opts.text }).first() : page.locator(vis).first();
    await waitTracked(() => loc.waitFor({ state: 'visible', timeout: opts.timeout || 15000 })).catch(() => { throw new SceneError(`not found: ${sel}${opts.text ? ` "${opts.text}"` : ''}`); });
    return loc;
  };
  const moveTo = async (x, y, ms = rand(...PACE.moveMs)) => {
    const from = { ...mouse };
    // A slight curve, like a hand.
    const bend = { x: (y - from.y) * 0.08, y: (from.x - x) * 0.08 };
    const steps = Math.max(8, Math.round(ms / 16));
    for (let i = 1; i <= steps; i += 1) {
      const t = ease(i / steps);
      const arc = Math.sin(Math.PI * t);
      const px = from.x + (x - from.x) * t + bend.x * arc;
      const py = from.y + (y - from.y) * t + bend.y * arc;
      await page.mouse.move(px, py);
      await page.evaluate(([a, b]) => window.__qbx?.move(a, b), [px, py]).catch(() => {});
      await sleep(Math.max(0, ms / steps - 6));
    }
    mouse.x = x; mouse.y = y;
  };
  const showCursor = async () => { await page.evaluate(([a, b]) => window.__qbx?.move(a, b), [mouse.x, mouse.y]).catch(() => {}); };
  const pointAt = async (loc, where = 'center') => {
    await loc.scrollIntoViewIfNeeded().catch(() => {});
    let box = await loc.boundingBox();
    if (!box) throw new SceneError('element has no box');
    // Near an edge (under a sticky header or the phone's tab bar): bring it to the middle first.
    const vh = page.viewportSize().height;
    if (box.y < 110 || box.y + box.height > vh - 120) {
      await loc.evaluate(el => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));
      await sleep(750);
      box = await loc.boundingBox();
    }
    const x = box.x + (where === 'left' ? Math.min(24, box.width / 2) : box.width / 2) + rand(-2, 2);
    const y = box.y + box.height / 2 + rand(-1.5, 1.5);
    await moveTo(x, y);
    return { x, y };
  };
  const smoothScroll = async (js, arg) => {
    await page.evaluate(js, arg);
    await sleep(750);
  };

  const run = {
    async goto(s) {
      const to = typeof s.goto === 'function' ? s.goto(vars) : s.goto;
      const url = to.startsWith('http') ? to : `${BASE}${to}`;
      await waitTracked(() => page.goto(url, { waitUntil: 'domcontentloaded' }));
      await settle(12000);
      if (s.waitFor) await target(s.waitFor);
      await showCursor();
    },
    async click(s) {
      const loc = await target(s.click, s);
      const p = await pointAt(loc, s.at);
      await page.evaluate(([a, b]) => { window.__qbx?.down(true); window.__qbx?.ring(a, b); }, [p.x, p.y]).catch(() => {});
      await sleep(90);
      const heard = audioRaw.filter(e => e.type === 'start').length;
      if (s.newTab) {
        const [popup] = await Promise.all([ctx.waitForEvent('page', { timeout: 15000 }), page.mouse.click(p.x, p.y)]);
        await popup.waitForLoadState('domcontentloaded');
        await cap.attach(popup);
        page = popup;
        await settle(10000);
      } else {
        await page.mouse.click(p.x, p.y);
      }
      await page.evaluate(() => window.__qbx?.down(false)).catch(() => {});
      if (s.waitAudio) {
        // Until the app's own voice starts (the wait is trimmed in the edit).
        const t = Date.now();
        while (audioRaw.filter(e => e.type === 'start').length <= heard && Date.now() - t < (s.audioTimeout || 20000)) await sleep(100);
        if (Date.now() - t > 300) ev.waits.push({ from: t, to: Date.now() });
        // No voice (quota used up): the app shows the text instead; noted for the report.
        if (audioRaw.filter(e => e.type === 'start').length <= heard) (ev.notes ||= []).push(`no app audio after clicking ${s.click}`);
      }
      if (s.waitFor) await target(s.waitFor, { timeout: s.timeout || 30000 });
      else if (s.waitUrl) await waitTracked(() => page.waitForURL(s.waitUrl, { timeout: 15000 }).catch(() => {}));
      if (!s.noSettle) await settle(s.settle || 6000);
      await sleep(s.pause ?? PACE.afterResult);
    },
    async type(s) {
      const loc = await target(s.into || s.type);
      if (!s.noClick) {
        const p = await pointAt(loc, 'left');
        await page.evaluate(([a, b]) => window.__qbx?.ring(a, b), [p.x, p.y]).catch(() => {});
        await page.mouse.click(p.x, p.y);
      }
      if (s.clear) { await loc.fill(''); }
      const text = typeof s.text === 'function' ? s.text(vars) : s.text;
      for (const ch of text) {
        if (ch === '\n') await page.keyboard.press('Enter'); else await page.keyboard.type(ch);
        await sleep(1000 / rand(...PACE.cps));
      }
      if (s.enter) { await sleep(250); await page.keyboard.press('Enter'); }
      if (s.waitFor) await target(s.waitFor, { timeout: s.timeout || 30000 });
      await sleep(s.pause ?? 500);
    },
    async fill(s) { // instant (for code the learner pastes); still on camera
      const loc = await target(s.fill);
      await pointAt(loc, 'left');
      await loc.fill(s.text);
      await sleep(s.pause ?? 600);
    },
    async selectText(s) { // select some text in a textarea (the next typing replaces it)
      const loc = await target(s.selectText);
      await loc.evaluate((el, find) => { const i = el.value.indexOf(find); el.focus(); el.setSelectionRange(i, i + find.length); }, s.find);
      await sleep(s.pause ?? 500);
    },
    async press(s) { await page.keyboard.press(s.press); if (s.waitFor) await target(s.waitFor); await sleep(s.pause ?? 600); },
    async select(s) {
      const loc = await target(s.select);
      const p = await pointAt(loc);
      await page.evaluate(([a, b]) => window.__qbx?.ring(a, b), [p.x, p.y]).catch(() => {});
      await loc.selectOption(s.value);
      if (s.waitFor) await target(s.waitFor, { timeout: s.timeout || 30000 });
      await settle(8000);
      await sleep(s.pause ?? PACE.afterResult);
    },
    async hover(s) {
      const loc = await target(s.hover, s);
      await pointAt(loc, s.at);
      await sleep(s.pause ?? 900);
    },
    async scroll(s) {
      if (typeof s.scroll === 'number') await smoothScroll((y) => window.scrollBy({ top: y / (Number(document.documentElement.style.zoom) || 1), behavior: 'smooth' }), s.scroll);
      else if (s.scroll === 'top') await smoothScroll(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
      else {
        const loc = await target(s.scroll, s);
        await loc.evaluate((el, block) => el.scrollIntoView({ behavior: 'smooth', block }), s.block || 'center');
        await sleep(750);
      }
      await sleep(s.pause ?? 400);
    },
    async 'wait-for'(s) { await target(s['wait-for'], { timeout: s.timeout || 30000, text: s.text }); if (s.settle !== false) await settle(); await sleep(s.pause ?? 300); },
    async waitText(s) { // until a selector shows some text (a typed answer, a result)
      const t = Date.now();
      await page.waitForFunction(([sel, re]) => new RegExp(re, 'i').test(document.querySelector(sel)?.textContent || ''), [s.waitText, s.match], { timeout: s.timeout || 30000 })
        .catch(() => { throw new SceneError(`no "${s.match}" in ${s.waitText}`); });
      if (Date.now() - t > 300) ev.waits.push({ from: t, to: Date.now() });
      await sleep(s.pause ?? 300);
    },
    async highlight(s) {
      const loc = await target(s.highlight, s);
      await loc.scrollIntoViewIfNeeded().catch(() => {});
      if (s.point !== false) await pointAt(loc);
      await page.evaluate(() => window.__qbx?.highlight(null, false));
      await loc.evaluate(el => el.classList.add('qbx-hl'));
      await sleep(s.hold ?? 1800);
      if (!s.keep) await page.evaluate(() => window.__qbx?.highlight(null, false));
    },
    async unhighlight() { await page.evaluate(() => window.__qbx?.highlight(null, false)); },
    async say(s) {
      // One narration line at a time: wait for the one before to finish.
      const wait = busyUntil - Date.now();
      if (wait > 0) await sleep(wait + 250);
      const n = narration[s.say.id];
      const at = Date.now();
      ev.says.push({ id: s.say.id, at, dur: n.dur, file: n.file, en: s.say.en, te: s.say.te, hi: s.say.hi });
      busyUntil = at + n.dur * 1000;
      if (s.wait) await sleep(n.dur * 1000 + 200); // finish the line before the next step
    },
    async label(s) { ev.labels.push({ text: s.label, at: Date.now(), dur: s.dur || 3.6 }); },
    async pause(s) { await sleep(s.pause); },
    async waitNarration() { const w = busyUntil - Date.now(); if (w > 0) await sleep(w + 200); },
    async eval(s) { await page.evaluate(s.eval, s.arg); await sleep(s.pause ?? 200); },
    async setup(s) { await s.setup({ api, page, ctx }); },
    async cursor(s) { if (s.cursor === 'hide') await page.evaluate(() => window.__qbx?.hide()); else await showCursor(); },
    async closeTab() {
      const pages = ctx.pages();
      if (pages.length > 1) { await page.close(); page = pages[0]; await cap.attach(page); await page.bringToFront(); await sleep(300); }
    }
  };
  const kindOf = (s) => Object.keys(run).find(k => k in s && k !== 'setup') || (s.setup ? 'setup' : null);

  try {
    // The first page loads off camera: the scene opens on a ready screen.
    const steps = [...scene.steps];
    if (steps[0]?.goto) await run.goto(steps.shift());
    await cap.attach(page);
    await sleep(400);
    await check('first screen');
    ev.start = Date.now();
    shown = true;
    for (const s of steps) {
      const kind = kindOf(s);
      if (!kind) throw new SceneError(`unknown step ${JSON.stringify(s).slice(0, 80)}`);
      await run[kind](s);
      if (!['say', 'label', 'pause', 'waitNarration'].includes(kind)) await check(`${kind} ${String(s[kind] ?? '').slice(0, 60)}`);
    }
    await run.waitNarration();
    await sleep(scene.tail ?? 900);
    ev.end = Date.now();
    ev.ok = true;
  } catch (err) {
    ev.error = String(err.message || err);
    ev.end = Date.now();
    if (!ev.bugs.length && shown) {
      const shot = path.join(BUGS, `${scene.id}-${Date.now()}.png`);
      await page.screenshot({ path: shot }).catch(() => {});
      ev.failShot = path.relative(path.dirname(BUGS), shot);
    }
    log(`  ✗ ${scene.id}: ${ev.error}`);
  } finally {
    await cap.detach();
    await sleep(300);
    // App audio: pair start/stop by source.
    const open = new Map();
    for (const e of audioRaw) {
      if (e.type === 'start') open.set(e.src, e);
      else if (e.type === 'stop' && open.has(e.src)) {
        const s = open.get(e.src); open.delete(e.src);
        if (e.at - s.at > 120) ev.audio.push({ src: s.src, at: s.at, offset: s.offset, rate: s.rate, dur: (e.at - s.at) / 1000 });
      }
    }
    for (const s of open.values()) ev.audio.push({ src: s.src, at: s.at, offset: s.offset, rate: s.rate, dur: Math.max(0, (ev.end - s.at) / 1000) });
    for (const a of ev.audio) {
      const buf = audioData.get(a.src);
      if (!buf) { a.file = null; continue; }
      const ext = buf.slice(0, 4).toString() === 'RIFF' ? 'wav' : buf.slice(0, 4).toString() === 'OggS' ? 'ogg' : 'mp3';
      const name = `${crypto.createHash('sha1').update(buf).digest('hex').slice(0, 12)}.${ext}`;
      fs.writeFileSync(path.join(dir, 'audio', name), buf);
      a.file = `audio/${name}`;
      delete a.src;
    }
    ev.audio = ev.audio.filter(a => a.at < ev.end && a.at + a.dur * 1000 > ev.start);
    if (ev.start) ev.duration = cap.writeList(ev.start, ev.end);
    ev.frames = cap.frames.length;
    fs.writeFileSync(path.join(dir, 'events.json'), JSON.stringify(ev, null, 1));
    await ctx.close();
  }
  return ev;
}
