# QUBIREX API REFERENCE

Base URL: `http://localhost:3001/api`

All protected routes require: `Authorization: Bearer <token>`

---

## AUTH

| Method | Endpoint | Body | Description |
|---|---|---|---|
| POST | `/auth/institution/login` | `{email, password}` | Staff sign-in (admin, professor, viewer). The institution's contact email signs in as an admin staff account (created on first use). Token carries `id` = institution id and `staff_id`. |
| GET | `/auth/staff/invite/:token` | — | Invite details (email, role, department, institution, inviter, cohorts) |
| POST | `/auth/staff/invite/:token/accept` | `{password}` (≥10 chars) | Accept a staff invite (or a password-reset link) and sign in |
| POST | `/auth/institution/register` | `{name, type, contact_email, password, city?}` | Register institution |
| POST | `/auth/learner/login` | `{learner_ref, join_code, pin}` | Learner sign-in. `join_code` is the cohort's short code (e.g. `QX-FSA-7K2`, typed loosely); the old `engagement_id` UUID is still accepted. PIN is the secret factor. 5 wrong PINs lock the enrolment (423) until staff reset it; removed students get 403. Response has `must_change_pin` after a one-time PIN. |
| GET | `/auth/learner/invite/:token` | — | Student invite details (name, ref, cohort, join code) |
| POST | `/auth/learner/invite/:token/accept` | `{pin}` (6 digits) | Student sets their own PIN from the invite and is signed in |
| POST | `/auth/learner/pin-reset-request` | `{learner_ref, join_code}` | "Forgot PIN?" — flags the student for staff. Always 200; never reveals whether the student exists. |
| POST | `/auth/admin/login` | `{email, password}` | Admin login |

---

## INSTITUTION (requires a staff token)

Every route runs as a staff member. **Admin**: the whole institution. **Professor**: only cohorts assigned to them (`staff_cohorts`). **Viewer**: everything, read-only (only `/me` is writable). Role and status are read from the database on every request. Cohort ("engagement") routes return 404 for cohorts outside the caller's institution or scope.

| Method | Endpoint | Who | Description |
|---|---|---|---|
| GET | `/institution/profile` | all | Institution profile |
| GET | `/institution/overview` | all | Home: cohorts in scope with stats, alerts (never signed in, stuck nodes, PIN reset requests), KPIs, market pulse, job-match summary |
| GET / PUT | `/institution/me` | all | Own staff profile: name, title, designation, department, employee ID, phone, qualification, years teaching, specialisations, teaching languages, subjects, office hours, target roles, photo (data URL ≤ 300 KB), notification prefs |
| PUT | `/institution/me/password` | all | `{current_password, new_password}` |
| GET | `/institution/team` | admin | Staff with role, status (active / invited / expired / disabled), cohorts |
| POST | `/institution/team/invites` | admin | `{email, name?, role, department?, engagement_ids[]}` → `invite_url` (email delivery is not wired yet; the message is recorded in `outbound_messages`) |
| POST | `/institution/team/:id/resend` | admin | New invite link; for an active member it is a password-reset link |
| PUT | `/institution/team/:id` | admin | `{role?, department?, status?: 'disabled'|'active', engagement_ids?}` — keeps at least one active admin |
| GET | `/institution/capability-targets` | all | Targets with cluster/node counts |
| POST | `/institution/capability-targets` | admin | `{title, path, raw_input, time_window_weeks?}` — Path B extraction is language-neutral |
| POST | `/institution/capability-targets/:id/confirm` | admin | Confirm Path B extraction |
| POST | `/institution/capability-targets/:id/build-pathway` | admin | `{language}` **required** (telugu / hindi); 409 if already built |
| POST | `/institution/engagements` | admin | `{capability_target_id, title, language, professors: [{id, cohort_role: 'lead'|'co'}]}` → `{engagement_id, join_code}`. The target must belong to the caller and have a built pathway. Students are added with `/students/enrol`. |
| GET | `/institution/engagements` | all | Cohorts in scope with join code, counts, progress, professors |
| GET | `/institution/engagements/:id` | all | Cohort detail: KPIs, clusters (where students are), hardest nodes (loops only), pathway, learners with access state |
| PUT | `/institution/engagements/:id` | admin | `{title?, status?, professors?}` |
| POST | `/institution/engagements/:id/join-code` | admin, professor | New join code (old one stops working) |
| GET | `/institution/engagements/:id/skill-requests` | all | Skills students requested, aggregated (no identities) |
| POST | `/institution/engagements/:id/produce-mastery-logs` | admin, professor | `{complete?: boolean, learner_ids?: []}` — scoped to the caller. Producing again replaces each learner's log; only `complete: true` marks the cohort completed. |
| GET | `/institution/engagements/:id/mastery-logs` | all | Logs for the cohort |
| GET | `/institution/engagements/:id/mastery-logs.csv` | all | One row per learner per node |
| GET | `/institution/mastery-logs/:id` | all | One Mastery Log, if its cohort is in scope |

### Students & access

| Method | Endpoint | Who | Description |
|---|---|---|---|
| GET | `/institution/students` | all | `?engagement_id&status&q&node_id` → `{counts, rows}`. `status`: all, active, invited, never_signed_in, locked, removed, reset_requested |
| GET | `/institution/students/:elId` | all | Login details (join code, PIN status, delivery) + access history |
| GET | `/institution/students-pool` | all | `?exclude_engagement_id&q` — existing students to add to another cohort |
| POST | `/institution/students/enrol/preview` | admin, professor | Same body as enrol; returns a check per row and a summary — changes nothing |
| POST | `/institution/students/enrol` | admin, professor | `{engagement_id, delivery: 'email'|'slips', students: [{name, learner_ref, email?}], existing_learner_ids?: []}` — **one transaction**: creates or reuses learners, enrols them, and issues access (invite links, or one-time PINs for printed slips, returned once). |
| POST | `/institution/students/actions` | admin, professor | `{action, el_ids[], target_engagement_id?, delivery?}`; `action`: `resend_invite`, `reset_pin` (unlocks; one-time PIN slip, or `delivery: 'email'` for a new invite link), `move`, `remove` (blocks login immediately, keeps the record), `restore` |

### Insights (JD figures are sample data)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/institution/insights/curriculum` | `?engagement_id` — each JD skill: share, trend, coverage (covered / partly / missing) with where it's taught, cohort mastery, student requests, suggestion; fit %, emerging topics to add, topics taught but rarely asked for |
| GET | `/institution/insights/standing` | `?engagement_id&compare=regional|last_year|<engagement id>&roles=` — job-match index (verified skills only), change over 30 days, bands vs comparison, fit by target role, where you trail, opted-in students closest to job-ready. Target roles default to the cohort professors' target roles. |

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
| PUT | `/learner/pin` | `{new_pin}` — change PIN (required after a one-time PIN) |
| GET | `/learner/professors` | The cohort's professors as students see them (name, photo, designation, specialisation, office hours) |
| GET | `/learner/profile` | Profile: institution fields (name, ref — read-only), contact, headline, about, goals, self-declared skills, experience, certifications, education[], projects[], `verified_skills` (mastered nodes), `ui_language`, `voice_prefs`, `share_with_institution` (opt-in for the institution's job-ready list), `completeness {pct, sections, missing}`, `has_profile` |
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
