// Investor pitch, under a minute (English). Numbers: video/facts.json.
// Phase 1 fixes: FY25 bar grows to 1.2 lakh with −80%; the code card holds
// ≥ 5 s with the bug then the fix; one title at a time; "1 in 10" once and
// "speak"; product screens recorded in Telugu mode, zoomed to one area.
import { facts } from '../lib/facts.mjs';
const f = facts('en');

export default {
  name: 'pitch-60s-en', title: 'Investor pitch, under a minute (English)', lang: 'en',
  target: { lufs: -16, min: 30, max: 55 },
  tempo: 1.05, lead: 0.4, tail: 2.4, shots: 'te',
  sections: [
    { id: 'problem', n: '01', title: 'Problem', theme: 'dark' },
    { id: 'solution', n: '02', title: 'Solution', theme: 'warm' },
    { id: 'product', n: '03', title: 'Our product', theme: 'light' },
    { id: 'whynow', n: '04', title: 'Why now', theme: 'dark' },
    { id: 'close', theme: 'close' }
  ],
  lines: [
    { section: 'problem', say: 'Every year, India produces about 1.1 crore graduates.', beat: f.stat('graduates') },
    { section: 'problem', say: 'Only about half are judged ready for a job.', beat: f.caps('jobReady') },
    { section: 'problem', say: 'Only 1 in 10 Indians speak English. Yet engineering is taught in English.', beat: f.people('english') },
    { section: 'solution', say: 'Qubirex teaches in Telugu, Hindi, or the mix students actually speak.', beat: { type: 'solution', lines: ['Learn in your own language.', 'Prove every skill.'] }, pad: 1.0 },
    { section: 'product', say: 'Professor Qubirex explains every line, and every skill students prove goes on a signed Capability Passport.', beat: { type: 'device', shots: [{ key: 'walk', kicker: 'In your language', title: 'Every line, explained' }, { key: 'passport', kicker: 'Capability Passport', title: 'Every skill, signed' }] } },
    { section: 'whynow', say: 'IT fresher hiring has fallen 80% in three years.', beat: f.falling('fresherHiring'), pad: 1.4 },
    { section: 'whynow', say: "As Jensen Huang said: you're not going to lose your job to an AI, but you're going to lose your job to someone who uses AI.", beat: f.quote() },
    { section: 'whynow', say: "AI is the recipe. You still cook. Why shouldn't that be you?", beat: { type: 'recipe' }, pad: 2.6 },
    { section: 'close', say: 'Qubirex. Your language. Your skills. Your future.', beat: { type: 'close', action: 'Talk to us' } }
  ]
};
