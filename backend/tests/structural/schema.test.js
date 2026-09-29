// Structural guarantee 3 — sign facts, compute labels (spec §2, §6, §11):
// node_mastery and credentials never carry a label or confidence column.
// Also: the audit tables that must be append-only have their triggers.
import { describe, it, expect, beforeAll } from 'vitest';
import * as dal from '../../core/db/dal.js';
import { migrate } from '../../core/db/migrate.js';

const NO_LABEL_TABLES = ['node_mastery', 'credentials'];
const LABELISH = /label|confidence/i;
const APPEND_ONLY = ['access_events', 'consents'];

beforeAll(async () => {
  dal.connect({ file: ':memory:' });
  await migrate();
});

describe('sign facts, compute labels', () => {
  it.each(NO_LABEL_TABLES)('%s has no label or confidence column', (table) => {
    const cols = dal.tableExists(table) ? dal.columns(table) : [];
    expect(cols.filter(c => LABELISH.test(c))).toEqual([]);
  });

  it('node_mastery exists, so the check above is not vacuous', () => {
    expect(dal.columns('node_mastery')).toContain('mastery_attainment');
  });
});

describe('append-only audit tables', () => {
  it.each(APPEND_ONLY)('%s has UPDATE and DELETE guards', (table) => {
    const triggers = dal.all("SELECT name, sql FROM sqlite_master WHERE type = 'trigger' AND tbl_name = ?", table);
    expect(triggers.some(t => /BEFORE DELETE/i.test(t.sql))).toBe(true);
    expect(triggers.some(t => /BEFORE UPDATE/i.test(t.sql))).toBe(true);
  });
});
