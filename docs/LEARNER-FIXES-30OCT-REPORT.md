# Learner fixes and learn-by-topic — 30 Oct report (31 Oct additions in §0)

Branch `claude/learner-side-updates-vthycg` (PR #20). Everything below is on this branch. Staging still runs an older build, so none of it is live there yet (see Voice).


## 0. 31 Oct team points

| # | What was wrong | Cause | Fix | How verified | Status |
|---|---|---|---|---|---|
| 31-3 | Reviews → Back went to Skill path | Back used browser history when there was any | New Back rule (below): Reviews returns to its opener, else Home | e2e: Skill path → Reviews → Back = Home; Home → Reviews → Back = Home | Done |
| 31-4 | Opening the voice session signed the learner out | Some routes passed a Google 401/403 (bad or restricted voice/AI key) straight to the app, and the app signed out on **any** 401 | Google 401/403 become 502 (original status kept for diagnosis). Every session 401 now carries a code (`unauthenticated`, `invalid_session`, `access_removed`, `moved_cohort`, `account_inactive`…); the app signs out only on those codes and shows a normal error otherwise | `upstreamErrors.test.js`, `auth.test.js` (codes); e2e: open and use `/learn/session`, still signed in afterwards | Done |
| 31-5 | "Walk me through it" glitched (overlapping or skipped speech) | Each line was a separate speak call chained on timers; a stale "no voice" check fired the next line while the current one still played | One clip per line, all made and cached before playback; clips play one after another on one audio element (never overlapping); the highlight moves when a clip starts. Pause / Previous line / Next line / Replay line. Code is spoken as words (`a + b` → "a plus b", `#` comments read as text, `def` stays "def"). If a line's audio fails, the highlight stays and its text shows; Next moves on | `codeSpeech.test.js`; e2e with a stubbed voice: 6 clips for 6 lines, order 0–5, no overlap, highlight on each line, controls work, no-audio fallback | Done locally; Android and iPhone not tested (no devices here) |
| 31-6 / 31-8 | "Telugu" and "Telugu + English" gave the same text (also Hindi) | The mode was reduced to the main language before any content was made | The exact mode now reaches every content call (request context) and every review-question cache key. **Telugu + English** = the lessons as written (Hyderabad spoken mix). **Telugu** = full Telugu: every English word that is not code becomes Telugu (విలువ, సంఖ్య, జాబితా) or Telugu script (ఫంక్షన్, లూప్); code and code names stay English. Same for Hindi. AI prompts get one style line for the chosen mode. The picker shows a one-line sample of each mode | `learningLanguage.test.js` (lesson, skill page Array methods, review question, AI style line); e2e: lesson text differs (16 vs 28 English words), picker samples | Done. Needs a native speaker's review (open item 1) |
| 31-7 | Explore topics → Back went forward to Python Programming | Browser history | Back rule below | e2e: course page → Explore topics → Home | Done |
| 31-9 | Package (salary band) charts were gone from Jobs & applications | They were only on the job market pages, now hidden | "Packages by role" on Jobs & applications, shown even with the job market hidden: one bar per role from lowest to highest ₹ LPA, a line at the middle, labelled axis, tooltip, Source · date, sample-data badge, phone layout, a table for screen readers | e2e at 1280 and 390 px: 10 roles, ₹ LPA axis, tooltip, source and date, no sideways scroll | Done |
| 31-10 | Readiness showed a separate set of bars per skill | — | One grouped chart: per skill, You now / Your course reaches / Employers ask (horizontal grouped bars, which also fit phones), with the band, "Why this?" and a summary ("3 skills short: HTML & CSS, JavaScript, React"). The per-skill "Add to my plan" stays below the chart. Colours passed colour-blind checks in light and dark | e2e at 1280 and 390 px: one chart, 3 bars per skill, band, summary, Why this? | Done. The radar option for wide screens was not built: the grouped bars read the same at every width |

**Re-test of the same points (31 Oct, later).** Each point was walked again in a browser from the exact place named:
- **Home "Ask anything":** answers in the learning language, with an "Answer in" picker. Answers taken from the lessons now also follow the full / mix style.
- **Reviews → Due now → Continue:** switching language works, but Telugu and Hindi questions showed a raw slot ("{సందర్భం}"). Fixed: the converter never touches `{…}` slots. Tested.
- **Telugu vs Telugu + English (Python course; Attempt history → Array methods):** the two differed by only a word or two. The written Telugu is already nearly full Telugu, so making "Telugu" fuller could not separate them. Now "Telugu + English" also says the common words in English ("ఒక teacher దగ్గర answer పత్రాల… ఐదు grace marks"), while "Telugu" stays full Telugu ("ఒక టీచర్… మార్కులు"). Words that are also everyday Hindi or Telugu ("की", "बस", "पास") are never changed. Tested.
- **Back, voice session, walkthrough, package chart, readiness chart:** pass in the browser test (85/85).

**Back rule (31 Oct).**
- Back always goes one level up the breadcrumb: lesson → its course → Explore topics → Home; Skill path, Reviews and Attempt history → Home; module test/project → its course.
- Only pages opened from several places (Reviews, a lesson, a skill page, a module test/project, the voice session) return to the page that opened them (`from`).
- Back never uses browser history; the browser's own back button still works.
- e2e checks every `/learn/*` route plus the three journeys above.

## 1. Team points (30 Oct)

| # | What was wrong | Cause | Fix | How verified | Status |
|---|---|---|---|---|---|
| 1 | The same opening speech played every time a voice session started | `/session/start` returned the history and the page replayed the first AI message | Resuming plays a short, varied "welcome back" line with where you stopped; old messages stay in the transcript with Replay; a new skill gets its own fresh opening | `scriptedTutor.test.js` (start → leave → start does not replay) | Done |
| 2 | "I'm ready for the check" did nothing | TEACH decided and returned CONTINUE | The server always starts a check (fresh question from the assessment system), with "you can try now; we'll explain again if needed" when little was taught | `scriptedTutor.test.js` (`request_check` and typed "I'm ready for the test" always give CHECK) | Done |
| 3 | Robotic voice ("ration-shop announcement") | The server voice failed on staging and the app silently fell back to the browser voice | Chain: Cloud TTS Chirp3-HD (female) → Gemini TTS, same voice. No silent fallback for Telugu or Hindi: a notice plus text and captions; the phone voice only if chosen in Settings. Speeds 0.8 / 1.0 / 1.2; repeated lines cached. `/api/health?deep=1` reports `voice` | `health.test.js`; browser checks | Done in code. **On staging: needs the founder's step below** |
| 4 | No Back button on most learner pages | No shared back bar | Back plus breadcrumb on every /learn page except Home; ← icon with a label on phones | e2e: 16 routes, each to its parent | Done |
| 5 | Concept, Practice and Reviews always in Telugu | Content used the cohort language only | A learning language (Telugu / Hindi / English / Telugu+English / Hindi+English): cohort default, picker in Settings and on every learning screen; every learner request follows it | API and e2e (lesson English ↔ Telugu, Settings) | Done |
| 6 | Back from a lesson went to Home | The session ignored where it was opened from | `from` is passed from Skill path, a skill page, Reviews and Home; Back and End session return there | e2e (skill page → lesson → Back = skill page; course → lesson → Back = course) | Done |
| 7 | Emerging topics intro audio in Telugu only | Same cause as 5 | Follows the learning language. That page is hidden for now (point 8) | Code path shared with 5 | Done |
| 8 | Job market search failed; job market shown before learning | Exact-text search; no switch | Job market and Emerging topics hidden behind `FEATURE_LEARNER_JOBS` (off). With it on: search tolerates typos and short forms, shows related roles (never an empty page), each role lists the topics it needs with "Add to my topics", and Naukri / LinkedIn / Indeed links carry the role and city only | `marketSearch.test.js` (5 searches, links); e2e (jobs hidden) | Done |
| 9 | The content language could not be changed | No setting | See 5; the English caption toggle stays on Telugu/Hindi content | as 5 | Done |
| 10 | No Back on Career and Me pages | as 4 | as 4 (Jobs, Profile, Résumé, Settings, Notifications included) | e2e | Done |
| 11 | Ask Qubirex always answered in English | The Ask box started in English whatever the learner chose | Answers follow the learning language; an "Answer in" picker re-answers the same question; Telugu typed in English letters ("loop ante enti?") is understood; with no AI key, study questions are answered from the matching lesson | API + e2e ("loop ante enti?" → Telugu, then English) | Done |
| 12 | Reviews → Continue always in Telugu | Questions were made in the cohort language | Made in the learning language; switching while a question is open shows the **same** question (same instance and values) in the new language, with no new attempt and no change to scoring | API + e2e (Telugu → Hindi, same instance, attempt count unchanged) | Done |

### Every content endpoint and its language (Part 2 root cause)

Signed-in learner requests now carry the learning language (`api/middleware/auth.js`). The cohort language is only the default. Each endpoint below uses it:

| Endpoint | Content | Language now |
|---|---|---|
| `POST /learner/session/start`, `/session/message`, `/session/voice` | Lesson (voice), check, welcome back | Learning language (English tutor profile added) |
| `POST /learner/tts` | Spoken lines | The requested language, else the learning language |
| `GET /learner/skill/:node`, `POST …/practice`, `…/task`, `…/challenge`, `/challenge/:id/answer`, `…/help` | Concept, practice, task, spoken challenge | Learning language |
| `GET /learner/reviews/due`, `POST /reviews/:node/start`, `POST /reviews/instances/:id/answer` | Review questions | Learning language; an open question comes back in the current language |
| `GET /learner/reviews/instances/:id/question` (new) | The same open question in another language | The chosen language, same instance |
| `POST /assist/ask` | Ask Qubirex | Learning language, or the "Answer in" choice |
| `GET /learner/lessons/:id`, `…/ask`, `…/check`, `…/testout`, `/modules/:id/test` | Course lessons, questions, checks | Learning language; "Available in X only" when a language is missing |
| `POST /market/topics/:id/intro` | Emerging topics intro audio | Learning language |
| `POST /learner/baseline/*`, `GET /learner/dayone` | Starting check, Day-One | Learning language |
| `GET /catalog/sample/:lesson?language=` | Public free sample | The visitor's choice |

None of these hard-codes English prompts. Code, skill names and technical words stay in English inside Telugu and Hindi text.

## 2. Voice

**31 Oct:** staging could not be re-checked today (this session's Vercel access does not reach the staging deployment). Nothing below changed in what the founder must add: the same names, no new ones. The voice-session sign-out (31-4) is fixed in code whatever the key does: a voice key Google rejects now shows a normal error, never a sign-out.

- **Running on staging now:** the browser fallback. The last deep health check on staging showed:
  - Gemini TTS returning 404 for its model;
  - Cloud TTS failing;
  - staging running an older build (migration 0008).
- **What the founder must do (names only):**
  1. Enable the **Cloud Text-to-Speech API** on the Google Cloud project that owns `GEMINI_API_KEY`. That gives the Chirp3-HD voice.
  2. If needed, set `GEMINI_TTS_MODEL` in Vercel (staging) to a TTS model that key can use. `/api/health?deep=1` lists the models it found.
  3. Deploy this branch to staging (migrations 0010 and 0011).
  4. Check that `/api/health?deep=1` shows `voice: "server"`.
- **iPhone:** not tested; no device here. To check: in iPhone Safari, open a Telugu lesson and tap Listen. You should hear the natural voice, or see the "high-quality voice is not available" notice, never the robotic voice.
- **Same cause in the team-points test:** the public "sample lesson plays" check fails locally (`/api/sample-lesson` 503) because there is no voice key here. It will pass once the server voice works.

## 3. Topic catalog

- **Live and complete in English, Telugu and Hindi**, in the brief's exact order:
  - **Python Programming:** 8 modules, 28 lessons.
    - 1 Fundamentals: Introduction · Variables and data types · Operators · Input and output
    - 2 Control Flow: If / else · For loops · While loops · Break, continue and nested loops
    - 3 Functions: Defining functions · Parameters and arguments · Return values · Scope and recursion
    - 4 Data Structures: Lists · Tuples · Sets · Dictionaries · Strings in depth
    - 5 Files and Errors: Reading and writing files · Exceptions (try / except)
    - 6 OOP: Classes and objects · Inheritance · Polymorphism · Encapsulation
    - 7 Modules and Libraries: Import and your own modules · pip and packages · First look at NumPy and pandas
    - 8 Project: Planning a program · Testing your code, plus the Student results app
  - **Java Programming:** 9 modules, 30 lessons.
    - 1 Fundamentals: Introduction, JDK and JVM · Variables · Operators · Input and output (Scanner)
    - 2 Control Flow: If / else and switch · For loops · While and do-while
    - 3 Methods: Defining methods · Parameters · Return values · Overloading and recursion
    - 4 Arrays and Strings: Arrays · 2D arrays · Strings and StringBuilder
    - 5 OOP: Classes and objects · Constructors · Inheritance · Polymorphism · Abstraction and interfaces · Encapsulation
    - 6 Exceptions and Files: Exceptions · File reading and writing
    - 7 Collections and Generics: ArrayList · HashMap · HashSet · Generics
    - 8 Lambdas and Streams: Lambdas · Streams
    - 9 Project: Designing with classes · Testing with JUnit, plus the Student results app
  - Every module ends with a module test and a small project. Passing both puts the skill group on the Passport, grouped by topic.
- **Drafts ("Draft — needs faculty review"):** JavaScript, SQL, C, DSA, Web basics, React, Data analysis and AI basics. These are module outlines in three languages, with no lessons yet.
- **Completeness checks, both in CI:**
  - `npm run topics:check` passes for Python and Java in all three languages: all 10 parts, the check, the module test and the project.
  - `npm run topics:code` runs every exercise:
    - Python solutions pass their tests, and every Python example prints its stored output;
    - Java examples and solutions compile with javac and print their stored output;
    - every starter fails at least one test.
- **Running code:**
  - Python runs in the browser (Pyodide). NumPy and pandas load on demand when the code imports them.
  - JavaScript runs in a worker, SQL in sql.js.
  - Java answers are checked by their structure until a server sandbox exists (**"Java runner pending"**); the example shows its known output.
- **Test-out ("I already know this"):** a small link on every lesson.
  - It asks that lesson's check questions.
  - Passing marks the lesson **Known**, and the evidence counts like any check.
  - Not passing leaves the lesson open to learn, with no penalty.
- **Professor review:** in the college portal, **Topics** (`/institution/topics`) lets a professor or admin:
  - read any lesson in English, Telugu or Hindi;
  - mark it **Reviewed** per language, or suggest an edit;
  - see 👍 / 👎 feedback from learners.

  Learners of that college then see **"Reviewed by [college] faculty"**. Students → a student → **Extra topics** shows self-chosen courses, only with the student's consent.
- **Where colleges and visitors can see the topics:**
  - `/topics` (public "See our topics", one free sample lesson per course in all three languages, no sign-in, in the top menu);
  - the college demo story ("Review a lesson");
  - `/institution/topics`;
  - learners at `/learn/courses`;
  - /dev → "Learner with 2 topics known".

## 4. Tests

All results below are local runs against this branch on 31 Oct.

- **Backend:**
  - structural: 24 passed;
  - REST and integration: 313 passed. New: `upstreamErrors.test.js` and session codes in `auth.test.js` (31-4), and full language vs mix in `learningLanguage.test.js` (31-6/8).
- **Frontend:** 23 unit tests passed, including `codeSpeech.test.js` (31-5); `i18n:check` OK (4102 keys).
- **Browser (Playwright):**
  - learner-topics: 85/85. New: Back from Reviews, Explore topics, a course page and Attempt history with no forward jumps; the walkthrough plays every line in order with no overlap and its controls work; the voice session never signs out; Telugu vs mix text differs; the package chart shows; readiness shows one grouped chart (both at 1280 and 390 px);
  - learner journey: 35/35;
  - dev login: 20/20;
  - demo: 20/20;
  - smoke: passed (no console errors, no sideways scroll, no duplicate titles);
  - team points: 12/13, failing only the voice check (no voice key locally, see Voice).

## 5. Open items

1. **Telugu and Hindi lesson text needs a native speaker's review** before colleges rely on it. The professor review flow is ready for this.
2. **Voice on staging:** the founder steps above, then an iPhone check.
3. **Java server sandbox:** until it exists, Java answers are checked by structure.
4. **Draft courses need lessons next.** SQL and JavaScript first: they appear in most roles, and their in-browser runners already work.
5. **College programme builder:** colleges currently pick modules through a cohort brief. A pick-modules screen would make this clearer.
6. **NumPy / pandas lesson:** the first run loads about 15 MB in the browser. On slow phones it can take a minute, and the runner allows that.
7. **Full Telugu / Hindi wording (31 Oct):** the full-language mode is made from the reviewed mix text with a word list (`backend/core/language/style.js`, about 200 words). A native speaker should read a few lessons in "తెలుగు" and "हिंदी" and correct the list; English words not in it stay as they are.
8. **Walkthrough on phones:** checked in Chrome desktop with a stubbed voice. Android Chrome and iPhone Safari still need a hand check: open a lesson → See the code → Walk me through it, and listen for one line at a time with the highlight following.
