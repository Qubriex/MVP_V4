// Structural guarantees 1 and 2 (spec §2, §11). The build fails if either breaks.
import { describe, it, expect } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import { checkWall, TEACHING, EMPLOYER } from './walls.js';
import { closure } from './importGraph.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const BAD = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'fixtures/bad');

describe('teaching/assessment wall', () => {
  it('teachBrain, cultBrain and memBrain reach no evidence, validator, rubric, item-family or mutant module', () => {
    expect(checkWall(ROOT, TEACHING)).toEqual([]);
  });

  it('actually walks the teaching brains (not a vacuous pass)', () => {
    const { files } = closure(ROOT, TEACHING.entries(ROOT));
    expect([...files.keys()]).toEqual(expect.arrayContaining(['core/brains/teachBrain.js', 'core/ai/gateway.js']));
  });

  it('self-test: catches a transitive rubric import, an evidence table and a computed dynamic import', () => {
    const v = checkWall(BAD, TEACHING);
    expect(v.some(x => x.includes('core/brains/teachBrain.js → core/brains/helper.js → core/stores/rubricStore.js'))).toBe(true);
    expect(v.some(x => x.includes('names table evidence_records'))).toBe(true);
    expect(v.some(x => x.includes('computed dynamic import'))).toBe(true);
  });
});

describe('employer/session wall', () => {
  it('employer routes, verify routes, employerAuth and core/match reach no session, memory, provenance, CKB-usage or evaluation store', () => {
    expect(checkWall(ROOT, EMPLOYER)).toEqual([]);
  });

  it('actually walks the employer modules', () => {
    const { files } = closure(ROOT, EMPLOYER.entries(ROOT));
    expect([...files.keys()]).toEqual(expect.arrayContaining(['api/routes/employer.js', 'api/middleware/employerAuth.js', 'api/middleware/auth.js']));
  });

  it('self-test: catches an employer route importing learner memory and naming a session table', () => {
    const v = checkWall(BAD, EMPLOYER);
    expect(v.some(x => x.includes('api/routes/employer.js → core/stores/learnerMemoryStore.js'))).toBe(true);
    expect(v.some(x => x.includes('names table session_messages'))).toBe(true);
  });
});
