// Students, explainer (16:9). Words: video/scripts/<lang>/student-explainer.md.
// Revision 2: on-screen words come from the script's on-screen column in the
// video's language (Telugu file: the Telugu column); one row per product shot.
const shot = (key, kicker, title) => ({ key, kicker, title });
const dev = (sh, join = true) => ({ type: 'device', join, shots: [sh] });
export default ({ scenes: s }) => ({
  sections: [{ id: 'intro', theme: 'dark' }, { id: 'steps', theme: 'light' }, { id: 'close', theme: 'close' }],
  scenes: [
    { section: 'intro', beat: { type: 'text', heading: s[0].screen[0], top: 420, size: 110 } },
    { section: 'steps', beat: dev(shot('courses', s[1].screen[0], s[1].screen[1]), false) },
    { section: 'steps', beat: dev(shot('lesson', s[2].screen[0], s[2].screen[1])) },
    { section: 'steps', beat: dev(shot('walk', s[3].screen[0], s[3].screen[1])) },
    { section: 'steps', beat: dev(shot('practise', s[4].screen[0], s[4].screen[1])) },
    { section: 'steps', beat: dev(shot('check', s[5].screen[0], s[5].screen[1])) },
    { section: 'steps', beat: dev(shot('passport', s[6].screen[0], s[6].screen[1])) },
    { section: 'close', beat: { type: 'close', action: s[7].screen[0] } }
  ]
});
