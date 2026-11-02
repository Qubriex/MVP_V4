// Pre-recorded lesson audio is stored under the text the page asks for, so
// the server's copies of the browser's speech-text rules must stay identical.
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
describe('speech text is the same on the server and in the browser', () => {
  for (const f of ['speechText.js', 'pronounce.js', 'codeSpeech.js']) {
    it(`backend/core/voice/${f} matches frontend/src/utils/${f}`, () => {
      expect(fs.readFileSync(path.join(ROOT, 'backend/core/voice', f), 'utf8')).toBe(fs.readFileSync(path.join(ROOT, 'frontend/src/utils', f), 'utf8'));
    });
  }
});
