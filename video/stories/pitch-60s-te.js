// Investor pitch, under a minute (Telugu voice, Telugu on-screen text).
// DRAFT until a native speaker checks the lines marked ⚠ (brief §3); then it
// is voiced again from these lines with the agreed brand pronunciation.
import { facts } from '../lib/facts.mjs';
import { TE, sections, QUOTE_TE, CLOSE_TE } from './te-common.mjs';
const f = facts('te');
const VOICE = new URL('../../artifacts/walkthrough/story/qubirex-pitch-60s-telugu', import.meta.url).pathname;

export default {
  name: 'pitch-60s-te', title: 'Investor pitch, under a minute (Telugu)', lang: 'te',
  target: { lufs: -16, min: 30, max: 55 }, lead: 0.4, tail: 1.8, shots: 'te', strings: TE,
  voiceFrom: VOICE, voiceEngine: 'Gemini TTS gemini-3.8-flash-tts (te-IN, Kore)',
  pending: ['native-speaker check of the Telugu lines (⚠ quote, line 7), then a new voice-over with the agreed brand pronunciation'],
  sections: sections(['problem', 'solution', 'product', 'whynow', 'close']),
  lines: [
    { section: 'problem', say: 'ప్రతి సంవత్సరం భారతదేశంలో దాదాపు ఒక కోటి పది లక్షల మంది గ్రాడ్యుయేట్లు తయారవుతున్నారు.', back: 'Every year in India, about one crore ten lakh graduates are produced.', beat: f.stat('graduates') },
    { section: 'problem', say: 'వాళ్లలో దాదాపు సగం మంది మాత్రమే ఉద్యోగానికి సిద్ధంగా ఉన్నారని అంచనా.', back: 'It is estimated that only about half of them are ready for a job.', beat: f.caps('jobReady') },
    { section: 'problem', say: 'భారతదేశంలో పది మందిలో ఒక్కరే ఇంగ్లీష్ మాట్లాడతారు. కానీ ఇంజనీరింగ్ మాత్రం ఇంగ్లీష్‌లోనే నేర్పిస్తారు.', back: 'In India, only one in ten people speaks English. But engineering is taught only in English.', beat: f.people('english') },
    { section: 'solution', say: 'క్యూబిరెక్స్ తెలుగులో, హిందీలో, లేదా విద్యార్థులు నిజంగా మాట్లాడే తెలుగు-ఇంగ్లీష్ మిక్స్‌లో నేర్పిస్తుంది.', back: 'Qubirex teaches in Telugu, in Hindi, or in the Telugu-English mix that students actually speak.', beat: { type: 'solution', lines: ['మీ భాషలోనే నేర్చుకోండి.', 'ప్రతి స్కిల్‌ను నిరూపించండి.'] }, pad: 0.7 },
    { section: 'product', say: 'ప్రొఫెసర్ క్యూబిరెక్స్ ప్రతి లైన్‌ను వివరిస్తారు. నిరూపించిన ప్రతి స్కిల్, సంతకంతో ఉన్న కేపబిలిటీ పాస్‌పోర్ట్‌లో చేరుతుంది.', back: 'Professor Qubirex explains every line. Every skill proved goes into the Capability Passport, which carries a signature.', beat: { type: 'device', shots: [{ key: 'walk', kicker: 'మీ భాషలో', title: 'ప్రతి లైన్ వివరంగా' }, { key: 'passport', kicker: 'కేపబిలిటీ పాస్‌పోర్ట్', title: 'ప్రతి స్కిల్‌కి సంతకం' }] } },
    { section: 'whynow', say: 'IT కంపెనీల్లో ఫ్రెషర్ల నియామకాలు మూడేళ్లలో ఎనభై శాతం తగ్గిపోయాయి.', back: 'Fresher hiring in IT companies has fallen eighty percent in three years.', beat: f.falling('fresherHiring'), pad: 0.6 },
    { section: 'whynow', say: 'జెన్సెన్ హువాంగ్ చెప్పినట్టు: మీ ఉద్యోగం AI కి పోదు, కానీ AI వాడే ఎవరికైనా పోతుంది.', back: '⚠ As Jensen Huang said: your job will not go to AI, but it will go to anyone who uses AI. (Check: the second half should mean "to someone who uses AI".)', beat: f.quote(QUOTE_TE) },
    { section: 'whynow', say: 'AI ఒక రెసిపీ లాంటిది. వంట మాత్రం మీరే చేయాలి. ఆ వ్యక్తి మీరే ఎందుకు కాకూడదు?', back: 'AI is like a recipe. But the cooking, you must do yourself. Why shouldn’t that person be you?', beat: { type: 'recipe' }, pad: 1.5 },
    { section: 'close', say: 'క్యూబిరెక్స్. మీ భాష. మీ స్కిల్స్. మీ భవిష్యత్తు.', back: 'Qubirex. Your language. Your skills. Your future.', beat: CLOSE_TE }
  ]
};
