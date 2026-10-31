// core/language/style.js — the two ways a learner can read Telugu or Hindi.
//
//   telugu / hindi        Full Telugu (or Hindi) sentences in Telugu (or
//                         Devanagari) script. English stays only for code:
//                         keywords, names from the code (def, return, marks).
//   telugu_en / hindi_en  Natural Hyderabad-style spoken mix: Telugu (or
//                         Hindi) sentences that keep common English technical
//                         words as they are — "ఈ function ఒక value ని return
//                         చేస్తుంది — అంటే result ని బయటకు పంపిస్తుంది".
//
// Course lessons and the scripted tutor are written in the mix style (that is
// how they were reviewed), so the full-language mode is made from them with
// native(): every English word that is not code becomes its Telugu / Hindi
// word, or the same word in Telugu / Devanagari script. AI prompts get
// styleLine(mode) so a live model writes in the chosen style from the start.
import { currentLearningMode } from '../requestContext.js';

export const MIX = new Set(['telugu_en', 'hindi_en']);
const CODE_OF = { telugu: 'te', hindi: 'hi', telugu_en: 'te', hindi_en: 'hi' };

/** One line for an AI system prompt, or '' when the mode needs none. */
export function styleLine(mode) {
  switch (mode) {
    case 'telugu': return 'Language style: full Telugu sentences in Telugu script. Use English (Latin letters) only for code, code keywords and names that appear in the code (def, return, print, marks). Write every other technical word in Telugu — translated (విలువ, సంఖ్య, జాబితా) or in Telugu script (ఫంక్షన్, లూప్, వేరియబుల్).';
    case 'hindi': return 'Language style: full Hindi sentences in Devanagari. Use English (Latin letters) only for code, code keywords and names that appear in the code (def, return, print, marks). Write every other technical word in Hindi — translated (नाम, संख्या, सूची) or in Devanagari (फ़ंक्शन, लूप, वेरिएबल).';
    case 'telugu_en': return 'Language style: natural Hyderabad spoken Telugu + English mix. Telugu sentence structure, with common English technical words kept as they are in Latin letters, e.g. "ఈ function ఒక value ని return చేస్తుంది — అంటే result ని బయటకు పంపిస్తుంది".';
    case 'hindi_en': return 'Language style: natural spoken Hindi + English mix (Hinglish as students speak it). Hindi sentence structure, with common English technical words kept as they are in Latin letters, e.g. "यह function एक value को return करता है — मतलब result को बाहर भेजता है".';
    default: return '';
  }
}

/** True when text for this language should be made full Telugu / Hindi (the current learner chose the full mode). */
export function wantsNative(lang, mode = currentLearningMode()) {
  const main = String(lang || '').replace(/_en$/, '');
  return (mode === 'telugu' || mode === 'hindi') && main === mode;
}

