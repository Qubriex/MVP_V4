// On-screen Telugu for the Telugu videos (brief §2.1): every title, label,
// caption and end line in Telugu; tech words (AI, code, function, return,
// Python) and the brand stay in English letters. Lines marked ⚠ in the
// scripts wait for a native-speaker check.
export const TE = {
  source: 'ఆధారం:',
  yetEnglish: 'కానీ ఇంజనీరింగ్ ఇంగ్లీష్‌లోనే.',
  ai: 'AI', recipe: 'రెసిపీ ఇస్తుంది', you: 'మీరు', cook: 'వంట మీదే',
  aiWrites: 'AI కోడ్ రాస్తుంది', youCheck: 'చెక్ మీదే', bug: 'తప్పు: + ఉండాలి',
  why: 'ఆ వ్యక్తి మీరే ఎందుకు కాకూడదు?',
  priya: 'ప్రియ', town: 'చిన్న ఊరు · ఆంధ్రప్రదేశ్', illustrative: 'ఉదాహరణ కథ',
  translated: 'అనువాద కోర్సు', teacher: 'మీలా మాట్లాడే టీచర్',
  profLabel: 'PROFESSOR QUBIREX · తెలుగు + ENGLISH', profMeaning: '',
  sample: 'శాంపిల్ డేటా',
  aToZ: 'A నుంచి Z వరకు, ఒకే చోట',
  pilot: 'ఫలితాన్ని కొలిచే పైలట్',
  tagline: ['మీ భాష.', 'మీ స్కిల్స్.', 'మీ భవిష్యత్తు.']
};
export const TITLES = { problem: 'సమస్య', solution: 'పరిష్కారం', product: 'మా ప్రోడక్ట్', whynow: 'ఇప్పుడే ఎందుకు?', whyus: 'Qubirex ఎందుకు?', next: 'తర్వాత ఏమిటి?' };
export const sections = (ids) => ids.map((id) => (TITLES[id] ? { id, n: null, title: TITLES[id] } : { id })).map((s, i, all) => ({ ...s, n: s.title ? String(all.slice(0, i + 1).filter(x => x.title).length).padStart(2, '0') : undefined, theme: { solution: 'warm', product: 'light', next: 'light', brand: 'light', close: 'close' }[s.id] || 'dark' }));
// ⚠ The quote in Telugu: its second half must mean "to someone who uses AI".
export const QUOTE_TE = 'మీ ఉద్యోగం AI కి పోదు, కానీ AI వాడే ఎవరికైనా పోతుంది.';
export const COMPARE_TE = { type: 'compare', them: 'ఇతర ప్లాట్‌ఫామ్‌లు', us: 'Qubirex', rows: [['రుజువు', 'కోర్సు పూర్తయిన సర్టిఫికెట్', 'ఫ్రెష్ చెక్ తర్వాత, సంతకంతో కేపబిలిటీ పాస్‌పోర్ట్'], ['కాలేజీల కోసం', 'విద్యార్థులకు కోర్సులు', 'ప్రతి బ్యాచ్‌కి రెడీనెస్ టూల్స్'], ['ఎవరు చెల్లిస్తారు', 'సాధారణంగా విద్యార్థి', '[FILL: who pays]']] };
export const CLOSE_TE = { type: 'close', action: 'మాతో మాట్లాడండి' };
