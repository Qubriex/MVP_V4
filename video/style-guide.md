# Visual style guide

Keep the look of the current pitch videos (dark bokeh background, orange section numbers, white titles, flame logo). Values come from `brand.json`.

## Type sizes (at 1080 px short side)
| Element | 16:9 (1920x1080) | 1:1 (1080x1080) | 9:16 (1080x1920) |
|---|---|---|---|
| Section title | 72 px | 64 px | 80 px |
| Big number | 160 px | 140 px | 180 px |
| Body / label | 40 px | 40 px | 48 px |
| Source line | 24 px, 70% opacity | 24 px | 28 px |
| Captions | 40 px, 2 lines max | 44 px | 52 px, 2 lines max |
| Code | 36 px min | 36 px | 44 px |

Telugu text: use the Telugu font at the same size; allow 15% more line height. Never shrink Telugu text to fit; shorten the line instead.

## Timing
- Text holds at least 1 s per 3 words, minimum 2 s.
- Code holds at least 5 s.
- Fades: 0.4 s. Only one title or text slide visible at a time (no crossfading titles).
- Count-ups: 1.2 s, label visible from the first frame, start from 0 (never count down to the value).
- End card holds 3 s after the voice ends.

## Safe areas
- 16:9: 5% margin all round.
- 1:1: 6% margin.
- 9:16: text inside the middle 80% width; nothing important in the top 12% or bottom 20% (platform UI).

## Product shots
- Recorded at 1440x900, deviceScaleFactor 2.
- Each shot zooms (1.6x-2.2x) to ONE area: lesson panel, code block, passport card, readiness table.
- Slow push-in 3-5%, no spinning or tilted 3D at more than 8 degrees.
- "Sample data" badge visible in the corner.

## Tags and placeholders
- "Illustrative story": small rounded tag, top-left, 24 px, on any persona scene.
- [FILL] placeholders: orange box (#FF8A00) with black text "[FILL: ...]". Any file containing one is exported with `-DRAFT` in its name.

## Audio
- Voice: Cloud TTS Chirp 3 HD (en-IN / te-IN), same voice as Professor Qubirex in the product.
- Music: calm, royalty-free, ducked about 12 dB under the voice.
- Loudness: -14 LUFS (9:16 and 1:1), -16 LUFS (16:9); true peak <= -1 dBTP.
