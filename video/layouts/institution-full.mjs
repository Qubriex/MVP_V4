// Institutions, full (16:9). Words: video/scripts/<lang>/institution-full.md.
import { facts } from '../lib/facts.mjs';
const shot = (key, kicker, title, focus) => ({ key, kicker, title, ...(focus ? { focus } : {}) });
export default ({ scenes: s, contact }) => ({
  usesContact: true,
  sections: [{ id: 'q', theme: 'dark' }, { id: 'product', theme: 'light' }, { id: 'pilot', theme: 'light' }, { id: 'close', theme: 'close' }],
  scenes: [
    { section: 'q', beat: { type: 'persona', kicker: s[0].screen[0], question: 'Which of our 600 students are actually ready, and who needs help now?' } },
    { section: 'q', beat: facts.donut('motherTongue', 'of engineering students want mother-tongue learning') },
    { section: 'product', beat: { type: 'device', shots: [shot('college', 'Sample data', s[2].screen[0]), shot('whynot', 'Sample data', s[2].screen[1]), shot('overview', 'Sample data', s[2].screen[2]), shot('college', 'Sample data', s[2].screen[3], [0.62, 0.52, 0.99, 1.0]), shot('lesson', 'Students', 'Learn in Telugu')] } },
    { section: 'product', beat: { type: 'device', shots: [shot('passport', 'Sample data', s[3].screen[0]), shot('verify', 'Sample data', s[3].screen[1])] } },
    { section: 'pilot', beat: { type: 'pilot', header: s[4].screen[0], steps: s[4].screen.slice(1), stagger: 1.2 } },
    { section: 'close', beat: { type: 'close', tagline: [s[5].screen[0]], contact } }
  ]
});
