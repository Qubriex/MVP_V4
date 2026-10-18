// e2e/screens.mjs — refreshes the home-page screenshot strip
// (public/screens/*.png) from a running local copy with the seed data
// (backend: npm run seed:test). BASE=http://localhost:3000 node e2e/screens.mjs
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(path.join(process.env.NODE_PATH || '/opt/node22/lib/node_modules', 'playwright'))); }
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'screens');
const BASE = process.env.BASE || 'http://localhost:3000';
const PASSWORD = 'QubirexTest2026!';

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
async function shoot(login, route, file) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, colorScheme: 'light', reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  await p.goto(BASE); await p.evaluate(() => { localStorage.setItem('qubirex_ui_lang', 'english'); localStorage.setItem('qubirex_theme', 'light'); });
  await login(p);
  await p.goto(BASE + route); await p.waitForLoadState('networkidle').catch(() => {}); await p.waitForTimeout(800);
  await p.screenshot({ path: path.join(OUT, `${file}.png`) });
  await ctx.close();
}
const learner = async (p) => { await p.goto(`${BASE}/learner-login`); await p.fill('#lref', 'TEST-LRNR-001'); await p.fill('#leng', 'QX-FSD-T01'); await p.fill('#lpin', '410585'); await p.click('form button[type=submit]'); await p.waitForURL(/\/learn\/(?!.*login)/); };
const staff = async (p) => { await p.goto(`${BASE}/login`); await p.fill('#em', 'test.institution@qubirex.local'); await p.fill('#pw', PASSWORD); await p.click('form button[type=submit]'); await p.waitForURL(/\/institution\/home/); };
const employer = async (p) => { await p.goto(`${BASE}/employer/login`); await p.fill('#em', 'test.employer@qubirex.local'); await p.fill('#pw', PASSWORD); await p.click('form button[type=submit]'); await p.waitForURL(/\/employer\/(home|company)/); };
await shoot(learner, '/learn/dashboard', 'learner-home');
await shoot(learner, '/learn/passport', 'passport');
await shoot(staff, '/institution/home', 'college-home');
await shoot(employer, '/employer/home', 'employer-home');
await browser.close();
console.log('Saved to', OUT);
