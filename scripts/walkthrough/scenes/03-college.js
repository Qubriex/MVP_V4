// Chapter 3 · The college (2–3 minutes). Test-tenant staff, signed in off camera.
export default [
  {
    id: 'c3-home', chapter: 3, title: 'College home, command box and MoU', viewport: 'desktop', account: 'college_admin',
    steps: [
      { goto: '/institution/home' },
      { label: 'College home' },
      { say: { en: 'For a college, home says what to do next: who has gone quiet, who is nearly ready, and what is waiting for review.', te: 'College కి home తర్వాత ఏం చేయాలో చెబుతుంది: ఎవరు నిశ్శబ్దంగా ఉన్నారు, ఎవరు దాదాపు సిద్ధం, ఏది review కోసం ఎదురుచూస్తోంది.', hi: 'College के लिए home बताता है कि आगे क्या करना है: कौन चुप हो गया, कौन लगभग तैयार है, और क्या review के लिए रुका है।' } },
      { highlight: 'section:has(h2:has-text("Do this next"))', hold: 3000 },
      { waitNarration: true },
      { label: 'Ask about your students' },
      { say: { en: 'Or just ask, in plain words.', te: 'లేదా సాధారణ మాటల్లో అడగండి.', hi: 'या सीधे आसान शब्दों में पूछिए।' } },
      { type: '#cmd-staff', text: 'Who is nearly ready?', enter: true, pause: 3200 },
      { waitNarration: true },
      { label: 'MoU scoreboard' },
      { say: { en: 'The MoU scoreboard tracks the placement target the college has promised.', te: 'College ఇచ్చిన placement లక్ష్యాన్ని MoU scoreboard ట్రాక్ చేస్తుంది.', hi: 'MoU scoreboard उस placement लक्ष्य को track करता है जिसका college ने वादा किया है।' } },
      { scroll: 'button:has-text("Set target")', block: 'center', pause: 500 },
      { highlight: '.ln-card:has(button:has-text("Set target"))', hold: 2600 },
      { waitNarration: true }
    ]
  },
  {
    id: 'c3-heatmap', chapter: 3, title: 'Cohort heat-map and drill-down', viewport: 'desktop', account: 'college_admin',
    steps: [
      { goto: '/institution/home' },
      { scroll: 'h2:has-text("Skill groups by cohort")', block: 'start', pause: 500 },
      { label: 'Skill groups by cohort' },
      { say: { en: 'The heat-map shows each cohort\'s skill groups. Open a cell to see exactly which students need help.', te: 'ప్రతి cohort skill groups ని heat-map చూపిస్తుంది. ఏ విద్యార్థులకు సహాయం కావాలో చూడడానికి ఒక cell తెరవండి.', hi: 'Heat-map हर cohort के skill groups दिखाता है। किन छात्रों को मदद चाहिए, यह देखने के लिए एक cell खोलिए।' } },
      { click: 'a[aria-label*="CSE-A"] >> nth=2', pause: 2600 },
      { waitNarration: true }
    ]
  },
  {
    id: 'c3-cohort', chapter: 3, title: 'A cohort, student by student', viewport: 'desktop', account: 'college_admin',
    setup: async ({ devJson }) => devJson('/route-ids'),
    steps: [
      { goto: (v) => `/institution/cohorts/${v.engagement_id}` },
      { label: 'Cohort: every student, every skill' },
      { say: { en: 'A cohort page lists every student with their stage and readiness, so a teacher knows whom to help today.', te: 'Cohort page లో ప్రతి విద్యార్థి దశ, సిద్ధత కనిపిస్తాయి. ఈ రోజు ఎవరికి సహాయం చేయాలో teacher కి తెలుస్తుంది.', hi: 'Cohort page पर हर छात्र का पड़ाव और तैयारी दिखती है, ताकि teacher जाने कि आज किसकी मदद करनी है।' } },
      { scroll: 420, pause: 2200 },
      { scroll: 420, pause: 2000 },
      { waitNarration: true }
    ]
  },
  {
    id: 'c3-mastery', chapter: 3, title: 'A Mastery Log', viewport: 'desktop', account: 'college_admin',
    setup: async ({ devJson }) => devJson('/route-ids'),
    steps: [
      { goto: (v) => `/institution/mastery-log/${v.mastery_log_id}` },
      { label: 'Mastery Log' },
      { say: { en: 'When a student finishes a skill group, the Mastery Log records what was shown, how it was checked, and when.', te: 'విద్యార్థి ఒక skill group పూర్తి చేసినప్పుడు, ఏం చూపించారు, ఎలా check చేశారు, ఎప్పుడు అనేది Mastery Log నమోదు చేస్తుంది.', hi: 'जब छात्र एक skill group पूरा करते हैं, तो Mastery Log दर्ज करता है कि क्या दिखाया, कैसे जाँचा गया, और कब।' } },
      { scroll: 380, pause: 2400 },
      { waitNarration: true }
    ]
  },
  {
    id: 'c3-curriculum', chapter: 3, title: 'Curriculum vs market', viewport: 'desktop', account: 'college_admin',
    steps: [
      { goto: '/institution/curriculum' },
      { label: 'Curriculum vs market' },
      { say: { en: 'Curriculum versus market shows which skills employers ask for that the syllabus does not yet teach.', te: 'Employers అడిగే, కానీ syllabus ఇంకా నేర్పని skills ఏవో Curriculum vs market చూపిస్తుంది.', hi: 'Curriculum vs market दिखाता है कि कौन-से skills employers माँगते हैं जो syllabus अभी नहीं पढ़ाता।' } },
      { scroll: 400, pause: 2600 },
      { waitNarration: true }
    ]
  },
  {
    id: 'c3-add', chapter: 3, title: 'Add students in bulk', viewport: 'desktop', account: 'college_admin',
    steps: [
      { goto: '/institution/students/add' },
      { label: 'Add students and give access' },
      { say: { en: 'Adding students takes a minute: type them in or upload a CSV, pick the cohort, and choose how they get access.', te: 'విద్యార్థులను చేర్చడం ఒక్క నిమిషం: type చేయండి లేదా CSV upload చేయండి, cohort ఎంచుకోండి, access ఎలా ఇవ్వాలో ఎంచుకోండి.', hi: 'छात्र जोड़ना एक मिनट का काम है: नाम type कीजिए या CSV upload कीजिए, cohort चुनिए, और access का तरीका चुनिए।' } },
      { type: 'input[aria-label="Row 1 name"]', text: 'Ramya Sri' },
      { type: 'input[aria-label="Row 1 roll or ref number"]', text: '22CS101' },
      { click: 'main button:has-text("Upload CSV")', pause: 1200 },
      { click: 'main button:has-text("Type in")', pause: 800 },
      { waitNarration: true },
      { say: { en: 'We stop here, before anything is sent.', te: 'ఏదీ పంపకముందే ఇక్కడ ఆగుదాం.', hi: 'कुछ भी भेजने से पहले हम यहीं रुकते हैं।' }, wait: true }
    ]
  },
  {
    id: 'c3-bridge', chapter: 3, title: 'A bridge programme', viewport: 'desktop', account: 'college_admin',
    steps: [
      { goto: '/institution/bridges?new=1' },
      { label: 'Bridge programme' },
      { say: { en: 'When students are a few skills short, a bridge programme gives them focused practice and a retest date.', te: 'విద్యార్థులకు కొన్ని skills తక్కువైనప్పుడు, bridge programme ప్రత్యేక practice, retest తేదీ ఇస్తుంది.', hi: 'जब छात्रों के कुछ skills कम हों, तो bridge programme उन्हें खास practice और retest की तारीख देता है।' } },
      { type: '#br-title', text: 'SQL and REST practice' },
      { scroll: 'button[type=submit]:has-text("Start bridge programme")', pause: 400 },
      { click: 'button[type=submit]:has-text("Start bridge programme")', pause: 2200 },
      { waitNarration: true }
    ]
  },
  {
    id: 'c3-topics', chapter: 3, title: 'Topics: a professor reviews a lesson', viewport: 'desktop', account: 'professor',
    steps: [
      { goto: '/institution/topics' },
      { label: 'Faculty review every lesson' },
      { say: { en: 'Professors review every lesson in each language before it counts. They see what learners thought of it, thumbs up or down.', te: 'ప్రతి lesson ని ప్రతి భాషలో professors review చేస్తారు. Learners కి ఎలా అనిపించిందో, thumbs up లేదా down, చూస్తారు.', hi: 'Professors हर lesson को हर भाषा में review करते हैं। Learners को कैसा लगा, thumbs up या down, यह भी देखते हैं।' } },
      { click: 'main button:has-text("Return values")', waitFor: '[data-mark-reviewed]' },
      { click: '[data-review-lang="telugu"]', pause: 1500 },
      { click: '[data-review-lang="english"]', pause: 900 },
      { click: '[data-mark-reviewed]', pause: 2000 },
      { waitNarration: true }
    ]
  },
  {
    id: 'c3-review', chapter: 3, title: 'Faculty review queue', viewport: 'desktop', account: 'professor',
    steps: [
      { goto: '/institution/review' },
      { label: 'Faculty review queue' },
      { say: { en: 'Some answers are double-checked by faculty. The professor reads the answer and gives a band and a short note.', te: 'కొన్ని జవాబులను faculty మళ్ళీ check చేస్తారు. Professor జవాబు చదివి ఒక band, చిన్న note ఇస్తారు.', hi: 'कुछ जवाब faculty दोबारा जाँचते हैं। Professor जवाब पढ़कर एक band और छोटा note देते हैं।' } },
      { scroll: 'main textarea', pause: 900 },
      { click: 'main button:text-is("Good (0.7–0.89)")', pause: 900 },
      { type: 'main textarea', text: 'Clear answer. Add one example next time.' },
      { waitNarration: true }
    ]
  },
  {
    id: 'c3-board', chapter: 3, title: 'Board report in Telugu, placements', viewport: 'desktop', account: 'college_admin',
    steps: [
      { goto: '/institution/home' },
      { label: 'Board report in Telugu' },
      { say: { en: 'The board report is one page, in English, Telugu or Hindi. Here it is in Telugu.', te: 'Board report ఒక్క పేజీ, English, తెలుగు లేదా హిందీలో. ఇదిగో తెలుగులో.', hi: 'Board report एक पेज का है, English, तेलुगु या हिंदी में। यह रहा तेलुगु में।' } },
      { scroll: 'a[href="/institution/board-report?lang=te"]', pause: 400 },
      { click: 'a[href="/institution/board-report?lang=te"]', waitFor: 'h1' },
      { scroll: 500, pause: 1800 },
      { waitNarration: true },
      { click: 'nav a[href="/institution/placements"], aside a[href="/institution/placements"]', waitFor: 'h1' },
      { label: 'Placements' },
      { say: { en: 'And placements show where students were hired, with the employer\'s rating after ninety days.', te: 'Placements లో విద్యార్థులు ఎక్కడ ఉద్యోగం పొందారో, తొంభై రోజుల తర్వాత employer ఇచ్చిన rating కనిపిస్తాయి.', hi: 'और placements में दिखता है कि छात्र कहाँ hire हुए, और नब्बे दिन बाद employer की rating।' } },
      { scroll: 300, pause: 1500 },
      { waitNarration: true }
    ]
  }
];
