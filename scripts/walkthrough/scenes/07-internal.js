// The internal cut only: /dev (opened already unlocked, off camera) and two
// admin pages. Never in the external videos.
export default [
  {
    id: 'i-dev', chapter: 'internal', cuts: ['internal'], title: '/dev: test accounts and the journey', viewport: 'desktop', account: null, unlock: true, allowUgly: ['test badge'],
    steps: [
      { goto: '/dev', waitFor: '.dx-cards' },
      { label: '/dev · internal' },
      { say: { en: 'For the team: the developer page. It opens one test account per role, with no passwords.', te: 'Team కోసం: developer page. ప్రతి role కి ఒక test account, password లేకుండా తెరుస్తుంది.', hi: 'Team के लिए: developer page। हर role का एक test account, बिना password के खुलता है।' } },
      { highlight: '.dx-cards', hold: 2600 },
      { waitNarration: true },
      { say: { en: 'And one test learner at every stage of the journey, from invited to hired.', te: 'Invite నుంచి ఉద్యోగం వరకు, journey లో ప్రతి దశకు ఒక test learner.', hi: 'और journey के हर पड़ाव पर एक test learner, invite से लेकर नौकरी तक।' } },
      { scroll: '.dx-stages', block: 'start', pause: 2600 },
      { waitNarration: true }
    ]
  },
  {
    id: 'i-voice', chapter: 'internal', cuts: ['internal'], title: 'Admin → Voice check', viewport: 'desktop', account: 'admin',
    steps: [
      { goto: '/admin/voice' },
      { label: 'Admin · Voice check' },
      { say: { en: 'Voice check shows every voice key and engine, and what to do when one fails. Play test speaks a line and times it.', te: 'ప్రతి voice key, engine, ఏదైనా పని చేయకపోతే ఏం చేయాలో Voice check చూపిస్తుంది. Play test ఒక line మాట్లాడి సమయం కొలుస్తుంది.', hi: 'Voice check हर voice key और engine दिखाता है, और कोई fail हो तो क्या करना है। Play test एक line बोलकर समय नापता है।' } },
      { click: 'main button:text-is("Telugu")', waitAudio: true, pause: 3500 },
      { waitNarration: true }
    ]
  },
  {
    id: 'i-quality', chapter: 'internal', cuts: ['internal'], title: 'Admin → Evaluator quality', viewport: 'desktop', account: 'admin',
    steps: [
      { goto: '/admin/quality' },
      { label: 'Admin · Evaluator quality' },
      { say: { en: 'Evaluator quality tracks how well the automatic marking agrees with faculty.', te: 'ఆటోమేటిక్ marking faculty తో ఎంత ఏకీభవిస్తుందో Evaluator quality ట్రాక్ చేస్తుంది.', hi: 'Evaluator quality देखता है कि automatic marking faculty से कितना मेल खाती है।' } },
      { scroll: 380, pause: 2200 },
      { waitNarration: true }
    ]
  }
];
