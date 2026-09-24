// src/context/UiLangContext.js
// Interface language for the learner side: telugu | hindi | english. Chosen
// on the login page, changeable in Profile → Learning & voice, and saved to
// the learner's profile (ui_language) once signed in. This only changes the
// app's labels; the TEACHING language is set by the institution per
// engagement and never changes here.
//
// Strings cover navigation, headings and the voice-session controls — the
// parts a learner has to read to find their way. Long-form copy (JD text,
// topic descriptions) stays in English until it is authored per language.
import React, { createContext, useContext, useState, useCallback } from 'react';

const STORAGE_KEY = 'qubirex_ui_lang';
export const UI_LANGS = [
  { id: 'telugu', label: 'తెలుగు', bcp47: 'te-IN' },
  { id: 'hindi', label: 'हिंदी', bcp47: 'hi-IN' },
  { id: 'english', label: 'English', bcp47: 'en-IN' }
];

const STRINGS = {
  greet:            { telugu: 'నమస్కారం', hindi: 'नमस्ते', english: 'Hello' },
  'nav.learn':      { telugu: 'నేర్చుకోండి', hindi: 'सीखें', english: 'Learn' },
  'nav.home':       { telugu: 'హోమ్', hindi: 'होम', english: 'Home' },
  'nav.session':    { telugu: 'వాయిస్ సెషన్', hindi: 'वॉइस सेशन', english: 'Voice session' },
  'nav.path':       { telugu: 'నైపుణ్య మార్గం & రికార్డ్', hindi: 'स्किल पाथ और रिकॉर्ड', english: 'Skill path & record' },
  'nav.career':     { telugu: 'కెరీర్', hindi: 'करियर', english: 'Career' },
  'nav.market':     { telugu: 'ఉద్యోగ మార్కెట్', hindi: 'जॉब मार्केट', english: 'Job market' },
  'nav.topics':     { telugu: 'కొత్త అంశాలు', hindi: 'उभरते विषय', english: 'Emerging topics' },
  'nav.me':         { telugu: 'నేను', hindi: 'मैं', english: 'Me' },
  'nav.profile':    { telugu: 'ప్రొఫైల్', hindi: 'प्रोफ़ाइल', english: 'Profile' },
  'nav.resume':     { telugu: 'రెజ్యూమ్ బిల్డర్', hindi: 'रिज़्यूमे बिल्डर', english: 'Resume builder' },
  'nav.settings':   { telugu: 'సెట్టింగ్స్', hindi: 'सेटिंग्स', english: 'Settings' },
  'nav.logout':     { telugu: 'లాగ్ అవుట్', hindi: 'लॉग आउट', english: 'Log out' },
  'nav.menu':       { telugu: 'మెనూ', hindi: 'मेन्यू', english: 'Menu' },

  'dash.continue':  { telugu: 'నేర్చుకోవడం కొనసాగించండి', hindi: 'सीखना जारी रखें', english: 'Continue learning' },
  'dash.startVoice':{ telugu: 'వాయిస్ సెషన్ మొదలుపెట్టండి', hindi: 'वॉइस सेशन शुरू करें', english: 'Start voice session' },
  'dash.typeInstead':{ telugu: 'టైప్ చేయండి', hindi: 'टाइप करें', english: 'Type instead' },
  'dash.progress':  { telugu: 'మొత్తం పురోగతి', hindi: 'कुल प्रगति', english: 'Overall progress' },
  'dash.jobs':      { telugu: 'మీ నైపుణ్యాలకు సరిపోయే ఉద్యోగాలు', hindi: 'आपके कौशल से मेल खाती नौकरियाँ', english: 'Jobs that fit your skills' },
  'dash.skillsNext':{ telugu: 'తర్వాత నేర్చుకోదగిన నైపుణ్యాలు', hindi: 'आगे सीखने लायक कौशल', english: 'Skills worth learning next' },
  'dash.topics':    { telugu: 'కొత్త ఉద్యోగాలు సృష్టిస్తున్న అంశాలు', hindi: 'नई नौकरियाँ बनाते विषय', english: 'Topics creating new jobs' },
  'dash.recent':    { telugu: 'ఇటీవల నేర్చుకున్నవి', hindi: 'हाल में सीखा', english: 'Recently mastered' },
  'dash.done':      { telugu: 'అభినందనలు! మీ కార్యక్రమం పూర్తయింది.', hindi: 'बधाई हो! आपका कार्यक्रम पूरा हुआ।', english: 'Congratulations! You have completed your programme.' },

  'session.speaking':  { telugu: 'మాట్లాడుతున్నారు', hindi: 'बोल रहे हैं', english: 'Speaking' },
  'session.listening': { telugu: 'వింటున్నాను… సహజంగా మాట్లాడండి', hindi: 'सुन रहा हूँ… आराम से बोलिए', english: 'Listening… speak naturally' },
  'session.thinking':  { telugu: 'ఆలోచిస్తున్నారు…', hindi: 'सोच रहे हैं…', english: 'Thinking…' },
  'session.typing':    { telugu: 'మీరు టైప్ చేస్తున్నప్పుడు వాయిస్ ఆగుతుంది', hindi: 'आप टाइप कर रहे हैं, आवाज़ रुकी है', english: 'Voice paused while you type' },
  'session.yourTurn':  { telugu: 'మీ వంతు — ప్రశ్నకు సమాధానం చెప్పండి', hindi: 'आपकी बारी — प्रश्न का उत्तर दें', english: 'Your turn — answer the question' },
  'session.idle':      { telugu: 'మీ వంతు', hindi: 'आपकी बारी', english: 'Your turn' },
  'session.tapSpeak':  { telugu: 'మాట్లాడటానికి నొక్కండి', hindi: 'बोलने के लिए दबाएँ', english: 'Tap to speak' },
  'session.tapStop':   { telugu: 'ఆపడానికి నొక్కండి', hindi: 'रोकने के लिए दबाएँ', english: 'Tap to stop' },
  'session.ready':     { telugu: 'నేను చెక్‌కి సిద్ధం', hindi: 'मैं चेक के लिए तैयार हूँ', english: 'I’m ready for the check' },
  'session.send':      { telugu: 'పంపు', hindi: 'भेजें', english: 'Send' },
  'session.transcript':{ telugu: 'సంభాషణ', hindi: 'बातचीत', english: 'Transcript' },
  'session.board':     { telugu: 'బోర్డ్', hindi: 'बोर्ड', english: 'Board' },
  'session.end':       { telugu: 'సెషన్ ముగించండి', hindi: 'सेशन खत्म करें', english: 'End session' },
  'session.check':     { telugu: 'మాస్టరీ చెక్. మాట్లాడి లేదా టైప్ చేసి సమాధానం ఇవ్వండి. ఒకే సరైన పదాలు అవసరం లేదు.', hindi: 'मास्टरी चेक। बोलकर या टाइप करके जवाब दें। एक ही सही शब्द ज़रूरी नहीं।', english: 'Mastery check. Answer out loud or type it. There is no single right wording.' },
  'session.typeHere':  { telugu: 'తెలుగు, హిందీ లేదా ఇంగ్లీష్‌లో టైప్ చేయండి… Enter తో పంపండి', hindi: 'हिंदी, तेलुगु या अंग्रेज़ी में टाइप करें… Enter से भेजें', english: 'Type in Telugu, Hindi or English… Enter to send' },
  'session.next':      { telugu: 'తదుపరి నైపుణ్యం మొదలుపెట్టండి', hindi: 'अगला कौशल शुरू करें', english: 'Start the next skill' },
  'session.advance':   { telugu: 'ముందుకు వెళ్ళండి', hindi: 'आगे बढ़ें', english: 'You can move on' },
  'session.nextSkill': { telugu: 'తదుపరి నైపుణ్యం', hindi: 'अगला कौशल', english: 'Next skill' },
  'session.complete':  { telugu: 'కార్యక్రమం పూర్తయింది!', hindi: 'कार्यक्रम पूरा!', english: 'Programme complete!' },

  'common.sample':     { telugu: 'నమూనా డేటా', hindi: 'नमूना डेटा', english: 'Sample data' },
  'common.save':       { telugu: 'మార్పులు సేవ్ చేయండి', hindi: 'बदलाव सहेजें', english: 'Save changes' }
};

const UiLangContext = createContext(null);

function loadInitial() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (UI_LANGS.some(l => l.id === saved)) return saved;
  } catch (e) { /* storage blocked — fall through */ }
  return 'telugu';
}

export function UiLangProvider({ children }) {
  const [lang, setLangState] = useState(loadInitial);

  const setLang = useCallback((next) => {
    if (!UI_LANGS.some(l => l.id === next)) return;
    setLangState(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch (e) { /* ignore */ }
  }, []);

  const t = useCallback((key) => {
    const entry = STRINGS[key];
    if (!entry) return key;
    return entry[lang] || entry.english;
  }, [lang]);

  return <UiLangContext.Provider value={{ lang, setLang, t }}>{children}</UiLangContext.Provider>;
}

export const useUiLang = () => useContext(UiLangContext);

// BCP-47 tag for the learner's TEACHING language (speech in and out).
export const speechTag = (language) => (language === 'hindi' ? 'hi-IN' : language === 'english' ? 'en-IN' : 'te-IN');
