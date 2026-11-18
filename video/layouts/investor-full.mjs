// Investors (16:9, English). Words: video/scripts/en/investor-full.md. Founder
// lines are founder footage (placeholder cards until filmed); scenes that are
// only blanks stay silent, showing their [FILL] boxes for the script's time.
import { facts, fill } from '../lib/facts.mjs';
const shot = (key, kicker, title) => ({ key, kicker, title });
export default ({ scenes: s, contact }) => ({
  usesContact: true,
  sections: [
    { id: 'intro', theme: 'dark' }, { id: 'gap', n: '01', title: 'Market gap', theme: 'dark' }, { id: 'solution', n: '02', title: 'Solution', theme: 'light' },
    { id: 'why', n: '03', title: 'Why Qubirex', theme: 'dark' }, { id: 'proof', n: '04', title: 'Product proof', theme: 'dark' }, { id: 'customers', n: '05', title: 'Customers', theme: 'dark' },
    { id: 'revenue', n: '06', title: 'Revenue', theme: 'dark' }, { id: 'market', n: '07', title: 'Market', theme: 'dark' }, { id: 'traction', n: '08', title: 'Traction and team', theme: 'dark' },
    { id: 'ask', n: '09', title: 'The ask', theme: 'dark' }
  ],
  scenes: [
    { section: 'intro', silent: true, beats: [{ type: 'founder', line: s[0].say, lower: 'Sasi, Founder, Qubirex', at: 0 }, { type: 'chips3', at: .55, items: [{ big: facts.screen('graduates'), label: 'graduates every year', source: facts.source('graduates') }, { big: facts.screen('jobReady'), label: 'judged job-ready', source: facts.source('jobReady') }, { big: '−80%', label: 'IT fresher hiring, FY22–FY25', source: facts.source('fresherHiring') }] }] },
    { section: 'gap', beat: { type: 'table', grid: '320px 1fr', rows: [['NxtWave', 'Teaches, sold to students'], ['GUVI', 'Teaches, 16 languages'], ['HackerRank', 'Tests, in English'], ['Missing', 'Learn in the mix + proof + college tools']], hiLast: true } },
    { section: 'solution', beat: { type: 'device', shots: [shot('lesson', 'Learn', 'In Telugu'), shot('walk', 'Learn', 'Every line explained'), shot('practise', 'Practise', 'Real tests'), shot('check', 'Check', 'A fresh check'), shot('passport', 'Passport', 'Signed, verifiable')] } },
    { section: 'why', beat: { type: 'table', grid: '90px 1fr', rows: [['1', 'Proof, not certificates'], ['2', 'Built for colleges'], ['3', 'One record, lesson to job']] } },
    { section: 'proof', silent: true, beat: { type: 'cards', items: [{ label: 'Pilot result', value: '[FILL: before X% -> after Y%, N students, Z weeks]' }] } },
    { section: 'customers', silent: true, beat: { type: 'cards', items: [{ icon: 'college', label: 'Colleges', value: '[FILL: who pays]' }, { icon: 'employer', label: 'Employers', value: '[FILL: who pays]' }, { icon: 'student', label: 'Students', value: '[FILL: who pays]' }] } },
    { section: 'revenue', silent: true, beat: { type: 'cards', items: [{ label: 'Price', value: fill('pricePerStudentYear', 'price per student per year') }, { label: 'Cost per learner', value: fill('costPerLearnerMonth', 'from usage logs') }, { label: 'Gross margin', value: fill('grossMargin', 'gross margin') }] } },
    { section: 'market', beat: { type: 'funnel', rows: [['India, BTech seats (2024-25)', '14.9 lakh'], ['Andhra Pradesh + Telangana', '1,83,532 + 1,16,877'], ['First target', '[FILL: first target]']], source: 'AICTE via EducationPost; Telangana Today', fact: 'btechSeats' } },
    { section: 'traction', silent: true, beat: { type: 'cards', items: [{ label: 'Traction', value: fill('traction', 'pilots, LOIs, colleges in talks') }, { label: 'Team', value: fill('team', 'one line per person') }] } },
    { section: 'ask', silent: true, beats: [{ type: 'founder', line: s[9].say || s[9].voice, at: 0 }, { type: 'cards', at: .45, items: [{ label: 'The ask', value: fill('ask', 'Rs __') }, { label: 'Use of funds', value: fill('useOfFunds', 'product %, sales %, content %') }, { label: 'Contact', value: contact }] }] }
  ]
});
