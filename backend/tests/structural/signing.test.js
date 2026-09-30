// Keys and secrets (v4.3 §10): signing keys are loaded only by
// core/return/signing.js. No other module may read .pem files, the key
// directory, or create private keys.
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { listSourceFiles } from './importGraph.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const KEY_PATTERNS = [/createPrivateKey\s*\(/, /generateKeyPair(Sync)?\s*\(/, /\.pem\b/, /dev-keys/, /['"]keys['"]/];

describe('signing keys', () => {
  it('only core/return/signing.js loads private key material', () => {
    const offenders = listSourceFiles(ROOT, { skip: ['tests', 'scripts'] })
      .filter(f => f !== 'core/return/signing.js')
      .filter(f => KEY_PATTERNS.some(re => re.test(fs.readFileSync(path.join(ROOT, f), 'utf8'))));
    expect(offenders).toEqual([]);
  });

  it('only core/return/signing.js reads the SIGNING_KEY environment variables', () => {
    const offenders = listSourceFiles(ROOT, { skip: ['tests', 'scripts'] })
      .filter(f => f !== 'core/return/signing.js')
      .filter(f => /SIGNING_KEY_(PEM|ID)/.test(fs.readFileSync(path.join(ROOT, f), 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('the signing module exists (the check is not vacuous)', () => {
    const src = fs.readFileSync(path.join(ROOT, 'core/return/signing.js'), 'utf8');
    expect(KEY_PATTERNS.some(re => re.test(src))).toBe(true);
  });
});
