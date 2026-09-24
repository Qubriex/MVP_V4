# QUBIREX API REFERENCE

Base URL: `http://localhost:3001/api`

All protected routes require: `Authorization: Bearer <token>`

---

## AUTH

| Method | Endpoint | Body | Description |
|---|---|---|---|
| POST | `/auth/institution/login` | `{email, password}` | Institution login |
| POST | `/auth/institution/register` | `{name, type, contact_email, password, city?}` | Register institution |
| POST | `/auth/learner/login` | `{learner_ref, engagement_id, pin}` | Learner login. `pin` is the secret factor — `learner_ref` and `engagement_id` are both shared across a cohort, so neither is sufficient alone. |
| POST | `/auth/admin/login` | `{email, password}` | Admin login |

---

## INSTITUTION (requires institution token)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/institution/profile` | Get institution profile |
| GET | `/institution/learners` | List all learners |
| POST | `/institution/learners` | Add single learner. Response includes `pin` (the login PIN) — shown once, not retrievable afterward. |
| POST | `/institution/learners/bulk` | `{learners:[]}` — Bulk add. Response includes a `learners` array of `{learner_ref, pin}` (or `{learner_ref, skipped: true}` for a duplicate) — shown once, not retrievable afterward. |
| POST | `/institution/capability-targets` | `{title, path, raw_input, language}` — Upload brief (Path A structured or Path B any-format, via CURR) |
| POST | `/institution/capability-targets/:id/confirm` | Confirm Path B extraction — also confirms the CURR brief-store template |
| POST | `/institution/capability-targets/:id/build-pathway` | `{language}` — CURR decomposes clusters into skill nodes + writes node specs |
| POST | `/institution/engagements` | `{capability_target_id, title, language, learner_ids}` |
| GET | `/institution/engagements` | List engagements |
| GET | `/institution/engagements/:id` | Engagement detail + cohort progress (structural only — never session content) |
| GET | `/institution/engagements/:id/skill-requests` | Skills learners asked to add, aggregated (skill, learner count, pending) — no learner identities |
| POST | `/institution/engagements/:id/produce-mastery-logs` | Compile all Mastery Logs |
| GET | `/institution/engagements/:id/mastery-logs` | Get produced logs |

---

## LEARNER (requires learner token)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/learner/dashboard` | Dashboard + progress + streak |
| GET | `/learner/progress` | Full node-by-node progress map |
| POST | `/learner/session/start` | Start or resume session for the current node. Fresh sessions run DIAGNOSE via ORCH. |
| POST | `/learner/session/message` | `{content, session_id?, input_mode?, request_check?}` — primary interaction endpoint. ORCH classifies the request as `DIAGNOSIS_RESPONSE`, `LEARNER_MESSAGE`, or `CHECK_RESPONSE` from session state; `session_id` may be omitted to use the learner's current active session. |
| POST | `/learner/session/check` | Alias for `/learner/session/message` |
| GET | `/learner/session/:sessionId/history` | Full session message history |
| GET | `/learner/doubts` | List learner doubts |
| POST | `/learner/doubts` | `{skill_node_id?, question_text}` — routes to ORCH `DOUBT_QUERY` |
| POST | `/learner/doubts/:id/escalate` | Escalate an unresolved doubt for human review |
| GET | `/learner/study-plans` | List study plans |
| POST | `/learner/study-plans` | `{planned_date, planned_duration_minutes?, notes?}` |
| GET | `/learner/streak` | Current and longest streak |
| GET | `/learner/certificates` | Earned cluster certificates + programme certificate |
| GET | `/learner/mastery-record` | Mastered nodes only, newest first (dashboard, resume) |
| GET | `/learner/path` | The learner's own skill path & record: clusters with node status (mastered / current / upcoming), summary stats, evidence per mastered node. Never includes session content. |
| POST | `/learner/session/voice` | Multipart `audio` (+ `session_id?`, `request_check?`). Transcribed server-side, then handled like `/session/message` with `input_mode: 'voice'`; response adds `transcript`. Browsers with on-device speech recognition post text to `/session/message` instead. Speech out is synthesised in the browser. |
| POST | `/learner/session/heartbeat` | `{session_id, minutes}` — adds active time (≤2 min per call) while the session page is visible |
| PUT | `/learner/notifications` | Update notification preferences |

