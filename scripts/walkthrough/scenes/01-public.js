// Chapter 1 · The public site (about 2 minutes). No sign-in.
// Narration: English (spoken), Telugu and Hindi (subtitles).
export default [
  {
    id: 'c1-home', chapter: 1, title: 'Home and the sample lesson', viewport: 'desktop', account: null,
    steps: [
      { goto: '/' },
      { label: 'Qubirex · qubirex.in' },
      { say: { en: 'This is Qubirex. Students learn in their own language, prove what they can do, and get hired on that proof.', te: 'ఇది Qubirex. విద్యార్థులు తమ భాషలో నేర్చుకుంటారు, తాము ఏం చేయగలరో నిరూపిస్తారు, ఆ రుజువుతో ఉద్యోగం పొందుతారు.', hi: 'यह Qubirex है। छात्र अपनी भाषा में सीखते हैं, दिखाते हैं कि वे क्या कर सकते हैं, और उसी सबूत पर नौकरी पाते हैं।' }, wait: true },
      { label: 'One tap: English, Telugu or Hindi' },
      { say: { en: 'The whole site changes language in one tap. Here it is in Telugu, and in Hindi.', te: 'ఒక్క tap తో site మొత్తం భాష మారుతుంది. ఇదిగో తెలుగులో, హిందీలో.', hi: 'एक tap में पूरी site की भाषा बदल जाती है। यह रही तेलुगु में, और हिंदी में।' } },
      { click: '.ui-lang-full button[lang="te"]', pause: 1600 },
      { click: '.ui-lang-full button[lang="hi"]', pause: 1600 },
      { click: '.ui-lang-full button[lang="en"]', pause: 900 },
      { waitNarration: true },
      { label: 'A sample lesson, spoken in Telugu' },
      { say: { en: 'Press play to hear a sample lesson. Professor Qubirex explains in Telugu, and the code stays in English.', te: 'Play నొక్కి ఒక sample lesson వినండి. Professor Qubirex తెలుగులో వివరిస్తారు, code మాత్రం English లోనే ఉంటుంది.', hi: 'Play दबाकर एक sample lesson सुनिए। Professor Qubirex तेलुगु में समझाते हैं, code English में ही रहता है।' }, wait: true },
      { click: 'button[aria-label="Play the sample lesson"]', pause: 9000 },
      { click: '.pb-play', pause: 600 }
    ]
  },
  {
    id: 'c1-sides', chapter: 1, title: 'For learners, colleges and employers', viewport: 'desktop', account: null,
    steps: [
      { goto: '/' },
      { say: { en: 'Qubirex has three sides. Learners learn and build a Capability Passport.', te: 'Qubirex కి మూడు వైపులు ఉన్నాయి. విద్యార్థులు నేర్చుకుని Capability Passport తయారు చేసుకుంటారు.', hi: 'Qubirex के तीन हिस्से हैं। छात्र सीखते हैं और अपना Capability Passport बनाते हैं।' } },
      { click: 'header a[href="/learners"], nav a[href="/learners"]', waitUrl: '**/learners' },
      { scroll: 420, pause: 900 },
      { waitNarration: true },
      { say: { en: 'Colleges see who is ready, who is stuck, and what to teach next.', te: 'ఎవరు సిద్ధంగా ఉన్నారు, ఎవరు ఆగిపోయారు, తర్వాత ఏం నేర్పాలి అనేది colleges చూస్తాయి.', hi: 'Colleges देखते हैं कि कौन तैयार है, कौन अटका है, और आगे क्या पढ़ाना है।' } },
      { click: 'header a[href="/colleges"], nav a[href="/colleges"]', waitUrl: '**/colleges' },
      { scroll: 420, pause: 900 },
      { waitNarration: true },
      { say: { en: 'And employers hire on checked skills, not just marks on paper.', te: 'Employers కాగితం మీద marks కాకుండా, పరీక్షించిన skills చూసి ఉద్యోగం ఇస్తారు.', hi: 'और employers काग़ज़ पर लिखे marks नहीं, जाँचे हुए skills देखकर hire करते हैं।' } },
      { click: 'header a[href="/employers"], nav a[href="/employers"]', waitUrl: '**/employers' },
      { scroll: 420, pause: 900 }
    ]
  },
  {
    id: 'c1-topics', chapter: 1, title: 'See our topics', viewport: 'desktop', account: null,
    steps: [
      { goto: '/' },
      { click: 'header a[href="/topics"], nav a[href="/topics"]', waitFor: '[data-public-course]' },
      { label: 'Topics: Python, Java and more' },
      { say: { en: 'Anyone can see the topics. Python and Java are complete, from the first lesson to the project.', te: 'Topics ఎవరైనా చూడొచ్చు. Python, Java మొదటి lesson నుంచి project వరకు పూర్తిగా ఉన్నాయి.', hi: 'Topics कोई भी देख सकता है। Python और Java पहले lesson से project तक पूरे तैयार हैं।' } },
      { highlight: '[data-public-course]', hold: 2600 },
      { say: { en: 'Try a free lesson, no sign-in needed.', te: 'Sign in లేకుండా ఒక free lesson ప్రయత్నించండి.', hi: 'बिना sign in के एक free lesson आज़माइए।' } },
      { click: 'a[data-sample-link][href="/topics/sample/py-m1-l1"]', waitFor: 'h1' },
      { scroll: 520, pause: 1400 },
      { scroll: '[data-code-panel]', pause: 1600 },
      { click: 'button:text-is(\'print("Hello")\')', pause: 1600 }
    ]
  },
  {
    id: 'c1-demo', chapter: 1, title: 'The live demo', viewport: 'desktop', account: null,
    steps: [
      { goto: '/' },
      { click: 'header a[href="/demo"], nav a[href="/demo"]', waitFor: 'h1' },
      { label: 'Live demo: try it as a learner, college or employer' },
      { say: { en: 'The live demo lets anyone try Qubirex as a learner, a college, or an employer, with sample data that clears itself.', te: 'Live demo లో ఎవరైనా learner గా, college గా, employer గా Qubirex ప్రయత్నించవచ్చు. Sample data దానంతటదే తొలగిపోతుంది.', hi: 'Live demo में कोई भी learner, college या employer बनकर Qubirex आज़मा सकता है। Sample data अपने-आप हट जाता है।' } },
      { hover: 'main button:text-is("Start")', pause: 1200 },
      { hover: 'main button:text-is("Start") >> nth=2', pause: 1200 },
      { hover: 'main button:text-is("Start") >> nth=4', pause: 1200 }
    ]
  },
  {
    id: 'c1-verify', chapter: 1, title: 'Verify a Passport', viewport: 'desktop', account: null,
    steps: [
      { goto: '/' },
      { click: 'header a[href="/verify"], nav a[href="/verify"]', waitFor: '#eid' },
      { label: 'Verify a Capability Passport' },
      { say: { en: 'Anyone can check a Passport. Type the Evidence ID from the card. This is a sample.', te: 'ఎవరైనా Passport ను check చేయవచ్చు. Card మీద ఉన్న Evidence ID type చేయండి. ఇది ఒక sample.', hi: 'कोई भी Passport जाँच सकता है। Card पर लिखा Evidence ID type कीजिए। यह एक sample है।' } },
      { type: '#eid', text: 'QBX-DEMO-0000' },
      { click: 'main button[type=submit]:has-text("Verify")', waitFor: 'h2:has-text("Skills")' },
      { highlight: 'main section.ln-card >> nth=0', hold: 2200 },
      { say: { en: 'It is genuine and unchanged. Each skill shows how it was checked.', te: 'ఇది నిజమైనది, మార్పు లేనిది. ప్రతి skill ఎలా check చేశారో చూపిస్తుంది.', hi: 'यह असली है और बदला नहीं गया। हर skill के साथ लिखा है कि उसे कैसे जाँचा गया।' } },
      { scroll: 'h2:has-text("Is this the person")', block: 'center', pause: 600 },
      { waitNarration: true },
      { label: 'What this check can and can’t tell you' },
      { highlight: '#limits-title', hold: 1200, keep: true },
      { say: { en: 'It also says plainly what this check can and cannot tell you.', te: 'ఈ check ఏం చెప్పగలదో, ఏం చెప్పలేదో కూడా స్పష్టంగా చెబుతుంది.', hi: 'यह साफ़ बताता है कि यह जाँच क्या बता सकती है और क्या नहीं।' }, wait: true },
      { unhighlight: true },
      { say: { en: 'To confirm the person in front of you, type their name and press Check name.', te: 'మీ ముందు ఉన్న వ్యక్తి వారేనా అని తెలుసుకోవడానికి, వారి పేరు type చేసి Check name నొక్కండి.', hi: 'सामने बैठा व्यक्ति वही है या नहीं, यह जानने के लिए नाम type करके Check name दबाइए।' } },
      { type: '#vname', text: 'Lakshmi Rao' },
      { click: 'button[type=submit]:has-text("Check name")', pause: 2200 }
    ]
  }
];
