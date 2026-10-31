// src/utils/codeSpeech.js
// How a line note that quotes code is said aloud: keywords stay as they are
// ("def" is "def"), operators become words ("a + b" → "a plus b"), and a
// "#" comment is read as its text. Only the spoken copy changes; the note on
// screen keeps the code. Operator words stay in English inside Telugu and
// Hindi notes, the same way code keywords do.

const OPS = [
  [/\s*->\s*/g, ' arrow '],
  [/\s*>=\s*/g, ' greater than or equal to '],
  [/\s*<=\s*/g, ' less than or equal to '],
  [/\s*==\s*/g, ' equals equals '],
  [/\s*!=\s*/g, ' not equal to '],
  [/\s*\+=\s*/g, ' plus equals '],
  [/\s*-=\s*/g, ' minus equals '],
  [/\s*\*=\s*/g, ' times equals '],
  [/(\w)\+\+/g, '$1 plus plus'],
  [/(\w)--/g, '$1 minus minus'],
  [/<>/g, ' angle brackets '],
  [/<(\w+)>/g, ' angle $1 '],
  [/(\d)\s*%(?!\w)/g, '$1 percent'],
  [/%n\b/g, ' percent n '],
  [/(^|\s)%(\s|$)/g, '$1modulo$2'],
  [/\s\+\s|^\+\s/g, ' plus '],
  [/\s-\s/g, ' minus '],
  [/\s\*\s/g, ' times '],
  [/(\w|\))\s*\/\s*(\w)/g, '$1 divided by $2'],
  [/^\/\s/g, 'divided by '],
  [/\s<\s/g, ' less than '],
  [/\s>\s/g, ' greater than '],
  [/\s=\s/g, ' equals ']
];

/** @param {string} text a line note (any language) @returns {string} the same note, ready to be spoken */
export function codeSpeech(text) {
  let t = String(text || '');
  t = t.replace(/(^|\s)#\s*/g, '$1'); // "# total marks" → "total marks"
  t = t.replace(/__(\w+?)__/g, 'dunder $1');
  OPS.forEach(([re, say]) => { t = t.replace(re, say); });
  t = t.replace(/(\w)\[(\w+)\]/g, '$1 index $2'); // marks[0] → marks index 0
  t = t.replace(/(\w)\(\)/g, '$1'); // stream() → stream
  t = t.replace(/\(\.\.\.\)/g, '');
  t = t.replace(/(\w)\.(?=[A-Za-z_])/g, '$1 dot '); // marks.length → marks dot length
  t = t.replace(/(\w)_(?=\w)/g, '$1 '); // most_common → most common
  return t.replace(/\s+/g, ' ').trim();
}
