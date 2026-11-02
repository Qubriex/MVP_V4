// Secrets separation (spec §10): no secure-config content in this repository.
import { describe, it, expect } from 'vitest';
import { checkRepository, findViolations, findKeys, PLACEHOLDER_MARKER } from '../../scripts/check-secrets.js';

describe('secrets separation', () => {
  it('the repository holds no secure-config, rubric, mutant or prompt content', () => {
    expect(checkRepository()).toEqual([]);
  });

  it('self-test: flags each forbidden kind and allows only true placeholders', () => {
    const files = {
      'secure-config/params.json': '{"label":{}}',
      'backend/secure-config/README.md': PLACEHOLDER_MARKER,
      'backend/fixtures/sql_joins.rubric.json': '{"points":[]}',
      'backend/fixtures/ok.rubric.md': `${PLACEHOLDER_MARKER}\nreal texts live in secure-config`,
      'backend/mutants/m17.sql': 'SELECT * FROM a JOIN b',
      'backend/prompts/TEACH.instruct.v1.md': 'You are a tutor...',
      'backend/prompts/TEACH.doubt.v1.md': `${PLACEHOLDER_MARKER}\nID: TEACH.doubt v1`,
      'backend/core/logger.js': 'export const x = 1;'
    };
    const v = findViolations(Object.keys(files), (f) => files[f]);
    expect(v.map(x => x.split(':')[0]).sort()).toEqual([
      'backend/mutants/m17.sql',
      'backend/prompts/TEACH.instruct.v1.md',
      'backend/secure-config/README.md',
      'backend/fixtures/sql_joins.rubric.json',
      'secure-config/params.json'
    ].sort());
  });
});

// A Gemini key must never be committed or shipped in the frontend build.
describe('no Google API key in the repository', () => {
  it('flags AIza… and AQ.… key shapes, and nothing else', async () => {
    const files = { 'a.js': `const k = "${'AQ' + '.' + 'k'.repeat(50)}";`, 'b.md': `key: ${'AI' + 'za' + 'z'.repeat(35)}`, 'c.js': 'GEMINI_API_KEY=', 'd.png': 'AQ.' + 'x'.repeat(60) };
    const out = findKeys(Object.keys(files), (f) => files[f]);
    expect(out.map(x => x.split(':')[0])).toEqual(['a.js', 'b.md']);
    expect(out.join(' ')).not.toMatch(/kkkk|zzzz/); // the key itself is never echoed
  });
});