### Learner portfolio (profile, resume, skill requests)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/learner/profile` | Profile: institution fields (name, ref — read-only), contact, headline, about, goals, self-declared skills, experience, certifications, education[], projects[], `verified_skills` (mastered nodes), `ui_language`, `voice_prefs`, `completeness {pct, sections, missing}`, `has_profile` |
| PUT | `/learner/profile` | Partial update of any editable field. `education` and `projects` are replace-all lists. |
| POST | `/learner/profile/summary-from-speech` | `{transcript}` — learner described themselves in Telugu/Hindi; returns an English resume `summary` |
| POST | `/learner/transcribe` | Multipart `audio` → `{transcript}` (speech-to-text fallback) |
| GET | `/learner/resume` | Latest resume version (or a default draft), version list, profile, saved jobs |
| GET | `/learner/resume/versions/:version` | One saved version |
| POST | `/learner/resume` | `{template, sections[{key,on}], summary, skill_order?, tailored_job_id?}` — saves a new version; never changes the profile |
| POST | `/learner/resume/tailor` | `{job_id}` → `{summary, skill_order}`; only skills that are verified or self-declared can appear |
| GET | `/learner/skill-requests` | Skills this learner asked the institution to add |
| POST | `/learner/skill-requests` | `{skill_name, source?}` — the institution owns the pathway, so learners request, never add |

---

## MARKET (requires learner token)

All market figures are **sample data** (`core/market/sampleMarket.js`) and every response carries `sample: true`. Gap scoring is live against the learner's own mastery.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/market/jobs` | `?q&city&mode&min_salary&min_match&tab=all|saved|applied&sort=match|recent|salary` — scored job cards with skill chips and counts |
| GET | `/market/trends` | `?city` — headline numbers, last six months of demand, skills JDs ask for most (each tagged with the learner's status) |
| GET | `/market/jobs/:id` | Full JD + gap: match %, skills covered, hours to close the gap, per-skill status and evidence |
| GET | `/market/jobs/:id/gap` | Gap only |
| POST / DELETE | `/market/jobs/:id/save` | Save / unsave |
| POST | `/market/jobs/:id/applied` | Mark as applied |
| POST | `/market/jobs/:id/read-aloud` | Spoken walk-through of the JD in the learner's language (`text`, `caption_en`) |
| POST | `/market/jobs/:id/interview` | `{turns[]}` — voice interview practice, 5 questions with feedback. Stateless, not stored, not evidence of mastery |
| GET | `/market/topics` | `?sector` — featured topic + grid, with learning steps tagged by the learner's status |
| POST | `/market/topics/:id/intro` | Spoken two-minute intro in the learner's language |
| GET | `/market/snapshot` | Home dashboard cards: top 3 jobs, skills worth learning next, 3 topics |

Skill status values: `mastered`, `in_progress`, `in_path`, `declared` (self-declared), `requested`, `not_in_path`.

### `/learner/session/message` response shapes

**Instruction turn (CONTINUE or CHECK):**
```json
{
  "session_id": "...",
  "message": "native-language text",
  "caption_en": "1–2 sentence English caption | null",
  "decision": "CONTINUE | CHECK",
  "check_question": "... | null",
  "mermaid": "... | null",
  "code": "... | null",
  "behaviour_signal": "engaged | confused | disengaged | accelerating",
  "approach": "native_concept | analogy | worked_example | decomposition | socratic"
}
```

`request_check: true` is the "I'm ready for the check" button: `content` may be empty, and TEACH is told to set the mastery check this turn. ADVANCE and LOOP responses also carry `caption_en`, `mermaid` and `code`; all three are stored on the message and returned in session history.

**ADVANCE (mastery check passed):**
```json
{
  "result": "advance",
  "decision": "ADVANCE",
  "passed": true,
  "score": 0.85,
  "feedback": "...",
  "message": "...",
  "mastery_increment": 24,
  "mastery_attainment": 87,
  "confidence_indicator": 0.76,
  "next_node": { "id": "...", "label": "..." },
  "programme_complete": false
}
```

**LOOP (mastery check failed):**
```json
{
  "result": "loop",
  "decision": "LOOP",
  "passed": false,
  "score": 0.55,
  "feedback": "...",
  "understanding_gaps": ["..."],
  "message": "the next instruction, already generated with the new approach",
  "next_approach": "analogy",
  "loop_count": 2
}
```

---

## ADMIN (requires admin token)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/admin/stats` | System-wide statistics |
| GET | `/admin/institutions` | All institutions |
| GET | `/admin/mastery-logs/:id` | Get a specific Mastery Log |
| GET | `/admin/quality-report` | Node difficulty + approach effectiveness |

The first admin account is created via `node scripts/seed-admin.js` (server shell access only), not an HTTP route.

---

*Inferexaa Private Limited · Qubirex API Reference v2.0*
