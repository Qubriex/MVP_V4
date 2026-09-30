// DAL, migrations and append-only enforcement.
import { describe, it, expect, beforeAll } from 'vitest';
import * as dal from '../../core/db/dal.js';
import { migrate } from '../../core/db/migrate.js';
import { freshDb, seedInstitution } from '../helpers/setup.js';
import * as consent from '../../core/consent/levels.js';
import { logEvent, openResetRequest, resolvePinResetRequests } from '../../core/access.js';

describe('migrations', () => {
  beforeAll(freshDb);

  it('are recorded and idempotent', async () => {
    const ids = (await dal.all('SELECT id FROM schema_migrations ORDER BY id')).map(r => r.id);
    expect(ids).toEqual(['0001_schema', '0002_reference_data']);
    expect(await migrate()).toEqual([]);
  });

  it('create the foundation tables', async () => {
    for (const t of ['domain_events', 'event_consumptions', 'consents', 'employers', 'employer_users', 'auth_sessions', 'login_failures', 'model_calls']) {
      expect(await dal.tableExists(t)).toBe(true);
    }
    expect(await dal.columns('learners')).toEqual(expect.arrayContaining(['is_discoverable', 'availability', 'city', 'age_status']));
  });

  it('learners default to unknown age and not discoverable', async () => {
    const f = await seedInstitution('m');
    expect(await dal.one('SELECT age_status, is_discoverable FROM learners WHERE id = ?', f.learnerId)).toEqual({ age_status: 'unknown', is_discoverable: 0 });
  });
});

describe('reference data (0002)', () => {
  beforeAll(freshDb);
  it('loads the skills ontology and the CKB seed examples', async () => {
    const c = await dal.one(`SELECT (SELECT COUNT(*) FROM skills) s, (SELECT COUNT(*) FROM skill_aliases) a,
      (SELECT COUNT(*) FROM skill_prereqs) p, (SELECT COUNT(*) FROM cultural_knowledge_base) k`);
    expect(c).toEqual({ s: 72, a: 333, p: 41, k: 25 });
  });
});

describe('append-only tables', () => {
  beforeAll(freshDb);

  it('access_events rejects UPDATE and DELETE', async () => {
    const f = await seedInstitution('a');
    const db = dal.legacyHandle();
    await dal.tx(async () => await logEvent(db, { institutionId: f.institutionId, learnerId: f.learnerId, elId: f.elId, event: 'signed_in' }));
    await expect((async () => await dal.run("UPDATE access_events SET detail = 'x'"))()).rejects.toThrow(/append-only/);
    await expect((async () => await dal.run('DELETE FROM access_events'))()).rejects.toThrow(/append-only/);
  });

  it('a PIN-reset request is closed by a later event, not by a flag', async () => {
    const db = dal.legacyHandle();
    const q = async () => (await dal.one(`SELECT COUNT(*) n FROM access_events ae WHERE ae.engagement_learner_id = 'el-a' AND ${openResetRequest('ae')}`)).n;
    await logEvent(db, { institutionId: 'inst-a', learnerId: 'learner-a', elId: 'el-a', event: 'pin_reset_requested' });
    expect(await q()).toBe(1);
    expect(await resolvePinResetRequests(db, { institutionId: 'inst-a', learnerId: 'learner-a' })).toBe(1);
    expect(await q()).toBe(0);
  });

  it('consents: withdrawal sets withdrawn_at once, through withdraw(); nothing else may change', async () => {
    const id = await consent.grant({ learnerId: 'learner-a', institutionId: 'inst-a', level: 1, purpose: 'build', textVersion: 'v1' });
    expect(await consent.isActive('learner-a', 1)).toBe(true);
    await expect((async () => await dal.run('UPDATE consents SET level = 3 WHERE id = ?', id))()).rejects.toThrow(/append-only/);
    await expect((async () => await dal.run('DELETE FROM consents WHERE id = ?', id))()).rejects.toThrow(/append-only/);
    expect(await consent.withdraw(id)).toBe(true);
    expect(await consent.isActive('learner-a', 1)).toBe(false);
    expect(await consent.withdraw(id)).toBe(false);
    await expect((async () => await dal.run("UPDATE consents SET withdrawn_at = '2030-01-01' WHERE id = ?", id))()).rejects.toThrow(/append-only/);
    const events = (await dal.all("SELECT type FROM domain_events WHERE aggregate_id = 'learner-a' ORDER BY id")).map(r => r.type);
    expect(events).toEqual(['CONSENT_GRANTED', 'CONSENT_WITHDRAWN']);
  });
});

