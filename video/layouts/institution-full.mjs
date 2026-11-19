// Institutions, full (16:9). Words: video/scripts/<lang>/institution-full.md.
// Revision 2: one script row per product shot; consecutive shots join into one
// device beat, each with its own voice line and measured callout (call name).
import { facts } from '../lib/facts.mjs';
const shot = (key, kicker, title, call) => ({ key, kicker, title, ...(call ? { call } : {}) });
const dev = (sh, join = true) => ({ type: 'device', join, shots: [sh] });
export default ({ scenes: s, contact }) => ({
  usesContact: true,
  sections: [{ id: 'q', theme: 'dark' }, { id: 'product', theme: 'light' }, { id: 'pilot', theme: 'light' }, { id: 'close', theme: 'close' }],
  scenes: [
    { section: 'q', beat: { type: 'persona', kicker: s[0].screen[0], question: 'Which of our 600 students are actually ready, and who needs help now?' } },
    { section: 'q', beat: facts.donut('motherTongue', 'of engineering students want mother-tongue learning') },
    { section: 'product', beat: dev(shot('college', 'Sample data', s[2].screen[0]), false) },
    { section: 'product', beat: dev(shot('whynot', 'Sample data', s[3].screen[0])) },
    { section: 'product', beat: dev(shot('overview', 'Sample data', s[4].screen[0])) },
    { section: 'product', beat: dev(shot('college', 'Sample data', s[5].screen[0], 'nudge')) },
    { section: 'product', beat: dev(shot('lesson', 'Students', s[6].screen[0])) },
    { section: 'product', beat: dev(shot('passport', 'Sample data', s[7].screen[0])) },
    { section: 'product', beat: dev(shot('verify', 'Sample data', s[8].screen[0])) },
    { section: 'pilot', beat: { type: 'pilot', header: s[9].screen[0], steps: s[9].screen.slice(1), stagger: 1.2 } },
    { section: 'close', beat: { type: 'close', tagline: [s[10].screen[0]], contact } }
  ]
});
