// Transactional outbox and worker (spec §2, §7, §11 "a crash between write and delivery loses no events").
import { describe, it, expect, beforeEach } from 'vitest';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import * as dal from '../../core/db/dal.js';
import { migrate } from '../../core/db/migrate.js';
import { emit } from '../../core/events/outbox.js';
import { subscribe, clearSubscribers } from '../../core/events/subscribers.js';
import { createWorker } from '../../core/events/worker.js';
import { freshDb } from '../helpers/setup.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ev = async (id, n) => await emit('NODE_ADVANCED', { aggregateType: 'learner', aggregateId: id, payload: { n } });

beforeEach(async () => { await freshDb(); clearSubscribers(); });

describe('emit', () => {
  it('refuses to run outside a transaction', async () => {
    await expect((async () => await ev('l1', 1))()).rejects.toThrow(/inside the transaction/);
  });

  it('refuses unknown event types', async () => {
    await expect((async () => await dal.tx(async () => await emit('MADE_UP', { aggregateType: 'x', aggregateId: 'y' })))()).rejects.toThrow(/Unknown event type/);
  });

  it('a rolled-back state change leaves no event behind', async () => {
    await expect((async () => await dal.tx(async () => { await ev('l1', 1); throw new Error('rollback'); }))()).rejects.toThrow('rollback');
    expect((await dal.one('SELECT COUNT(*) n FROM domain_events')).n).toBe(0);
  });

  it('works with a legacy better-sqlite3 handle inside its transaction', async () => {
    const db = dal.legacyHandle();
    await db.transaction(async () => await emit('NODE_LOOPED', { aggregateType: 'learner', aggregateId: 'l9' }, db))();
    expect((await dal.one("SELECT type FROM domain_events WHERE aggregate_id = 'l9'")).type).toBe('NODE_LOOPED');
  });
});

describe('worker', () => {
  it('delivers in created_at order per aggregate and marks delivered', async () => {
    const got = [];
    subscribe('NODE_ADVANCED', 'rec', (e) => got.push(`${e.aggregate_id}:${e.payload.n}`));
    await dal.tx(async () => { await ev('a', 1); await ev('b', 1); await ev('a', 2); await ev('a', 3); await ev('b', 2); });
    const r = await createWorker().tick();
    expect(r.delivered).toBe(5);
    expect(got.filter(x => x.startsWith('a'))).toEqual(['a:1', 'a:2', 'a:3']);
    expect(got.filter(x => x.startsWith('b'))).toEqual(['b:1', 'b:2']);
    expect((await dal.one('SELECT COUNT(*) n FROM domain_events WHERE delivered_at IS NULL')).n).toBe(0);
  });

  it('a failing event blocks later events of the same aggregate only', async () => {
    const got = [];
    subscribe('NODE_ADVANCED', 'rec', (e) => { if (e.aggregate_id === 'a' && e.payload.n === 1) throw new Error('down'); got.push(`${e.aggregate_id}:${e.payload.n}`); });
    await dal.tx(async () => { await ev('a', 1); await ev('a', 2); await ev('b', 1); });
    await createWorker().tick();
    expect(got).toEqual(['b:1']);
  });

  it('retries on the 1m, 5m, 30m, 2h, 12h schedule, then dead-letters', async () => {
    let t = Date.now() + 1000;
    subscribe('NODE_ADVANCED', 'always-fails', () => { throw new Error('nope'); });
    await dal.tx(async () => await ev('a', 1));
    const w = createWorker({ now: () => t });
    const gaps = [];
    for (let i = 0; i < 5; i += 1) {
      await w.tick();
      const row = await dal.one('SELECT attempts, next_attempt_at FROM domain_events');
      expect(row.attempts).toBe(i + 1);
      gaps.push((Date.parse(row.next_attempt_at) - t) / 60000);
      expect((await w.tick()).failed).toBe(0); // not due yet
      t = Date.parse(row.next_attempt_at);
    }
    expect(gaps).toEqual([1, 5, 30, 120, 720]);
    const last = await w.tick();
    expect(last.deadLettered).toBe(1);
    const row = await dal.one('SELECT attempts, dead_lettered_at, delivered_at, last_error FROM domain_events');
    expect(row).toMatchObject({ attempts: 6, delivered_at: null, last_error: 'nope' });
    expect(row.dead_lettered_at).toBeTruthy();
  });

  it('subscribers are idempotent on event id: a succeeded subscriber is not re-run when another retries', async () => {
    let okCalls = 0;
    let flaky = 0;
    subscribe('NODE_ADVANCED', 'ok', () => { okCalls += 1; });
    subscribe('NODE_ADVANCED', 'flaky', () => { flaky += 1; if (flaky === 1) throw new Error('once'); });
    await dal.tx(async () => await ev('a', 1));
    let t = Date.now() + 1000; // after the event's own timestamp
    const w = createWorker({ now: () => t });
    await w.tick();
    t += 60 * 60000;
    await w.tick();
    expect(okCalls).toBe(1);
    expect(flaky).toBe(2);
    expect((await dal.one('SELECT delivered_at FROM domain_events')).delivered_at).toBeTruthy();
  });
});

describe('crash between write and delivery', () => {
  it('loses no events when the worker process is killed mid-delivery', async () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'qbx-outbox-')), 'crash.db');
    dal.connect({ file });
    await migrate();
    await dal.run("INSERT INTO institutions (id, name, type, contact_email, password_hash) VALUES ('ci', 'I', 'other', 'c@i.t', 'x')");
    await dal.run("INSERT INTO learners (id, institution_id, name, learner_ref, language) VALUES ('crash-learner', 'ci', 'L', 'R', 'telugu')");
    await dal.close();

    const child = spawnSync(process.execPath, [path.join(HERE, 'fixtures/outbox-crash-child.mjs'), file], {
      env: { ...process.env, DB_PATH: file }, encoding: 'utf8'
    });
    expect(child.signal).toBe('SIGKILL');

    dal.connect({ file });
    // The state change and all three events were committed together.
    expect((await dal.one("SELECT city FROM learners WHERE id = 'crash-learner'")).city).toBe('Warangal');
    expect((await dal.one('SELECT COUNT(*) n FROM domain_events')).n).toBe(3);
    // The first was delivered before the kill; the second was mid-flight.
    expect((await dal.one('SELECT COUNT(*) n FROM domain_events WHERE delivered_at IS NOT NULL')).n).toBe(1);

    const got = [];
    subscribe('NODE_ADVANCED', 'test.recorder', (e) => got.push(e.payload.n));
    const r = await createWorker().tick();
    expect(got).toEqual([2, 3]);
    expect(r.delivered).toBe(2);
    expect((await dal.one('SELECT COUNT(*) n FROM domain_events WHERE delivered_at IS NULL')).n).toBe(0);
    await dal.close();
  });
});
