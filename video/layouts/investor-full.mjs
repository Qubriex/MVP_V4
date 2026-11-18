// Investors (16:9, English). Words: video/scripts/en/investor-full.md. Founder
// lines are founder footage (placeholder cards until filmed); scenes that are
// only blanks stay silent, showing their [FILL] boxes for the script's time.
import { facts, fill } from '../lib/facts.mjs';
const shot = (key, kicker, title) => ({ key, kicker, title });
export default ({ scenes: s, contact }) => ({
  usesContact: true,
  brandRef: 'assets/voice/qubirex-en.wav', // the investor voice was heard as "QB Rex"
  sections: [
    { id: 'intro', theme: 'dark' }, { id: 'gap', n: '01', title: 'Market gap', theme: 'dark' }, { id: 'solution', n: '02', title: 'Solution', theme: 'light' },
    { id: 'why', n: '03', title: 'Why Qubirex', theme: 'dark' }, { id: 'proof', n: '04', title: 'Product proof', theme: 'dark' }, { id: 'customers', n: '05', title: 'Customers', theme: 'dark' },
    { id: 'revenue', n: '06', title: 'Revenue', theme: 'dark' }, { id: 'market', n: '07', title: 'Market', theme: 'dark' }, { id: 'traction', n: '08', title: 'Traction and team', theme: 'dark' },
    { id: 'ask', n: '09', title: 'The ask', theme: 'dark' }
  ],
  scenes: [
    { section: 'intro', placeholder: 'Every year India produces about 1.1 crore graduates. Only about half are judged job-ready, and IT fresher hiring has fallen 80% in three years. Most of these students think in Telugu or Hindi, but are taught only in English.', beats: [{ type: 'founder', line: 'Founder introduction', lower: 'Founder introduction (footage to come)', at: 0 }, { type: 'chips3', at: .2, items: [{ big: facts.screen('graduates'), label: 'graduates every year', source: facts.source('graduates') }, { big: facts.screen('jobReady'), label: 'judged job-ready', source: facts.source('jobReady') }, { big: '−80%', label: 'IT fresher hiring, FY22–FY25', source: facts.source('fresherHiring') }] }] },
    { section: 'gap', beat: { type: 'table', grid: '320px 1fr', rows: [['NxtWave', 'Teaches, sold to students'], ['GUVI', 'Teaches, 16 languages'], ['HackerRank', 'Tests, in English'], ['Missing', 'Learn in the mix + proof + college tools']], hiLast: true } },
    { section: 'solution', beat: { type: 'device', shots: [shot('lesson', 'Learn', 'In Telugu, every line explained'), shot('practise', 'Practise', 'Real tests'), shot('check', 'Check', 'A fresh check'), shot('passport', 'Passport', 'Signed, verifiable')] } },
    { section: 'why', beat: { type: 'table', grid: '90px 1fr', rows: [['1', 'Proof, not certificates'], ['2', 'Built for colleges'], ['3', 'One record, lesson to job']] } },
    { section: 'proof', placeholder: 'Pilot results will be added here: the score before and after, how many students took part, and over how many weeks.', beat: { type: 'cards', items: [{ label: 'Pilot result', value: '[FILL: before X% -> after Y%, N students, Z weeks]' }] } },
    { section: 'customers', placeholder: 'Who pays will be added here, for each of our three customers: colleges, employers and students.', beat: { type: 'cards', items: [{ icon: 'college', label: 'Colleges', value: '[FILL: who pays]' }, { icon: 'employer', label: 'Employers', value: '[FILL: who pays]' }, { icon: 'student', label: 'Students', value: '[FILL: who pays]' }] } },
    { section: 'revenue', placeholder: 'Our price per student, our AI cost per learner, and the expected gross margin will be added here, from real usage logs.', beat: { type: 'cards', items: [{ label: 'Price', value: fill('pricePerStudentYear', 'price per student per year') }, { label: 'Cost per learner', value: fill('costPerLearnerMonth', 'from usage logs') }, { label: 'Gross margin', value: fill('grossMargin', 'gross margin') }] } },
    { section: 'market', beat: { type: 'funnel', rows: [['India, BTech seats (2024-25)', '14.9 lakh'], ['Andhra Pradesh + Telangana', '1,83,532 + 1,16,877'], ['First target', '[FILL: first target]']], source: 'AICTE via EducationPost; Telangana Today', fact: 'btechSeats' } },
    { section: 'traction', placeholder: 'Traction will be added here: our pilots, letters of intent and colleges in talks. Then a line on each person in the team.', beat: { type: 'cards', items: [{ label: 'Traction', value: fill('traction', 'pilots, LOIs, colleges in talks') }, { label: 'Team', value: fill('team', 'one line per person') }] } },
    { section: 'ask', placeholder: 'Our funding ask will be added here. Thank you.', beats: [{ type: 'founder', line: 'Founder introduction', lower: 'The ask (founder footage to come)', at: 0 }, { type: 'cards', at: .45, items: [{ label: 'The ask', value: fill('ask', 'Rs __') }, { label: 'Use of funds', value: fill('useOfFunds', 'product %, sales %, content %') }, { label: 'Contact', value: contact }] }] }
  ]
});
