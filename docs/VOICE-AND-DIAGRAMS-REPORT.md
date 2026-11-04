# Voice and diagrams — report (2 Nov 2026)

Branch `claude/learner-side-updates-vthycg` (PR #20). Production still runs the 30 Oct build; everything below is on the branch preview until it is promoted.

## 1. Why the voice was failing

The health check on the preview (key 2, the voice key, fingerprint `3d2207`, project 711146201037) showed:

| Engine | Result | Google's reason | Meaning |
|---|---|---|---|
| Cloud TTS (Chirp 3 HD, te-IN) | 401 | `API_KEYS_NOT_SUPPORTED` ("API keys are not supported by this API") | These keys are Google AI Studio keys. Cloud Text-to-Speech does not accept this kind of key at all; enabling the API does not change that. |
| Gemini `gemini-2.5-flash-preview-tts` (the old hard-coded default) | 429 | `RESOURCE_EXHAUSTED` | The project's free quota for that model was used up. |
| Gemini `gemini-2.5-pro-preview-tts` | 429 | `RESOURCE_EXHAUSTED` | Same. |
| Gemini `gemini-2.5-flash-tts` | 404 | `NOT_FOUND` | Not offered to this key. |
| Gemini `gemini-3.1-flash-tts-preview`, `gemini-3.8-flash-tts`, `gemini-3.8-flash-lite-tts` | OK | — | These work. |

So the voice "was not available" because:

- the app always tried the old model first;
- Cloud TTS can never work with these keys;
- each lesson sent dozens of small requests into a small, shared quota.

Production (the 30 Oct build) also had no key pool, so keys 2 and 3 were never used there.

## 2. What changed

**Keys by purpose, with failover** (`backend/core/ai/keyPool.js`, the only place that reads the keys):

- Text (teaching, marking, Ask Qubirex, résumé, captions): key 1, then 3, then 2.
- Voice (speech and transcription): key 2, then 3, then 1.
- You can change the order with `QBX_KEYS_TEXT` and `QBX_KEYS_VOICE`.

| Error | What happens |
|---|---|
| 401 / 403 / key not valid / `SERVICE_DISABLED` / `API_KEY_SERVICE_BLOCKED` | That key is skipped for 30 minutes (for that engine only, for voice); the next key answers at once. |
| 429 | That key rests for the time Google asks (default 60 s); the next key answers at once. |
| 5xx / timeout | Same key once more, then the next key. |
| 400 | No switch (another key would get the same answer). |
| 404 for a speech model | That model rests for that key; the next model is tried. |

- **Shared status:** key status is stored in the database (`ai_key_health`) so every server instance avoids a broken key within 30 seconds.
- **No key values anywhere:** keys appear only as slot number plus a 6-character fingerprint, never in logs, health or errors.

**Voice engines:**
- **Order:** Cloud TTS (Chirp 3 HD, Kore) first, then the Gemini speech models each key actually offers. These are read from Google every hour, newest Flash first, then Pro.
- **Model choice:** the model that last worked is remembered per key (`ai_voice_models`). `GEMINI_TTS_MODEL` is only an optional override; if it is not found, the next model is used.
- **One voice:** Professor Qubirex keeps one voice, Kore (female), in Telugu, Hindi and English.

**Fewer, larger requests:**
- **Smaller parts, fewer of them:** long text is spoken in parts under 4,500 bytes on sentence boundaries and joined into one clip. The browser now asks for parts of up to 1,400 characters, not 200–400, so "Listen (2 min)" is a few requests instead of dozens.
- **At most 2 voice requests on their way per learner;** "Walk me through it" fetches the next line while the current one plays.
- **Busy voice (429):** retried quietly for about 6 seconds; only then does the page show the text with the notice. No robotic fallback for Telugu or Hindi.

**Where you can see it:**
- `/api/health?deep=1` → `ai_keys` and `voice_detail.slots`: every voice key × engine with ok, HTTP status, Google's reason and what to do.
- **Admin → Voice check:** the same table, key status and failovers, and a **Play test** per language showing which engine and key answered and the time to first audio.

## 3. Pre-recorded lesson audio

- `npm run voice:prerender` (or **/dev → Tools → Record lesson audio**) records every Python and Java lesson's "Listen" and each "Walk me through it" line, plus the scripted tutor's turns, in all five learning modes. It saves them under exactly the text the page asks for, so learners hear the stored clip with no live call.
- It can be stopped and resumed, and skips clips already recorded.
- **Size of the job:** 2,536 clips, 323,206 characters:

  | Part | Clips per mode | Characters per mode |
  |---|---|---|
  | Listen | about 115 | about 34,000 |
  | Walkthrough lines | 186–284 | 8,000–12,000 |
  | Scripted tutor | 134–157 | 19,000–22,000 |

  Modes: Telugu, Telugu + English, Hindi, Hindi + English, English.
- **Recorded so far: 0.** It has not been run against the real database yet. It needs the voice working first (see 5) and a run on staging/production.
- **Storage cap:** about 6.5 hours of audio. Gemini's voice returns uncompressed WAV (about 1.1 GB for everything), so recording stops at `QBX_PRERENDER_MAX_MB` (default 300 MB). With Cloud TTS (MP3) everything fits in about 90 MB.
- **"In one line":** not recorded, because no page speaks it.

## 4. Diagrams: no error graphic, no raw code

- **Content fixed:** 11 diagrams in 8 lessons (Python py-m1-l1, py-m1-l2, py-m1-l4, py-m4-l5, py-m6-l1; Java jv-m3-l2, jv-m4-l3, jv-m5-l6) did not parse because of `\"` inside labels. They now use `#quot;`.
- **Checked:** all 238 diagrams in `backend/data/courses` and `backend/data/scripted` parse (`npm run diagrams:check`, now in CI) and draw in a real browser, in every language mode.
- **Forms in React / React state and props:** these parse and draw in all three languages; the reported error does not reproduce on this branch.
- **The component** parses first, tells Mermaid not to draw errors, removes anything Mermaid left in the page, and gives up after 6 s. On failure it shows nothing (the lesson goes on), never the error graphic or the diagram code, and logs it for admins (`POST /api/ui-errors`).
- **AI tutor diagrams** are checked on the server and dropped if they cannot be drawn.
- **Error boundaries** around every page section and around charts, the code panel and the voice notice. A broken part shows one line ("This part didn't load." + Try again).
- **Sweep:** 450 pages (public, learner, college, employer and admin; English, Telugu and Hindi; 1440 and 390 px) show no "Syntax error", "mermaid version", "Error:", "Exception", stack trace, "undefined", "NaN", "[object Object]", "mock:", diagram source or error graphic. This runs in CI.

## 5. Founder steps still needed

The health check now says exactly what is needed. On the preview (2 Nov) it shows:

1. **The voice works now without any change from you.** It uses key 2 with `gemini-3.8-flash-tts` in Telugu, Hindi and English. It falls back to key 3, then key 1.
2. **To make Cloud TTS (Chirp 3 HD, small MP3s, much larger quota) the main voice, you need a different kind of key.** Google AI Studio keys (like the three you added) can never call Cloud Text-to-Speech; Google answers "API keys are not supported by this API".
   1. Google Cloud Console → project 711146201037 → **APIs & Services → Enable APIs and services** → search **Cloud Text-to-Speech API** → **Enable**.
   2. **Billing** → make sure a billing account is linked. Chirp 3 HD needs billing, even within the free monthly allowance.
   3. **APIs & Services → Credentials → Create credentials → API key.** This makes a standard Google Cloud key.
   4. Open the new key → **API restrictions → Restrict key** → tick **Generative Language API** and **Cloud Text-to-Speech API** → **Save**.
   5. In Vercel → mvp-v4 → Settings → Environment Variables → **GEMINI_API_KEY_2** → Edit → paste the new key → Save. Do the same for key 3 if you want the backup on Cloud TTS too.
   6. Redeploy, then open `/api/health?deep=1` (or **Admin → Voice check**). `voice_detail.engine` should read `cloud-tts:te-IN-Chirp3-HD-Kore`.
3. **Then run Record lesson audio once** (`/dev → Tools`, staging), or `npm run voice:prerender` with the deployment's database. It records MP3s (about 90 MB). Re-run it after it stops for quota; it resumes where it stopped.
4. **Replace the three keys.** They were pasted into a chat. Create new ones and delete the old ones in Google, then paste the new ones straight into Vercel.
5. **For a real backup against quota limits,** create key 3 in a separate Google Cloud project. Keys in the same project share one quota.
6. **Your decision:** Gemini's voice returns uncompressed WAV, about 10× larger than MP3. If you prefer to stay on the AI Studio keys, the server can compress it to MP3 with an open-source encoder. The only ones available (lamejs) are LGPL-licensed, so I have not added one without your OK.

## 6. Tests

All run locally on this branch on 2 Nov:

- **Backend:** structural 28/28; REST and integration 350/350. These include:
  - key pool: order per job; every failover case; Google reasons; shared key health; no key text in logs, health or errors; streaming never switches mid-stream;
  - voice chain: a Cloud TTS refusal does not disable the key; model 404 → next model; quota → backup key; byte splitting (a 6,000-byte Telugu text becomes 2 parts under 5,000); one-engine parts joined into one clip; a pre-recorded clip served without a live call; newer models' WAV not wrapped twice;
  - TEACH diagrams that cannot be drawn are dropped;
  - the server's speech-text files match the browser's.
- **Frontend:** unit tests 29/29, including:
  - the diagram component renders nothing and leaves no error element;
  - at most 2 voice requests in flight;
  - a quiet retry on 429;
  - giving up after about 6 s.

  Also: `i18n:check` OK (4139 keys); `npm run diagrams:check` 238/238; build OK.
- **Browser (Playwright):**
  - no-ugly-errors sweep 450/450;
  - learner-topics 85/85;
  - learner journey 35/35;
  - dev login 20/20;
  - demo 20/20;
  - smoke passed;
  - team points 12/13, failing only the sample-lesson voice check, because no key is set locally on purpose. Tests never see the real keys.

## 7. Learner check on the preview (Part 3)

Done against the preview `mvp-v4-gfeiq5icf` (commit 9a90daa) with the real keys:

- **Voice check (`/api/health?deep=1&ai=1`):**
  - voice `server`, engine `gemini-3.8-flash-tts`, key 2;
  - live text AI OK on key 1 (`gemini-3.6-flash`, 1.2 s);
  - live voice OK (64 KB in 2.2 s);
  - all three keys `ok`; migration 12 applied.

  Per key:

  | Engine | Result |
  |---|---|
  | Cloud TTS te/hi/en | 401 `API_KEYS_NOT_SUPPORTED` |
  | `gemini-3.8-flash-tts` | works, about 2 s |
  | `gemini-3.1-flash-tts-preview` | works |
  | `gemini-3.8-flash-lite-tts` | works |
  | `gemini-2.5-pro-preview-tts` | 429 `RESOURCE_EXHAUSTED` |
  | `gemini-2.5-flash-preview-tts` | fails |
- **Sample lesson (Telugu, public `/api/sample-lesson`):** 200, `audio/wav`, 465 KB of speech. This showed newer models send a finished WAV that the server wrapped a second time (a click at the start). Fixed in this commit, including clips already stored.
- **Not done:**
  - **Browser walk-through on the preview** ("Listen" in te/hi/en at 0.8/1.0/1.2×, "Walk me through it", a full voice session, diagrams in every lesson): this cloud workspace's network policy blocks `*.vercel.app`, so no browser could open the preview from here. The same flows pass locally in Chromium: learner-topics, team points, and the no-ugly-errors sweep (every Python and Java lesson with a picture, in three languages and two widths, shows its diagram or nothing).
  - **Failover with key 2 made invalid:** I can add a branch-only override in Vercel but cannot remove it from here, so I did not leave one behind. The automated tests cover it. To try it yourself:
    1. Vercel → Settings → Environment Variables → Add `GEMINI_API_KEY_2` = `invalid`, Environment **Preview**, Branch `claude/learner-side-updates-vthycg`.
    2. Redeploy that branch → **Admin → Voice check** → Play test. It should answer from key 3, and key 2 shows `disabled`.
    3. Delete that variable and redeploy.
  - **iPhone Safari and Android Chrome:** no devices here. Please check one lesson's "Listen" and "Walk me through it" on each.
