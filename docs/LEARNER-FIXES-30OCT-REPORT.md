# Learner fixes — 30 Oct report

Branch `claude/learner-side-updates-vthycg`. Everything below is on that branch; nothing is deployed to staging yet (see Voice).

## Team points

| # | What was wrong | Cause | Fix | How verified | Status |
|---|---|---|---|---|---|
| 1 | No health signal for voice; failures were silent | Voice was never checked | `/api/health?deep=1` reports `voice: server \| browser-fallback \| off` and names what is missing | `health.test.js` | Done |
| 2 | Telugu/Hindi fell back to a robotic browser voice without saying so | Silent fallback in `voice.js` | No silent fallback; a notice instead. Browser voice only via Settings → "Use my phone's voice" | Unit + e2e | Done |
| 3 | Resuming a lesson replayed the opening | Session start re-sent the first turn | Resume sends a varied "welcome back" line; a new skill gets a fresh opening | `scriptedTutor.test.js` | Done |
| 4 | "I'm ready for the check" sometimes kept teaching | The orchestrator decided | `request_check` always gives a CHECK from the assessment system, with an "early" note when little was taught | `scriptedTutor.test.js` | Done |
| 5 | Repeated audio was synthesised every time | No cache | Speech cache (memory + `tts_cache`, max 5000 rows); speeds 0.8 / 1.0 / 1.2 | Integration tests | Done |
| 6 | Learning language could not be changed; some screens ignored it | Language came only from the cohort | Learning language (telugu / hindi / english / telugu_en / hindi_en): cohort default, picker in Settings and on lesson, course, skill, session, Reviews and Emerging topics; every learner request follows it; "Available in X only for now" instead of a silent switch | API test + e2e (lesson English ↔ Telugu, Settings) | Done |
| 7 | English sessions crashed | Tutor had no English profile | English tutor profile added | `scriptedTutor.test.js` | Done |
| 8 | No Back button on many learner pages | No shared back bar | Back + breadcrumb on every /learn page except Home; history, then `from`, then the logical parent | e2e: 16 routes + "back to the course it came from" | Done |
| 9 | Job market shown to every learner | No switch | Hidden behind `FEATURE_LEARNER_JOBS` (default off); Home is learning-only; market links go Home | e2e | Done |
| 10 | Job search missed typos and short forms | Exact substring match | Tolerant search (typos, swapped letters, js / front end / reactjs…), related roles, "Add to my topics", Naukri / LinkedIn / Indeed links with role and city only | `marketSearch.test.js` (5 searches + links) | Done (visible only with the flag on) |
| 11 | No structured courses | — | Course → Module → Lesson, teach-first lessons (Learn → See the code → Practise → Check), runners (Python via Pyodide, JS, SQL; Java structure check), test-out, module test + project → Passport skill group | `courses.test.js` (13), e2e | Done |
| 12 | No Python / Java content | — | Python 8 modules / 28 lessons, Java 9 modules / 22 lessons, all ten parts in en, te, hi | `topics:check` + `topics:code` in CI | Done |
| 13 | Colleges could not see or review topics | — | College Topics page, review per language, "Reviewed by [college] faculty" badge, Students → Extra topics (with consent), public "See our topics" + free sample, demo story step | API tests + e2e | Done |
| 14 | No test account for "learner with topics known" | — | Journey account "Learner with 2 topics known" on /dev | `learnerJourney.test.js`, `courses.test.js` | Done |

## Voice

- **Running on staging:** browser fallback. The last deep health check showed the server voice failing: Gemini TTS returned 404 for `gemini-2.5-flash-tts`, and Cloud TTS also failed. Staging is still on migration 0008, so it runs an older build than this branch.
- **What the founder must do (names only, no values):**
  1. On the Google Cloud project that owns `GEMINI_API_KEY`, enable the **Cloud Text-to-Speech API**.
  2. If that project cannot use the default TTS model, set `GEMINI_TTS_MODEL` in Vercel (staging) to a TTS model the key can use. `/api/health?deep=1` lists the models it found.
  3. Deploy this branch to staging (it brings migration 0010).
  4. Then open `/api/health?deep=1` and check that it says `voice: server`.
- **iPhone:** not verified. No device was available here. To check: Safari on an iPhone, open a Telugu lesson, tap Listen. It should either play the server voice or show the notice, never the robotic voice.

## Topic catalog

- **Live:** Python Programming (8 modules, 28 lessons) and Java Programming (9 modules, 22 lessons). Both are complete in English, Telugu and Hindi: every lesson has all ten parts plus a check, and every module has a test and a project.
- **Drafts:** JavaScript, SQL & Databases, C, DSA, Web Basics, React, Data Analysis and AI Basics. These are module outlines only (en / te / hi), marked "Draft — needs faculty review".
- **Completeness checks:**
  - `npm run topics:check` fails CI if Python or Java has any gap.
  - `npm run topics:code` runs every exercise: solutions must pass, starters must fail, and Java examples must compile and print their stored output.
- **Test-out:** "I already know this" on any lesson asks that lesson's check questions. Passing marks the lesson Known (evidence kind `testout`); not passing leaves it open, with no penalty.
- **Review:** College Topics (`/institution/topics`) lets a professor or admin:
  - read any lesson in en / te / hi;
  - mark it Reviewed per language, or suggest an edit;
  - see learner 👍 / 👎 feedback.
  Learners of that college then see "Reviewed by [college] faculty".
- **Where to see it:**
  - `/learn/courses` (learner)
  - `/institution/topics` (college)
  - `/topics` (public; one free sample lesson per course)
  - /dev → "Learner with 2 topics known"

## Open items

1. **Voice on staging:** the founder steps above; then confirm on an iPhone.
2. **Java runner:** a server sandbox is pending. Java answers are checked by structure, and the example shows its known output. The UI says "Java runner pending".
3. **Draft courses:** need lessons and faculty review before they can be marked complete.
4. **College programme builder:** colleges pick modules through a new cohort's brief for now. There is no drag-and-drop builder yet.
5. **`/learn/jobs` stays visible:** it holds employer requests and the demo's approve step, so it is not behind the flag. The market and emerging topics are.
