# Developer login and the 19 Oct fixes: report

## 1. How to use the developer login

- **URL:** `https://<your-deployment>/dev`. Enter the passcode once, then
  press **Open** on any role card. A purple bar at the bottom of every page
  shows which test account you are using and when the session ends. From that
  bar you can switch role, change language, get phone-view help, or end the
  session.
- **Turn it on** in Vercel → mvp-v4 → Settings → Environment Variables (names
  only, values never in code or chat):
  - `DEV_LOGIN_ENABLED` = `true`;
  - `DEV_LOGIN_SECRET` = the passcode, 32+ characters, marked Sensitive;
  - `DEV_LOGIN_ALLOWED_IPS` (optional): your office or home IPs, comma-separated;
  - `QBX_SEED_TEST_DATA` = `1` so the test accounts exist (or press
    **Reset test data** on /dev).
  
  Then redeploy.
- **Make a strong passcode** on your own computer with `openssl rand -base64 48`
  and paste it straight into Vercel. Share it with testers via a password
  manager.
- **Turn it off:** delete `DEV_LOGIN_ENABLED` and redeploy. `/api/dev/*` then
  answers 404, and `/dev` goes to the home page. Changing the passcode ends
  every unlocked browser at once.
- **Recommendation:** run it on a **staging** deployment (a Vercel Preview of
  a `staging` branch with its own Neon database), not on production. It is
  safe on production too, because it can only open the test accounts and
  their data is walled off, but staging keeps test traffic and resets away
  from real users. The steps are in `docs/DEPLOY-VERCEL.md` → "Developer login".

## 2. Role cards and test accounts (no passwords here)

| Card | Test account | Opens at |
|---|---|---|
| Learner (Telugu) | `TEST-LRNR-001`, Telugu cohort | `/learn/dashboard` |
| Learner (Hindi) | `TEST-LRNR-HI1`, Hindi cohort (new) | `/learn/dashboard` |
| Learner, first time | `TEST-LRNR-NEW`, no profile yet (new) | `/learn/welcome` |
| College admin | Test Coordinator, `test.institution@qubirex.local` | `/institution/home` |
| Professor | Lakshmi Rao, `test.professor@qubirex.local` (test cohort only) | `/institution/home` |
| Employer, verified | `test.employer.verified@qubirex.local`, KYB approved (new) | `/employer/home` |
| Employer, verification pending | `test.employer@qubirex.local`, KYB pending | `/employer/home` |
| Platform admin | `test.admin@qubirex.local`, sees only the test tenant | `/admin/overview` |
| Public site | no sign-in; language reset to English | `/` |

**Tools on /dev:**
- **Reset test data**, with a confirmation step.
- **Skip waits:**
  - verify the test companies (KYB and domain);
  - clear PIN and sign-in lockouts for test accounts;
  - make the test learners' reviews due now.
- **Sample Passport** opens the test learner's Passport on /verify.
- **Current build** shows the version, commit, deploy time, environment and
  whether the AI is mock or live.

## 3. Security checklist

| Rule (A1) | Status | Test |
|---|---|---|
| Opens only the fixed test accounts, never a real one | ✅ | `devLogin.test.js` "refuses anything but a fixed test account key" (real IDs, test IDs, `__proto__`) and "refuses a test account whose row has left the test tenant" |
| Off by default: `/api/dev/*` returns 404 and `/dev` goes home | ✅ | "every /api/dev route answers 404 when DEV_LOGIN_ENABLED is unset" |
| Passcode checked on the server in constant time; 32+ characters or the deployment refuses to start | ✅ | "also 404 when enabled with a passcode under 32 characters, and the deployment refuses to start"; `vercel/handler.js` and `server.js` stop at startup |
| 5 tries per 15 minutes per IP; the 6th is refused | ✅ | "a wrong passcode is 401, and the 6th try … is rate-limited" (the count is kept in the database, so it holds across instances) |
| Optional IP allowlist | ✅ | "404 from an IP outside DEV_LOGIN_ALLOWED_IPS" |
| The secret never reaches the frontend, logs or repo | ✅ | `npm run check:build` checks `build/` for `DEV_LOGIN_SECRET`, `JWT_SECRET` and the old fake tokens; the audit test checks wrong passcodes are not stored |
| Real JWT sessions with `dev: true` and `actor: "developer"`, lasting 8 hours | ✅ | "issues a real session with dev: true, actor "developer", 8 hours, and audits it" |
| Audit log: who, role, when, IP | ✅ | same test (`dev_audit` row with session and IP) |
| Client fake-token bypass and DevNav removed | ✅ | `DevNav.js` deleted, `REACT_APP_DEV_MODE` removed; `npm run check:build` passes and catches a planted `dev-learner-token` |
| Logging out uses `revokeActorSessions` | ✅ | "switching ends the previous developer session, and End signs the account out" |
| Test learners never appear in real employers' search (and the reverse) | ✅ | "a real employer finds the real student but never the test learner …" |
| Test data never counted in benchmarks or admin numbers | ✅ | "test colleges never count in a real college's regional benchmark" and "real admin numbers leave the test tenant out" |
| Real users never see test data; test sessions never see real data | ✅ | the same tests, plus jobs, applications and sponsorships filtered by `is_test` (`core/hiringLoop.js`) |
| Staging and production setups written up | ✅ | `docs/DEPLOY-VERCEL.md` → "Developer login" |

