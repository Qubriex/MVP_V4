# Student reel 1: Spot the bug - TELUGU (template)

- **Script id:** `student-reel-1`
- **Audience:** Engineering students
- **Goal:** Hook with a challenge, show the teaching style, invite to practise.
- **Format:** 9:16 (1080x1920), 30-40 s
- **Languages:** en, te
- **Phase:** 3
- **End action:** Practise free on Qubirex

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
| 1 | 0:00-0:03 | This code has ONE mistake. Find it in 5 seconds. | *draft (Claude):* ఈ కోడ్‌లో ఒకే ఒక్క తప్పు ఉంది. ఐదు సెకన్లలో కనిపెట్టండి. | There is just one mistake in this code. Find it in five seconds. | Find the bug in 5 seconds | (English on screen: founder decision, 18 Nov 2026) |
| 2 | 0:03-0:08 | [timer ticking] | *draft (Claude):* [timer ticking] | (no voice: timer) | def add(a, b):<br>    return a * b | (English on screen: founder decision, 18 Nov 2026) |
| 3 | 0:08-0:20 | The function is called add, so it should add two numbers. But star means multiply. It should be plus. | *draft (Claude):* Function పేరు add, అంటే రెండు numbers ని కలపాలి. కానీ ఇక్కడ star ఉంది, అది multiply చేస్తుంది. Plus ఉండాలి. | The function's name is add, so it should add two numbers. But there is a star here, and it multiplies. It should be plus. | * -> +  (tick) | (English on screen: founder decision, 18 Nov 2026) |
| 4 | 0:20-0:30 | Every line explained in your language. Then you practise, and a fresh check proves it. | *draft (Claude):* ప్రతి లైన్ మీ భాషలో వివరిస్తారు. తర్వాత మీరు ప్రాక్టీస్ చేస్తారు, ఒక fresh check దాన్ని నిరూపిస్తుంది. | Every line is explained in your language. Then you practise, and a fresh check proves it. | Explained in your language / Practise / Fresh check | (English on screen: founder decision, 18 Nov 2026) |
| 5 | 0:30-0:35 | Practise free on Qubirex. | *draft (Claude):* క్యూబిరెక్స్‌లో ఫ్రీగా ప్రాక్టీస్ చేయండి. | Practise for free on Qubirex. | Practise free on Qubirex / [website] | (English on screen: founder decision, 18 Nov 2026) |

**Voiced before review on the founder's go-ahead (18 Nov 2026); a native reviewer should still check every line.**

**Native reviewer sign-off:** Name: ______  Date: ______  Approved: yes / no
