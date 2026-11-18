// Student reel 2: same lesson, two ways (9:16). Words: video/scripts/<lang>/student-reel-2.md.
export default ({ scenes: s }) => ({
  lead: 0.3,
  scenes: [
    { beat: { type: 'text', lines: [s[0].screen[0]] } },
    { beat: { type: 'split', midAt: 'never' } },
    { beat: { type: 'split', midAt: 'start' } },
    { beat: { type: 'shot', lines: ['Learn by topic', 'Python · Java'], shots: [{ key: 'courses' }] } },
    { beat: { type: 'end', lines: ['Your language. Your skills.'] } }
  ]
});
