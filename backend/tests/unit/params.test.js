import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import params from '../../config/params.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'qbx-secure-'));

afterEach(() => { params.load({ env: 'test', dir: './tests/no-secure-config' }); delete process.env.FEATURE_HYBRID_RETRIEVAL; });

describe('config/params', () => {
  it('falls back to priors in development and test', () => {
    params.load({ env: 'development', dir: './tests/no-secure-config' });
    expect(params.get('label.confirmed.minPasses')).toBe(3);
    expect(params.stage('label.confirmed.minPasses')).toBe('prior');
  });

  it('refuses to run in production without secure-config', () => {
    expect(() => params.load({ env: 'production', dir: './tests/no-secure-config' })).toThrow(/secure-config/);
  });

  it('deep-merges secure-config over the priors and reports the stage', () => {
    const dir = tmp();
    fs.writeFileSync(path.join(dir, 'params.json'), JSON.stringify({ label: { confirmed: { minPasses: 4 } } }));
    params.load({ env: 'production', dir });
    expect(params.get('label.confirmed.minPasses')).toBe(4);
    expect(params.get('label.confirmed.minSpanDays')).toBe(14);
    expect(params.stage('label.confirmed.minPasses')).toBe('secure-config');
    expect(params.stage('label.confirmed.minSpanDays')).toBe('prior');
    expect(params.report().find(r => r.key === 'label.confirmed.minPasses')).toMatchObject({ value: 4, stage: 'secure-config' });
  });

  it('throws on unknown keys instead of returning undefined', () => {
    expect(() => params.get('label.confirmed.nope')).toThrow(/Unknown parameter/);
  });

  it('values are frozen', () => {
    const budget = params.get('retrieval.budget');
    expect(() => { budget.total = 1; }).toThrow();
  });

  it('feature flags default off and can be switched by env (E7)', () => {
    expect(params.flag('hybridRetrieval')).toBe(false);
    process.env.FEATURE_HYBRID_RETRIEVAL = '1';
    expect(params.flag('hybridRetrieval')).toBe(true);
  });
});
