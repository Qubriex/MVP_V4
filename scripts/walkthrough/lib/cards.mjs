// Title cards, lower-thirds, the phone frame and thumbnails, drawn as HTML in
// Chrome with the brand fonts (Outfit, Anek) and logo, saved as PNG.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { pathToFileURL } from 'url';
import { ROOT, CACHE, BRAND } from './config.mjs';
import { launch } from './runner.mjs';

const FONTS = path.join(ROOT, 'frontend/public/fonts');
const LOGO = path.join(ROOT, 'frontend/public/brand/qubirex-logo-notag-1280.png');
const LOGO_DARK = path.join(ROOT, 'frontend/public/brand/qubirex-logo-notag-on-dark-1280.png');
const MARK = path.join(ROOT, 'frontend/public/brand/qubirex-mark.png');
const DIR = path.join(CACHE, 'cards');
const url = (f) => pathToFileURL(f).href;
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const face = (family, file, weight) => `@font-face { font-family: '${family}'; src: url('${url(path.join(FONTS, file))}') format('woff2'); font-weight: ${weight}; }`;
const CSS = `
  ${face('Outfit', 'outfit-latin-500-normal.woff2', 500)} ${face('Outfit', 'outfit-latin-600-normal.woff2', 600)} ${face('Outfit', 'outfit-latin-700-normal.woff2', 700)}
  ${face('Anek Latin', 'anek-latin-latin-400-normal.woff2', 400)} ${face('Anek Latin', 'anek-latin-latin-500-normal.woff2', 500)} ${face('Anek Latin', 'anek-latin-latin-600-normal.woff2', 600)}
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 100%; height: 100%; }
  body { font-family: 'Anek Latin', sans-serif; color: ${BRAND.ink}; -webkit-font-smoothing: antialiased; }
  .display { font-family: 'Outfit', sans-serif; letter-spacing: -0.02em; }
`;

