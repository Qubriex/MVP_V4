# Walkthrough videos: report (4 Nov 2026)

Recorded from a local copy of this branch (the network policy of the build workspace blocks `*.vercel.app`, so staging could not be opened), with the seeded test tenant only. Videos are in `artifacts/walkthrough/` (git-ignored, not committed).

## Videos

| Video | Length | Size | Target |
|---|---|---|---|
| `qubirex-walkthrough-full.mp4` | 12:05 | 44.2 MB | 12–16 min ✓ |
| `qubirex-highlights-90s.mp4` (subtitles burned in) | 1:23 | 6.1 MB | 75–90 s ✓ |
| `chapter-01-public.mp4` | 2:07 | 8.5 MB | ~2 min |
| `chapter-02-learner.mp4` | 5:25 | 17.7 MB | 5–6 min ✓ |
| `chapter-03-college.mp4` | 2:07 | 8.7 MB | 2–3 min ✓ |
| `chapter-04-employer.mp4` | 1:33 | 5.5 MB | 2–3 min, short |
| `chapter-05-verify.mp4` | 0:41 | 2.5 MB | ~1 min, short |
| `qubirex-learner-phone.mp4` | 1:26 | 3.9 MB | 2–3 min, short |
| `qubirex-internal-full.mp4` (internal only) | 12:42 | 46.8 MB | — |

All are 1920×1080, 30 fps, H.264 with AAC audio. Each has a PNG thumbnail plus `.srt` and `.vtt` subtitles (English; the full video also has Telugu and Hindi). Every subtitle cue is at most 2 lines of about 42 characters.

Chapters of the full video (`chapters.txt`):

```
0:00 Introduction
0:04 1. The public site
2:12 2. A learner's day
7:37 3. The college
9:44 4. The employer
11:17 5. Trust
11:58 Talk to us
```

## Voice

- **Narration: subtitle-only in this run.** The narration was going to use the app's own voice: key pool → Gemini TTS (Cloud TTS refuses AI Studio keys). Google's free tier allows **10 speech requests per day per model for the project**. `gemini-3.8-flash-tts` and `gemini-3.1-flash-tts-preview` were used up after 21 of about 120 lines, and `gemini-3.8-flash-lite-tts` allows 3 a minute. Half-voiced videos would be worse, so this run is subtitle-only, with English subtitles burned into every video. The 21 voiced lines stay cached.
- **To get spoken narration:** run `npm run walkthrough:all` after the daily reset or once billing is on. Better: use the standard Google Cloud key for Cloud TTS described in `docs/VOICE-AND-DIAGRAMS-REPORT.md` §5.
- **Lesson voices played live** (captured and mixed in):
  - the Telugu sample lesson on Home;
  - "Listen" in Telugu (desktop and phone);
  - "Walk me through it" (desktop and phone);
  - the voice session.
- **No voice (quota):** "Hear Professor Qubirex" on the welcome step and the admin Voice check. The wait was trimmed and the screens showed no error.
- **Loudness:** −16 LUFS where there is sound. Chapters 3–5 and the highlights have no app audio in this run, so they are silent (−70).

## Re-record

```bash
export DEV_LOGIN_SECRET=…   # read from the environment, never shown
export BASE_URL=…           # staging, or http://localhost:3000
npm run walkthrough:all                                        # everything
npm run walkthrough:record -- --scene c2-lesson-practise && npm run walkthrough:edit   # one scene
```

See `scripts/walkthrough/README.md`.

## Bugs found and fixed (this branch)

| Page | What appeared | Fix |
|---|---|---|
| Learner → Attempt history | Empty evidence badges; screen readers heard "undefined (L1): what it means" | Badges show the level and assurance words; `CodeTag` never renders an empty label |
| Public → Verify (sample Passport) | "Commissioned by [Institution name]" | "Sample college" |
| Employer → Verify in bulk | A CSV header `evidence_id` was counted and checked as an ID ("Verify 2") | Header names are skipped |
| Test-tenant data (every side) | "[Company name] verified (test)", "Test Coordinator", "Test Learner", "… — Test Batch" | Sample names marked "(sample)" in the seed. The college stays "Qubirex Test Institution" because tests use that name. |

`artifacts/walkthrough/bugs/` also holds screenshots from scene runs that stopped while selectors were being set up (a button not yet found). None of them is an app error, and no published video contains a broken screen.

**Minor, not fixed:**
- On the phone, a button just scrolled into view can sit under the fixed tab bar, so a tap lands on the tab bar. The pages could add `scroll-padding-bottom` for the tab bar.
- After the lesson check the result says "Passed" while the label stays "Partial". This is correct (Confirmed needs passes spread over time), so the caption says "passed".

## Open items

- **`[CONTACT_EMAIL]`** on the closing card: please send the address.
- **Music:** none. Pass a licensed bed with `--music file.mp3`.
- **Narration script** (`scripts/walkthrough/narration-script.md`): written in simple Indian English with Telugu and Hindi subtitles. Nobody has reviewed it yet.
- **Voice:** re-run when there is TTS quota (see Voice).
- **Lengths:** the phone video, Chapter 4 and Chapter 5 are under their targets. More scenes can be added as data in `scripts/walkthrough/scenes/`.
- **Staging:** record against staging once this branch is deployed there and a browser can reach it.
