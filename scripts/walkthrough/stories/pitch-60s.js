// The investor pitch, under 60 seconds. Numbers and sources: the Qubirex
// Pitch Facts Report (16 Nov 2026). Check each against its original report
// before it goes into an investor deck.
export default {
  name: 'qubirex-pitch-60s',
  maxSeconds: 60,
  tempo: 1.05,   // a touch quicker, still natural
  // url: 'qubirex.in',   // shown on the end card; add once the domain is confirmed
  lead: 0.4,
  tail: 2.0,
  sections: [
    { id: 'problem', n: '01', title: 'Problem', theme: 'dark' },
    { id: 'solution', n: '02', title: 'Solution', theme: 'warm' },
    { id: 'product', n: '03', title: 'Our product', theme: 'light' },
    { id: 'whynow', n: '04', title: 'Why now', theme: 'dark' },
    { id: 'close', theme: 'close' }
  ],
  lines: [
    { section: 'problem', say: 'Every year, India produces about 1.1 crore graduates.', beat: { type: 'stat', value: 1.1, decimals: 1, suffix: ' crore', label: 'graduates every year', source: 'AISHE 2023-24' } },
    { section: 'problem', say: 'Only about half are judged ready for a job.', beat: { type: 'caps', pct: 56, label: 'judged job-ready', source: 'India Skills Report 2026 (56%)' } },
    { section: 'problem', say: 'Only one in ten Indians speaks English. Yet engineering is taught in English.', beat: { type: 'people', label: '1 in 10 Indians speaks English', source: 'Census 2011 (10.6%)', priya: true } },
    { section: 'solution', say: 'Qubirex teaches in Telugu, Hindi, or the mix students actually speak.', beat: { type: 'solution', lines: ['Learn in your own language.', 'Prove every skill.'] } },
    { section: 'product', say: 'Professor Qubirex explains every line, and every skill students prove goes on a signed Capability Passport.', beat: { type: 'device', shots: [{ key: 'walk', kicker: 'In your language', title: 'Every line, explained' }, { key: 'passport', kicker: 'Capability Passport', title: 'Every skill, signed' }] } },
    { section: 'whynow', say: 'IT fresher hiring has fallen eighty percent in three years.', beat: { type: 'falling', from: 6, to: 1.2, unit: 'lakh', label: 'IT fresher hiring', fromLabel: 'FY22', toLabel: 'FY25', source: 'Xpheno, FY22–FY25' } },
    { section: 'whynow', say: "As Jensen Huang said: you're not going to lose your job to an AI, but you're going to lose your job to someone who uses AI.", beat: { type: 'quote', text: "You're not going to lose your job to an AI, but you're going to lose your job to someone who uses AI.", who: 'Jensen Huang, CEO, Nvidia', source: 'Milken Institute, May 2025' } },
    { section: 'whynow', say: "AI is the recipe. You still cook. Why shouldn't that be you?", beat: { type: 'recipe' } },
    { section: 'close', say: 'Qubirex. Your language. Your skills. Your future.', beat: { type: 'close' } }
  ]
};
