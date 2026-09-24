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
| POST | `/institution/engagements/:id/produce-mastery-logs` | Compile all Mastery Logs |
| GET | `/institution/engagements/:id/mastery-logs` | Get produced logs |

---

## LEARNER (requires learner token)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/learner/dashboard` | Dashboard + progress + streak |
| GET | `/learner/progress` | Full node-by-node progress map |
| POST | `/learner/session/start` | Start or resume session for the current node. Fresh sessions run DIAGNOSE via ORCH. |
| POST | `/learner/session/message` | `{content, session_id?}` — primary interaction endpoint. ORCH classifies the request as `DIAGNOSIS_RESPONSE`, `LEARNER_MESSAGE`, or `CHECK_RESPONSE` from session state; `session_id` may be omitted to use the learner's current active session. |
| POST | `/learner/session/check` | Alias for `/learner/session/message` |
| GET | `/learner/session/:sessionId/history` | Full session message history |
| GET | `/learner/doubts` | List learner doubts |
| POST | `/learner/doubts` | `{skill_node_id?, question_text}` — routes to ORCH `DOUBT_QUERY` |
| POST | `/learner/doubts/:id/escalate` | Escalate an unresolved doubt for human review |
| GET | `/learner/study-plans` | List study plans |
| POST | `/learner/study-plans` | `{planned_date, planned_duration_minutes?, notes?}` |
| GET | `/learner/streak` | Current and longest streak |
| GET | `/learner/certificates` | Earned cluster certificates + programme certificate |
| GET | `/learner/profile` | Learner profile + engagement info + notification settings |
| PUT | `/learner/notifications` | Update notification preferences |

### `/learner/session/message` response shapes

**Instruction turn (CONTINUE or CHECK):**
```json
{
  "session_id": "...",
  "message": "native-language text",
  "decision": "CONTINUE | CHECK",
  "check_question": "... | null",
  "mermaid": "... | null",
  "code": "... | null",
  "behaviour_signal": "engaged | confused | disengaged | accelerating",
  "approach": "native_concept | analogy | worked_example | decomposition | socratic"
}
```

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
