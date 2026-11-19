// Institutions, 60 s (16:9). Words: video/scripts/<lang>/institution-60s.md.
// Revision 2: one script row per product shot (joined into one device beat).
const shot = (key, kicker, title, call) => ({ key, kicker, title, ...(call ? { call } : {}) });
const dev = (sh, join = true) => ({ type: 'device', join, shots: [sh] });
export default ({ scenes: s, contact }) => ({
  usesContact: true,
  sections: [{ id: 'q', theme: 'dark' }, { id: 'product', theme: 'light' }, { id: 'pilot', theme: 'light' }, { id: 'close', theme: 'close' }],
  scenes: [
    { section: 'q', beat: { type: 'persona', kicker: 'A TPO’s question', question: s[0].screen[0] } },
    { section: 'product', beat: dev(shot('college', 'Sample data', s[1].screen[0]), false) },
    { section: 'product', beat: dev(shot('whynot', 'Sample data', s[2].screen[0])) },
    { section: 'product', beat: dev(shot('overview', 'Sample data', s[3].screen[0])) },
    { section: 'product', beat: dev(shot('lesson', 'Students', s[4].screen[0])) },
    { section: 'pilot', beat: { type: 'pilot', header: 'Pilot', steps: ['100 students', 'One semester', 'Measured from day one'], stagger: 1.0 } },
    { section: 'close', beat: { type: 'close', tagline: ['Book a demo.'], contact } }
  ]
});
