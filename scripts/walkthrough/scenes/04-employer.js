// Chapter 4 · The employer (2–3 minutes). The verified test company, signed
// in off camera. Record after Chapter 2: the candidate approved there appears here.
export default [
  {
    id: 'c4-home', chapter: 4, title: 'Employer home', viewport: 'desktop', account: 'employer_verified',
    steps: [
      { goto: '/employer/home' },
      { label: 'Employer home' },
      { say: { en: 'For an employer, home shows who is waiting for a decision, the hiring funnel, and open roles.', te: 'Employer కి home లో నిర్ణయం కోసం ఎవరు ఎదురుచూస్తున్నారు, hiring funnel, open roles కనిపిస్తాయి.', hi: 'Employer के home पर दिखता है कि किसके फ़ैसले का इंतज़ार है, hiring funnel, और खुले roles।' } },
      { highlight: 'section:has(h2:has-text("waiting for your decision"))', hold: 2600 },
      { scroll: 'h2:has-text("Open roles")', pause: 1000 },
      { waitNarration: true }
    ]
  },
  {
    id: 'c4-role', chapter: 4, title: 'A new role from a job description', viewport: 'desktop', account: 'employer_verified',
    steps: [
      { goto: '/employer/roles?new=1' },
      { label: 'New role from a job description' },
      { say: { en: 'Paste a job description, and Qubirex picks out the skills. Here we use the sample.', te: 'Job description paste చేస్తే Qubirex skills వెతికి తీస్తుంది. ఇక్కడ sample వాడుతున్నాం.', hi: 'Job description paste कीजिए, Qubirex उसमें से skills निकाल लेता है। यहाँ हम sample इस्तेमाल कर रहे हैं।' } },
      { click: 'button:has-text("Use a sample job description")', pause: 1200 },
      { click: 'button:has-text("Pick out the skills")', waitFor: '#r-bar' },
      { waitNarration: true },
      { label: 'Your bar vs the market' },
      { say: { en: 'Each skill shows how often the market asks for it, next to your own bar.', te: 'ప్రతి skill ని market ఎంత తరచుగా అడుగుతుందో, మీ bar పక్కనే చూపిస్తుంది.', hi: 'हर skill के साथ दिखता है कि market उसे कितनी बार माँगता है, आपके अपने bar के बगल में।' } },
      { scroll: 'text=Skills · your target vs the market', block: 'start', pause: 600 },
      { hover: 'text=% of posts', pause: 2000 },
      { waitNarration: true }
    ]
  },
  {
    id: 'c4-colleges-for-role', chapter: 4, title: 'Best colleges for a role', viewport: 'desktop', account: 'employer_verified',
    steps: [
      { goto: '/employer/roles/test-role-0002' },
      { label: 'Best colleges for this role' },
      { say: { en: 'For each role, Qubirex shows which colleges have learners closest to your bar. Watch a college, or request to see candidates.', te: 'ప్రతి role కి, మీ bar కి దగ్గరగా ఉన్న learners ఏ colleges లో ఉన్నారో Qubirex చూపిస్తుంది. College ని watch చేయండి, లేదా candidates ని చూడడానికి request పంపండి.', hi: 'हर role के लिए Qubirex दिखाता है कि किन colleges के learners आपके bar के सबसे क़रीब हैं। College को watch कीजिए, या candidates देखने की request भेजिए।' } },
      { scroll: 'h2:has-text("Best colleges for this role")', block: 'start', pause: 1200 },
      { hover: 'main button[data-demo="request"]', pause: 2400 },
      { waitNarration: true }
    ]
  },
  {
    id: 'c4-candidate', chapter: 4, title: 'Find candidates and see the evidence', viewport: 'desktop', account: 'employer_verified',
    steps: [
      { goto: '/employer/pipeline' },
      { label: 'Find candidates' },
      { say: { en: 'Harsha approved the request in the learner\'s chapter. Now the employer sees the name and the evidence.', te: 'Learner భాగంలో Harsha request ఆమోదించారు. ఇప్పుడు employer కి పేరు, ఆధారాలు కనిపిస్తాయి.', hi: 'Learner वाले हिस्से में Harsha ने request मंज़ूर की थी। अब employer को नाम और सबूत दिखते हैं।' } },
      { click: 'main a[href="/employer/candidates/test-j-s8-pipe"]', waitFor: 'h2:has-text("Skills this role asks for")' },
      { scroll: 'h2:has-text("Skills this role asks for")', block: 'start', pause: 2400 },
      { waitNarration: true },
      { label: 'Move to interview' },
      { say: { en: 'One click moves Harsha to interview.', te: 'ఒక్క click తో Harsha interview కి వెళ్తారు.', hi: 'एक click में Harsha interview में पहुँच जाते हैं।' } },
      { click: 'main button:has-text("interview")', pause: 2200 },
      { waitNarration: true }
    ]
  },
  {
    id: 'c4-tools', chapter: 4, title: 'Day-One templates, pipeline and sponsoring', viewport: 'desktop', account: 'employer_verified',
    steps: [
      { goto: '/employer/templates' },
      { label: 'Day-One templates' },
      { say: { en: 'Day-One templates are short, supervised runs of real first-week work.', te: 'Day-One templates అంటే మొదటి వారం చేసే నిజమైన పనిని పర్యవేక్షణలో చేసే చిన్న పరీక్షలు.', hi: 'Day-One templates पहले हफ़्ते के असली काम के छोटे, निगरानी वाले अभ्यास हैं।' } },
      { hover: 'main .ln-card:has-text("Data analyst")', pause: 2000 },
      { waitNarration: true },
      { click: 'nav a[href="/employer/pipeline"], aside a[href="/employer/pipeline"]', waitFor: 'h2:has-text("Funnel")' },
      { label: 'Pipeline' },
      { say: { en: 'The pipeline follows every candidate from request to offer.', te: 'Request నుంచి offer వరకు ప్రతి candidate ని pipeline చూపిస్తుంది.', hi: 'Pipeline हर candidate को request से offer तक दिखाता है।' } },
      { click: 'main button:text-is("Interview")', pause: 1800 },
      { waitNarration: true },
      { click: 'nav a[href="/employer/sponsor"], aside a[href="/employer/sponsor"]', waitFor: '#sp-s' },
      { label: 'Sponsor a cohort' },
      { say: { en: 'An employer can also sponsor a whole cohort at a college. We stop before sending.', te: 'Employer ఒక college లో మొత్తం cohort ని sponsor చేయవచ్చు. పంపకముందే ఆగుదాం.', hi: 'Employer किसी college के पूरे cohort को sponsor भी कर सकते हैं। भेजने से पहले हम रुकते हैं।' } },
      { type: '#sp-m', text: 'We would like to sponsor 20 students for the data analyst track.' },
      { waitNarration: true }
    ]
  },
  {
    id: 'c4-insights', chapter: 4, title: 'Colleges & insights, verify in bulk', viewport: 'desktop', account: 'employer_verified',
    steps: [
      { goto: '/employer/colleges' },
      { label: 'Colleges & insights' },
      { say: { en: 'Colleges and insights compare skill supply with demand, and say when a sample is small.', te: 'Skills సరఫరా, డిమాండ్ ని Colleges & insights పోలుస్తుంది; sample చిన్నదైతే అదీ చెబుతుంది.', hi: 'Colleges & insights skills की supply और demand मिलाता है, और sample छोटा हो तो वह भी बताता है।' } },
      { scroll: 'h2:has-text("Skill supply vs demand")', block: 'start', pause: 2200 },
      { waitNarration: true },
      { click: 'nav a[href="/employer/verify-bulk"], aside a[href="/employer/verify-bulk"]', waitFor: '#bv' },
      { label: 'Verify in bulk' },
      { say: { en: 'And Verify in bulk checks a whole list of Evidence IDs at once. This is a sample list.', te: 'Verify in bulk ఒకేసారి Evidence IDs జాబితా మొత్తాన్ని check చేస్తుంది. ఇది ఒక sample జాబితా.', hi: 'और Verify in bulk एक साथ Evidence IDs की पूरी सूची जाँचता है। यह एक sample सूची है।' } },
      { fill: '#bv', text: 'evidence_id\nQBX-DEMO-0000\nQBX-NOT-REAL1\n' },
      { click: 'button.ln-btn-primary:has-text("Verify")', pause: 2600 },
      { waitNarration: true }
    ]
  }
];