The browser check `frontend/e2e/dev-login.mjs` passed 17 of 17:
- it unlocked (after a wrong passcode) and opened all 8 role cards, each
  reaching its home page with no console errors;
- it switched role and language from the bar;
- on a phone, the bar sits above the learner tab bar;
- Skip waits worked, and ending the session signed out.

## 4. Part B issues

Most of Part B shipped in PR #15. This round adds what the new brief asked
for beyond that.

| # | Root cause | Fix | Files | How verified | Status |
|---|---|---|---|---|---|
| B4 | Browsers have no Telugu voice, and the old Play depended on one | Plays real audio from the server's teaching voice, with Play/Pause/Replay, a loading state and a message on failure. **New:** the Vercel build records the sample to a static file, so visitors don't trigger a live AI call | `HeroDemo.js`, `scripts/record-sample-lesson.js`, `scripts/vercel-build.js`, `core/sampleLesson.js` | `team-points.mjs` checks an audio element actually plays, both from the shipped file and from the API fallback; also on an emulated Pixel 5 with a tap | ✅ (real recording needs `GEMINI_API_KEY` at build time; see open items) |
| B8 | A stale sign-in token plus a global 401 redirect sent visitors to employer sign-in | Optional sign-in on the contact route; redirects only inside portals; messages go to Admin → Messages. **New:** the confirmation reads "Thanks, we'll get back to you within 1 working day", and the reply-to (email or WhatsApp number) is checked in the browser and on the server | `TalkToUs.js`, `routes/shared.js`, i18n | `team-points.mjs` (URL unchanged, confirmation visible); `sharedKit.test.js` (stored; a missing or invalid reply-to returns 400) | ✅ |
| B9 | The button was disabled until two words were typed | Always answers Match / Unclear / No match, never shows the stored name, explains when no Passport has been checked, and shows a loading state | `Verify.js`, `routes/verify.js` | `team-points.mjs` (all three results); `verifyName.test.js` | ✅ |
| B6 | The images were plain `<img>` tags | Click opens a larger view with Close, Esc, arrow keys, swipe, and keyboard focus. **New:** alt text on each thumbnail | `Home.js` | `team-points.mjs` (opens, next, Esc closes, alt text present) | ✅ |
| B1 | The hero kept a three-language tagline | Shows only the selected language | `Home.js` | `team-points.mjs` in English, Telugu **and Hindi** | ✅ |
| B5 | The home page repeated the header's Sign in menu | Section removed | `Home.js` | `team-points.mjs`; RTL test | ✅ |
| B10 | Developer links sat on Verify | Moved to the footer's "For developers" page | `Verify.js`, `Developers.js` | `team-points.mjs` | ✅ |
| B7 | Wording tied learning to the phone | "Learn in your own language, at your own pace", plus **new** "Works on your phone and laptop." (en/te/hi) | i18n, `Home.js` | `team-points.mjs` | ✅ |
| B2 | Header logo carried an unreadable tagline | Logo without the tagline (cropped, not redrawn) | `BrandLogo.js`, `public/brand/*notag*` | `team-points.mjs` | ✅ |
| B3 | Footer tagline too small | Tagline shown as normal text under the logo | `PublicShell.js` | `team-points.mjs` | ✅ |

Overall checks:
- `npm run build` passes.
- Frontend unit tests: 15 of 15.
- Backend: 23 structural tests and 224 others.
- `i18n-check`: 3,166 keys.
- The smoke test on every route had no console errors, no overflow at 360 or
  1440 px, no axe serious or critical issues, and no duplicate titles.

