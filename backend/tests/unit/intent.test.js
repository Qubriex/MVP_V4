// "I'm ready for the check" in the learner's own words starts the check.
import { describe, it, expect } from 'vitest';
import { asksForCheck } from '../../core/ai/intent.js';

describe('asksForCheck', () => {
  it('matches the ready phrase in English, Telugu and Hindi', () => {
    for (const s of ["I'm ready for the check", 'i am ready', 'Ready for the mastery check.', 'చెక్‌కు సిద్ధం', 'నేను సిద్ధంగా ఉన్నాను', 'मैं जाँच के लिए तैयार हूँ', 'जांच के लिए तैयार', 'ready for the test', 'టెస్ట్‌కు సిద్ధం', 'टेस्ट के लिए तैयार']) {
      expect(asksForCheck(s), s).toBe(true);
    }
  });
  it('does not match answers or long text that only mention being ready', () => {
    for (const s of ['flex makes items sit in a row', 'The useEffect hook runs when the component is ready for the check of props and then re-renders the whole tree again', '', null]) {
      expect(asksForCheck(s), String(s)).toBe(false);
    }
  });
});
