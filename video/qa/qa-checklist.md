# QA checklist (run for every video before it goes to video/out/)

## Automatic (script: `npm run video:qa -- <file>`)
- [ ] **Transcript check**: transcribe the voice (local Whisper / sherpa-onnx). Fail if any style/direction sentence was spoken (e.g. "Read the following...", "Warm, sincere...").
- [ ] **Numbers**: every number heard and shown matches `facts.json` (e.g. 98 not 90; 1.2 lakh not 2.5 lakh).
- [ ] **Brand**: every "Qubirex" mention logged with timestamp; flag if the transcript spells it more than one way.
- [ ] **Screen language**: Telugu videos have no English-only titles, labels or captions (allow-list: tech words, brand, URLs, source names).
- [ ] **Overlap**: no frame with two title layers both above 0.1 opacity.
- [ ] **Hold time**: every text layer meets the read-time rule; code >= 5 s.
- [ ] **Code**: every code snippet runs; bug scenes show label + fix + tick.
- [ ] **Loudness**: within +/-1 LU of target; true peak <= -1 dBTP (`ffmpeg -af ebur128`).
- [ ] **Format**: size, 30 fps, duration within manifest range.
- [ ] **Placeholders**: any [FILL] present -> filename ends `-DRAFT`.
- [ ] **Contact sheet** saved: one frame every 2 s -> `video/qa/<name>-sheet.jpg`.

## Human (founder or team)
- [ ] Watch once on a phone at normal size. Can every word on screen be read?
- [ ] Listen to every brand mention.
- [ ] Telugu: native reviewer has signed the script and watched the final cut.
- [ ] Product screens show Telugu mode, sample data, no loading states.
- [ ] Persona scenes carry the "Illustrative story" tag; real people have signed consent.
- [ ] End card shows the right website and contact.