let browser = null;
async function shot(name, html, { width = 1920, height = 1080, transparent = false } = {}) {
  fs.mkdirSync(DIR, { recursive: true });
  const key = crypto.createHash('sha1').update(html + width + height + transparent).digest('hex').slice(0, 10);
  const file = path.join(DIR, `${name}-${key}.png`);
  if (fs.existsSync(file)) return file;
  if (!browser) browser = await launch();
  const page = await browser.newPage({ viewport: { width, height } });
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>${html}</body></html>`, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
  await page.screenshot({ path: file, omitBackground: transparent });
  await page.close();
  return file;
}
export async function closeCards() { if (browser) await browser.close(); browser = null; }

const glow = `radial-gradient(1200px 700px at 85% 110%, rgba(248,152,51,.22), transparent 60%), radial-gradient(900px 600px at 0% -10%, rgba(231,59,43,.14), transparent 60%), ${BRAND.soft}`;
const bar = `<div style="position:absolute;left:0;right:0;bottom:0;height:14px;background:linear-gradient(90deg, ${BRAND.crimson}, ${BRAND.primary} 40%, ${BRAND.accentStrong} 70%, ${BRAND.accent})"></div>`;

export const introCard = () => shot('intro', `
  <div style="position:relative;width:100%;height:100%;background:${glow};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:44px">
    <img src="${url(LOGO)}" style="width:760px">
    <div class="display" style="font-size:64px;font-weight:600;color:${BRAND.ink}">Your Language. Your Skills. Your Future.</div>
    <div style="font-size:30px;color:#5b5b66;font-weight:500">Qubirex by Inferexaa Private Limited</div>
    ${bar}
  </div>`);

export const chapterCard = (n, title, sub = '') => shot(`chapter-${n}`, `
  <div style="position:relative;width:100%;height:100%;background:${glow};display:flex;flex-direction:column;justify-content:center;padding:0 200px;gap:26px">
    <img src="${url(MARK)}" style="width:96px;height:96px;object-fit:contain">
    <div style="font-size:30px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:${BRAND.primary}">${n === 'internal' ? 'Internal' : `Chapter ${n}`}</div>
    <div class="display" style="font-size:110px;font-weight:700;line-height:1.02">${esc(title)}</div>
    ${sub ? `<div style="font-size:36px;color:#55555f;max-width:1300px;line-height:1.3">${esc(sub)}</div>` : ''}
    ${bar}
  </div>`);

export const closingCard = () => shot('closing', `
  <div style="position:relative;width:100%;height:100%;background:#17171b;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:40px">
    <img src="${url(LOGO_DARK)}" style="width:640px">
    <div class="display" style="font-size:58px;font-weight:600">Your Language. Your Skills. Your Future.</div>
    <div style="display:flex;gap:28px;align-items:center;margin-top:10px">
      <div style="font-size:40px;font-weight:600;padding:18px 40px;border-radius:999px;background:${BRAND.primary}">Talk to us</div>
      <div style="font-size:40px;font-weight:500">qubirex.in</div>
    </div>
    <div style="font-size:34px;color:#d9d9e0">[CONTACT_EMAIL]</div>
    <div style="font-size:26px;color:#9a9aa6">Qubirex by Inferexaa Private Limited</div>
    ${bar}
  </div>`);

/** A lower-third naming the feature on screen (transparent PNG over the video). */
export const lowerThird = (text, { phone = false } = {}) => shot('lower', `
  <div style="position:absolute;left:${phone ? 120 : 64}px;bottom:${phone ? 140 : 70}px;display:flex;align-items:stretch;border-radius:16px;overflow:hidden;box-shadow:0 10px 34px rgba(0,0,0,.28)">
    <div style="width:12px;background:linear-gradient(180deg, ${BRAND.primary}, ${BRAND.accent})"></div>
    <div class="display" style="background:rgba(23,23,27,.92);color:#fff;font-size:${phone ? 40 : 36}px;font-weight:600;padding:20px 34px;max-width:${phone ? 560 : 1100}px;line-height:1.2">${esc(text)}</div>
  </div>`, { transparent: true });

// The phone: a generic frame. The screen (390×844 scaled by 1.12) sits at
// PHONE_SCREEN; the background has the logo and room for captions.
export const PHONE_SCREEN = { x: 1080, y: 69, w: 437, h: 945 };
export const phoneBackground = () => shot('phone-bg', `
  <div style="position:relative;width:100%;height:100%;background:${glow}">
    <img src="${url(LOGO)}" style="position:absolute;left:120px;top:120px;width:420px">
    <div class="display" style="position:absolute;left:120px;top:260px;font-size:58px;font-weight:700;line-height:1.1;max-width:760px">Qubirex on a phone</div>
    <div style="position:absolute;left:120px;top:420px;font-size:32px;color:#55555f;max-width:700px;line-height:1.35">Lessons, practice and the Passport, made for the phone in your pocket.</div>
    <div style="position:absolute;left:${PHONE_SCREEN.x - 22}px;top:${PHONE_SCREEN.y - 22}px;width:${PHONE_SCREEN.w + 44}px;height:${PHONE_SCREEN.h + 44}px;border-radius:64px;background:#111;box-shadow:0 30px 80px rgba(0,0,0,.35)"></div>
    ${bar}
  </div>`);
export const phoneBezel = () => shot('phone-bezel', `
  <div style="position:absolute;left:${PHONE_SCREEN.x}px;top:${PHONE_SCREEN.y}px;width:${PHONE_SCREEN.w}px;height:${PHONE_SCREEN.h}px;border-radius:44px;box-shadow:0 0 0 40px #111"></div>
  <div style="position:absolute;left:${PHONE_SCREEN.x + PHONE_SCREEN.w / 2 - 60}px;top:${PHONE_SCREEN.y + 10}px;width:120px;height:30px;border-radius:20px;background:#111"></div>`, { transparent: true });

/** A thumbnail: a frame from the video with the title over it. */
export const thumbnail = (name, frame, title, kicker) => shot(`thumb-${name}`, `
  <div style="position:relative;width:100%;height:100%;background:#111">
    <img src="${url(frame)}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.92">
    <div style="position:absolute;inset:0;background:linear-gradient(90deg, rgba(23,23,27,.92) 0%, rgba(23,23,27,.7) 45%, rgba(23,23,27,0) 75%)"></div>
    <img src="${url(LOGO_DARK)}" style="position:absolute;left:64px;top:56px;width:300px">
    <div style="position:absolute;left:64px;bottom:96px;max-width:720px">
      <div style="font-size:30px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:${BRAND.accent}">${esc(kicker)}</div>
      <div class="display" style="font-size:76px;font-weight:700;color:#fff;line-height:1.04;margin-top:14px">${esc(title)}</div>
    </div>
    ${bar}
  </div>`, { width: 1280, height: 720 });
