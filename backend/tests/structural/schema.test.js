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
  it.each(NO_LABEL_TABLES)('%s has no label or confidence column', async (table) => {
    const cols = await dal.tableExists(table) ? await dal.columns(table) : [];
    expect(cols.filter(c => LABELISH.test(c))).toEqual([]);
  });

  it('node_mastery exists, so the check above is not vacuous', async () => {
    expect(await dal.columns('node_mastery')).toContain('mastery_attainment');
  });
});

describe('append-only audit tables', () => {
  it.each(APPEND_ONLY)('%s has UPDATE and DELETE guards', async (table) => {
    const triggers = await dal.all(`SELECT t.tgname AS name, pg_get_triggerdef(t.oid) AS sql FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid WHERE c.relname = ? AND NOT t.tgisinternal`, table);
    expect(triggers.some(t => /BEFORE DELETE/i.test(t.sql))).toBe(true);
    expect(triggers.some(t => /BEFORE UPDATE/i.test(t.sql))).toBe(true);
  });
});