describe('DAL transactions', () => {
  beforeAll(freshDb);

  it('roll back everything when the function throws', async () => {
    await seedInstitution('t');
    await expect(dal.tx(async () => {
      await dal.run("UPDATE learners SET city = 'Hyderabad' WHERE id = 'learner-t'");
      throw new Error('nope');
    })).rejects.toThrow('nope');
    expect((await dal.one("SELECT city FROM learners WHERE id = 'learner-t'")).city).toBeNull();
  });

  it('a nested tx is a savepoint: its failure rolls back only itself', async () => {
    await dal.tx(async () => {
      await dal.run("UPDATE learners SET city = 'Outer' WHERE id = 'learner-t'");
      await expect(dal.tx(async () => {
        await dal.run("UPDATE learners SET city = 'Inner' WHERE id = 'learner-t'");
        throw new Error('inner');
      })).rejects.toThrow('inner');
      expect(dal.inTransaction()).toBe(true);
    });
    expect((await dal.one("SELECT city FROM learners WHERE id = 'learner-t'")).city).toBe('Outer');
    expect(dal.inTransaction()).toBe(false);
  });

  it('translates ? and @name parameters, INSERT OR IGNORE, and SQLite-style datetime()', async () => {
    expect(await dal.one('SELECT ?::int + ?::int AS n', 2, 3)).toEqual({ n: 5 });
    expect(await dal.one('SELECT @x::int * 2 AS n, @x::int AS x', { x: 21 })).toEqual({ n: 42, x: 21 });
    const now = dal.nowIso();
    await dal.run("INSERT INTO employers (id, name, domain, created_at, updated_at) VALUES ('e-dup', 'E', 'd.test', ?, ?)", now, now);
    expect((await dal.run("INSERT OR IGNORE INTO employers (id, name, domain, created_at, updated_at) VALUES ('e-dup', 'E', 'd.test', ?, ?)", now, now)).changes).toBe(0);
    const d = await dal.one("SELECT datetime('2026-01-31T10:00:00.000Z', '+1 day') AS d, COUNT(*) AS n, AVG(2) AS a FROM employers");
    expect(d).toEqual({ d: '2026-02-01 10:00:00', n: 1, a: 2 });
  });

  it('legacy handles share the connection and cannot close it', async () => {
    const h = dal.legacyHandle();
    h.close();
    expect((await dal.one('SELECT 1 AS ok')).ok).toBe(1);
  });
});

describe('employer roles (v4.3 §14.1)', () => {
  beforeAll(freshDb);
  it('are owner, recruiter or viewer', async () => {
    const now = dal.nowIso();
    await dal.run("INSERT INTO employers (id, name, domain, created_at, updated_at) VALUES ('e1', 'E', 'e.test', ?, ?)", now, now);
    for (const role of ['owner', 'recruiter', 'viewer']) {
      await dal.run('INSERT INTO employer_users (id, employer_id, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        `u-${role}`, 'e1', `${role}@e.test`, 'x', role, now, now);
    }
    await expect((async () => await dal.run("INSERT INTO employer_users (id, employer_id, email, password_hash, role, created_at, updated_at) VALUES ('u-x', 'e1', 'x@e.test', 'x', 'admin', ?, ?)", now, now))()).rejects.toThrow();
  });
});

describe('calibration register (v4.3 Appendix A.1)', () => {
  it('lists every parameter group with a stage and a trigger', async () => {
    const { calibrationRegister } = await import('../../config/params.js');
    const reg = calibrationRegister();
    expect(reg).toHaveLength(11);
    for (const g of reg) expect(g).toMatchObject({ stage: expect.any(String), trigger: expect.any(String), overriddenBySecureConfig: false });
  });
});
