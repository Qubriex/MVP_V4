# Claude Code prompt: build the 23 Qubirex videos

Paste this whole file into Claude Code, opened at the root of the Qubirex MVP repo, after copying the `video/` folder from this kit into the repo root.

---

## Your role and goal

You are building Qubirex's video set: 23 videos for four audiences (students, institutions, employers, investors), plus fixed versions of the current pitch videos, in English and Telugu.

The kit in `video/` already holds:
- the plan;
- the scripts;
- the only numbers you may use;
- the pronunciation rules;
- the shot list;
- the QA rules.

Your job is to:
1. build the pipeline;
2. record real product screens;
3. voice;
4. edit;
5. run QA;
6. deliver in three phases, stopping after each one for the founder.

**Never invent numbers, results, prices, quotes, people or customer names.** Anything not in `video/facts.json` or a script stays as a visible `[FILL: …]` placeholder, and the file is exported with `-DRAFT` in its name.

---

## 1. Read these first (in this order)

1. `video/manifest.json`: the 23 output files, with phase, language, format, size, target length, captions and loudness.
2. `video/facts.json`: every number allowed, with its screen text, voice text and source line. `founder_fill` holds the blanks.
3. `video/pronunciation.json`: how to say "Qubirex", "Jensen Huang" and the acronyms.
4. `video/brand.json` and `video/style-guide.md`: the look, type sizes, timings and safe areas.
5. `video/scripts/en/*.md`: the English scripts, scene by scene (time, voice, on-screen text, visual).
6. `video/scripts/te/*.md`: the Telugu templates.
   - **Do not voice a Telugu script until its "Native reviewer sign-off" line is filled.**
   - Until then, build Telugu videos with the English voice muted and the on-screen text marked `[TE pending]`, exported as `-DRAFT`.
7. `video/shotlists/app-recording-plan.md`: the screens to record (S01–S11).
8. `video/qa/qa-checklist.md` and `video/qa/qa-config.json`: the checks every file must pass.

Then summarise what you found: the existing pitch-video project (if any), the app routes for each shot, the voice set-up, and the open `[FILL]` items. **Do this before writing code.**

---

## 2. Pipeline set-up

1. **Reuse first.** Search the repo for the project that rendered `qubirex-pitch-60s.mp4` / `qubirex-pitch-3min.mp4` (dark bokeh background, orange section numbers, flame logo). If it exists, extend it.
2. **Otherwise, create `video/` as a Remotion project** (React, same language as the frontend).
   - Folder layout:
     ```
     video/
       src/components/   TitleCard, StatCard, CapsGraphic, PeopleGraphic, BarChart, QuoteCard,
                         CodeCard (bug -> fix -> tick), ProductShot (zoom/pan on a clip),
                         PassportCard, ComparisonTable, StepList, Funnel, EndCard,
                         IllustrativeTag, SourceLine, FillPlaceholder, Captions, FounderClip
       src/videos/       one composition per script id (pitch-60s, pitch-3min, investor-full, ...)
       src/lib/          facts.ts (reads facts.json), pron.ts, timing.ts (scene times from script), lang.ts
       scripts/          voice.ts, record.ts (Playwright), render.ts, qa.ts, parse-script.ts
       assets/           screens/, voice/, music/, founder/
       out/              final files + REPORT.md
       qa/               contact sheets + QA logs
     ```
   - Add npm scripts:
     - `video:parse`: read the script `.md` tables into JSON;
     - `video:voice`;
     - `video:record`;
     - `video:render -- <id>`;
     - `video:qa -- <file>`;
     - `video:all -- --phase N`.
3. **Read the scripts directly.** Every scene's timing, voice line and on-screen text comes from `video/scripts/<lang>/<id>.md`, via `video:parse`. Never retype them into code.
   - In the on-screen column, `/` means a new line.
   - The same script makes the 16:9 and 1:1 employer cuts. In the square cut, re-lay the text to fit; do not shrink it.
4. **Brand.** Fill `brand.json` from `frontend/src/styles/tokens.css` and the existing videos, then treat it as fixed. Use Noto Sans Telugu, or the app's Telugu font, for Telugu text.

---

## 3. Voice

1. Use the app's own voice pipeline:
   - key pool → Cloud TTS **Chirp 3 HD**: `en-IN` for English, `te-IN` for Telugu;
   - use the same voice as Professor Qubirex in the product;
   - fall back to Gemini TTS.

   Never write API key values into any file or log.
2. **Generate one audio file per scene** (`assets/voice/<id>-<lang>-<scene>.wav`), so one bad line can be redone alone. Fit the scene length to the real audio length, plus 0.3 s of padding.
3. **Never send style or direction text as text to be spoken.** The old pitch videos read "Read the following like a young Indian founder…" aloud.
   - If Gemini TTS needs a style, put it in its separate instruction field.
   - Send only the voice-over sentence as the text.
4. **Pronunciation:**
   - Use `pronunciation.json`, with the engine's custom-pronunciation (IPA) feature where it is supported.
   - Otherwise send the `say_en` spelling.
   - In Telugu, write the brand as క్యూబిరెక్స్.
   - If `confirmed_by_founder` is false, render Phase 1 and **ask the founder to confirm** the brand sound before Phase 2.
5. Strip stage directions in square brackets (for example `[Founder on camera]`, `[timer ticking]`) from the text sent to TTS.
6. Founder lines in the investor video come from founder footage (`video/assets/founder/`), not TTS. If the footage is missing, show a "Founder on camera" placeholder card and mark the file `-DRAFT`.

---

## 4. Recording real product screens

