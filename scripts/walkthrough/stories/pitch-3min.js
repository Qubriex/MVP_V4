// The investor pitch, under 3 minutes. Numbers and sources: the Qubirex
// Pitch Facts Report (16 Nov 2026). Check each against its original report
// before it goes into an investor deck.
export default {
  name: 'qubirex-pitch-3min',
  maxSeconds: 180,
  tempo: 0.94,   // calmer than the generated pace
  // url: 'qubirex.in',   // shown on the end card; add once the domain is confirmed
  sections: [
    { id: 'problem', n: '01', title: 'Problem', theme: 'dark' },
    { id: 'solution', n: '02', title: 'Solution', theme: 'warm' },
    { id: 'product', n: '03', title: 'Our product', theme: 'light' },
    { id: 'whynow', n: '04', title: 'Why now', theme: 'dark' },
    { id: 'whyus', n: '05', title: 'Why Qubirex', theme: 'dark' },
    { id: 'next', n: '06', title: "What's next", theme: 'light' },
    { id: 'close', theme: 'close' }
  ],
  lines: [
    { section: 'problem', say: "Imagine Priya. A bright student from a small town in Andhra Pradesh. She understands logic, but every coding class is in English, a language she doesn't think in.", beat: { type: 'priya' } },
    { section: 'problem', say: 'She is not alone. Every year, India produces about 1.1 crore graduates.', beat: { type: 'stat', value: 1.1, decimals: 1, suffix: ' crore', label: 'graduates every year', source: 'AISHE 2023-24' } },
    { section: 'problem', say: 'Only about half of them are judged ready for a job.', beat: { type: 'caps', pct: 56, label: 'judged job-ready', source: 'India Skills Report 2026 (56%)' } },
    { section: 'problem', say: 'And graduates are four times more likely to be jobless: thirteen percent, against three point two percent for all workers.', beat: { type: 'bars', rows: [['Graduates', 13], ['All workers', 3.2]], unit: '%', label: '4× more likely to be jobless', source: 'PLFS 2023-24' } },
    { section: 'problem', say: 'Only one Indian in ten speaks English. Yet engineering is taught in English.', beat: { type: 'people', label: '1 in 10 Indians speaks English', source: 'Census 2011 (10.6%)' } },
    { section: 'problem', say: 'Forty-four percent of engineering students told AICTE they want to learn in their mother tongue.', beat: { type: 'donut', pct: 44, label: 'of engineering students want to learn in their mother tongue', source: 'AICTE survey, 2020' } },
    { section: 'solution', say: 'What if Priya could learn in her own language, and prove every skill she learns?', beat: { type: 'solution', lines: ['Learn in your own language.', 'Prove every skill.'] } },
    { section: 'solution', say: 'Not a translated course. A teacher who speaks the way she speaks: Telugu, Hindi, or the everyday Telugu-English mix.', beat: { type: 'mix' } },
    { section: 'product', say: "That's Qubirex.", beat: { type: 'logo' } },
    { section: 'product', say: 'Professor Qubirex explains each idea, walks through the code line by line, and answers her questions.', beat: { type: 'device', shots: [{ key: 'walk', kicker: 'In your language', title: 'Every line, explained' }] } },
    { section: 'product', say: 'She practises real code, with real tests, and a fresh check confirms she can do it herself.', beat: { type: 'device', shots: [{ key: 'practise', kicker: 'Practise', title: 'Real code, real tests' }] } },
    { section: 'product', say: 'Every skill she proves goes on a signed Capability Passport. Anyone can verify it online.', beat: { type: 'device', shots: [{ key: 'passport', kicker: 'Capability Passport', title: 'Every skill, signed' }, { key: 'verify', kicker: 'Verify', title: 'Anyone can verify it online' }] } },
    { section: 'product', say: 'Colleges see who is ready and who needs help. Employers hire on proof.', beat: { type: 'device', shots: [{ key: 'college', kicker: 'Colleges', title: 'See who is ready' }, { key: 'employer', kicker: 'Employers', title: 'Hire on proof' }] } },
    { section: 'product', say: 'Learn, practise, prove, and get seen by employers. A to Z, in one place.', beat: { type: 'journey', steps: ['Learn', 'Practise', 'Prove', 'Get hired'] } },
    { section: 'whynow', say: 'Why now? Because IT fresher hiring has fallen eighty percent in three years, from six lakh to one point two lakh.', beat: { type: 'falling', from: 6, to: 1.2, unit: 'lakh', label: 'IT fresher hiring', fromLabel: 'FY22', toLabel: 'FY25', source: 'Xpheno, FY22–FY25' } },
    { section: 'whynow', say: "A degree alone is no longer enough. As Jensen Huang said: you're not going to lose your job to an AI, but you're going to lose your job to someone who uses AI.", beat: { type: 'quote', text: "You're not going to lose your job to an AI, but you're going to lose your job to someone who uses AI.", who: 'Jensen Huang, CEO, Nvidia', source: 'Milken Institute, May 2025' } },
    { section: 'whynow', say: "AI is like a recipe. It gives the steps, but you still cook. AI writes code, but someone must check it. Why shouldn't that someone be you?", beat: { type: 'recipe' } },
    { section: 'whynow', say: "And ninety-eight percent of India's internet users already use Indian-language content.", beat: { type: 'stat', value: 98, decimals: 0, suffix: '%', label: 'of internet users use Indian-language content', source: 'IAMAI–Kantar 2024' } },
    { section: 'whyus', say: 'Big platforms are translating their courses. But translation is not enough.', beat: { type: 'compare' } },
    { section: 'whyus', say: 'Qubirex gives proof of skills, one journey from learning to hiring, and tools built for colleges.', beat: { type: 'pillars', items: ['Proof of skills', 'One journey, A to Z', 'Built for colleges'] } },
    { section: 'next', say: 'Next, a pilot with one partner college, to measure exactly how many more students get jobs.', beat: { type: 'pilot', steps: ['100 students, one college', 'Starting skills checked', 'One semester on Qubirex', 'Placements, six months on'] } },
    { section: 'close', say: 'Qubirex. Your language. Your skills. Your future.', beat: { type: 'close' } }
  ]
};
