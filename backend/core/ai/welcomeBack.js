// core/ai/welcomeBack.js — what she says when a learner comes back to a
// lesson they left: a short, varied line that recaps where they stopped,
// instead of replaying the old opening. Fixed text, so it is spoken from the
// voice cache at once and costs nothing the second time.
const LINES = {
  telugu: {
    lesson: [
      'మళ్లీ స్వాగతం! పోయినసారి మనం {skill} దగ్గర ఉన్నాం. అక్కడి నుంచే కొనసాగిద్దామా?',
      'తిరిగి వచ్చినందుకు సంతోషం. మనం {skill} నేర్చుకుంటున్నాం. ఆపిన చోటు నుంచి మొదలుపెడదాం.',
      'నమస్కారం! {skill} పాఠం ఆగిన చోటే ఉంది. ఏదైనా అడగాలంటే అడగండి, లేదా కొనసాగిద్దాం.'
    ],
    check: [
      'మళ్లీ స్వాగతం! {skill} check మీ కోసం ఎదురుచూస్తోంది. ప్రశ్న క్రింద ఉంది.',
      'తిరిగి వచ్చారు, బాగుంది. {skill} check మధ్యలో ఆగాం. మీ జవాబు చెప్పండి.'
    ]
  },
  hindi: {
    lesson: [
      'फिर से स्वागत है! पिछली बार हम {skill} पर थे। वहीं से आगे बढ़ें?',
      'आपको वापस देखकर अच्छा लगा। हम {skill} सीख रहे थे। जहाँ रुके थे, वहीं से शुरू करते हैं।',
      'नमस्ते! {skill} का पाठ वहीं रुका है जहाँ आपने छोड़ा था। कुछ पूछना हो तो पूछिए, या आगे चलें।'
    ],
    check: [
      'फिर से स्वागत है! {skill} का check आपका इंतज़ार कर रहा है। प्रश्न नीचे है।',
      'वापस आ गए, बढ़िया। हम {skill} के check के बीच में थे। अपना जवाब बताइए।'
    ]
  },
  english: {
    lesson: [
      'Welcome back! Last time we were on {skill}. Shall we continue from there?',
      'Good to see you again. We were learning {skill}. Let us pick up where you stopped.',
      'Hello again! Your {skill} lesson is where you left it. Ask me anything, or we carry on.'
    ],
    check: [
      'Welcome back! Your {skill} check is waiting. The question is below.',
      'Good to have you back. We were in the middle of the {skill} check. Tell me your answer.'
    ]
  }
};

/** A welcome-back line and its English caption; `seed` varies the wording between visits. */
export function welcomeBack({ language = 'telugu', skill, inCheck = false, seed = Date.now() }) {
  const set = (LINES[language] || LINES.telugu)[inCheck ? 'check' : 'lesson'];
  const en = LINES.english[inCheck ? 'check' : 'lesson'];
  const i = Math.abs(Math.floor(seed)) % set.length;
  const fill = (s) => s.replace('{skill}', skill);
  return { message: fill(set[i]), caption_en: language === 'english' ? null : fill(en[i % en.length]) };
}

// "I'm ready for the check": the check starts at once, with one short line.
// Early (little teaching so far) it says the learner may try now and will be
// taught again if it does not go well.
const READY = {
  telugu: { ok: 'మంచిది. ఇప్పుడు ఒక చిన్న check: మీ సొంత మాటల్లో జవాబు చెప్పండి.', early: 'సరే, ఇప్పుడే ప్రయత్నించవచ్చు. సరిగ్గా రాకపోతే మళ్లీ వివరిస్తాను. ఇదిగో check.' },
  hindi: { ok: 'बहुत अच्छा। अब एक छोटा check: अपने शब्दों में जवाब दीजिए।', early: 'ठीक है, आप अभी कोशिश कर सकते हैं। ठीक न रहा तो मैं फिर से समझाऊँगी। यह रहा check।' },
  english: { ok: 'Good. Now a short check: answer it in your own words.', early: 'Sure, you can try now. If it does not go well, I will explain again. Here is the check.' }
};
export function readyForCheck({ language = 'telugu', early = false }) {
  const k = early ? 'early' : 'ok';
  return { message: (READY[language] || READY.telugu)[k], captionEn: language === 'english' ? null : READY.english[k], early };
}
