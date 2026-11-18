// Students, explainer (16:9). Words: video/scripts/<lang>/student-explainer.md.
const shot = (key, kicker, title) => ({ key, kicker, title });
export default ({ scenes: s }) => ({
  sections: [{ id: 'intro', theme: 'dark' }, { id: 'steps', theme: 'light' }, { id: 'close', theme: 'close' }],
  scenes: [
    { section: 'intro', beat: { type: 'text', heading: s[0].screen[0], top: 420, size: 110 } },
    { section: 'steps', beat: { type: 'device', shots: [shot('courses', s[1].screen[0], 'Pick a topic'), shot('lesson', s[1].screen[0], 'In Telugu')] } },
    { section: 'steps', beat: { type: 'device', shots: [shot('walk', s[2].screen[0], 'Line by line')] } },
    { section: 'steps', beat: { type: 'device', shots: [shot('practise', s[3].screen[0], 'Hints and real tests')] } },
    { section: 'steps', beat: { type: 'device', shots: [shot('check', s[4].screen[0], 'A fresh check')] } },
    { section: 'steps', beat: { type: 'device', shots: [shot('passport', s[5].screen[0], 'Signed, verifiable')] } },
    { section: 'close', beat: { type: 'close', action: s[6].screen[0] } }
  ]
});
