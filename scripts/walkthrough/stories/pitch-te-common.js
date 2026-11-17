// On-screen Telugu for the Telugu pitch videos. Names, sources and the
// Jensen Huang quote stay exactly as published (in English).
export const SECTIONS_TE = {
  problem: 'సమస్య', solution: 'పరిష్కారం', product: 'మా ప్రోడక్ట్', whynow: 'ఇప్పుడే ఎందుకు?', whyus: 'Qubirex ఎందుకు?', next: 'తర్వాత ఏమిటి?'
};
export const STRINGS_TE = {
  source: 'ఆధారం:',
  oneInTen: '10 లో 1',
  yetEnglish: 'కానీ ఇంజనీరింగ్ ఇంగ్లీష్‌లోనే.',
  ai: 'AI', recipe: 'రెసిపీ ఇస్తుంది', you: 'మీరు', cook: 'వంట మీదే',
  aiWrites: 'AI కోడ్ రాస్తుంది', youCheck: 'చెక్ మీదే', bug: 'తప్పు: + ఉండాలి',
  why: 'ఆ వ్యక్తి మీరే ఎందుకు కాకూడదు?',
  priya: 'ప్రియ', town: 'చిన్న ఊరు · ఆంధ్రప్రదేశ్',
  translated: 'అనువాద కోర్సు', teacher: 'మీలా మాట్లాడే టీచర్',
  profLabel: 'PROFESSOR QUBIREX · తెలుగు + ENGLISH', profMeaning: '',
  sample: 'శాంపిల్ డేటా',
  aToZ: 'A నుంచి Z వరకు, ఒకే చోట',
  compareThem: 'అనువాద కోర్సులు', compareUs: 'Qubirex',
  compareRows: [
    ['భాష', 'అనువాదం లేదా డబ్బింగ్', 'తెలుగు, హిందీ లేదా తెలుగు-ఇంగ్లీష్ మిక్స్‌లో బోధన'],
    ['రుజువు', 'కోర్సు పూర్తయిన సర్టిఫికెట్', 'సంతకంతో కేపబిలిటీ పాస్‌పోర్ట్'],
    ['కాలేజీలు', 'సీట్ లైసెన్సులు', 'ప్రతి బ్యాచ్ రెడీనెస్'],
    ['ఉద్యోగాలు', 'వేరే వెబ్‌సైట్‌లో', 'కంపెనీలు రుజువును నేరుగా చూస్తాయి']
  ],
  pilot: 'ఫలితాన్ని కొలిచే పైలట్',
  tagline: ['మీ భాష.', 'మీ స్కిల్స్.', 'మీ భవిష్యత్తు.']
};
export const sections = (ids) => [
  ...ids.map((id, i) => ({ id, n: String(i + 1).padStart(2, '0'), title: SECTIONS_TE[id], theme: { solution: 'warm', product: 'light', next: 'light' }[id] || 'dark' })),
  { id: 'close', theme: 'close' }
];
export const QUOTE = { type: 'quote', text: "You're not going to lose your job to an AI, but you're going to lose your job to someone who uses AI.", who: 'Jensen Huang, CEO, Nvidia', source: 'Milken Institute, May 2025' };
