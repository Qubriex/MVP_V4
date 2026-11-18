// Employers (16:9 and 1:1 from the same script). Words: video/scripts/<lang>/employer-full.md.
const shot = (key, kicker, title, focus) => ({ key, kicker, title, ...(focus ? { focus } : {}) });
export default ({ scenes: s, wide, contact }) => (wide ? {
  usesContact: true,
  sections: [{ id: 'q', theme: 'dark' }, { id: 'product', theme: 'light' }, { id: 'why', theme: 'dark' }, { id: 'close', theme: 'close' }],
  scenes: [
    { section: 'q', beat: { type: 'resumes', heading: s[0].screen[0] } },
    { section: 'product', beat: { type: 'device', shots: [shot('passport', 'Scan', 'Sample passport', [0.62, 0.36, 0.97, 0.70]), shot('verify', 'Verify', 'Genuine and unchanged'), shot('verify', 'Evidence', 'Evidence per skill', [0.10, 0.55, 0.90, 0.98])] } },
    { section: 'product', beat: { type: 'device', shots: [shot('employer', 'Search by skill', 'Sample data'), shot('employer', 'Readiness', 'Who is ready', [0.30, 0.35, 0.75, 0.90]), shot('employer', 'Invite', 'Request an interview', [0.55, 0.35, 0.75, 0.75])] } },
    { section: 'why', beat: { type: 'pillars', items: s[3].screen, icons: ['signed', 'fresh', 'verify'] } },
    { section: 'close', beat: { type: 'close', tagline: ['Request candidate access.'], contact } }
  ]
} : {
  usesContact: true,
  scenes: [
    { beat: { type: 'resumes', lines: [s[0].screen[0]] } },
    { beat: { type: 'shot', lines: ['Scan → Verify', 'Evidence per skill'], shots: [{ key: 'qr' }, { key: 'verify' }] } },
    { beat: { type: 'shot', lines: ['Search by skill', 'Readiness · Invite'], shots: [{ key: 'employer' }, { key: 'employer', focus: [0.30, 0.35, 0.75, 0.90] }] } },
    { beat: { type: 'icons', items: [['signed', s[3].screen[0]], ['fresh', s[3].screen[1]], ['verify', s[3].screen[2]]] } },
    { beat: { type: 'end', lines: ['Request candidate access'], contact } }
  ]
});
