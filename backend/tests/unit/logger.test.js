import { describe, it, expect, afterEach } from 'vitest';
import { logger, setSink, redact } from '../../core/logger.js';

let restore = () => {};
afterEach(() => { restore(); delete process.env.LOG_LEVEL; });

describe('structured logger', () => {
  it('writes one JSON object per line with bound fields', () => {
    const lines = [];
    restore = setSink((l) => lines.push(l));
    process.env.LOG_LEVEL = 'debug';
    logger.child({ reqId: 'r1' }).info('thing.happened', { n: 2 });
    const entry = JSON.parse(lines[0]);
    expect(entry).toMatchObject({ level: 'info', msg: 'thing.happened', reqId: 'r1', n: 2 });
    expect(entry.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('redacts secrets by key name, at any depth', () => {
    const out = redact({ email: 'a@b.c', password: 'x', body: { pin: '123456', token: 't', nested: [{ apiKey: 'k' }] }, authorization: 'Bearer z' });
    expect(out).toEqual({ email: 'a@b.c', password: '[redacted]', body: { pin: '[redacted]', token: '[redacted]', nested: [{ apiKey: '[redacted]' }] }, authorization: '[redacted]' });
  });

  it('respects the level threshold', () => {
    const lines = [];
    restore = setSink((l) => lines.push(l));
    process.env.LOG_LEVEL = 'warn';
    logger.info('quiet');
    logger.warn('loud');
    expect(lines.map(l => JSON.parse(l).msg)).toEqual(['loud']);
  });
});