Follow `video/shotlists/app-recording-plan.md`:
- use Playwright, at 1440×900, deviceScaleFactor 2, 30 fps, with an injected cursor dot;
- use the dev login stage accounts or the demo sandbox;
- set "Learning in" to Telugu (also record an English take where a shot is used in English reels);
- wait for audio and data to load, so that no loading text, spinners or skeletons appear;
- keep the "Sample data" badge on;
- show no "Test", "TEST-LRNR-…" or real names.

Save the app's own lesson audio when it plays. Mix it in, and duck the narration by 12 dB under it.

Each `ProductShot` zooms to **one** area, with a slow 3–5% push-in. No tilted 3D beyond 8 degrees.

If a shot cannot be recorded, list it in `REPORT.md`. Use a mock-up only if the founder approves, and label it "Design preview".

---

## 5. Editing rules (all videos)

Follow `style-guide.md`. The ones that broke last time:
1. **Screen language = voice language.** In Telugu videos, all titles, labels, captions and the end line are in Telugu. Tech words stay in English.
2. **Numbers** come only from `facts.json`, and the voice and chart must agree.
   - The FY25 bar is **1.2 lakh**.
   - Indian-language content is **98%**.
3. **One title at a time.** No crossfading of two titles.
4. **Read time:** at least 1 s per 3 words, and never less than 2 s. Code holds at least 5 s. Count-ups start from 0, with the label visible from the first frame.
5. **Code cards:** show the bug with the label "Bug: should be +", then the fix, then the green tick. Run every snippet in a test.
6. **Persona scenes** get the "Illustrative story" tag. Real people appear only with a signed consent form (`video/consent/`).
7. **The logo holds 1.5 s** before any section title that follows it.
8. **Captions:** burned in for 9:16 and 1:1; a `.srt` file for 16:9.
9. **Loudness:** −14 LUFS for 9:16 and 1:1, and −16 LUFS for 16:9. True peak ≤ −1 dBTP. Music ducked about 12 dB.
10. **End card:** logo, tagline, action line, `[website]` (from `founder_fill.website`; a placeholder until filled). It holds 3 s after the voice ends.
11. **Exports:** H.264 High, yuv420p, 30 fps, AAC 192 kbps 48 kHz, `+faststart`, with the file names from `manifest.json`.

---

## 6. Phases and stop points

### Phase 1: fix the 4 current pitch videos
Files: `pitch-60s-{en,te}`, `pitch-3min-{en,te}`. The scripts already contain these fixes:
- **60s EN:**
  - 1.2 lakh bar;
  - a 5 s code card with the fix;
  - separated titles;
  - one "1 in 10" line, with "speak" matching on screen and in the voice;
  - Telugu-mode product shots, zoomed.
- **3-min EN:**
  - "98%";
  - the logo held 1.5 s before "03 Our product";
  - the label shown with the count-up;
  - the "Illustrative story" tag on Priya;
  - "Why Qubirex" rewritten (no "translated courses" straw man);
  - pilot step 4 held 3 s.
- **Telugu:**
  - all on-screen text in Telugu;
  - the FY25 bar counts up from 0;
  - the "04 Why now" title separated from the chart;
  - the 3-min cut kept to 2:40 or less, ending on a full sentence.
- **Native check:** first fill the back-translation of the Jensen Huang quote and the "translating" line, for the native reviewer.

**Stop.** Send the 4 files, their contact sheets, `REPORT.md` and the list of Telugu lines waiting for review. Ask the founder to confirm the brand pronunciation and the website.

### Phase 2: investors and institutions (5 files)
Files: `investor-full-en`, `institution-full-{en,te}`, `institution-60s-{en,te}`.
- The investor video uses `founder_fill`. Every empty field stays `[FILL]`, and the file is `-DRAFT`.
- The market funnel uses only `btechSeats`, `apSeats` and `tgSeats`.
- Competitors appear as plain text names, never logos.

**Stop.** Send the files and the open `[FILL]` list.

### Phase 3: employers and students (14 files)
Files: `employer-full-{en,te}`, `employer-square-{en,te}`, `student-reel-{1..4}-{en,te}`, `student-explainer-{en,te}`.
- Reels: 9:16, 30–40 s, the hook in the first 3 s, burned-in captions, and the safe areas from the style guide.

**Stop.** Send everything, plus the final `REPORT.md`.

---

## 7. QA (every file, before it goes to `video/out/`)

Run `npm run video:qa -- <file>`. It implements `video/qa/qa-checklist.md` with the thresholds in `qa-config.json`:
1. **Transcribe the voice back** with a local ASR (the sherpa-onnx Whisper model used in this project, or similar).
   - Fail if any phrase in `bannedSpokenPhrases` is heard.
   - Fail if any number differs from `facts.json`.
   - Log every brand mention with its timestamp.
2. **Telugu screen-text check** against `teluguAllowListEnglish`.
3. **Title overlap**, hold time and code-snippet tests.
4. **Loudness** (`ffmpeg -af ebur128`), size, frame rate and duration against the manifest.
5. **Contact sheet:** one frame every 2 s, saved to `video/qa/<name>-sheet.jpg`.
6. **Report:** write a row in `video/out/REPORT.md`, starting from `REPORT_TEMPLATE.md`.

Never overwrite a passing file with a failing one. A file with any `[FILL]` must be named `-DRAFT`.

---

## 8. Done means

- All 23 files exist in `video/out/`, named as in the manifest. Files with open blanks carry `-DRAFT`.
- Every file passes the automatic QA.
- `REPORT.md` lists:
  - the duration, loudness, voice engine and QA result for each file;
  - the open `[FILL]` items;
  - the Telugu lines waiting for review;
  - any shots that could not be recorded.
- The pipeline re-renders any video with one command (`npm run video:render -- <id>`) after a script or fact changes.
