// config/params.js
// Calibrated parameters. The real values live in secure-config/ (a separate
// private repository, mounted at runtime at SECURE_CONFIG_DIR, default
// ./secure-config, never committed here). This module deep-merges
// secure-config/params.json over the priors in config/priors.js.
//
// On hosts without a mounted directory (Vercel), SECURE_CONFIG_PARAMS_JSON
// carries the same params.json content in an environment variable.
//
// Production (NODE_ENV=production) refuses to run on priors alone: a missing
// or unreadable secure-config is a startup error, not a silent fallback. A
// staging or pilot deployment may opt in to priors with QBX_ALLOW_PRIORS=1;
// it is logged at every start and reported by /api/health.
//
//   params.get('label.confirmed.minPasses')  → 3
//   params.stage('label.confirmed.minPasses') → 'prior' | 'secure-config'
//   params.flag('employerPortal')            → boolean (env FEATURE_EMPLOYER_PORTAL=1 overrides)
import fs from 'fs';
import path from 'path';
import { PRIORS, CALIBRATION_REGISTER } from './priors.js';

let loaded = null;

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

function deepMerge(base, over, prefix, overridden) {
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const [k, v] of Object.entries(over || {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (isObj(v) && isObj(base?.[k])) out[k] = deepMerge(base[k], v, key, overridden);
    else { out[k] = v; overridden.add(key); }
  }
  return out;
}

function deepFreeze(o) {
  Object.values(o).forEach(v => { if (v && typeof v === 'object') deepFreeze(v); });
  return Object.freeze(o);
}

export function secureConfigDir() {
  return path.resolve(process.env.SECURE_CONFIG_DIR || './secure-config');
}

/** (Re)load parameters. Tests call this after changing env. */
export function load({ env = process.env.NODE_ENV, dir = secureConfigDir() } = {}) {
  const file = path.join(dir, 'params.json');
  let override = null;
  let source = 'priors';
  if (process.env.SECURE_CONFIG_PARAMS_JSON) {
    try { override = JSON.parse(process.env.SECURE_CONFIG_PARAMS_JSON); } catch { throw new Error('SECURE_CONFIG_PARAMS_JSON is not valid JSON'); }
    source = 'env:SECURE_CONFIG_PARAMS_JSON';
  } else if (fs.existsSync(file)) {
    override = JSON.parse(fs.readFileSync(file, 'utf8'));
    source = file;
  } else if (env === 'production') {
    if (process.env.QBX_ALLOW_PRIORS !== '1') {
      throw new Error(`secure-config not found at ${dir} and SECURE_CONFIG_PARAMS_JSON is not set: production will not run on prior defaults`);
    }
    console.warn('[qubirex] QBX_ALLOW_PRIORS=1: running in production on prior parameters (staging/pilot only).');
    source = 'priors (QBX_ALLOW_PRIORS)';
  }
  const overridden = new Set();
  const values = deepFreeze(deepMerge(PRIORS, override, '', overridden));
  loaded = { values, overridden, source };
  return loaded;
}

const state = () => loaded || load();

export function get(key) {
  const v = key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), state().values);
  if (v === undefined) throw new Error(`Unknown parameter "${key}"`);
  return v;
}

/** Where a value came from; feeds the "which parameters are still priors" status report. */
export function stage(key) {
  const { overridden } = state();
  for (const k of overridden) if (key === k || key.startsWith(k + '.')) return 'secure-config';
  return 'prior';
}

export function flag(name) {
  const envName = 'FEATURE_' + name.replace(/[A-Z]/g, c => '_' + c).toUpperCase();
  if (process.env[envName] !== undefined) return ['1', 'true', 'on'].includes(String(process.env[envName]).toLowerCase());
  return !!get(`flags.${name}`);
}

/** Where the parameters came from: a file, the environment, or priors. */
export const source = () => state().source;

/** Every leaf key with its stage, for the status report. */
export function report() {
  const out = [];
  const walk = (o, prefix) => Object.entries(o).forEach(([k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    if (isObj(v)) walk(v, key); else out.push({ key, value: v, stage: stage(key) });
  });
  walk(state().values, '');
  return out;
}

/** Appendix A.1 register, with whether secure-config currently overrides each group. */
export function calibrationRegister() {
  const { overridden } = state();
  const touches = (k) => [...overridden].some(o => o === k || o.startsWith(`${k}.`) || k.startsWith(`${o}.`));
  return CALIBRATION_REGISTER.map(g => ({ ...g, overriddenBySecureConfig: g.keys.some(touches) }));
}

export const params = { get, stage, flag, load, report, calibrationRegister, source };
export default params;
