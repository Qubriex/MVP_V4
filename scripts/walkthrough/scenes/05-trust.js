// Chapter 5 · Trust (about 1 minute): anyone checks the learner's Passport.
export default [
  {
    id: 'c5-verify', chapter: 5, title: 'Anyone can check the Passport', viewport: 'desktop', account: null,
    // Lakshmi Durga's Passport from Chapter 2 (the test learner whose Passport is public).
    setup: async ({ apiAsAccount }) => ({ eid: (await apiAsAccount('journey_s7', 'GET', '/learner/passport')).evidence_id }),
    steps: [
      { goto: '/verify' },
      { label: 'Trust: check any Passport' },
      { say: { en: 'Finally, trust. An employer, a parent, or anyone at all can check a learner\'s Passport with its Evidence ID.', te: 'చివరగా, నమ్మకం. Employer, తల్లిదండ్రులు, ఎవరైనా Evidence ID తో విద్యార్థి Passport ను check చేయవచ్చు.', hi: 'आख़िर में, भरोसा। Employer, माता-पिता, या कोई भी, Evidence ID से छात्र का Passport जाँच सकता है।' } },
      { type: '#eid', text: (v) => v.eid },
      { click: 'main button[type=submit]:has-text("Verify")', waitFor: 'h2:has-text("Skills")' },
      { highlight: 'main section.ln-card >> nth=0', hold: 2400 },
      { waitNarration: true },
      { say: { en: 'Genuine, signed, and fresh. Skills that were really checked, not just claimed.', te: 'నిజమైనది, signed, తాజాది. చెప్పుకున్న skills కాదు, నిజంగా check చేసిన skills.', hi: 'असली, signed और ताज़ा। सिर्फ़ दावा किए गए नहीं, सच में जाँचे गए skills।' } },
      { scroll: 'h2:has-text("Skills")', block: 'start', pause: 2600 },
      { waitNarration: true },
      { label: 'Is this the person in front of you?' },
      { say: { en: 'At an interview, type the candidate\'s name to confirm the Passport is theirs. The name itself is never shown.', te: 'Interview లో candidate పేరు type చేసి, Passport వారిదేనా అని నిర్ధారించుకోండి. పేరు మాత్రం ఎప్పుడూ చూపించదు.', hi: 'Interview में candidate का नाम type करके पक्का कीजिए कि Passport उन्हीं का है। नाम ख़ुद कभी नहीं दिखाया जाता।' } },
      { scroll: '#vname', pause: 400 },
      { type: '#vname', text: 'Lakshmi Durga' },
      { click: 'button[type=submit]:has-text("Check name")', pause: 2400 },
      { waitNarration: true },
      { scroll: '#limits-title', block: 'start', pause: 600 },
      { say: { en: 'And it is honest about its limits: what this check can tell you, and what it cannot.', te: 'తన పరిమితుల గురించి కూడా నిజాయితీగా చెబుతుంది: ఈ check ఏం చెప్పగలదు, ఏం చెప్పలేదు.', hi: 'और यह अपनी सीमाओं के बारे में भी ईमानदार है: यह जाँच क्या बता सकती है, और क्या नहीं।' } },
      { highlight: '#limits-title', hold: 2600 },
      { waitNarration: true },
      { say: { en: 'Your language. Your skills. Your future.', te: 'మీ భాష. మీ skills. మీ భవిష్యత్తు.', hi: 'आपकी भाषा। आपके skills। आपका भविष्य।' }, wait: true }
    ]
  }
];
