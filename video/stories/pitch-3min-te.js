// Investor pitch, under 3 minutes (Telugu voice, Telugu on-screen text).
// DRAFT: this render reuses the earlier Telugu voice-over (173 s, over the
// 2:40 limit). Each line's `next` is the tightened script (≤ 2:40, ending on a
// complete sentence, with the new comparison line); it is voiced only after a
// native speaker checks it (brief §3).
import { facts } from '../lib/facts.mjs';
import { TE, sections, QUOTE_TE, COMPARE_TE, CLOSE_TE } from './te-common.mjs';
const f = facts('te');
const VOICE = new URL('../../artifacts/walkthrough/story/qubirex-pitch-3min-telugu', import.meta.url).pathname;
const dev = (key, kicker, title) => ({ key, kicker, title });

export default {
  name: 'pitch-3min-te', title: 'Investor pitch, under 3 minutes (Telugu)', lang: 'te',
  target: { lufs: -16, min: 90, max: 160 }, shots: 'te', strings: TE,
  voiceFrom: VOICE, voiceEngine: 'Gemini TTS gemini-3.8-flash-tts (te-IN, Kore)',
  pending: ['native-speaker check of the Telugu lines (⚠ quote line 16; "translating" line 19), then a new voice-over from the proposed tightened script (≤ 2:40)'],
  sections: sections(['problem', 'solution', 'brand', 'product', 'whynow', 'whyus', 'next', 'close']),
  lines: [
    { section: 'problem', say: 'ప్రియను ఊహించుకోండి. ఆంధ్రప్రదేశ్‌లోని ఒక చిన్న ఊరి నుంచి వచ్చిన తెలివైన విద్యార్థిని. లాజిక్ బాగా అర్థమవుతుంది, కానీ ప్రతి కోడింగ్ క్లాస్ ఇంగ్లీష్‌లోనే. ఆ భాషలో ఆమె ఆలోచించదు.', back: 'Imagine Priya. A bright student from a small town in Andhra Pradesh. She understands logic well, but every coding class is in English. She does not think in that language.', beat: { type: 'priya' },
      next: { say: 'ప్రియను ఊహించుకోండి. ఆంధ్రప్రదేశ్‌లోని ఒక చిన్న ఊరి విద్యార్థిని. లాజిక్ బాగా అర్థమవుతుంది, కానీ ప్రతి కోడింగ్ క్లాస్ ఇంగ్లీష్‌లోనే.', back: 'Imagine Priya. A student from a small town in Andhra Pradesh. She understands logic well, but every coding class is in English.' } },
    { section: 'problem', say: 'ఆమె ఒక్కతే కాదు. ప్రతి సంవత్సరం భారతదేశంలో దాదాపు ఒక కోటి పది లక్షల మంది గ్రాడ్యుయేట్లు బయటికి వస్తున్నారు.', back: 'She is not alone. Every year in India, about one crore ten lakh graduates come out.', beat: f.stat('graduates'),
      next: { say: 'ఆమె ఒక్కతే కాదు. ఏటా దాదాపు ఒక కోటి పది లక్షల మంది గ్రాడ్యుయేట్లు బయటికి వస్తున్నారు.', back: 'She is not alone. Every year, about one crore ten lakh graduates come out.' } },
    { section: 'problem', say: 'వాళ్లలో దాదాపు సగం మంది మాత్రమే ఉద్యోగానికి సిద్ధంగా ఉన్నారని అంచనా.', back: 'It is estimated that only about half of them are ready for a job.', beat: f.caps('jobReady'),
      next: { say: 'వాళ్లలో దాదాపు సగం మంది మాత్రమే ఉద్యోగానికి సిద్ధంగా ఉన్నారని అంచనా.', back: 'It is estimated that only about half of them are ready for a job.' } },
    { section: 'problem', say: 'గ్రాడ్యుయేట్లలో నిరుద్యోగం నాలుగు రెట్లు ఎక్కువ: పదమూడు శాతం. మొత్తం కార్మికుల్లో అది మూడు పాయింట్ రెండు శాతమే.', back: 'Among graduates, unemployment is four times higher: thirteen percent. Among all workers it is only three point two percent.', beat: f.bars('jobless'),
      next: { say: 'గ్రాడ్యుయేట్లలో నిరుద్యోగం నాలుగు రెట్లు ఎక్కువ: పదమూడు శాతం, మొత్తం కార్మికుల్లో మూడు పాయింట్ రెండు శాతం.', back: 'Among graduates, unemployment is four times higher: thirteen percent, against three point two percent among all workers.' } },
    { section: 'problem', say: 'భారతదేశంలో పది మందిలో ఒక్కరే ఇంగ్లీష్ మాట్లాడతారు. కానీ ఇంజనీరింగ్ మాత్రం ఇంగ్లీష్‌లోనే నేర్పిస్తారు.', back: 'In India, only one in ten people speaks English. But engineering is taught only in English.', beat: f.people('english'),
      next: { say: 'భారతదేశంలో పది మందిలో ఒక్కరే ఇంగ్లీష్ మాట్లాడతారు. కానీ ఇంజనీరింగ్ మాత్రం ఇంగ్లీష్‌లోనే నేర్పిస్తారు.', back: 'In India, only one in ten people speaks English. But engineering is taught only in English.' } },
    { section: 'problem', say: 'నలభై నాలుగు శాతం ఇంజనీరింగ్ విద్యార్థులు, తమ మాతృభాషలో నేర్చుకోవాలని ఉందని AICTE కి చెప్పారు.', back: 'Forty-four percent of engineering students told AICTE that they want to learn in their mother tongue.', beat: f.donut('motherTongue'),
      next: { say: 'నలభై నాలుగు శాతం ఇంజనీరింగ్ విద్యార్థులు, తమ మాతృభాషలో నేర్చుకోవాలని ఉందని AICTE కి చెప్పారు.', back: 'Forty-four percent of engineering students told AICTE that they want to learn in their mother tongue.' } },
    { section: 'solution', say: 'ప్రియ తన సొంత భాషలోనే నేర్చుకుని, నేర్చుకున్న ప్రతి స్కిల్‌ను నిరూపించగలిగితే?', back: 'What if Priya could learn in her own language, and prove every skill she learned?', beat: { type: 'solution', lines: ['మీ భాషలోనే నేర్చుకోండి.', 'ప్రతి స్కిల్‌ను నిరూపించండి.'] }, pad: 0.6,
      next: { say: 'ప్రియ తన సొంత భాషలోనే నేర్చుకుని, ప్రతి స్కిల్‌ను నిరూపించగలిగితే?', back: 'What if Priya could learn in her own language, and prove every skill?' } },
    { section: 'solution', say: 'ఇది అనువాదం చేసిన కోర్సు కాదు. ఆమె మాట్లాడినట్టే మాట్లాడే టీచర్: తెలుగు, హిందీ, లేదా రోజూ మాట్లాడే తెలుగు-ఇంగ్లీష్ మిక్స్.', back: 'This is not a translated course. A teacher who speaks the way she speaks: Telugu, Hindi, or the everyday Telugu-English mix.', beat: { type: 'mix' },
      next: { say: 'ఇది అనువాద కోర్సు కాదు. ఆమె మాట్లాడినట్టే మాట్లాడే టీచర్: తెలుగు, హిందీ, లేదా తెలుగు-ఇంగ్లీష్ మిక్స్.', back: 'This is not a translated course. A teacher who speaks the way she speaks: Telugu, Hindi, or the Telugu-English mix.' } },
    { section: 'brand', say: 'అదే క్యూబిరెక్స్.', back: 'That is Qubirex.', beat: { type: 'logo' }, pad: 1.0,
      next: { say: 'అదే క్యూబిరెక్స్.', back: 'That is Qubirex.' } },
    { section: 'product', say: 'ప్రొఫెసర్ క్యూబిరెక్స్ ప్రతి కాన్సెప్ట్‌ను వివరిస్తారు, కోడ్‌ను లైన్ బై లైన్ చూపిస్తారు, ఆమె ప్రశ్నలకు సమాధానం ఇస్తారు.', back: 'Professor Qubirex explains every concept, shows the code line by line, and answers her questions.', beat: { type: 'device', shots: [dev('walk', 'మీ భాషలో', 'ప్రతి లైన్ వివరంగా')] },
      next: { say: 'ప్రొఫెసర్ క్యూబిరెక్స్ ప్రతి కాన్సెప్ట్‌ను వివరిస్తారు, కోడ్‌ను లైన్ బై లైన్ చూపిస్తారు.', back: 'Professor Qubirex explains every concept and shows the code line by line.' } },
    { section: 'product', say: 'ఆమె నిజమైన టెస్టులతో కోడ్ ప్రాక్టీస్ చేస్తుంది. తనంతట తానే చేయగలదని ఒక కొత్త చెక్ నిర్ధారిస్తుంది.', back: 'She practises code with real tests. A fresh check confirms that she can do it on her own.', beat: { type: 'device', shots: [dev('practise', 'ప్రాక్టీస్', 'నిజమైన కోడ్, నిజమైన టెస్టులు')] },
      next: { say: 'ఆమె నిజమైన టెస్టులతో కోడ్ ప్రాక్టీస్ చేస్తుంది. తనంతట తానే చేయగలదని ఒక కొత్త చెక్ నిర్ధారిస్తుంది.', back: 'She practises code with real tests. A fresh check confirms that she can do it on her own.' } },
    { section: 'product', say: 'ఆమె నిరూపించిన ప్రతి స్కిల్, సంతకంతో ఉన్న కేపబిలిటీ పాస్‌పోర్ట్‌లో చేరుతుంది. దాన్ని ఎవరైనా ఆన్‌లైన్‌లో వెరిఫై చేయొచ్చు.', back: 'Every skill she proves goes into the signed Capability Passport. Anyone can verify it online.', beat: { type: 'device', shots: [dev('passport', 'కేపబిలిటీ పాస్‌పోర్ట్', 'ప్రతి స్కిల్‌కి సంతకం'), dev('verify', 'వెరిఫై', 'ఎవరైనా ఆన్‌లైన్‌లో చెక్ చేయొచ్చు')] },
      next: { say: 'ఆమె నిరూపించిన ప్రతి స్కిల్, సంతకంతో ఉన్న కేపబిలిటీ పాస్‌పోర్ట్‌లో చేరుతుంది. దాన్ని ఎవరైనా ఆన్‌లైన్‌లో వెరిఫై చేయొచ్చు.', back: 'Every skill she proves goes into the signed Capability Passport. Anyone can verify it online.' } },
    { section: 'product', say: 'ఎవరు సిద్ధంగా ఉన్నారో, ఎవరికి సహాయం కావాలో కాలేజీలకు కనిపిస్తుంది. కంపెనీలు రుజువు చూసి ఉద్యోగం ఇస్తాయి.', back: 'Colleges can see who is ready and who needs help. Companies hire after seeing the proof.', beat: { type: 'device', shots: [dev('college', 'కాలేజీలు', 'ఎవరు సిద్ధమో చూడండి'), dev('employer', 'కంపెనీలు', 'రుజువు చూసి ఉద్యోగం')] }, pad: 0.8,
      next: { say: 'ఎవరు సిద్ధంగా ఉన్నారో, ఎవరికి సహాయం కావాలో కాలేజీలకు కనిపిస్తుంది. కంపెనీలు రుజువు చూసి ఉద్యోగం ఇస్తాయి.', back: 'Colleges can see who is ready and who needs help. Companies hire after seeing the proof.' } },
    { section: 'product', say: 'నేర్చుకోవడం, ప్రాక్టీస్, నిరూపించడం, కంపెనీలకు కనిపించడం. ఏ నుంచి జెడ్ వరకు, అన్నీ ఒకే చోట.', back: 'Learning, practice, proving, and being seen by companies. From A to Z, all in one place.', beat: { type: 'journey', steps: ['నేర్చుకో', 'ప్రాక్టీస్', 'నిరూపించు', 'ఉద్యోగం'] }, pad: 1.2,
      next: { say: 'నేర్చుకోవడం నుంచి ఉద్యోగం వరకు, అన్నీ ఒకే చోట.', back: 'From learning to a job, all in one place.' } },
    { section: 'whynow', say: 'ఇప్పుడే ఎందుకు? ఎందుకంటే IT కంపెనీల్లో ఫ్రెషర్ల నియామకాలు మూడేళ్లలో ఎనభై శాతం తగ్గాయి. ఆరు లక్షల నుంచి ఒక లక్ష ఇరవై వేలకు.', back: 'Why now? Because fresher hiring in IT companies fell eighty percent in three years. From six lakh to one lakh twenty thousand.', beat: f.falling('fresherHiring'), pad: 0.6,
      next: { say: 'ఇప్పుడే ఎందుకు? IT కంపెనీల్లో ఫ్రెషర్ల నియామకాలు మూడేళ్లలో ఎనభై శాతం తగ్గాయి.', back: 'Why now? Fresher hiring in IT companies fell eighty percent in three years.' } },
    { section: 'whynow', say: 'ఇప్పుడు డిగ్రీ ఒక్కటే సరిపోదు. జెన్సెన్ హువాంగ్ చెప్పినట్టు: మీ ఉద్యోగం AI కి పోదు, కానీ AI వాడే ఎవరికైనా పోతుంది.', back: '⚠ A degree alone is no longer enough. As Jensen Huang said: your job will not go to AI, but it will go to anyone who uses AI. (Check: the second half should mean "to someone who uses AI".)', beat: f.quote(QUOTE_TE),
      next: { say: 'జెన్సెన్ హువాంగ్ చెప్పినట్టు: మీ ఉద్యోగం AI కి పోదు, కానీ AI వాడే ఎవరికైనా పోతుంది.', back: '⚠ As Jensen Huang said: your job will not go to AI, but it will go to anyone who uses AI.' } },
    { section: 'whynow', say: 'AI ఒక రెసిపీ లాంటిది. స్టెప్స్ అది ఇస్తుంది, కానీ వంట మాత్రం మీరే చేయాలి. AI కోడ్ రాస్తుంది, కానీ దాన్ని ఎవరో ఒకరు చెక్ చేయాలి. ఆ ఒకరు మీరే ఎందుకు కాకూడదు?', back: 'AI is like a recipe. It gives the steps, but the cooking you must do yourself. AI writes code, but someone must check it. Why shouldn’t that someone be you?', beat: { type: 'recipe' }, pad: 1.0,
      next: { say: 'AI ఒక రెసిపీ లాంటిది. వంట మాత్రం మీరే చేయాలి. AI కోడ్ రాస్తుంది, కానీ ఎవరో ఒకరు చెక్ చేయాలి. ఆ ఒకరు మీరే ఎందుకు కాకూడదు?', back: 'AI is like a recipe. The cooking, you must do yourself. AI writes code, but someone must check it. Why shouldn’t that someone be you?' } },
    { section: 'whynow', say: 'అంతేకాదు, భారతదేశంలో తొంభై ఎనిమిది శాతం ఇంటర్నెట్ యూజర్లు ఇప్పటికే భారతీయ భాషల కంటెంట్ వాడుతున్నారు.', back: 'What is more, ninety-eight percent of India’s internet users already use Indian-language content.', beat: f.stat('indicContent'),
      next: { say: 'భారతదేశంలో తొంభై ఎనిమిది శాతం ఇంటర్నెట్ యూజర్లు భారతీయ భాషల కంటెంట్ వాడుతున్నారు.', back: 'Ninety-eight percent of India’s internet users use Indian-language content.' } },
    { section: 'whyus', say: 'పెద్ద ప్లాట్‌ఫామ్‌లు తమ కోర్సులను అనువదిస్తున్నాయి. కానీ అనువాదం ఒక్కటే సరిపోదు.', back: '⚠ Big platforms are translating their courses. But translation alone is not enough. (Check: "అనువదిస్తున్నాయి" must mean translating, not testing.)', beat: COMPARE_TE, pad: 1.5,
      next: { say: 'ఇతర ప్లాట్‌ఫామ్‌లు కూడా కోడింగ్ నేర్పిస్తున్నాయి, కొన్ని భారతీయ భాషల్లో కూడా. క్యూబిరెక్స్ మూడు విషయాల్లో వేరు.', back: 'Other platforms also teach coding, some in Indian languages too. Qubirex is different in three ways.' } },
    { section: 'whyus', say: 'క్యూబిరెక్స్ స్కిల్స్‌కి రుజువు ఇస్తుంది. నేర్చుకోవడం నుంచి ఉద్యోగం వరకు ఒకే ప్రయాణం. కాలేజీల కోసం ప్రత్యేక టూల్స్.', back: 'Qubirex gives proof of skills. One journey from learning to a job. Special tools for colleges.', beat: { type: 'pillars', items: ['స్కిల్స్‌కి రుజువు', 'A నుంచి Z వరకు, ఒకే ప్రయాణం', 'కాలేజీల కోసం టూల్స్'] },
      next: { say: 'క్యూబిరెక్స్ స్కిల్స్‌కి రుజువు ఇస్తుంది. నేర్చుకోవడం నుంచి ఉద్యోగం వరకు ఒకే ప్రయాణం. కాలేజీల కోసం ప్రత్యేక టూల్స్.', back: 'Qubirex gives proof of skills. One journey from learning to a job. Special tools for colleges.' } },
    { section: 'next', say: 'తర్వాత, ఒక పార్ట్‌నర్ కాలేజీతో పైలట్. ఎంత మంది విద్యార్థులకు అదనంగా ఉద్యోగాలు వస్తాయో కచ్చితంగా కొలవడానికి.', back: 'Next, a pilot with one partner college, to measure exactly how many more students get jobs.', beat: { type: 'pilot', steps: ['ఒక కాలేజీ, 100 మంది విద్యార్థులు', 'మొదట స్కిల్స్ చెక్', 'Qubirex తో ఒక సెమిస్టర్', 'ఆరు నెలల తర్వాత ప్లేస్‌మెంట్లు'] }, pad: 1.2,
      next: { say: 'తర్వాత, ఒక పార్ట్‌నర్ కాలేజీతో పైలట్. ఎంత మంది విద్యార్థులకు అదనంగా ఉద్యోగాలు వస్తాయో కచ్చితంగా కొలవడానికి.', back: 'Next, a pilot with one partner college, to measure exactly how many more students get jobs.' } },
    { section: 'close', say: 'క్యూబిరెక్స్. మీ భాష. మీ స్కిల్స్. మీ భవిష్యత్తు.', back: 'Qubirex. Your language. Your skills. Your future.', beat: CLOSE_TE,
      next: { say: 'క్యూబిరెక్స్‌తో మీ భాషలో నేర్చుకోండి, మీ స్కిల్స్ నిరూపించండి, మీ భవిష్యత్తును నిర్మించుకోండి.', back: 'With Qubirex, learn in your language, prove your skills, and build your future.' } }
  ]
};
