// Append-only tables (consents, credentials, demonstrations, faculty reviews,
// access events) accept a DELETE only inside the demo cleanup transaction,
// which sets qbx.demo_cleanup (migration 0008). Only core/demo/cleanup.js —
// which deletes nothing but one demo sandbox's rows — may set it.
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { listSourceFiles } from './importGraph.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

describe('demo cleanup gate', () => {
  it('only core/demo/cleanup.js (and the migration defining it) names qbx.demo_cleanup', () => {
    const users = listSourceFiles(ROOT, { skip: ['tests', 'data'] }).filter(f => fs.readFileSync(path.join(ROOT, f), 'utf8').includes('qbx.demo_cleanup'));
    expect(users.sort()).toEqual(['core/demo/cleanup.js', 'migrations/0008_demo_sandboxes.js']);
  });
});
