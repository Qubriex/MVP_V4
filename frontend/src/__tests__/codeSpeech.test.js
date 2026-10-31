import { codeSpeech } from '../utils/codeSpeech';

describe('code is spoken properly in a walkthrough', () => {
  it('keeps keywords and reads operators as words', () => {
    expect(codeSpeech('def starts a new function named greet.')).toBe('def starts a new function named greet.');
    expect(codeSpeech('a + b adds them.')).toBe('a plus b adds them.');
    expect(codeSpeech('Start at 1, go while i <= 5, add 1 each time.')).toBe('Start at 1, go while i less than or equal to 5, add 1 each time.');
    expect(codeSpeech('Keep only the rows where marks >= 50.')).toBe('Keep only the rows where marks greater than or equal to 50.');
    expect(codeSpeech('count++ adds one.')).toBe('count plus plus adds one.');
    expect(codeSpeech('+= adds 5 more: 6.')).toBe('plus equals adds 5 more: 6.');
    expect(codeSpeech('int / int drops the decimal: 333.')).toBe('int divided by int drops the decimal: 333.');
    expect(codeSpeech('The lambda m -> m < 35 says which marks to remove.')).toBe('The lambda m arrow m less than 35 says which marks to remove.');
  });
  it('reads a # comment as its text, and tidies calls and names', () => {
    expect(codeSpeech('# total marks for the class')).toBe('total marks for the class');
    expect(codeSpeech('__init__ runs once for every new student.')).toBe('dunder init runs once for every new student.');
    expect(codeSpeech('stream() starts the pipeline.')).toBe('stream starts the pipeline.');
    expect(codeSpeech('length gives rows; marks[0].length gives columns.')).toBe('length gives rows; marks index 0 dot length gives columns.');
    expect(codeSpeech('Counter counts each item; most_common(2) gives the top two.')).toBe('Counter counts each item; most common(2) gives the top two.');
    expect(codeSpeech('It works out 12% PF from the salary.')).toBe('It works out 12 percent PF from the salary.');
  });
  it('leaves Telugu text alone apart from the code in it', () => {
    expect(codeSpeech('def తో greet అనే కొత్త function మొదలవుతుంది.')).toBe('def తో greet అనే కొత్త function మొదలవుతుంది.');
    expect(codeSpeech('a + b రెండింటినీ కలుపుతుంది.')).toBe('a plus b రెండింటినీ కలుపుతుంది.');
  });
});