## 5. Speed

All numbers below were measured locally (built site plus API on the same
machine), as the median of 3 runs.

| | Before (password or PIN form) | After (/dev) |
|---|---|---|
| Sign in as college admin, from submit to home loaded | 1,200 ms, plus typing email and password | 1,070 ms from one click, no typing |
| Sign in as learner | 1,125 ms, plus typing ref, join code and PIN | about 1,000 ms from one click |
| Home page first load | 667 ms | unchanged |
| Lockouts | 5 wrong tries lock the account or IP for 15 minutes | not possible for test accounts via /dev; **Skip waits** clears any |

**Cold start.** Changes made:
- Every cold start used to check migrations inside a locked transaction and
  load every migration file. It now makes one query, and does the full check
  only when a migration is actually pending.
- The four secrets kept in the database used to be read one at a time
  (8 queries). They are now read in one query.
- On a Neon database that takes the cold start from about 13 queries to
  2–3 before the first request is served.

What I could and couldn't measure:
- Locally, the cold start stayed about 600 ms. That figure is dominated by
  starting the local in-process database (PGlite), so the saving doesn't show
  up here.
- I couldn't measure the live Vercel/Neon cold start: reading the deployment
  needs you to approve my Vercel team access.

What I left unchanged, with reasons:
- **Function memory:** left at the default.
- **Region:** the functions run in Washington, D.C. (iad1) next to the US
  database. Moving both to Mumbai is the biggest remaining win for India; the
  steps are in `DEPLOY-VERCEL.md`.
- **Module loading:** the heaviest optional modules (the PGlite import, the
  AI SDK, multer) each take under 60 ms to import, so lazy-loading them isn't
  worth the risk.

**Visitor IPs.** On Vercel the API now trusts one proxy hop (`TRUST_PROXY=1`),
so rate limits and lockouts see each visitor's own IP. Before this, everyone
may have appeared to come from the platform's address, so one person's wrong
passwords could lock out others. That is a likely cause of the lockouts
testers hit, but I couldn't confirm it on the live site. The limits
themselves are unchanged for real users.

## 6. Open items

- **Pre-recorded sample voice:** the build records it only when
  `GEMINI_API_KEY` is available to the build. I couldn't record it here
  because there is no AI key in this environment and Google's TTS is
  blocked. Until it is recorded, Play uses the live voice, then the browser's
  voice. You can also record it once by hand with
  `cd backend && GEMINI_API_KEY=… node scripts/record-sample-lesson.js`, and
  commit `frontend/public/audio/`.
- **`[CONTACT_EMAIL]`:** enquiries are stored and shown in Admin → Messages.
  Email forwarding to an address still needs a mail provider and the address
  you want.
- **Live check on Vercel:** I couldn't load the deployment from here. After
  deploying, open `/api/health?deep=1`, then `/dev`.
- The Hindi and first-time learners, and the verified test employer, are new
  seed rows. They appear after the next seed or **Reset test data**.
- **Logo:** the header logo without the tagline is a clean crop of the
  existing file (no redraw or recolour). A designer-made file can replace
  `public/brand/qubirex-logo-notag-*.png` at any time.
- **iPhone Safari:** the audio playback isn't tested on real iPhone Safari,
  only Chromium (desktop and an emulated phone).

## 7. Deploy steps

1. Merge the branch `claude/learner-side-updates-vthycg` into a `staging`
   branch (or open its Vercel Preview).
2. Connect a staging Neon database to **Preview**. In Vercel, set for
   **Preview only**:
   - `DEV_LOGIN_ENABLED=true`;
   - `DEV_LOGIN_SECRET` (from `openssl rand -base64 48`);
   - optionally `DEV_LOGIN_ALLOWED_IPS`;
   - `QBX_SEED_TEST_DATA=1`;
   - `GEMINI_API_KEY`, so the build records the sample lesson.
3. Seed the staging database, **staging only**:
   `cd backend && DATABASE_URL='<staging connection string>' QBX_SEED_REMOTE=1 npm run seed:test`
4. Deploy and check:
   - `/api/health?deep=1` shows migration `0007_test_tenant_and_dev_audit`;
   - `/dev` unlocks and every card opens.
5. Promote: merge to `main`. Production gets the Part B fixes and the test-tenant
   wall. The developer login stays off there unless you also set the
   variables for Production.
