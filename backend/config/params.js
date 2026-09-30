// config/params.js
// Calibrated parameters. The real values live in secure-config/ (a separate
// private repository, mounted at runtime at SECURE_CONFIG_DIR, default
// ./secure-config, never committed here). This module deep-merges
// secure-config/params.json over the priors in config/priors.js.
//
// Production (NODE_ENV=production) refuses to run on priors alone: a missing
// or unreadable secure-config is a startup error, not a silent fallback.
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
  if (fs.existsSync(file)) {
    override = JSON.parse(fs.readFileSync(file, 'utf8'));
  } else if (env === 'production') {
    throw new Error(`secure-config not found at ${dir}: production will not run on prior defaults`);
  }
  const overridden = new Set();
  const values = deepFreeze(deepMerge(PRIORS, override, '', overridden));
  loaded = { values, overridden, source: override ? file : 'priors' };
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

export const params = { get, stage, flag, load, report, calibrationRegister };
export default params;
