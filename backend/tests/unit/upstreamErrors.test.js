// A Google "key not valid" (401) or "API not enabled" (403) is about our key,
// never the signed-in person: it reaches the browser as 502, so the app does
// not treat it as the session ending (team point 31-4, voice session logout).
import { describe, it, expect } from 'vitest';
import { upstream } from '../../core/ai/adapters/gemini.js';

describe('upstream AI errors', () => {
  it('401 and 403 from Google become 502, keeping the original status for diagnosis', () => {
    for (const s of [401, 403]) {
      const e = upstream(Object.assign(new Error('x'), { status: s }));
      expect(e.status).toBe(502);
      expect(e.upstreamStatus).toBe(s);
    }
  });
  it('other statuses pass through unchanged', () => {
    expect(upstream(Object.assign(new Error('x'), { status: 429 })).status).toBe(429);
    expect(upstream(Object.assign(new Error('x'), { status: 404 })).status).toBe(404);
  });
});
