// e2e/team-points.mjs — checks the team's 19 Oct review points in a real
// browser against a running local copy (BASE, default http://localhost:3000).
//   node e2e/team-points.mjs
import { createRequire } from 'module';
import path from 'path';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(path.join(process.env.NODE_PATH || '/opt/node22/lib/node_modules', 'playwright'))); }
const BASE = process.env.BASE || 'http://localhost:3000';
const results = [];
const check = (point, ok, detail = '') => { results.push([point, ok, detail]); console.log(`${ok ? '✓' : '✗'} ${point}${detail ? ` — ${detail}` : ''}`); };

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
// Record real playback: every audio element that actually starts playing.
await page.addInitScript(() => {
  window.__played = [];
  document.addEventListener('playing', e => window.__played.push(e.target.currentSrc || e.target.src), true);
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () { this.addEventListener('playing', () => window.__played.push(this.src), { once: true }); return play.call(this); };
});
const errors = [];
page.on('pageerror', e => errors.push(e.message));

// 4 — sample lesson plays real audio, with Pause and captions.
await page.goto(BASE + '/');
await page.evaluate(() => localStorage.setItem('qubirex_ui_lang', 'english'));
await page.reload();
// The shipped recording (/audio/sample-lesson-*.wav) when the build made one, else the API.
const audioReq = page.waitForResponse(r => /\/api\/sample-lesson|\/audio\/sample-lesson-/.test(r.url()), { timeout: 15000 }).catch(() => null);
await page.click('.pb-play');
const audioRes = await audioReq;
await page.waitForFunction(() => /Pause|again|tap play/i.test(document.querySelector('.pb-play')?.getAttribute('aria-label') || '') || /ready/i.test(document.body.innerText), null, { timeout: 15000 }).catch(() => {});
const label = await page.getAttribute('.pb-play', 'aria-label');
const caption = await page.textContent('.pb-captions');
const played = await page.waitForFunction(() => window.__played.length > 0, null, { timeout: 10000 }).then(() => true).catch(() => false);
check('4 Sample lesson plays', !!audioRes && audioRes.status() === 200 && played && /Pause|again|Replay|tap/i.test(label || ''), `${audioRes?.url().replace(BASE, '')} ${audioRes?.status()} ${audioRes?.headers()['content-type']}, audio playing: ${played}, button "${label}", caption "${caption.trim().slice(0, 40)}"`);

// 1 — the brand line under the headline is only in the selected language.
const hero = await page.textContent('.pb-hero');
check('1 Hero shows one language', !/[ఀ-౿]/.test(hero.replace(/React లో.*$/s, '')) && !/[ऀ-ॿ]/.test(hero), 'no Telugu or Hindi brand lines in English mode');
await page.evaluate(() => localStorage.setItem('qubirex_ui_lang', 'telugu'));
await page.reload();
const heroTe = await page.textContent('.pb-hero h1 + p');
check('1 Telugu only after choosing Telugu', /[ఀ-౿]/.test(heroTe) && !/[A-Za-z]{4}/.test(heroTe), heroTe.trim());
await page.evaluate(() => localStorage.setItem('qubirex_ui_lang', 'hindi'));
await page.reload();
const heroHi = await page.textContent('.pb-hero h1 + p');
check('1 Hindi only after choosing Hindi', /[ऀ-ॿ]/.test(heroHi) && !/[ఀ-౿]/.test(heroHi) && !/[A-Za-z]{4}/.test(heroHi), heroHi.trim());
await page.evaluate(() => localStorage.setItem('qubirex_ui_lang', 'english'));
await page.reload();

// 5 — no repeated sign-in section on the home page.
const signInLinks = await page.$$eval('main a', as => as.map(a => a.getAttribute('href')).filter(h => ['/learner-login', '/login', '/employer/login'].includes(h)));
check('5 No sign-in boxes on the home page', signInLinks.length === 0, `${signInLinks.length} sign-in links in the page body`);

// 6 — screenshots open a larger view.
await page.click('.pb-screen-btn >> nth=1');
const dlg = await page.waitForSelector('[role="dialog"] .pb-screen-full', { timeout: 5000 }).catch(() => null);
const alts = await page.$$eval('.pb-screen-btn img', imgs => imgs.map(i => i.alt));
const next = dlg && await page.click('[role="dialog"] button:has-text("Next")').then(() => page.getAttribute('.pb-screen-full', 'src'));
await page.keyboard.press('Escape');
const closed = !(await page.$('[role="dialog"]'));
check('6 Screenshots open larger', !!dlg && /college-home/.test(next || '') && closed && alts.every(Boolean), `opened, next → ${next}, Esc closes: ${closed}, alt text: ${alts.join(' / ')}`);

// 7 — learners wording no longer ties learning to the phone.
const body = await page.textContent('main');
check('7 "Learn on your phone" replaced', !/Learn on your phone/i.test(body) && /at your own pace/i.test(body) && /Works on your phone and laptop/.test(body));

// 2, 3 — header logo without the tagline; footer shows the tagline as text.
const headerLogo = await page.getAttribute('header .brand-logo-light', 'src');
const footerTag = await page.textContent('.pb-foot-tagline');
check('2 Header logo without tagline', /notag/.test(headerLogo), headerLogo);
check('3 Footer tagline readable', /Your Language\. Your Skills\. Your Future\./.test(footerTag), footerTag);

// 8 — Talk to us with a stale sign-in in the browser: stays put, says thanks, message is stored.
await page.evaluate(() => { localStorage.setItem('qubirex_token', 'stale-token'); localStorage.setItem('qubirex_role', 'employer'); });
await page.reload();
await page.locator('button:has-text("Talk to us"):visible').first().click();
await page.fill('#tk-name', 'Placement Officer');
await page.fill('#tk-reply', 'tpo@example-college.in');
await page.fill('#tk-msg', 'We would like a demo for 300 students.');
await page.click('form button[type=submit]:has-text("Send")');
await page.waitForTimeout(1500);
const url = page.url();
const thanks = await page.$('[role="status"] >> text=/within 1 working day/i');
check('8 Talk to us stays and confirms', url === BASE + '/' && !!thanks, `url ${url.replace(BASE, '')}, thanks shown: ${!!thanks}`);

// 9 — Check name gives Match / Unclear / No match, and explains a one-word name.
await page.goto(BASE + '/verify/QBX-DEMO-0000');
await page.waitForSelector('#vname');
const outcome = async (name) => { await page.fill('#vname', name); await page.click('button:has-text("Check name")'); await page.waitForTimeout(300); return (await page.textContent('#vname >> xpath=ancestor::section')).replace(/\s+/g, ' '); };
const one = await outcome('Lakshmi');
const m = await outcome('Lakshmi Rao');
const u = await outcome('Kumar Rao');
const n = await outcome('Anil Sharma');
check('9 Check name works', /full name/i.test(one) && /Match/.test(m) && /Unclear/.test(u) && /No match/.test(n), 'one word → asks for full name; Match; Unclear; No match');

// 10 — no JWKS link on Verify; "For developers" in the footer.
const verifyText = await page.textContent('main');
const devLink = await page.$('footer a[href="/developers"]');
await page.goto(BASE + '/developers');
const devPage = await page.textContent('main');
check('10 JWKS moved to For developers', !/JWKS/.test(verifyText) && !!devLink && /JWKS/.test(devPage));

check('No page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
await browser.close();
const failed = results.filter(r => !r[1]).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
