// Investor pitch, under 3 minutes (English). Numbers: video/facts.json.
// Phase 1 fixes: "98%" said clearly; the logo holds 1.5 s before "03 Our
// product"; the 98% label shows with the count-up; Priya is tagged
// "Illustrative story"; the comparison is proof, college tools and who pays
// (not "translated courses"); product screens in Telugu mode, zoomed.
import { facts } from '../lib/facts.mjs';
const f = facts('en');

export default {
  name: 'pitch-3min-en', title: 'Investor pitch, under 3 minutes (English)', lang: 'en',
  target: { lufs: -16, min: 90, max: 160 },
  tempo: 0.97, shots: 'te',
  sections: [
    { id: 'problem', n: '01', title: 'Problem', theme: 'dark' },
    { id: 'solution', n: '02', title: 'Solution', theme: 'warm' },
    { id: 'brand', theme: 'light' },
    { id: 'product', n: '03', title: 'Our product', theme: 'light' },
    { id: 'whynow', n: '04', title: 'Why now', theme: 'dark' },
    { id: 'whyus', n: '05', title: 'Why Qubirex', theme: 'dark' },
    { id: 'next', n: '06', title: "What's next", theme: 'light' },
    { id: 'close', theme: 'close' }
  ],
  lines: [
    { section: 'problem', say: "Imagine Priya. A bright student from a small town in Andhra Pradesh. She understands logic, but every coding class is in English, a language she doesn't think in.", beat: { type: 'priya' } },
    { section: 'problem', say: 'She is not alone. Every year, India produces about 1.1 crore graduates.', beat: f.stat('graduates') },
    { section: 'problem', say: 'Only about half of them are judged ready for a job.', beat: f.caps('jobReady') },
    { section: 'problem', say: 'And graduates are four times more likely to be jobless: 13 percent, against 3.2 percent for all workers.', beat: f.bars('jobless') },
    { section: 'problem', say: 'Only 1 in 10 Indians speak English. Yet engineering is taught in English.', beat: f.people('english') },
    { section: 'problem', say: '44 percent of engineering students told AICTE they want to learn in their mother tongue.', beat: f.donut('motherTongue') },
    { section: 'solution', say: 'What if Priya could learn in her own language, and prove every skill she learns?', beat: { type: 'solution', lines: ['Learn in your own language.', 'Prove every skill.'] }, pad: 0.6 },
    { section: 'solution', say: 'Not a translated course. A teacher who speaks the way she speaks: Telugu, Hindi, or the everyday Telugu-English mix.', beat: { type: 'mix' } },
    { section: 'brand', say: "That's Qubirex.", beat: { type: 'logo' }, pad: 1.0 },
    { section: 'product', say: 'Professor Qubirex explains each idea, walks through the code line by line, and answers her questions.', beat: { type: 'device', shots: [{ key: 'walk', kicker: 'In your language', title: 'Every line, explained' }] } },
    { section: 'product', say: 'She practises real code, with real tests, and a fresh check confirms she can do it herself.', beat: { type: 'device', shots: [{ key: 'practise', kicker: 'Practise', title: 'Real code, real tests' }] } },
    { section: 'product', say: 'Every skill she proves goes on a signed Capability Passport. Anyone can verify it online.', beat: { type: 'device', shots: [{ key: 'passport', kicker: 'Capability Passport', title: 'Every skill, signed' }, { key: 'verify', kicker: 'Verify', title: 'Anyone can check it online' }] } },
    { section: 'product', say: 'Colleges see who is ready and who needs help. Employers hire on proof.', beat: { type: 'device', shots: [{ key: 'college', kicker: 'Colleges', title: 'See who is ready' }, { key: 'employer', kicker: 'Employers', title: 'Hire on proof' }] }, pad: 0.8 },
    { section: 'product', say: 'Learn, practise, prove, and get seen by employers. A to Z, in one place.', beat: { type: 'journey', steps: ['Learn', 'Practise', 'Prove', 'Get hired'] }, pad: 1.2 },
    { section: 'whynow', say: 'Why now? Because IT fresher hiring has fallen 80% in three years, from 6 lakh to 1.2 lakh.', beat: f.falling('fresherHiring'), pad: 0.6 },
    { section: 'whynow', say: "A degree alone is no longer enough. As Jensen Huang said: you're not going to lose your job to an AI, but you're going to lose your job to someone who uses AI.", beat: f.quote() },
    { section: 'whynow', say: "AI is like a recipe. It gives the steps, but you still cook. AI writes code, but someone must check it. Why shouldn't that someone be you?", beat: { type: 'recipe' }, pad: 1.0 },
    { section: 'whynow', say: "And 98 percent of India's internet users already use Indian-language content.", beat: f.stat('indicContent') },
    { section: 'whyus', say: 'Other platforms already teach coding, some in Indian languages. Qubirex is different in three ways.', beat: { type: 'compare', them: 'Other platforms', us: 'Qubirex', rows: [['Proof', 'Course completion certificate', 'Signed Capability Passport, after a fresh check'], ['For colleges', 'Courses for students', 'Readiness tools for every cohort'], ['Who pays', 'Usually the student', '[FILL: who pays]']] }, pad: 1.5 },
    { section: 'whyus', say: 'Qubirex gives proof of skills, one journey from learning to hiring, and tools built for colleges.', beat: { type: 'pillars', items: ['Proof of skills', 'One journey, A to Z', 'Built for colleges'] } },
    { section: 'next', say: 'Next, a pilot with one partner college, to measure exactly how many more students get jobs.', beat: { type: 'pilot', steps: ['100 students, one college', 'Starting skills checked', 'One semester on Qubirex', 'Placements, six months on'] }, pad: 1.2 },
    { section: 'close', say: 'Qubirex. Your language. Your skills. Your future.', beat: { type: 'close', action: 'Talk to us' } }
  ]
};
