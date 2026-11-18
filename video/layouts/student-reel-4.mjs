// Student reel 4: ask anything (9:16). Words: video/scripts/<lang>/student-reel-4.md.
export default ({ scenes: s }) => ({
  lead: 0.3,
  scenes: [
    { beat: { type: 'text', lines: [s[0].screen[0]] } },
    { beat: { type: 'shot', lines: ['Voice question', 'Answer in your language'], shots: [{ key: 'ask' }] } },
    { beat: { type: 'text', lines: [s[2].screen[0]], chips: ['Telugu', 'Hindi', 'English'] } },
    { beat: { type: 'end', lines: ['Ask Professor Qubirex'] } }
  ]
});
