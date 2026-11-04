# Walkthrough videos

Records the MVP walkthrough videos from the real app (real buttons, test-tenant data) and edits them with ffmpeg. Videos go to `artifacts/walkthrough/` (git-ignored; never commit them). Only these scripts and the narration source are committed.

## Run

```bash
export DEV_LOGIN_SECRET=…        # the deployment's /dev passcode: read from the environment, never shown or logged
export BASE_URL=https://…        # staging (default WALKTHROUGH_STAGING_URL), or http://localhost:3000
npm run walkthrough:all          # reset test data → record every scene → edit every video
```

Behind Vercel Deployment Protection, also set `VERCEL_BYPASS` (Protection Bypass for Automation).

- **One scene again:** `npm run walkthrough:record -- --scene c2-lesson-practise`, then `npm run walkthrough:edit`.
- **One chapter:** `npm run walkthrough:record -- --chapter 3`. **Phone / internal:** `-- --cut phone`, `-- --cut internal`.
- **Edit only some videos:** `npm run walkthrough:edit -- --only chapters,highlights` (`full`, `phone`, `internal`).
- **Music bed:** `npm run walkthrough:edit -- --music path/to/licensed-bed.mp3` (quiet, under everything).
- **Script:** `npm run walkthrough:script` writes `narration-script.md` from the scene files.
- Record Chapter 2 before Chapter 4: the employer sees the candidate who approved the request in Chapter 2. `walkthrough:all` resets the test data and records in order.

## How it works

- **Scenes are data** (`scenes/*.js`): `id`, `title`, `chapter`, `viewport` (`desktop` or `phone`), `account` (a /dev test account, signed in off camera) and `steps`: `goto`, `click`, `type`, `hover`, `scroll`, `wait-for`, `highlight`, `say` (English spoken; Telugu and Hindi subtitles), `label` (a lower-third), plus `select`, `selectText`, `fill`, `press`, `waitText`, `waitNarration`, `pause`. `cuts: ['phone']` or `['internal']` keeps a scene out of the external videos.
- **Recording** (`record.mjs`, `lib/runner.mjs`): Chrome at 1920×1080 drawing the 1440 px layout (CSS zoom, so text is sharp), or 390×844 for the phone. Frames come from Chrome's screencast (JPEG, 92 %) with their real times. A visible cursor (dot, ring on each click, highlight on the element being explained), moves of 400–700 ms, typing at 12–18 characters a second and a 1.2 s pause after each result. `?record=1` (`sessionStorage.qbx_record`) hides the developer bar and the test badges.
- **Narration** (`lib/narration.mjs`): the app's own voice (`POST /api/learner/tts`, key pool → Cloud TTS → Gemini TTS), cached by text. If no server voice answers, the videos are subtitle-only and the record says so.
- **App audio**: what the page plays (lesson voice, sample lesson) is captured with its start time and mixed in; the narration ducks under it.
- **Broken screens**: after every step the page is checked for an error graphic, "Syntax error", "undefined", `mock:`, raw errors, the developer bar or a test badge. A hit stops the scene, saves a screenshot to `artifacts/walkthrough/bugs/`, and the edit refuses that scene.
- **Edit** (`edit.mjs`, `lib/edit.mjs`, `lib/cards.mjs`): waits over 1.5 s are cut (never while someone speaks), cards in the brand fonts (Outfit, Anek) and logo, 300 ms crossfades, lower-thirds, the phone frame, subtitles (SRT and VTT; English, Telugu and Hindi for the full video; burned into the highlights only), `chapters.txt`, a PNG thumbnail per video and loudness at −16 LUFS. `checks.json` lists lengths, sizes, loudness and the subtitle check.
