// Chapter 2 · A learner's day (5–6 minutes). Test-tenant learners, signed in
// off camera through /dev (no passcode on screen), except the learner door.
export default [
  {
    id: 'c2-door', chapter: 2, title: 'Sign in through the learner door', viewport: 'desktop', account: null,
    steps: [
      { goto: '/learner-login' },
      { label: 'The learner door' },
      { say: { en: 'A learner signs in with their roll number, their college code and a PIN. No email or password to remember.', te: 'విద్యార్థి roll number, college code, PIN తో sign in చేస్తారు. Email, password గుర్తుపెట్టుకోవాల్సిన పని లేదు.', hi: 'छात्र अपना roll number, college code और PIN डालकर sign in करते हैं। Email या password याद रखने की ज़रूरत नहीं।' } },
      { type: '#lref', text: 'TEST-J-S1' },
      { type: '#leng', text: 'QX-FSD-T01' },
      { type: '#lpin', text: '410585' },
      { click: 'form button[type=submit]:has-text("Sign in")', waitUrl: '**/learn/welcome', waitFor: 'h1:has-text("Welcome")' },
      { waitNarration: true },
      { label: 'Welcome: three short steps' },
      { say: { en: 'The first time, three short steps. Choose the learning language and hear Professor Qubirex.', te: 'మొదటిసారి మూడు చిన్న steps. నేర్చుకునే భాష ఎంచుకుని, Professor Qubirex గొంతు వినండి.', hi: 'पहली बार तीन छोटे steps हैं। सीखने की भाषा चुनिए और Professor Qubirex की आवाज़ सुनिए।' }, wait: true },
      { click: 'button:has-text("Hear Professor Qubirex")', waitAudio: true, pause: 5500 },
      { click: 'button:text-is("Next")', waitFor: '[data-mic-test]' },
      { say: { en: 'Then a quick microphone test, so the learner can answer by speaking.', te: 'తర్వాత ఒక చిన్న microphone test, మాట్లాడి జవాబు చెప్పడానికి.', hi: 'फिर एक छोटा microphone test, ताकि छात्र बोलकर जवाब दे सकें।' }, wait: true },
      { click: 'main button:text-is("Next")', waitFor: 'button:has-text("Start the check")' },
      { say: { en: 'And a short starting check, so lessons begin at the right place.', te: 'చివరగా ఒక చిన్న starting check, lessons సరైన చోట మొదలవ్వడానికి.', hi: 'और एक छोटा starting check, ताकि lessons सही जगह से शुरू हों।' } },
      { highlight: 'button:has-text("Start the check")', hold: 2400 }
    ]
  },
  {
    id: 'c2-home', chapter: 2, title: 'Learner home', viewport: 'desktop', account: 'journey_topics',
    steps: [
      { goto: '/learn/dashboard' },
      { label: 'Learner home' },
      { say: { en: 'Home shows today\'s one next step, the topic in progress, and the voice session, all in one place.', te: 'Home లో ఈ రోజు చేయాల్సిన తదుపరి పని, నడుస్తున్న topic, voice session అన్నీ ఒకే చోట ఉంటాయి.', hi: 'Home पर आज का अगला कदम, चल रहा topic और voice session, सब एक ही जगह दिखते हैं।' } },
      { highlight: 'section:has(h2:has-text("Today"))', hold: 2600 },
      { hover: 'a[data-continue-topic]', pause: 1400 },
      { waitNarration: true }
    ]
  },
  {
    id: 'c2-explore', chapter: 2, title: 'Explore topics → Python → Return values', viewport: 'desktop', account: 'journey_topics',
    steps: [
      { goto: '/learn/dashboard' },
      { say: { en: 'Let\'s open a lesson. Explore topics, then Python, then Module 3, Lesson 3: return values.', te: 'ఒక lesson తెరుద్దాం. Explore topics, తర్వాత Python, Module 3 లో Lesson 3: return values.', hi: 'चलिए एक lesson खोलते हैं। Explore topics, फिर Python, फिर Module 3 का Lesson 3: return values।' } },
      { click: 'nav a[href="/learn/courses"], aside a[href="/learn/courses"]', waitFor: '[data-course]' },
      { click: 'a[href="/learn/courses/python"]', waitFor: '[data-module="py-m3"]' },
      { click: '[data-module="py-m3"] .lj-module-head', pause: 900 },
      { click: '[data-lesson="py-m3-l3"] a', waitFor: '[data-explain]' }
    ]
  },
  {
    id: 'c2-lesson-learn', chapter: 2, title: 'Teach first: listen, then switch language', viewport: 'desktop', account: 'journey_topics',
    setup: async ({ api }) => { await api('PUT', '/learner/learning-language', { value: 'telugu' }); },
    steps: [
      { goto: '/learn/lesson/py-m3-l3', waitFor: '[data-explain]' },
      { label: 'Teach first: Learn → See the code → Practise → Check' },
      { say: { en: 'Every lesson teaches first. Learn, see the code, practise, and only then the check. Here it is in Telugu. Let\'s listen.', te: 'ప్రతి lesson ముందు నేర్పుతుంది. నేర్చుకోండి, code చూడండి, practice చేయండి, ఆ తర్వాతే check. ఇది తెలుగులో ఉంది. విందాం.', hi: 'हर lesson पहले सिखाता है। सीखिए, code देखिए, practice कीजिए, और उसके बाद ही check। यह तेलुगु में है। चलिए सुनते हैं।' }, wait: true },
      { label: 'Listen in Telugu' },
      { click: '[data-listen]', waitAudio: true, pause: 10000 },
      { click: '[data-listen]', pause: 500 },
      { label: 'Learning language: one switch' },
      { say: { en: 'One switch changes the learning language. Now the same lesson is in English.', te: 'ఒక్క switch తో నేర్చుకునే భాష మారుతుంది. ఇప్పుడు అదే lesson English లో.', hi: 'एक switch से सीखने की भाषा बदल जाती है। अब वही lesson English में है।' } },
      { select: '[data-lesson-page] [data-learning-language] select', value: 'english', waitFor: '[data-explain]' },
      { scroll: '[data-explain]', block: 'start', pause: 1500 },
      { waitNarration: true }
    ]
  },
  {
    id: 'c2-lesson-code', chapter: 2, title: 'See the code, walk me through it, ask', viewport: 'desktop', account: 'journey_topics',
    setup: async ({ api }) => { await api('PUT', '/learner/learning-language', { value: 'english' }); },
    steps: [
      { goto: '/learn/lesson/py-m3-l3', waitFor: '[data-explain]' },
      { say: { en: 'Not clear? Ask in your own words.', te: 'అర్థం కాలేదా? మీ మాటల్లో అడగండి.', hi: 'समझ नहीं आया? अपने शब्दों में पूछिए।' } },
      { click: '[data-feedback="explain"] button[aria-label="No, not clear"]', waitFor: '[data-ask-input]', pause: 600 },
      { type: '[data-ask-input]', text: 'Why do we use return?', enter: true, waitFor: '[data-ask-answer="0"]' },
      { label: 'Ask during the lesson' },
      { highlight: '[data-ask-answer="0"]', hold: 3200 },
      { waitNarration: true },
      { click: '[data-step-panel="learn"] [data-next-step]', waitFor: '[data-walk]' },
      { label: 'See the code · Walk me through it' },
      { say: { en: 'See the code, then press Walk me through it. Professor Qubirex explains each line as it lights up.', te: 'Code చూడండి, తర్వాత Walk me through it నొక్కండి. ప్రతి line వెలిగినప్పుడు Professor Qubirex దాన్ని వివరిస్తారు.', hi: 'Code देखिए, फिर Walk me through it दबाइए। हर line चमकने पर Professor Qubirex उसे समझाते हैं।' }, wait: true },
      { click: '[data-walk]', waitAudio: true, pause: 9000 },
      { click: '[data-walk-stop], [data-walk]', pause: 700 }
    ]
  },
  {
    id: 'c2-lesson-practise', chapter: 2, title: 'Practise, then the check', viewport: 'desktop', account: 'journey_topics',
    setup: async ({ api }) => { await api('PUT', '/learner/learning-language', { value: 'english' }); },
    steps: [
      { goto: '/learn/lesson/py-m3-l3', waitFor: '[data-explain]' },
      { click: '.lj-stepper [data-step="practise"] button', waitFor: '[data-editor]' },
      { label: 'Practise: multiply(a, b)' },
      { say: { en: 'Now practise. Write multiply of a and b. A common mistake first: printing instead of returning.', te: 'ఇప్పుడు practice. multiply(a, b) రాయండి. ముందు ఒక సాధారణ తప్పు: return కాకుండా print చేయడం.', hi: 'अब practice। multiply(a, b) लिखिए। पहले एक आम गलती: return की जगह print करना।' } },
      { scroll: '[data-task]', block: 'start', pause: 500 },
      { selectText: '[data-editor]', find: 'pass' },
      { type: '[data-editor]', text: 'print(a * b)', noClick: true },
      { click: '[data-run-tests]', waitFor: '[data-practice-result]', timeout: 120000 },
      { highlight: '[data-test-results]', hold: 2200 },
      { waitNarration: true },
      { say: { en: 'The tests show exactly what failed. Change print to return, and run again.', te: 'ఏది fail అయిందో tests స్పష్టంగా చూపిస్తాయి. print ని return గా మార్చి మళ్ళీ run చేయండి.', hi: 'Tests साफ़ दिखाते हैं कि क्या fail हुआ। print को return से बदलिए और फिर run कीजिए।' } },
      { selectText: '[data-editor]', find: 'print(a * b)' },
      { type: '[data-editor]', text: 'return a * b', noClick: true },
      { click: '[data-run-tests]', waitFor: '[data-practice-result="pass"]', timeout: 120000 },
      { highlight: '[data-practice-result]', hold: 2000 },
      { waitNarration: true },
      { click: '[data-step-panel="practise"] [data-next-step]', waitFor: '[data-start-check]' },
      { label: 'The check: a fresh question' },
      { say: { en: 'Only now, the check: a fresh question, answered in your own words.', te: 'ఇప్పుడే check: ఒక కొత్త ప్రశ్న, మీ మాటల్లో జవాబు.', hi: 'अब जाकर check: एक नया सवाल, अपने शब्दों में जवाब।' } },
      { click: '[data-start-check]', waitFor: '[data-check-question] textarea' },
      { type: '[data-check-question] textarea', text: 'return sends the result back to the caller, so we can store it in a variable and add it up. print only shows it and gives back None.' },
      { click: '[data-check-question] button[type=submit]', waitFor: '[data-result]', timeout: 30000 },
      { label: 'Result: passed, with what to do next' },
      { say: { en: 'Passed. The result says what was good, and this skill now counts toward the Passport.', te: 'Pass అయ్యారు. ఏది బాగుందో result చెబుతుంది, ఈ skill ఇప్పుడు Passport లో లెక్కకు వస్తుంది.', hi: 'Pass हो गए। Result बताता है कि क्या अच्छा था, और यह skill अब Passport में गिनी जाती है।' } },
      { highlight: '[data-result]', hold: 3000 },
      { waitNarration: true }
    ]
  },
  {
    id: 'c2-voice', chapter: 2, title: 'A voice session', viewport: 'desktop', account: 'journey_topics',
    setup: async ({ api }) => { await api('PUT', '/learner/learning-language', { value: 'telugu' }); },
    steps: [
      { goto: '/learn/session?mode=voice', waitFor: '[data-tap-start]' },
      { label: 'Voice session with Professor Qubirex' },
      { say: { en: 'The voice session is a one-to-one class. Professor Qubirex speaks first, in Telugu.', te: 'Voice session ఒకరికొకరు class లాంటిది. Professor Qubirex ముందుగా తెలుగులో మాట్లాడతారు.', hi: 'Voice session एक-से-एक class जैसा है। Professor Qubirex पहले तेलुगु में बोलते हैं।' }, wait: true },
      { click: '[data-tap-start]', waitAudio: true, pause: 8000 },
      { say: { en: 'When the learner is ready, one tap asks for the check.', te: 'సిద్ధంగా ఉన్నప్పుడు ఒక్క tap తో check అడగొచ్చు.', hi: 'तैयार होने पर एक tap से check माँग सकते हैं।' } },
      { click: 'button:has-text("I’m ready for the check")', pause: 5000 },
      { waitNarration: true }
    ]
  },
  {
    id: 'c2-ask', chapter: 2, title: 'Ask Qubirex, in any language', viewport: 'desktop', account: 'journey_topics',
    steps: [
      { goto: '/learn/dashboard' },
      { label: 'Ask Qubirex' },
      { say: { en: 'Ask Qubirex is always one tap away. Ask anything about your learning, and choose the language of the answer.', te: 'Ask Qubirex ఎప్పుడూ ఒక్క tap దూరంలో ఉంటుంది. మీ చదువు గురించి ఏదైనా అడగండి, జవాబు ఏ భాషలో కావాలో ఎంచుకోండి.', hi: 'Ask Qubirex हमेशा एक tap दूर है। अपनी पढ़ाई के बारे में कुछ भी पूछिए, और जवाब की भाषा चुनिए।' } },
      { click: 'button[aria-label="Ask Qubirex"]', waitFor: '#ask-q' },
      { type: '#ask-q', text: 'What should I study next?', enter: true, pause: 4000 },
      { waitNarration: true },
      { select: 'select[aria-label="Answer language"]', value: 'english', pause: 3000 },
      { press: 'Escape', pause: 600 }
    ]
  },
  {
    id: 'c2-skill', chapter: 2, title: 'One skill, up close', viewport: 'desktop', account: 'journey_s3',
    steps: [
      { goto: '/learn/record' },
      { label: 'A skill, up close' },
      { say: { en: 'Each skill has its own page: what it covers, the evidence so far, and what is still missing.', te: 'ప్రతి skill కి ఒక page ఉంటుంది: అది ఏం నేర్పుతుంది, ఇప్పటివరకు ఉన్న ఆధారాలు, ఇంకా ఏం కావాలి.', hi: 'हर skill का अपना page है: उसमें क्या है, अब तक के सबूत, और क्या अभी बाकी है।' } },
      { click: 'main a[href="/learn/skill/test-node-2-3"]', waitFor: 'h1' },
      { scroll: 420, pause: 2200 },
      { scroll: 420, pause: 1800 },
      { waitNarration: true }
    ]
  },
  {
    id: 'c2-reviews', chapter: 2, title: 'Reviews', viewport: 'desktop', account: 'journey_s3',
    steps: [
      { goto: '/learn/reviews' },
      { label: 'Reviews: short, spaced repeats' },
      { say: { en: 'Reviews bring back skills just before they fade. Two are due today.', te: 'Skills మరచిపోయే ముందే reviews వాటిని మళ్ళీ తీసుకొస్తాయి. ఈ రోజు రెండు ఉన్నాయి.', hi: 'Reviews skills को भूलने से ठीक पहले वापस लाते हैं। आज दो बाकी हैं।' } },
      { click: 'main button:text-is("Start"), main button:text-is("Continue")', pause: 1500 },
      { waitNarration: true },
      { say: { en: 'The language can change even on an open question.', te: 'తెరిచి ఉన్న ప్రశ్న మీద కూడా భాష మార్చవచ్చు.', hi: 'खुले सवाल पर भी भाषा बदल सकते हैं।' } },
      { select: 'main [data-learning-language] select', value: 'english', pause: 1800 },
      { select: 'main [data-learning-language] select', value: 'telugu', pause: 1800 },
      { waitNarration: true }
    ]
  },
  {
    id: 'c2-record', chapter: 2, title: 'Skill path and Attempt history', viewport: 'desktop', account: 'journey_s3',
    steps: [
      { goto: '/learn/record' },
      { label: 'Skill path and record' },
      { say: { en: 'The skill path shows what is mastered and what comes next.', te: 'ఏది నేర్చుకున్నారో, తర్వాత ఏం వస్తుందో skill path చూపిస్తుంది.', hi: 'Skill path दिखाता है कि क्या सीख लिया और आगे क्या है।' } },
      { scroll: 'h2:has-text("Path")', block: 'start', pause: 2200 },
      { waitNarration: true },
      { click: 'nav a[href="/learn/history"], aside a[href="/learn/history"]', waitFor: 'h1' },
      { label: 'Attempt history' },
      { say: { en: 'Attempt history keeps every check and review, with how it was checked.', te: 'ప్రతి check, review ఎలా జరిగిందో Attempt history లో ఉంటుంది.', hi: 'Attempt history में हर check और review रहता है, और यह भी कि कैसे जाँचा गया।' } },
      { hover: 'main .sk-codetag', pause: 1600 },
      { waitNarration: true }
    ]
  },
  {
    id: 'c2-passport', chapter: 2, title: 'Capability Passport', viewport: 'desktop', account: 'journey_s7',
    steps: [
      { goto: '/learn/passport' },
      { label: 'Capability Passport' },
      { say: { en: 'This is the Capability Passport: every skill the learner has proved, signed, so anyone can check it.', te: 'ఇది Capability Passport: విద్యార్థి నిరూపించిన ప్రతి skill, signed, ఎవరైనా check చేయవచ్చు.', hi: 'यह Capability Passport है: छात्र के साबित किए हर skill, signed, जिसे कोई भी जाँच सकता है।' } },
      { click: 'main button:text-is("Grid")', pause: 1200 },
      { click: 'main button:has-text("Confirmed ·")', pause: 1400 },
      { click: 'main button:has-text("All ·")', pause: 800 },
      { waitNarration: true },
      { label: 'Share link, QR and share card' },
      { say: { en: 'Share it as a link, a QR code, or a card for social media. The learner decides who sees the details.', te: 'Link గా, QR code గా, లేదా social media card గా share చేయండి. వివరాలు ఎవరు చూడాలో విద్యార్థే నిర్ణయిస్తారు.', hi: 'Link, QR code या social media card के रूप में share कीजिए। Details कौन देखे, यह छात्र तय करते हैं।' } },
      { click: 'main button:text-is("Share link")', pause: 2200 },
      { highlight: 'main button:has-text("Share card")', hold: 1500 },
      { waitNarration: true },
      { say: { en: 'And the public check opens in a new tab, exactly as an employer sees it.', te: 'Public check కొత్త tab లో తెరుచుకుంటుంది, employer చూసినట్టే.', hi: 'और public check नए tab में खुलता है, ठीक वैसे जैसे employer देखते हैं।' } },
      { click: 'main a:has-text("Open the public check")', newTab: true, waitFor: 'h2:has-text("Skills")' },
      { scroll: 400, pause: 1500 },
      { waitNarration: true }
    ]
  },
  {
    id: 'c2-readiness', chapter: 2, title: 'Readiness for a role', viewport: 'desktop', account: 'journey_s6',
    steps: [
      { goto: '/learn/readiness' },
      { label: 'Readiness for a role' },
      { say: { en: 'Readiness compares three things for each skill: where you are, where your course takes you, and what employers ask.', te: 'ప్రతి skill కి మూడు పోలుస్తుంది: మీరు ఎక్కడ ఉన్నారు, course మిమ్మల్ని ఎక్కడికి తీసుకెళ్తుంది, employers ఏం అడుగుతున్నారు.', hi: 'Readiness हर skill के लिए तीन चीज़ें मिलाता है: आप कहाँ हैं, course आपको कहाँ ले जाएगा, और employers क्या माँगते हैं।' } },
      { scroll: '[data-readiness-chart]', block: 'center', pause: 600 },
      { hover: '[data-readiness-chart] .viz-bar >> nth=12', pause: 1800 },
      { highlight: '[data-ready-summary]', hold: 2200 },
      { waitNarration: true }
    ]
  },
  {
    id: 'c2-resume', chapter: 2, title: 'Résumé builder', viewport: 'desktop', account: 'journey_s6',
    steps: [
      { goto: '/learn/resume' },
      { label: 'Résumé builder' },
      { say: { en: 'The résumé builder starts from what is proven. It shows which résumé lines have evidence behind them, and tailors the résumé to a job.', te: 'Résumé builder నిరూపించిన వాటితో మొదలవుతుంది. ఏ lines కి ఆధారం ఉందో చూపిస్తుంది, ఒక job కి తగ్గట్టు résumé మారుస్తుంది.', hi: 'Résumé builder साबित की गई चीज़ों से शुरू होता है। यह दिखाता है किन lines के पीछे सबूत है, और résumé को किसी job के हिसाब से ढालता है।' } },
      { click: 'button.ln-tplbtn:has-text("Modern")', pause: 1500 },
      { scroll: 'h2:has-text("Your résumé vs what is proven")', block: 'start', pause: 2400 },
      { waitNarration: true }
    ]
  },
  {
    id: 'c2-jobs', chapter: 2, title: 'Jobs & applications', viewport: 'desktop', account: 'journey_s8',
    steps: [
      { goto: '/learn/jobs' },
      { label: 'Jobs & applications' },
      { say: { en: 'Jobs and applications. The chart shows sample package ranges by role.', te: 'Jobs & applications. Role వారీగా sample package ranges chart లో కనిపిస్తాయి.', hi: 'Jobs & applications। Chart में role के हिसाब से sample package ranges दिखती हैं।' } },
      { scroll: '[data-packages]', block: 'center', pause: 500 },
      { hover: '[data-packages] .viz-range >> nth=1', pause: 2000 },
      { waitNarration: true },
      { scroll: 'top', pause: 500 },
      { label: 'An employer asks to see the Passport' },
      { say: { en: 'An employer has asked to see this Passport, and promises an interview. Nothing is shared until the learner says yes.', te: 'ఒక employer ఈ Passport చూడాలని అడిగారు, interview ఇస్తామని మాట ఇచ్చారు. విద్యార్థి అవును అనే వరకు ఏదీ share కాదు.', hi: 'एक employer ने यह Passport देखने को कहा है और interview का वादा किया है। छात्र के हाँ कहने तक कुछ भी share नहीं होता।' } },
      { highlight: 'section:has(h2:has-text("Employer requests"))', hold: 2800 },
      { waitNarration: true },
      { click: 'button[data-demo="approve"]', pause: 2200 },
      { say: { en: 'Approved. The employer can now see the evidence.', te: 'ఆమోదించారు. ఇప్పుడు employer ఆధారాలు చూడగలరు.', hi: 'मंज़ूर। अब employer सबूत देख सकते हैं।' }, wait: true }
    ]
  }
];
