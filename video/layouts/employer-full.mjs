// Employers (16:9 and 1:1 from the same script). Words: video/scripts/<lang>/employer-full.md.
// Revision 2: one script row per product shot; callouts are measured boxes (call names).
const shot = (key, kicker, title, call) => ({ key, kicker, title, ...(call ? { call } : {}) });
const dev = (sh, join = true) => ({ type: 'device', join, shots: [sh] });
const sq = (lines, sh, join = true) => ({ type: 'shot', join, lines, shots: [sh] });
export default ({ scenes: s, wide, contact }) => (wide ? {
  usesContact: true,
  sections: [{ id: 'q', theme: 'dark' }, { id: 'product', theme: 'light' }, { id: 'why', theme: 'dark' }, { id: 'close', theme: 'close' }],
  scenes: [
    { section: 'q', beat: { type: 'resumes', heading: s[0].screen[0] } },
    { section: 'product', beat: dev(shot('qr', 'Scan', 'Sample passport'), false) },
    { section: 'product', beat: dev(shot('verify', 'Verify', 'Genuine and unchanged')) },
    { section: 'product', beat: dev(shot('employer', 'Search by skill', 'Sample data')) },
    { section: 'product', beat: dev(shot('employer', 'Readiness', 'Invite to interview', 'invite')) },
    { section: 'why', beat: { type: 'pillars', items: s[5].screen, icons: ['signed', 'fresh', 'verify'] } },
    { section: 'close', beat: { type: 'close', tagline: ['Request candidate access.'], contact } }
  ]
} : {
  usesContact: true,
  scenes: [
    { beat: { type: 'resumes', lines: [s[0].screen[0]] } },
    { beat: sq(['Scan', 'Sample passport'], { key: 'qr' }, false) },
    { beat: sq(['Verify', 'Genuine and unchanged'], { key: 'verify' }) },
    { beat: sq(['Search by skill', 'Readiness and verified skills'], { key: 'employer' }) },
    { beat: sq(['Who is ready', 'Invite to interview'], { key: 'employer', call: 'invite' }) },
    { beat: { type: 'icons', items: [['signed', s[5].screen[0]], ['fresh', s[5].screen[1]], ['verify', s[5].screen[2]]] } },
    { beat: { type: 'end', lines: ['Request candidate access'], contact } }
  ]
});
