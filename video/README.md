# Qubirex videos

Short videos for four audiences, in English and Telugu. They are built from
story files with the motion engine of the earlier pitch videos
(`scripts/walkthrough/lib/story.html`: dark bokeh background, orange section
numbers, the flame logo, brand colours and fonts).

| Path | What it is |
|---|---|
| `facts.json` | The only place numbers live. Stories build their charts, labels and source lines from it, and QA checks the voice against it. Add a statistic only when the founder supplies it with a source. |
| `pronunciation.json` | How names are said: "Qubirex" = KYOO-bih-rex (until the founder confirms), "Jensen Huang" = HWAHNG. |
| `stories/*.js` | One file per video: the script (and, for Telugu, an English back-translation per line), the sections and what is on screen. |
| `shots.mjs` | Product screens: real screens from a running app, as stills at 1440×900 ×2, signed in as the demo sandbox's sample people, with "Learning in" set to Telugu. Refuses a shot with test labels or "Getting the audio ready…" on screen. |
| `build.mjs` | Builds one video: voice → transcript check → line timing → per-scene audio, holds and the brand clip → frames → music ducked under the voice, two-pass loudness → `.srt` and `scripts/<name>.md` → QA → `out/`. |
| `qa.mjs` | The automatic checks (below). |
| `out/` | Videos that passed QA, their `.srt` captions, and `REPORT.md` (one line per video). Videos are never committed. |
| `qa/` | One JSON per video with every check, a contact sheet (one frame every 2 s), the brand clip used, and `failed/` for videos that did not pass. |

## Run it

```bash
# 1. A local copy of the app with the demo sandbox on (backend: DEMO_ENABLED=true),
#    served at http://localhost:3000 (or set BASE_URL).
node video/shots.mjs --lang te                # product screens → video/work/shots/te/
# 2. One video (needs the Gemini keys in backend/.env for the voice; PYTHON = a
#    Python with pocketsphinx, for English line timing).
node video/build.mjs video/stories/pitch-60s-en.js
PREVIEW=3,12,30 node video/build.mjs …        # stills only
REDO=4 node video/build.mjs …                 # voice line 4 again on its own
```

## Rules the build enforces

- **The voice gets only the words to say.** No style or direction text is ever sent (an
  earlier voice read its instructions aloud). The transcript is checked against the script.
- **The brand is said one way.** Every "Qubirex" in a video is the same recorded clip
  (`qa/<name>-brand.wav`); every mention is logged with its time for a human listen.
- **Blanks are never invented.** `[FILL: …]` and `[website]` render as orange placeholders,
  and the file is named `-DRAFT` until they are filled and pending checks are done.
- **One title at a time.** A section's first slide waits until the big section title has
  moved to its corner chip.
- **QA before `out/`:** no style text heard; numbers heard = script = `facts.json`; one brand
  pronunciation; Telugu videos have no English-only titles or labels (tech words and the
  brand allowed); never two titles at once; read time ≥ 1 s per 3 words and ≥ 2 s (code ≥ 4.5 s);
  loudness within ±1 LU of the target with true peak ≤ −1 dBTP; size, 30 fps and length.
  A video that fails stays in `qa/failed/` and never replaces a passing one.

## Voice engine

The brief asks for Cloud TTS Chirp 3 HD first. It refuses API keys (it needs a
service account), so the voice is Gemini TTS (`en-IN` / `te-IN`, voice Kore),
sent only the script. Gemini TTS has no custom-pronunciation field, so the brand
is written phonetically in the text sent to it.
