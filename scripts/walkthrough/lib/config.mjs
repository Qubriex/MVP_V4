// Shared settings for the walkthrough recorder and editor.
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export const OUT = path.join(ROOT, 'artifacts/walkthrough');
export const RAW = path.join(OUT, 'raw');          // one folder per recorded scene
export const WORK = path.join(OUT, 'work');        // intermediate clips
export const CACHE = path.join(OUT, 'cache');      // narration audio, cards
export const BUGS = path.join(OUT, 'bugs');        // screenshots of broken screens

// BASE_URL: staging by default (WALKTHROUGH_STAGING_URL), a local copy is fine.
export const BASE = (process.env.BASE_URL || process.env.WALKTHROUGH_STAGING_URL || 'http://localhost:3000').replace(/\/$/, '');
// The deployment's /dev passcode. Read from the environment only; never logged or shown.
export const devPasscode = () => process.env.DEV_LOGIN_SECRET || '';
// A Vercel deployment behind Deployment Protection (never committed).
export const BYPASS = process.env.VERCEL_BYPASS ? { 'x-vercel-protection-bypass': process.env.VERCEL_BYPASS, 'x-vercel-set-bypass-cookie': 'true' } : null;

// The desktop layout is 1440 px wide, drawn at 1920×1080 (CSS zoom), so text
// is sharp at 1080p. The phone layout is 390×844.
export const DESKTOP = { width: 1920, height: 1080, layout: 1440 };
export const PHONE = { width: 390, height: 844 };
export const FPS = 30;

// Human pacing.
export const PACE = {
  moveMs: [400, 700],      // mouse moves
  cps: [12, 18],           // typing, characters a second
  afterResult: 1200,       // pause after each result
  maxDeadWait: 1500        // longer waits are trimmed in the edit
};

export const BRAND = {
  primary: '#E73B2B', primaryStrong: '#C4302A', accent: '#F89833', accentStrong: '#F1592D', crimson: '#BC1F3D',
  ink: '#1B1B1F', paper: '#FFFFFF', soft: '#FFF6F0'
};

const require = createRequire(import.meta.url);
export function playwright() {
  try { return require('playwright'); } catch { return require(path.join(process.env.NODE_PATH || '/opt/node22/lib/node_modules', 'playwright')); }
}
export const FFMPEG = process.env.FFMPEG || 'ffmpeg';
export const FFPROBE = process.env.FFPROBE || 'ffprobe';
