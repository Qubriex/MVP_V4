// Student reel 3: your passport (9:16). Words: video/scripts/<lang>/student-reel-3.md.
export default ({ scenes: s }) => ({
  lead: 0.3,
  scenes: [
    { beat: { type: 'text', lines: ['Marks show you passed.', 'This shows you can.'], accent: true } },
    { beat: { type: 'shot', lines: [s[1].screen[0], 'Sample'], shots: [{ key: 'passport' }] } },
    { beat: { type: 'shot', lines: ['Scan → Verify'], shots: [{ key: 'qr' }, { key: 'verify' }] } },
    { beat: { type: 'end', lines: [s[3].screen[0]] } }
  ]
});
