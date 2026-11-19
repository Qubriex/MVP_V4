# Student explainer - TELUGU (template)

- **Script id:** `student-explainer`
- **Audience:** Engineering students (YouTube, website)
- **Goal:** Walk through the full learner journey on real screens.
- **Format:** 16:9 (1920x1080), 75-90 s
- **Languages:** en, te
- **Phase:** 3
- **End action:** Start free on Qubirex

Rules: numbers only from `video/facts.json`; brand said as in `video/pronunciation.json`; text holds >= 1 s per 3 words (min 2 s), code >= 5 s; one title on screen at a time; anything in `[FILL: ...]` renders as an orange placeholder and the export is named `-DRAFT`.

## How to fill this

1. A native Telugu writer fills **Telugu voice-over** and **Telugu on-screen text**, using the everyday Telugu-English mix (tech words such as function, loop, code, return, Python stay in English).
2. Someone else writes the **back-translation** (Telugu -> English) without looking at the English column.
3. Compare back-translation with the English column. Fix any line whose meaning changed.
4. Native reviewer signs off at the bottom. Claude Code must not voice this file until the sign-off line is filled.
5. Lines marked *draft* are starting points only.

Brand in Telugu script: క్యూబిరెక్స్ (Qubirex).

| # | Time | English voice-over (meaning to keep) | Telugu voice-over | Back-translation | English on-screen text | Telugu on-screen text |
|---|---|---|---|---|---|---|
| 1 | 0:00-0:08 | Learning to code is hard enough. Learning it in a language you don't think in is harder. | *draft (Claude):* కోడింగ్ నేర్చుకోవడమే కష్టం. మీరు ఆలోచించని భాషలో నేర్చుకోవడం ఇంకా కష్టం. | Learning to code is hard in itself. Learning it in a language you don't think in is even harder. | Learn in your language | మీ భాషలో నేర్చుకోండి |
| 2 | 0:08-0:17 | [new] Pick a topic, like Python. Each topic is its own course, with modules and lessons in a clear order. | *draft (Claude):* [new] Python లాంటి ఒక topic ఎంచుకోండి. ప్రతి topic ఒక పూర్తి course, అందులో modules, lessons ఒక క్రమంలో ఉంటాయి. | Choose a topic like Python. Every topic is a full course; in it, modules and lessons are in an order. | 1 Learn / Pick a topic | 1 నేర్చుకోండి / ఒక topic ఎంచుకోండి |
| 3 | 0:17-0:27 | Professor Qubirex teaches it in Telugu, Hindi or the mix. [new] Every lesson starts with the idea in one line, in your language. | *draft (Claude):* ప్రొఫెసర్ క్యూబిరెక్స్ దాన్ని తెలుగు, హిందీ, లేదా మిక్స్‌లో నేర్పిస్తారు. [new] ప్రతి lesson మొదట ఆ idea ని ఒక్క లైన్‌లో, మీ భాషలోనే చెబుతుంది. | Professor Qubirex teaches it in Telugu, Hindi or the mix. Every lesson first says the idea in one line, in your own language. | 1 Learn / In Telugu | 1 నేర్చుకోండి / తెలుగులో |
| 4 | 0:27-0:36 | See the code, line by line, [new] with the voice walking you through every line of this small function. | *draft (Claude):* కోడ్‌ని లైన్ బై లైన్ చూడండి. [new] ఈ చిన్న function లో ప్రతి లైన్‌ని వాయిస్ మీకు వివరిస్తుంది. | See the code line by line. The voice explains every line of this small function to you. | 2 See the code / Line by line | 2 కోడ్ చూడండి / లైన్ బై లైన్ |
| 5 | 0:36-0:45 | Practise with hints, and run real tests. [new] Hidden tests check the answer, not just the sample. | *draft (Claude):* Hints తో ప్రాక్టీస్ చేయండి, నిజమైన tests రన్ చేయండి. [new] Hidden tests కేవలం sample ని కాదు, మీ answer ని చెక్ చేస్తాయి. | Practise with hints, run real tests. Hidden tests check your answer, not just the sample. | 3 Practise / Hints and real tests | 3 ప్రాక్టీస్ / Hints, నిజమైన tests |
| 6 | 0:45-0:55 | When you're ready, a fresh check proves you can do it on your own: [new] a new question, answered in your own words. | *draft (Claude):* మీరు రెడీ అయ్యాక, మీరు సొంతంగా చేయగలరని ఒక fresh check నిరూపిస్తుంది. [new] ఒక కొత్త ప్రశ్న, దానికి మీ సొంత మాటల్లో జవాబు. | When you are ready, a fresh check proves you can do it on your own. A new question, and your answer in your own words. | 4 Check / A fresh check | 4 చెక్ / ఒక కొత్త check |
| 7 | 0:55-1:05 | Every skill you prove goes on your signed Capability Passport, [new] with an evidence ID that anyone can verify. | *draft (Claude):* మీరు నిరూపించిన ప్రతి స్కిల్, సంతకంతో ఉన్న మీ కేపబిలిటీ పాస్‌పోర్ట్‌లో చేరుతుంది. [new] దాని evidence ID తో ఎవరైనా verify చేయవచ్చు. | Every skill you proved goes into your signed Capability Passport. Anyone can verify it with its evidence ID. | 5 Passport / Signed, verifiable | 5 పాస్‌పోర్ట్ / సంతకంతో, verify చేయవచ్చు |
| 8 | 1:05-1:12 | Qubirex. Your language. Your skills. Your future. | *draft (Claude):* క్యూబిరెక్స్. మీ భాష. మీ స్కిల్స్. మీ భవిష్యత్తు. | Qubirex. Your language. Your skills. Your future. | Start free / [website] | ఉచితంగా మొదలుపెట్టండి / [website] |

**Voiced before review on the founder's go-ahead (18 Nov 2026); a native reviewer should still check every line.**

**Revision 2 (19 Nov 2026):** one row per product shot (each screen holds at least 4 s with a line about it; `[new]` marks added sentences). Telugu on-screen text is now used in this Telugu file (review: "Do not ship English text in a Telugu file"); it is a Claude draft, so the video shows a `[TE pending]` tag and is named `-DRAFT` until the sign-off below is filled.

**Native reviewer sign-off:** Name: ______  Date: ______  Approved: yes / no
