// DAL, migrations and append-only enforcement.
import { describe, it, expect, beforeAll } from 'vitest';
import * as dal from '../../core/db/dal.js';
import { migrate } from '../../core/db/migrate.js';
import { up as baseline } from '../../migrations/0001_baseline.js';
import { up as foundation } from '../../migrations/0002_foundation.js';
import { freshDb, seedInstitution } from '../helpers/setup.js';
import * as consent from '../../core/consent/levels.js';
import { logEvent, openResetRequest, resolvePinResetRequests } from '../../core/access.js';

describe('migrations', () => {
  beforeAll(freshDb);

  it('are recorded and idempotent', async () => {
    const ids = dal.all('SELECT id FROM schema_migrations ORDER BY id').map(r => r.id);
    expect(ids).toEqual(['0001_baseline', '0002_foundation']);
    expect(await migrate()).toEqual([]);
  });

  it('create the foundation tables', () => {
    for (const t of ['domain_events', 'event_consumptions', 'consents', 'employers', 'employer_users', 'auth_sessions', 'login_failures', 'model_calls']) {
      expect(dal.tableExists(t)).toBe(true);
    }
    expect(dal.columns('learners')).toEqual(expect.arrayContaining(['is_discoverable', 'availability', 'city', 'age_status']));
  });

  it('learners default to unknown age and not discoverable', () => {
    const f = seedInstitution('m');
    expect(dal.one('SELECT age_status, is_discoverable FROM learners WHERE id = ?', f.learnerId)).toEqual({ age_status: 'unknown', is_discoverable: 0 });
  });
});

describe('0002 over a pre-v4.3.1 database', () => {
  it('turns resolved PIN-reset flags into events and drops the stored confidence', () => {
    dal.connect({ file: ':memory:' });
    const db = dal.db();
    db.transaction(() => baseline(db));
    // The old schema had confidence_indicator on node_mastery.
    expect(dal.columns('node_mastery')).toContain('confidence_indicator');
    seedInstitution('l');
    dal.run(`INSERT INTO access_events (id, institution_id, learner_id, engagement_learner_id, event, resolved, created_at)
      VALUES ('old-1', 'inst-l', 'learner-l', 'el-l', 'pin_reset_requested', 1, '2026-01-01 10:00:00'),
             ('old-2', 'inst-l', 'learner-l', 'el-l', 'pin_reset_requested', 0, '2026-01-02 10:00:00')`);
    db.transaction(() => foundation(db));
    expect(dal.columns('node_mastery')).not.toContain('confidence_indicator');
    const open = dal.all(`SELECT ae.id FROM access_events ae WHERE ${openResetRequest('ae')}`).map(r => r.id);
    // old-1 was resolved; old-2 (newer, never resolved) must stay open.
    expect(dal.one("SELECT COUNT(*) n FROM access_events WHERE event = 'pin_reset_resolved'").n).toBe(1);
    expect(open).toEqual(['old-2']);
  });
});

describe('append-only tables', () => {
  beforeAll(freshDb);

  it('access_events rejects UPDATE and DELETE', () => {
    const f = seedInstitution('a');
    const db = dal.db();
    db.transaction(() => logEvent(db, { institutionId: f.institutionId, learnerId: f.learnerId, elId: f.elId, event: 'signed_in' }));
    expect(() => dal.run("UPDATE access_events SET detail = 'x'")).toThrow(/append-only/);
    expect(() => dal.run('DELETE FROM access_events')).toThrow(/append-only/);
  });

  it('a PIN-reset request is closed by a later event, not by a flag', () => {
    const db = dal.db();
    const q = () => dal.one(`SELECT COUNT(*) n FROM access_events ae WHERE ae.engagement_learner_id = 'el-a' AND ${openResetRequest('ae')}`).n;
    logEvent(db, { institutionId: 'inst-a', learnerId: 'learner-a', elId: 'el-a', event: 'pin_reset_requested' });
    expect(q()).toBe(1);
    expect(resolvePinResetRequests(db, { institutionId: 'inst-a', learnerId: 'learner-a' })).toBe(1);
    expect(q()).toBe(0);
  });

  it('consents: withdrawal sets withdrawn_at once, through withdraw(); nothing else may change', () => {
    const id = consent.grant({ learnerId: 'learner-a', institutionId: 'inst-a', level: 1, purpose: 'build', textVersion: 'v1' });
    expect(consent.isActive('learner-a', 1)).toBe(true);
    expect(() => dal.run('UPDATE consents SET level = 3 WHERE id = ?', id)).toThrow(/append-only/);
    expect(() => dal.run('DELETE FROM consents WHERE id = ?', id)).toThrow(/append-only/);
    expect(consent.withdraw(id)).toBe(true);
    expect(consent.isActive('learner-a', 1)).toBe(false);
    expect(consent.withdraw(id)).toBe(false);
    expect(() => dal.run("UPDATE consents SET withdrawn_at = '2030-01-01' WHERE id = ?", id)).toThrow(/append-only/);
    const events = dal.all("SELECT type FROM domain_events WHERE aggregate_id = 'learner-a' ORDER BY id").map(r => r.type);
    expect(events).toEqual(['CONSENT_GRANTED', 'CONSENT_WITHDRAWN']);
  });
});

describe('DAL transactions', () => {
  beforeAll(freshDb);

  it('roll back everything when the function throws', () => {
    seedInstitution('t');
    expect(() => dal.tx(() => {
      dal.run("UPDATE learners SET city = 'Hyderabad' WHERE id = 'learner-t'");
      throw new Error('nope');
    })).toThrow('nope');
    expect(dal.one("SELECT city FROM learners WHERE id = 'learner-t'").city).toBeNull();
  });

  it('legacy handles share the connection and cannot close it', () => {
    const h = dal.legacyHandle();
    h.close();
    expect(dal.one('SELECT 1 AS ok').ok).toBe(1);
  });
});
