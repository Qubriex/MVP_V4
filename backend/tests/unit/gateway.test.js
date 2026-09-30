import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { freshDb } from '../helpers/setup.js';
import * as dal from '../../core/db/dal.js';
import { generate, GatewayError } from '../../core/ai/gateway.js';
import { setResponder } from '../../core/ai/adapters/mock.js';

let restore = () => {};
beforeAll(freshDb);
afterEach(() => restore());

describe('AI gateway', () => {
  it('the mock adapter is deterministic per input', async () => {
    const a = await generate({ task: 'TEACH.instruct', system: 's', input: 'hello' });
    const b = await generate({ task: 'TEACH.instruct', system: 's', input: 'hello' });
    const c = await generate({ task: 'TEACH.instruct', system: 's', input: 'hello!' });
    expect(a.text).toBe(b.text);
    expect(a.text).not.toBe(c.text);
    expect(a.adapter).toBe('mock');
  });

  it('logs every call to model_calls with task and model', async () => {
    await generate({ task: 'EVAL.mastery', input: 'x', institutionId: 'inst-1', promptId: 'EVAL.mastery', promptVersion: 'v1' });
    const row = await dal.one("SELECT * FROM model_calls WHERE task = 'EVAL.mastery' ORDER BY created_at DESC");
    expect(row).toMatchObject({ adapter: 'mock', model_id: 'mock', status: 'ok', institution_id: 'inst-1', prompt_version: 'v1' });
  });

  it('repairs a schema miss once', async () => {
    let calls = 0;
    restore = setResponder(() => (++calls === 1 ? 'not json' : { decision: 'CHECK', message: 'm' }));
    const r = await generate({ task: 'TEACH.instruct', input: 'x', schema: { required: ['decision', 'message'] } });
    expect(r.json).toEqual({ decision: 'CHECK', message: 'm' });
    expect(calls).toBe(2);
  });

  it('fails with a typed error after the repair also misses', async () => {
    restore = setResponder(() => ({ wrong: true }));
    await expect(generate({ task: 'TEACH.instruct', input: 'y', schema: { required: ['decision'] } }))
      .rejects.toMatchObject({ name: 'GatewayError', code: 'schema_failed' });
    expect(await dal.one("SELECT status FROM model_calls WHERE status = 'schema_failed'")).toBeTruthy();
  });

  it('retries a 5xx once, then surfaces a typed upstream error', async () => {
    let calls = 0;
    restore = setResponder(() => { calls += 1; throw Object.assign(new Error('boom'), { status: 503 }); });
    const err = await generate({ task: 'TEACH.doubt', input: 'z' }).catch(e => e);
    expect(err).toBeInstanceOf(GatewayError);
    expect(err.code).toBe('upstream');
    expect(calls).toBe(2);
  });

  it('does not retry a 4xx', async () => {
    let calls = 0;
    restore = setResponder(() => { calls += 1; throw Object.assign(new Error('bad'), { status: 400 }); });
    await generate({ task: 'TEACH.doubt', input: 'z' }).catch(() => {});
    expect(calls).toBe(1);
  });
});
