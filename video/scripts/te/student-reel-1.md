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
| 1 | 0:00-0:03 | This code has ONE mistake. Find it in 5 seconds. | *draft:* Ee code lo OKA mistake undi. 5 seconds lo kanukkondi. |  | Find the bug in 5 seconds |  |
| 2 | 0:03-0:08 | [timer ticking] |  |  | def add(a, b):<br>    return a * b |  |
| 3 | 0:08-0:20 | The function is called add, so it should add two numbers. But star means multiply. It should be plus. | *draft:* add ante rendu numbers kalapali. Kani ikkada * undi, adi multiply chestundi. + undali. |  | * -> +  (tick) |  |
| 4 | 0:20-0:30 | Every line explained in your language. Then you practise, and a fresh check proves it. | *draft:* Prati line mee bhasha lo explain chestundi. Tarvata practice, fresh check tho proof. |  | Explained in your language / Practise / Fresh check |  |
| 5 | 0:30-0:35 | Practise free on Qubirex. | *draft:* Qubirex lo free ga practice cheyyandi. |  | Practise free on Qubirex / [website] |  |

**Native reviewer sign-off:** Name: ______  Date: ______  Approved: yes / no
