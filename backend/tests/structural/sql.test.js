// Every static SQL statement in the app must be valid PostgreSQL against the
// real schema. Each literal (a string or template starting with SELECT,
// INSERT, UPDATE, DELETE or WITH) is translated by core/db/sql.js and
// PREPAREd — PostgreSQL then checks tables, columns, types, GROUP BY and
// functions without running anything. SQL assembled at runtime (templates
// with ${…}) is skipped here and covered by the integration tests.
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as dal from '../../core/db/dal.js';
import { migrate } from '../../core/db/migrate.js';
import { translate } from '../../core/db/sql.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DIRS = ['api', 'core', 'scripts', 'vercel'];
const SQL_RE = /(['"`])\s*((?:SELECT|INSERT|UPDATE|DELETE|WITH)\b(?:\\[\s\S]|(?!\1)[\s\S])*?)\1/g;

function sourceFiles() {
  const out = [];
  const walk = (d) => fs.readdirSync(d).forEach(f => {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.js') && !p.includes(`${path.sep}db${path.sep}`)) out.push(p);
  });
  DIRS.forEach(d => fs.existsSync(path.join(ROOT, d)) && walk(path.join(ROOT, d)));
  return out;
}

function statements() {
  const out = [];
  for (const file of sourceFiles()) {
    const src = fs.readFileSync(file, 'utf8');
    for (const m of src.matchAll(SQL_RE)) {
      const sql = m[1] === '`' ? m[2] : m[2].replace(/\\(['"\\])/g, '$1');
      if (!/\b(FROM|INTO|SET|VALUES)\b/i.test(sql)) continue;
      if (m[1] === '`' && sql.includes('${')) continue;
      out.push({ where: `${path.relative(ROOT, file)}:${src.slice(0, m.index).split('\n').length}`, sql });
    }
  }
  return out;
}

describe('static SQL is valid PostgreSQL', () => {
  beforeAll(async () => {
    dal.connect({ file: ':memory:' });
    await migrate();
  });

  it('every statement prepares against the schema', async () => {
    const all = statements();
    expect(all.length).toBeGreaterThan(400); // the scan is not vacuous
    const bad = [];
    for (const { where, sql } of all) {
      try {
        await dal.exec(`PREPARE qbx_chk AS ${translate(sql).text}`);
        await dal.exec('DEALLOCATE qbx_chk');
      } catch (err) {
        bad.push(`${where}: ${err.message}`);
        await dal.exec('DEALLOCATE ALL').catch(() => {});
      }
    }
    expect(bad).toEqual([]);
  });
});
