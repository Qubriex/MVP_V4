// The investor pitch in Telugu, under 60 seconds: the same story, numbers and
// sources as pitch-60s.js (Qubirex Pitch Facts Report, 16 Nov 2026), with a
// Telugu voice and Telugu on-screen text. No subtitles.
import { STRINGS_TE, sections, QUOTE } from './pitch-te-common.js';

export default {
  name: 'qubirex-pitch-60s-telugu',
  lang: 'te-IN',
  maxSeconds: 60,
  tempo: 1.05,
  lead: 0.4,
  tail: 2.0,
  strings: STRINGS_TE,
  thumb: ['Telugu version', 'Qubirex · investor pitch'],
  sections: sections(['problem', 'solution', 'product', 'whynow']),
  lines: [
    { section: 'problem', say: 'ప్రతి సంవత్సరం భారతదేశంలో దాదాపు ఒక కోటి పది లక్షల మంది గ్రాడ్యుయేట్లు తయారవుతున్నారు.', beat: { type: 'stat', value: 1.1, decimals: 1, suffix: ' కోట్లు', label: 'ప్రతి సంవత్సరం గ్రాడ్యుయేట్లు', source: 'AISHE 2023-24' } },
    { section: 'problem', say: 'వాళ్లలో దాదాపు సగం మంది మాత్రమే ఉద్యోగానికి సిద్ధంగా ఉన్నారని అంచనా.', beat: { type: 'caps', pct: 56, label: 'ఉద్యోగానికి సిద్ధం', source: 'India Skills Report 2026 (56%)' } },
    { section: 'problem', say: 'భారతదేశంలో పది మందిలో ఒక్కరే ఇంగ్లీష్ మాట్లాడతారు. కానీ ఇంజనీరింగ్ మాత్రం ఇంగ్లీష్‌లోనే నేర్పిస్తారు.', beat: { type: 'people', label: 'పది మందిలో ఒక్కరే ఇంగ్లీష్ మాట్లాడతారు', source: 'Census 2011 (10.6%)' } },
    { section: 'solution', say: 'క్యూబిరెక్స్ తెలుగులో, హిందీలో, లేదా విద్యార్థులు నిజంగా మాట్లాడే తెలుగు-ఇంగ్లీష్ మిక్స్‌లో నేర్పిస్తుంది.', beat: { type: 'solution', lines: ['మీ భాషలోనే నేర్చుకోండి.', 'ప్రతి స్కిల్‌ను నిరూపించండి.'] } },
    { section: 'product', say: 'ప్రొఫెసర్ క్యూబిరెక్స్ ప్రతి లైన్‌ను వివరిస్తారు. నిరూపించిన ప్రతి స్కిల్, సంతకంతో ఉన్న కేపబిలిటీ పాస్‌పోర్ట్‌లో చేరుతుంది.', beat: { type: 'device', shots: [{ key: 'walk', kicker: 'మీ భాషలో', title: 'ప్రతి లైన్ వివరంగా' }, { key: 'passport', kicker: 'కేపబిలిటీ పాస్‌పోర్ట్', title: 'ప్రతి స్కిల్‌కి సంతకం' }] } },
    { section: 'whynow', say: 'IT కంపెనీల్లో ఫ్రెషర్ల నియామకాలు మూడేళ్లలో ఎనభై శాతం తగ్గిపోయాయి.', beat: { type: 'falling', from: 6, to: 1.2, unit: 'లక్షలు', label: 'IT ఫ్రెషర్ నియామకాలు', fromLabel: 'FY22', toLabel: 'FY25', source: 'Xpheno, FY22–FY25' } },
    { section: 'whynow', say: 'జెన్సెన్ హువాంగ్ చెప్పినట్టు: మీ ఉద్యోగం AI కి పోదు, కానీ AI వాడే ఎవరికైనా పోతుంది.', beat: QUOTE },
    { section: 'whynow', say: 'AI ఒక రెసిపీ లాంటిది. వంట మాత్రం మీరే చేయాలి. ఆ వ్యక్తి మీరే ఎందుకు కాకూడదు?', beat: { type: 'recipe' } },
    { section: 'close', say: 'క్యూబిరెక్స్. మీ భాష. మీ స్కిల్స్. మీ భవిష్యత్తు.', beat: { type: 'close' } }
  ]
};
