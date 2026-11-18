# Qubirex video kit

A ready-to-use template for building 23 videos with Claude Code.

## How to use it
1. **Unzip** the kit and copy the `video/` folder into the root of the Qubirex MVP repo.
2. **Fill in** `FILL_IN.md`: at least the pronunciation, website and contact before Phase 1. The investor blanks can come later.
3. **Telugu:** give `video/scripts/te/*.md` to a native Telugu writer and a reviewer. They fill the Telugu columns and sign off.
4. **Run:** open Claude Code at the repo root and paste in `PROMPT.md`. It builds in 3 phases and stops after each one for your review.

## The 23 videos (full list in video/manifest.json)
| Phase | Audience | Videos | Format | Length |
|---|---|---|---|---|
| 1 | Current pitch, fixed | 60-sec and 3-min, each in EN and TE (4) | 16:9 | 45-55 s / 2:15-2:40 |
| 2 | Investors | 1 full video, EN | 16:9 | 3:30-4:30 |
| 2 | Institutions | Full and 60-sec, each in EN and TE (4) | 16:9 | 2:00-2:30 / 60 s |
| 3 | Employers | Widescreen and square, each in EN and TE (4) | 16:9 + 1:1 | 60-90 s |
| 3 | Students | 4 reels and 1 explainer, each in EN and TE (10) | 9:16 + 16:9 | 30-40 s / 90 s |

## What's inside
```
PROMPT.md                     the detailed Claude Code prompt
FILL_IN.md                    blanks only you can fill (price, pilot result, ask, ...)
README.md                     this file
video/
  manifest.json               all 23 outputs: file name, phase, language, format, length, loudness
  facts.json                  the ONLY numbers allowed, with sources
  pronunciation.json          how to say Qubirex and other names
  brand.json                  colors, fonts, logo (Claude Code fills it from tokens.css)
  style-guide.md              type sizes, timings, safe areas, product-shot rules
  scripts/en/*.md             11 English scripts, scene by scene
  scripts/te/*.md             10 Telugu templates (native writer fills them, reviewer signs off)
  shotlists/app-recording-plan.md   the 11 product screens to record
  qa/qa-checklist.md, qa-config.json  checks every video must pass
  consent/student-consent-form.md     for any real student who appears
  assets/founder/HOW_TO_FILM.md       how to film your 3 clips for the investor video
  out/REPORT_TEMPLATE.md      the build report format
```

The employer square video reuses the employer script, so there are 11 English scripts for 23 videos. The investor video is English only, so there are 10 Telugu templates.

## Important
- No video will show an invented number. Anything missing appears as an orange `[FILL]` box, and the file is named `-DRAFT`.
- Every number in the scripts is checked against the sources listed in `facts.json`.
- Persona scenes (Priya, a TPO, a recruiter) are tagged "Illustrative story".
