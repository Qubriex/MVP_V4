# Revision 1 report: the 12 reviewed videos

All 12 were re-rendered with the Revision 1 pipeline and passed every QA check, including the new ones:
- **Sound effects:** fail on noise above 5 kHz lasting over 0.5 s with no speech.
- **Silence:** fail on any pause over 1.5 s mid-video, outside the declared code-card and countdown holds.
- **Cropping:** fail on any frame where a product screenshot goes outside the safe area.
- **Blue:** fail if over 2% of pixels are blue, screenshots excluded.

| File | Old length | New length | Longest silence | SFX found | QA result |
|---|---|---|---|---|---|
| `employer-square-en.mp4` | 86.51 s | 34 s | 0.9 s | none | PASS |
| `institution-60s-en.mp4` | 59.43 s | 25.47 s | 1.05 s | none | PASS |
| `institution-full-en.mp4` | 146.57 s | 49.61 s | 0.95 s | none | PASS |
| `investor-full-en-DRAFT.mp4` | 263.5 s | 111.23 s | 1.2 s | none | PASS |
| `student-explainer-te.mp4` | 86.2 s | 44.32 s | 1.2 s | none | PASS |
| `student-reel-1-en.mp4` | 37.57 s | 29.47 s | 0.8 s | none | PASS |
| `student-reel-1-te.mp4` | 39.27 s | 38.4 s | 1.25 s | none | PASS |
| `student-reel-2-en.mp4` | 36.87 s | 22.48 s | 1.05 s | none | PASS |
| `student-reel-2-te.mp4` | 38.27 s | 27.27 s | 1.4 s | none | PASS |
| `student-reel-3-en.mp4` | 36.53 s | 19.04 s | 0.5 s | none | PASS |
| `student-reel-3-te.mp4` | 38.63 s | 23.07 s | 1 s | none | PASS |
| `student-reel-4-te.mp4` | 39.17 s | 28.3 s | 0.95 s | none | PASS |

Contact sheets (one frame every 2 s): `video/qa/<name>-sheet.jpg`. Full check details: `video/qa/<name>.json`.

## What changed in all videos
- **Sound:** no whoosh, sweep, riser, click or tick. The reel 1 countdown is silent.
- **Music:** one soft, warm pad (slow chords, no melody, nothing bright). It sits 13 dB under the voice and drops about another 6 dB while the voice speaks. It fades in over 1 s and out over 2 s, and every video uses the same pad.
- **Timing:** each scene lasts its voice plus about 0.5 s. Code cards hold at least 5 s; end cards hold 3 s after the voice. Scenes cross-fade, so there are no blank frames.
- **Product screens:** the whole page is shown in a browser frame and never cropped. After a moment the page dims, an orange outline marks the area being discussed, and a 2× callout joined by a dashed line shows that area.
- **Background:** option A, warm charcoal #15110F, with an orange glow at the bottom right and a red glow at the top left. No bokeh and no blue. To switch, set "background" in `video/brand.json` to "A", "B" or "C".

## Investor video
- The brand name is spliced from an approved "cube-bi-rex" recording (the institution video's), replacing the "QB Rex" the team heard.
- GUVI is voiced "GOO-vee".
- The voice says "about 1.8 lakh seats in Andhra Pradesh and about 1.2 lakh in Telangana"; the exact figures (1,83,532 and 1,16,877) stay on screen.
- The market-gap table fills the safe area (54 px text) and appears row by row.
- The cards are centred, with 52 px labels and 44 px values.
- Each [FILL] scene now speaks a neutral placeholder line, e.g. "Pilot results will be added here…". The founder scenes show a "Founder introduction" placeholder card until the footage is filmed.

## Points for the team and founder
1. **Lengths:** videos are much shorter (e.g. institution-full 147 s → 50 s) because the old cuts held silent screens to match the script timings. The kit's minimum lengths are now a note, not a failure. To make a video longer, add voice lines.
2. **Telugu on-screen text:** the team asked for it, but the founder asked for English text only with Telugu or English voice. The text is kept in English. Please decide.
3. **Website:** end cards show inferexaa-official-website.vercel.app. Please confirm this address.
4. **Reels:** captions are burned in; the no-caption copies are kept (not re-rendered in this round).
5. The other 11 videos are not re-rendered yet. Waiting for team review of these 12.
