# Video report

One line per video: length, loudness, the voice engine that spoke it, and its QA result. QA details and contact sheets: `video/qa/`.

| File | Length | Loudness | Voice | QA | Notes |
|---|---|---|---|---|---|
| `qa/failed/pitch-3min-en-DRAFT.mp4` | 141.2 s | -16 LUFS (TP -0.8) | Gemini TTS gemini-3.8-flash-tts (en-IN, Kore); Chirp 3 HD not reachable with API keys | FAIL: text: read time held ("Bug: should be +" 1.8 s < 2.0 s); loudness: -16 LUFS ±1, true peak ≤ −1 dBTP (-16 LUFS, true peak -0.8 dBTP) | blanks: [FILL: who pays], [website] |
| `qa/failed/pitch-3min-te-DRAFT.mp4` | 180.94 s | -16 LUFS (TP -4.4) | Gemini TTS gemini-3.8-flash-tts (te-IN, Kore) (earlier recording, reused) | FAIL: text: read time held ("తప్పు: + ఉండాలి" 1.8 s < 2.0 s); format: size, 30 fps, length (1920×1080, 30 fps, 180.94 s (allowed 90–160 s)) | blanks: [FILL: who pays], [website]; native-speaker check of the Telugu lines (⚠ quote line 16; "translating" line 19), then a new voice-over from the proposed tightened script (≤ 2:40) |
| `qa/failed/pitch-60s-en-DRAFT.mp4` | 51.84 s | -16 LUFS (TP -1) | Gemini TTS gemini-3.8-flash-tts (en-IN, Kore); Chirp 3 HD not reachable with API keys | FAIL: text: read time held ("−80%" 1.7 s < 2.0 s; "You're not going to lose your job to an " 7.2 s < 7.3 s; "Bug: should be +" 1.8 s < 2.0 s; "Why not you?" 1.2 s < 2.0 s) | blanks: [website] |
| `qa/failed/pitch-60s-te-DRAFT.mp4` | 54.67 s | -16 LUFS (TP -3.7) | Gemini TTS gemini-3.8-flash-tts (te-IN, Kore) (earlier recording, reused) | FAIL: text: read time held ("మీ భాషలో" 1.7 s < 2.0 s; "“You're not going to lose your job to an" 5.5 s < 7.3 s; "తప్పు: + ఉండాలి" 1.8 s < 2.0 s; "ఆ వ్యక్తి మీరే ఎందుకు కాకూడదు?" 1.8 s < 2.0 s) | blanks: [website]; native-speaker check of the Telugu lines (⚠ quote, line 7), then a new voice-over with the agreed brand pronunciation |
