# Video report

One line per video. Longest silence is the longest pause in the voice mid-video, outside the declared code-card and timer holds. SFX found lists any noise above 5 kHz lasting over 0.5 s with no speech. QA details and contact sheets: `video/qa/`.

| File | Old length | New length | Longest silence | SFX found | QA result | Loudness | Notes |
|---|---|---|---|---|---|---|---|
| `out/employer-full-en.mp4` | — | 86.51 s | — | — | PASS | -16.3 LUFS (TP -2.5) |  |
| `out/employer-full-te.mp4` | — | 87.11 s | — | — | PASS | -16.4 LUFS (TP -2.6) | Telugu voice not yet native-reviewed; English text on screen |
| `out/employer-square-en.mp4` | 86.51 s | 34 s | 0.9 s | none | PASS | -14 LUFS (TP -2.9) |  |
| `out/employer-square-te.mp4` | — | 87.11 s | — | — | PASS | -15 LUFS (TP -1.6) | Telugu voice not yet native-reviewed; English text on screen |
| `out/institution-60s-en.mp4` | 59.43 s | 25.47 s | 1.05 s | none | PASS | -16 LUFS (TP -2.4) |  |
| `out/institution-60s-te.mp4` | — | 59.2 s | — | — | PASS | -16.1 LUFS (TP -2.2) | Telugu voice not yet native-reviewed; English text on screen |
| `qa/failed/institution-full-en.mp4` | 146.57 s | 49.61 s | 0.95 s | none | FAIL: picture: product shots inside the safe area (559 frames, first at 18.23 s) | -16 LUFS (TP -2.7) |  |
| `out/institution-full-te.mp4` | — | 146.87 s | — | — | PASS | -16.2 LUFS (TP -2.8) | Telugu voice not yet native-reviewed; English text on screen |
| `qa/failed/investor-full-en-DRAFT.mp4` | 263.5 s | 101.2 s | 1.05 s | none | FAIL: text: read time held ("The ask (founder footage to come)" 0.6 s < 2.0 s; "Founder on camera" 0.6 s < 2.0 s; "Founder introduction" 0.5 s < 2.0 s; "Placeholder: film this clip (video/asset" 0.5 s < 2.0 s); picture: product shots inside the safe area (396 frames, first at 33.03 s) | -16 LUFS (TP -2.9) | blanks: [FILL: before X% -> after Y%, N students, Z weeks], [FILL: who pays], [FILL: price per student per year], [FILL: from usage logs], [FILL: gross margin], [FILL: first target], [FILL: pilots, LOIs, colleges in talks], [FILL: one line per person], [FILL: Rs __], [FILL: product %, sales %, content %]; founder footage missing |
| `out/pitch-3min-en-DRAFT.mp4` | — | 141.2 s | — | — | PASS | -16 LUFS (TP -2.3) | blanks: [FILL: who pays], [website] |
| `qa/failed/pitch-3min-te-DRAFT.mp4` | — | 180.94 s | — | — | FAIL: format: size, 30 fps, length (1920×1080, 30 fps, 180.94 s (allowed 90–160 s)) | -16 LUFS (TP -4.4) | blanks: [FILL: who pays], [website]; native-speaker check of the Telugu lines (⚠ quote line 16; "translating" line 19), then a new voice-over from the proposed tightened script (≤ 2:40) |
| `out/pitch-60s-en-DRAFT.mp4` | — | 53.04 s | — | — | PASS | -16.1 LUFS (TP -2.3) | blanks: [website] |
| `out/pitch-60s-te-DRAFT.mp4` | — | 54.67 s | — | — | PASS | -16 LUFS (TP -3.6) | blanks: [website]; native-speaker check of the Telugu lines (⚠ quote, line 7), then a new voice-over with the agreed brand pronunciation |
| `out/student-explainer-en.mp4` | — | 86.2 s | — | — | PASS | -16.3 LUFS (TP -2.4) |  |
| `qa/failed/student-explainer-te.mp4` | 86.2 s | 44.32 s | 1.2 s | none | FAIL: picture: product shots inside the safe area (883 frames, first at 7.07 s) | -16 LUFS (TP -2.9) | Telugu voice not yet native-reviewed; English text on screen |
| `out/student-reel-1-en.mp4` | 37.57 s | 29.2 s | 0.8 s | none | PASS | -14.3 LUFS (TP -2.7) |  |
| `out/student-reel-1-en-nocaptions.mp4` | — | 37.57 s | — | — | PASS | -14.9 LUFS (TP -2.2) |  |
| `qa/failed/student-reel-1-te.mp4` | 39.27 s | 34.8 s | 1.25 s | none | FAIL: text: read time held ("def add(a, b):
    return a + b" 4.8 s < 5.0 s; "+" 4.8 s < 5.0 s) | -14 LUFS (TP -2.9) | Telugu voice not yet native-reviewed; English text on screen |
| `out/student-reel-1-te-nocaptions.mp4` | — | 39.27 s | — | — | PASS | -14 LUFS (TP -2) | Telugu voice not yet native-reviewed; English text on screen |
| `out/student-reel-2-en.mp4` | 36.87 s | 22.48 s | 1.05 s | none | PASS | -14 LUFS (TP -2.8) |  |
| `out/student-reel-2-en-nocaptions.mp4` | — | 36.87 s | — | — | PASS | -14.7 LUFS (TP -1.6) |  |
| `out/student-reel-2-te.mp4` | 38.27 s | 27.27 s | 1.4 s | none | PASS | -14 LUFS (TP -2.9) | Telugu voice not yet native-reviewed; English text on screen |
| `out/student-reel-2-te-nocaptions.mp4` | — | 38.27 s | — | — | PASS | -14.7 LUFS (TP -2.8) | Telugu voice not yet native-reviewed; English text on screen |
| `out/student-reel-3-en.mp4` | 36.53 s | 19.04 s | 0.5 s | none | PASS | -14 LUFS (TP -3) |  |
| `out/student-reel-3-en-nocaptions.mp4` | — | 36.53 s | — | — | PASS | -14.6 LUFS (TP -2.2) |  |
| `out/student-reel-3-te.mp4` | 38.63 s | 23.07 s | 1 s | none | PASS | -14 LUFS (TP -2.9) | Telugu voice not yet native-reviewed; English text on screen |
| `out/student-reel-3-te-nocaptions.mp4` | — | 38.63 s | — | — | PASS | -14.7 LUFS (TP -2.7) | Telugu voice not yet native-reviewed; English text on screen |
| `out/student-reel-4-en.mp4` | — | 36.27 s | — | — | PASS | -14.6 LUFS (TP -1.6) |  |
| `out/student-reel-4-en-nocaptions.mp4` | — | 36.27 s | — | — | PASS | -14.6 LUFS (TP -1.6) |  |
| `out/student-reel-4-te.mp4` | 39.17 s | 28.3 s | 0.95 s | none | PASS | -14 LUFS (TP -3.8) | Telugu voice not yet native-reviewed; English text on screen |
| `out/student-reel-4-te-nocaptions.mp4` | — | 39.17 s | — | — | PASS | -14 LUFS (TP -1.4) | Telugu voice not yet native-reviewed; English text on screen |
