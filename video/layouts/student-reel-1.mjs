// Student reel 1: spot the bug (9:16). Words: video/scripts/<lang>/student-reel-1.md.
export default ({ scenes: s }) => ({
  lead: 0.3,
  scenes: [
    { beat: { type: 'text', lines: [s[0].screen[0]] } },
    { silent: true, hold: 5.2, beat: { type: 'code', timer: 5, reveal: false } },
    { beat: { type: 'code', spot: 0.6, fix: 4.2 } },
    { beat: { type: 'shot', lines: s[3].screen.slice(0, 1).concat(['Practise · Fresh check']), shots: [{ key: 'walk' }, { key: 'practise' }, { key: 'check' }] } },
    { beat: { type: 'end', lines: [s[4].screen[0]] } }
  ]
});
