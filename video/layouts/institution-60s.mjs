// Institutions, 60 s (16:9). Words: video/scripts/<lang>/institution-60s.md.
const shot = (key, kicker, title) => ({ key, kicker, title });
export default ({ scenes: s, contact }) => ({
  usesContact: true,
  sections: [{ id: 'q', theme: 'dark' }, { id: 'product', theme: 'light' }, { id: 'pilot', theme: 'light' }, { id: 'close', theme: 'close' }],
  scenes: [
    { section: 'q', beat: { type: 'persona', kicker: 'A TPO’s question', question: s[0].screen[0] } },
    { section: 'product', beat: { type: 'device', shots: [shot('college', 'Sample data', s[1].screen[0]), shot('whynot', 'Sample data', s[1].screen[1]), shot('overview', 'Sample data', s[1].screen[2]), shot('lesson', 'Students', 'Learn in Telugu')] } },
    { section: 'pilot', beat: { type: 'pilot', header: 'Pilot', steps: ['100 students', 'One semester', 'Measured from day one'], stagger: 1.0 } },
    { section: 'close', beat: { type: 'close', tagline: ['Book a demo.'], contact } }
  ]
});