// English word (lower case) → [Telugu, Hindi]. Concept words and everyday
// nouns from the lessons; code keywords are never listed. Telugu translates
// where a Telugu word is in common use and otherwise writes the English word
// in Telugu script; Hindi mostly writes it in Devanagari, which keeps the
// gender the sentence already uses.
const WORDS = {
  value: ['విలువ', 'वैल्यू'], values: ['విలువలు', 'वैल्यूज़'],
  number: ['సంఖ్య', 'नंबर'], numbers: ['సంఖ్యలు', 'नंबर'],
  name: ['పేరు', 'नाम'], names: ['పేర్లు', 'नाम'],
  marks: ['మార్కులు', 'अंक'], mark: ['మార్కు', 'अंक'],
  total: ['మొత్తం', 'टोटल'], amount: ['మొత్తం', 'राशि'],
  line: ['లైన్', 'लाइन'], lines: ['లైన్లు', 'लाइनें'],
  text: ['టెక్స్ట్', 'टेक्स्ट'], word: ['పదం', 'शब्द'], words: ['పదాలు', 'शब्द'],
  item: ['వస్తువు', 'आइटम'], items: ['వస్తువులు', 'आइटम'],
  loop: ['లూప్', 'लूप'], loops: ['లూప్‌లు', 'लूप'],
  function: ['ఫంక్షన్', 'फ़ंक्शन'], functions: ['ఫంక్షన్లు', 'फ़ंक्शन'],
  method: ['మెథడ్', 'मेथड'], methods: ['మెథడ్‌లు', 'मेथड'],
  variable: ['వేరియబుల్', 'वेरिएबल'], variables: ['వేరియబుల్స్', 'वेरिएबल'],
  object: ['ఆబ్జెక్ట్', 'ऑब्जेक्ट'], objects: ['ఆబ్జెక్ట్‌లు', 'ऑब्जेक्ट'],
  type: ['రకం', 'टाइप'], types: ['రకాలు', 'टाइप'],
  data: ['డేటా', 'डेटा'], file: ['ఫైల్', 'फ़ाइल'], files: ['ఫైళ్లు', 'फ़ाइलें'],
  code: ['కోడ్', 'कोड'], program: ['ప్రోగ్రామ్', 'प्रोग्राम'], programs: ['ప్రోగ్రామ్‌లు', 'प्रोग्राम'],
  app: ['యాప్', 'ऐप'], array: ['అర్రే', 'ऐरे'], arrays: ['అర్రేలు', 'ऐरे'],
  call: ['కాల్', 'कॉल'], case: ['సందర్భం', 'केस'], cases: ['సందర్భాలు', 'केस'],
  test: ['పరీక్ష', 'टेस्ट'], tests: ['పరీక్షలు', 'टेस्ट'],
  key: ['కీ', 'की'], keys: ['కీలు', 'कीज़'],
  parent: ['పేరెంట్', 'पैरेंट'], child: ['చైల్డ్', 'चाइल्ड'],
  parameter: ['పారామీటర్', 'पैरामीटर'], parameters: ['పారామీటర్లు', 'पैरामीटर'],
  argument: ['ఆర్గ్యుమెంట్', 'आर्ग्युमेंट'], arguments: ['ఆర్గ్యుమెంట్లు', 'आर्ग्युमेंट'],
  error: ['పొరపాటు', 'एरर'], errors: ['పొరపాట్లు', 'एरर'],
  condition: ['షరతు', 'शर्त'], conditions: ['షరతులు', 'शर्तें'],
  step: ['దశ', 'स्टेप'], steps: ['దశలు', 'स्टेप'],
  bill: ['బిల్లు', 'बिल'], price: ['ధర', 'क़ीमत'], prices: ['ధరలు', 'क़ीमतें'],
  field: ['ఫీల్డ్', 'फ़ील्ड'], fields: ['ఫీల్డ్‌లు', 'फ़ील्ड'],
  count: ['లెక్క', 'गिनती'], index: ['స్థానం', 'इंडेक्स'],
  phone: ['ఫోన్', 'फ़ोन'], menu: ['మెనూ', 'मेन्यू'], order: ['ఆర్డర్', 'ऑर्डर'], orders: ['ఆర్డర్లు', 'ऑर्डर'],
  screen: ['స్క్రీన్', 'स्क्रीन'], book: ['పుస్తకం', 'किताब'], books: ['పుస్తకాలు', 'किताबें'],
  student: ['విద్యార్థి', 'छात्र'], students: ['విద్యార్థులు', 'छात्र'],
  row: ['వరుస', 'पंक्ति'], rows: ['వరుసలు', 'पंक्तियाँ'], column: ['నిలువు వరుస', 'कॉलम'], columns: ['నిలువు వరుసలు', 'कॉलम'],
  list: ['జాబితా', 'लिस्ट'], lists: ['జాబితాలు', 'लिस्टें'],
  string: ['స్ట్రింగ్', 'स्ट्रिंग'], strings: ['స్ట్రింగ్‌లు', 'स्ट्रिंग'],
  brackets: ['బ్రాకెట్లు', 'ब्रैकेट'], quotes: ['కొటేషన్లు', 'कोटेशन'], spaces: ['ఖాళీలు', 'स्पेस'], space: ['ఖాళీ', 'स्पेस'],
  title: ['శీర్షిక', 'शीर्षक'], form: ['ఫారం', 'फ़ॉर्म'], box: ['పెట్టె', 'बॉक्स'], card: ['కార్డు', 'कार्ड'],
  table: ['పట్టిక', 'टेबल'], tables: ['పట్టికలు', 'टेबल'], button: ['బటన్', 'बटन'], page: ['పేజీ', 'पेज'], pages: ['పేజీలు', 'पेज'],
  room: ['గది', 'कमरा'], seat: ['సీటు', 'सीट'], seats: ['సీట్లు', 'सीटें'], ticket: ['టికెట్', 'टिकट'], tickets: ['టికెట్లు', 'टिकट'],
  year: ['సంవత్సరం', 'साल'], months: ['నెలలు', 'महीने'], age: ['వయసు', 'उम्र'], salary: ['జీతం', 'सैलरी'],
  shop: ['దుకాణం', 'दुकान'], city: ['నగరం', 'शहर'], exam: ['పరీక్ష', 'परीक्षा'], subject: ['సబ్జెక్టు', 'विषय'],
  result: ['ఫలితం', 'नतीजा'], results: ['ఫలితాలు', 'नतीजे'], average: ['సగటు', 'औसत'], zero: ['సున్నా', 'शून्य'],
  output: ['అవుట్‌పుట్', 'आउटपुट'], message: ['సందేశం', 'संदेश'], user: ['యూజర్', 'यूज़र'], customer: ['కస్టమర్', 'ग्राहक'],
  computer: ['కంప్యూటర్', 'कंप्यूटर'], library: ['లైబ్రరీ', 'लाइब्रेरी'], module: ['మాడ్యూల్', 'मॉड्यूल'], modules: ['మాడ్యూల్‌లు', 'मॉड्यूल'],
  package: ['ప్యాకేజీ', 'पैकेज'], packages: ['ప్యాకేజీలు', 'पैकेज'], version: ['వెర్షన్', 'वर्ज़न'],
  constructor: ['కన్‌స్ట్రక్టర్', 'कंस्ट्रक्टर'], recursion: ['రికర్షన్', 'रिकर्शन'], inheritance: ['ఇన్హెరిటెన్స్', 'इनहेरिटेंस'],
  polymorphism: ['పాలిమార్ఫిజం', 'पॉलीमॉर्फ़िज़्म'], overloading: ['ఓవర్‌లోడింగ్', 'ओवरलोडिंग'], scope: ['పరిధి', 'स्कोप'],
  dictionary: ['డిక్షనరీ', 'डिक्शनरी'], decimal: ['దశాంశం', 'दशमलव'], decimals: ['దశాంశాలు', 'दशमलव'],
  block: ['బ్లాక్', 'ब्लॉक'], operators: ['ఆపరేటర్లు', 'ऑपरेटर'], operator: ['ఆపరేటర్', 'ऑपरेटर'],
  example: ['ఉదాహరణ', 'उदाहरण'], examples: ['ఉదాహరణలు', 'उदाहरण'], answer: ['జవాబు', 'जवाब'], question: ['ప్రశ్న', 'सवाल'],
  rule: ['నియమం', 'नियम'], rules: ['నియమాలు', 'नियम'], idea: ['ఆలోచన', 'विचार'], problem: ['సమస్య', 'समस्या'],
  team: ['జట్టు', 'टीम'], score: ['స్కోరు', 'स्कोर'], percent: ['శాతం', 'प्रतिशत'], balance: ['బ్యాలెన్స్', 'बैलेंस'],
  payment: ['చెల్లింపు', 'भुगतान'], employee: ['ఉద్యోగి', 'कर्मचारी'], manager: ['మేనేజర్', 'मैनेजर'], bonus: ['బోనస్', 'बोनस'],
  fee: ['ఫీజు', 'फ़ीस'], fare: ['ఛార్జీ', 'किराया'], vehicle: ['వాహనం', 'वाहन'], bus: ['బస్సు', 'बस'],
  tea: ['టీ', 'चाय'], cricket: ['క్రికెట్', 'क्रिकेट'], college: ['కాలేజీ', 'कॉलेज'], report: ['నివేదిక', 'रिपोर्ट'],
  terminal: ['టెర్మినల్', 'टर्मिनल'], server: ['సర్వర్', 'सर्वर'], request: ['అభ్యర్థన', 'रिक्वेस्ट'], event: ['ఈవెంట్', 'इवेंट'],
  component: ['కాంపోనెంట్', 'कंपोनेंट'], state: ['స్టేట్', 'स्टेट'], property: ['ప్రాపర్టీ', 'प्रॉपर्टी'], interface: ['ఇంటర్‌ఫేస్', 'इंटरफ़ेस'],
  exception: ['ఎక్సెప్షన్', 'एक्सेप्शन'], colon: ['కోలన్', 'कोलन'], design: ['డిజైన్', 'डिज़ाइन'], layout: ['లేఅవుట్', 'लेआउट'],
  statement: ['స్టేట్‌మెంట్', 'स्टेटमेंट'], statements: ['స్టేట్‌మెంట్‌లు', 'स्टेटमेंट'],
  database: ['డేటాబేస్', 'डेटाबेस'], chart: ['చార్ట్', 'चार्ट'], reservation: ['రిజర్వేషన్', 'रिज़र्वेशन'], status: ['స్థితి', 'स्टेटस'],
  query: ['క్వెరీ', 'क्वेरी'], queries: ['క్వెరీలు', 'क्वेरी'], train: ['రైలు', 'ट्रेन'], date: ['తేదీ', 'तारीख़'],
  skill: ['నైపుణ్యం', 'कौशल'], project: ['ప్రాజెక్ట్', 'प्रोजेक्ट'], context: ['సందర్భం', 'संदर्भ'], size: ['పరిమాణం', 'साइज़']
};

