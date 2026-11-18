# Video report

One line per video: length, loudness, the voice engine that spoke it, and its QA result. QA details and contact sheets: `video/qa/`.

| File | Length | Loudness | Voice | QA | Notes |
|---|---|---|---|---|---|
| `qa/failed/pitch-60s-en-DRAFT.mp4` | 50.24 s | -16 LUFS (TP -1.5) | Gemini TTS gemini-3.8-flash-tts (en-IN, Kore); Chirp 3 HD not reachable with API keys | FAIL: text: read time held ("Source: AISHE 2023–24" 1.8 s < 2.0 s; "Source: India Skills Report 2026" 1.9 s < 2.0 s; "తెలుగు" 1.8 s < 2.0 s; "हिंदी" 1.5 s < 2.0 s; "English" 1.2 s < 2.0 s; "In your language" 0.0 s < 2.0 s) | blanks: [website] |
