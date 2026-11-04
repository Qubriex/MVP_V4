// The phone video (2–3 minutes): the learner side at 390×844 in a phone frame.
export default [
  {
    id: 'p-home', chapter: 'phone', cuts: ['phone'], title: 'Home and the tab bar', viewport: 'phone', account: 'journey_topics',
    setup: async ({ api }) => { await api('PUT', '/learner/learning-language', { value: 'telugu' }); },
    steps: [
      { goto: '/learn/dashboard' },
      { label: 'Made for the phone' },
      { say: { en: 'Most learners use Qubirex on a phone. Home fits one screen, and the tab bar keeps everything one tap away.', te: 'చాలామంది విద్యార్థులు phone లోనే Qubirex వాడతారు. Home ఒక్క screen లో సరిపోతుంది, tab bar తో అన్నీ ఒక్క tap దూరంలో.', hi: 'ज़्यादातर छात्र phone पर Qubirex इस्तेमाल करते हैं। Home एक screen में आ जाता है, और tab bar से सब कुछ एक tap दूर है।' } },
      { scroll: 360, pause: 1500 },
      { scroll: 'top', pause: 800 },
      { highlight: 'nav.ln-tabbar, .ln-tabbar, nav[aria-label*="ain"] >> nth=-1', hold: 2200, point: false },
      { waitNarration: true }
    ]
  },
  {
    id: 'p-lesson', chapter: 'phone', cuts: ['phone'], title: 'A lesson: Listen and Walk me through it', viewport: 'phone', account: 'journey_topics',
    setup: async ({ api }) => { await api('PUT', '/learner/learning-language', { value: 'telugu' }); },
    steps: [
      { goto: '/learn/lesson/py-m3-l3', waitFor: '[data-explain]' },
      { label: 'Listen in Telugu' },
      { say: { en: 'A lesson on the phone. Press Listen, and Professor Qubirex reads it in Telugu.', te: 'Phone లో ఒక lesson. Listen నొక్కండి, Professor Qubirex తెలుగులో చదివి వినిపిస్తారు.', hi: 'Phone पर एक lesson। Listen दबाइए, Professor Qubirex इसे तेलुगु में पढ़कर सुनाते हैं।' }, wait: true },
      { click: '[data-listen]', waitAudio: true, pause: 8000 },
      { click: '[data-listen]', pause: 400 },
      { click: '.lj-stepper [data-step="code"] button', waitFor: '[data-walk]' },
      { label: 'Walk me through it' },
      { say: { en: 'On the code, Walk me through it explains one line at a time.', te: 'Code మీద Walk me through it ఒక్కో line ని వివరిస్తుంది.', hi: 'Code पर Walk me through it एक-एक line समझाता है।' }, wait: true },
      { scroll: '[data-walk]', pause: 300 },
      { click: '[data-walk]', waitAudio: true, pause: 7000 },
      { click: '[data-walk-stop], [data-walk]', pause: 600 }
    ]
  },
  {
    id: 'p-practise', chapter: 'phone', cuts: ['phone'], title: 'Practise on the phone', viewport: 'phone', account: 'journey_topics',
    setup: async ({ api }) => { await api('PUT', '/learner/learning-language', { value: 'english' }); },
    steps: [
      { goto: '/learn/lesson/py-m3-l3', waitFor: '[data-explain]' },
      { click: '.lj-stepper [data-step="practise"] button', waitFor: '[data-editor]' },
      { label: 'Practise: write and run real code' },
      { say: { en: 'Practice works on the phone too. Write the code, run the tests, see the result.', te: 'Practice phone లో కూడా పని చేస్తుంది. Code రాయండి, tests run చేయండి, result చూడండి.', hi: 'Practice phone पर भी चलती है। Code लिखिए, tests run कीजिए, result देखिए।' } },
      { scroll: '[data-editor]', pause: 400 },
      { selectText: '[data-editor]', find: 'pass' },
      { type: '[data-editor]', text: 'return a * b', noClick: true },
      { click: '[data-run-tests]', waitFor: '[data-practice-result="pass"]', timeout: 120000 },
      { scroll: '[data-practice-result]', pause: 2000 },
      { waitNarration: true }
    ]
  },
  {
    id: 'p-passport', chapter: 'phone', cuts: ['phone'], title: 'Passport QR', viewport: 'phone', account: 'journey_s7',
    steps: [
      { goto: '/learn/passport' },
      { label: 'Passport and QR code' },
      { say: { en: 'The Passport is in the pocket. Show the QR code at an interview, and the employer checks it on the spot.', te: 'Passport జేబులోనే. Interview లో QR code చూపించండి, employer అక్కడికక్కడే check చేస్తారు.', hi: 'Passport जेब में है। Interview में QR code दिखाइए, employer वहीं जाँच लेते हैं।' } },
      { click: 'main button:text-is("Share link")', pause: 1500 },
      { scroll: 'main svg, main canvas, main img[alt*="QR"]', pause: 2400 },
      { waitNarration: true }
    ]
  },
  {
    id: 'p-settings', chapter: 'phone', cuts: ['phone'], title: 'Settings → Learning language', viewport: 'phone', account: 'journey_topics',
    steps: [
      { goto: '/learn/settings' },
      { label: 'Settings: learning language' },
      { say: { en: 'And in Settings, the learning language: Telugu, Telugu with English, Hindi, Hindi with English, or English.', te: 'Settings లో నేర్చుకునే భాష: తెలుగు, తెలుగు + English, హిందీ, హిందీ + English, లేదా English.', hi: 'और Settings में सीखने की भाषा: तेलुगु, तेलुगु + English, हिंदी, हिंदी + English, या English।' } },
      { scroll: '[data-settings-learning-language]', pause: 600 },
      { select: '[data-settings-learning-language] select', value: 'telugu_en', pause: 1800 },
      { select: '[data-settings-learning-language] select', value: 'telugu', pause: 1200 },
      { waitNarration: true }
    ]
  }
];