// Telugu case endings written after an English word in the mix ("value ని").
const TE_JOIN = /\u0001([^\u0002]+)\u0002 (ని|ను|లో|కి|కు|తో|గా|పై|ల|లను|లకు|లలో)(?![ఀ-౿])/g;
const SCRIPT = { te: /[ఀ-౿]/, hi: /[ऀ-ॿ]/ };

function joinTelugu(word, suffix) {
  // మార్కులు + లో → మార్కులలో, + ని → మార్కులను; ఫంక్షన్ + ని → ఫంక్షన్‌ని
  if (/లు$/.test(word) && /^(లో|ని|ను|కి|కు|తో)$/.test(suffix)) return word.replace(/ు$/, '') + (suffix === 'ని' ? 'ను' : suffix);
  if (/్$/.test(word)) return `${word}‌${suffix}`;
  return word + suffix;
}

/**
 * The full Telugu / Hindi form of a mix-style text.
 * @param {string} text
 * @param {'te'|'hi'} code
 * @param {Set<string>} [keep] names from the code that stay in English
 */
export function native(text, code, keep = new Set()) {
  if (typeof text !== 'string' || !SCRIPT[code]?.test(text)) return text;
  const k = code === 'te' ? 0 : 1;
  // Code in backticks stays exactly as it is.
  return text.split(/(`[^`]*`)/).map((seg) => {
    if (seg.startsWith('`')) return seg;
    let out = seg.replace(/(?<![\w.(`'"/-])([A-Za-z][a-z]+)(?![\w(`'"/=-]|\.\w)/g, (m, w, off, all) => {
      if (keep.has(w)) return m;
      const say = WORDS[w.toLowerCase()];
      if (!say) return m;
      return `\u0001${say[k]}\u0002`;
    });
    if (code === 'te') out = out.replace(TE_JOIN, (m, w, suffix) => `\u0001${joinTelugu(w, suffix)}\u0002`);
    return out.replace(/[\u0001\u0002]/g, '');
  }).join('');
}

/** native() over every string inside a JSON-like value. */
export function nativeDeep(value, code, keep) {
  if (typeof value === 'string') return native(value, code, keep);
  if (Array.isArray(value)) return value.map(v => nativeDeep(v, code, keep));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, v]) => [key, nativeDeep(v, code, keep)]));
  return value;
}

export const codeOf = (mode) => CODE_OF[mode] || null;

/** Identifiers in a piece of code (they stay in English in the full mode). */
export function namesIn(...sources) {
  const out = new Set();
  sources.forEach(s => String(s || '')
    .replace(/("|')(?:\\.|(?!\1).)*\1/g, ' ') // string literals
    .replace(/(#|\/\/).*$/gm, ' ') // comments
    .replace(/[A-Za-z_]\w*/g, (m) => { out.add(m); return m; }));
  return out;
}
