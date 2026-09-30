# Decisions and interpretations

Every place the v4.3.1 build prompt had to be interpreted, with the section it
refers to. Rules are never changed silently: where the code departs from the
prompt, the entry says so and proposes an erratum.

Format: **D-nnn — title** · spec reference · status (*interpretation*,
*staged*, or *proposed erratum*).

---

## Phase 0, step 1 — Foundation

**D-001 — Legacy routes are migrated in stages** · §9 conventions · *staged*
The existing institution, learner, market and admin routes keep their
`{error: string}` error shape, SQLite `datetime('now')` timestamps and UUID ids
until each is rebuilt in its own Phase 0 step; the current frontend reads the
string form. New routes (`/api/employer`, and later `/api/verify`,
`/api/practical`) use `{error: {code, message}}`, ULIDs and ISO timestamps.
New rows written by rebuilt code (`access_events`, `domain_events`, `consents`,
sessions) already use ULID + ISO. Cursor pagination and `Idempotency-Key`
arrive with the first rebuilt route that needs them.

**D-002 — Bearer tokens accepted alongside cookies until the frontend moves** · §4 Auth · *staged*
Login sets the httpOnly `SameSite=Strict` session cookie plus a readable CSRF
cookie, and also returns the same token in the body. Cookie requests need
`X-CSRF-Token` on POST/PUT/PATCH/DELETE; Bearer requests do not (a browser
never attaches them on its own, so they are not CSRF-prone). Every token names
an `auth_sessions` row that is checked on each request, so logout and
revocation work for both. The `cookieOnlyAuth` flag refuses Bearer tokens and
is switched on when the frontend stops storing the token.
Consequence: tokens issued before this change carry no session id and are
refused (users sign in once more).

**D-003 — Lockout applies to password logins; learner PINs keep their own lock** · §10 Passwords · *interpretation*
"Lockout after 5 failures in 15 minutes, per account and per IP" is applied to
staff, employer and admin logins, persisted in `login_failures`. A lockout
refuses even the correct password until the window passes. Learner PIN logins
keep the per-enrolment lock (5 wrong PINs → staff reset, §10 "Learner PINs")
plus a per-IP request limit, because a whole classroom often shares one IP and
a per-IP lockout would lock out every student in the lab.

**D-004 — Migrations are SQLite dialect in Phase 0** · §4 portable SQL · *interpretation*
Application queries stay portable; the migrations use SQLite triggers (for
append-only tables), `PRAGMA table_info` and `DROP COLUMN`. The PostgreSQL
move adds a parallel migration set in the same files' order. `better-sqlite3`
is imported only by `core/db/sqlite.js` (structural test). Legacy route code
still receives a better-sqlite3-shaped handle through `dal.legacyHandle()`.

**D-005 — `0001_baseline` is the pre-v4.3.1 schema** · §6 · *interpretation*
The old `initDb` body and the store initialisers that ran when
`api/routes/learner.js` loaded became `migrations/0001_baseline.js`. It is
idempotent, so it applies both to a fresh database and to a pilot database the
old code created (tested). Tables §6 lists for later steps are created by the
migration of the step that builds them, not all up front, so each migration
lands with the code and tests that use it.

**D-006 — Extra event and outbox columns** · §6 `domain_events`, §7 · *interpretation*
`domain_events` keeps the §6 columns and adds `next_attempt_at`, `last_error`
and `dead_lettered_at` to implement the §7 backoff and dead-letter rule.
`event_consumptions(event_id, subscriber)` makes subscribers idempotent on
event id: a subscriber that succeeded is never re-run when another subscriber
of the same event retries. Three foundation event types are added to the §7
list: `EMPLOYER_REGISTERED`, `CONSENT_GRANTED`, `CONSENT_WITHDRAWN`
(`CONSENT_WITHDRAWN → MATCH.dropLearner` implements "search indexes drop the
learner within 1 minute", §8.10, once matching exists).
Events whose §7 targets are not built yet are delivered to no subscriber and
marked delivered; they remain in the table for Phase 2 learning.

**D-007 — One outbox worker and in-memory rate counters per process** · §7, §10 · *interpretation*
Phase 0 runs one API process. The worker has no lease, and rate-limit counters
live in memory (lockout, which must survive restarts, is in the database).
Running more than one process requires a lease column on `domain_events` and a
shared counter store; both are listed for the PostgreSQL move.

**D-008 — Additional modules not in the §4 module map** · §4 · *interpretation*
`core/logger.js` (structured logger), `core/db/migrate.js` and `core/db/ulid.js`
(migrations, ULIDs), `config/priors.js` (the prior defaults `config/params.js`
falls back to), `core/access.js` and `core/outboundMail.js` (existing; the
latter renamed from `core/outbox.js` so it is not confused with the event
outbox), `api/app.js` (app factory for tests), and the existing
`api/routes/institution{Team,Students,Insights}.js`. v4.3 Appendix B lists
`api/routes/institution*`, so the split is within the module map.

**D-009 — Stored confidence removed; the Mastery Log still shows a computed one** · §2 sign facts compute labels, §6 `node_mastery` · *staged*
`node_mastery.confidence_indicator` is dropped. The legacy stability measure is
computed from `mastery_checks` and loop counts whenever it is read
(`core/masteryLog.js nodeConfidence`). The produced Mastery Log document
(`mastery_logs.log_data`) is a dated snapshot and still carries the computed
band; the Return step replaces it with label_v1 facts and computes labels at
read and verify time.

**D-010 — `access_events` is append-only; PIN-reset resolution is an event** · §6 · *interpretation*
The old `resolved` flag was flipped in place. A request is now closed by a
later `pin_reset_resolved` event; the roster derives "reset requested" from
the log. The migration converts existing resolved flags (one resolution per
enrolment, stamped at the newest resolved request, so open newer requests stay
open). The `resolved` column is left in place, unused, because SQLite cannot
drop it without rebuilding an append-only table.

**D-011 — Unknown age defaults, consent table shape** · §8.10, §6 `consents` · *interpretation*
`learners.age_status` defaults to `unknown` (treated as a minor) and
`is_discoverable` to 0. `consents` adds `id`, `institution_id`, `granted_by`,
`guardian_ref` and `scope_json` (the employer a level-4 consent covers) to the
§6 columns. The trigger allows exactly one change: setting `withdrawn_at`
once, done by `core/consent/levels.js withdraw()`.

**D-012 — Structural walls are stricter than the minimum** · §2, §11 · *interpretation*
- Teaching wall: besides evidence, validators, rubric store, item families and
  mutants, the teaching brains may not reach `evalBrain`, and may not name
  evidence or rubric tables in SQL. Entries include any future `core/cult/*`.
- Employer wall: besides the listed stores, employer modules may not reach any
  brain, the orchestrator or `core/retrieval`, and may not name session,
  memory, provenance, CKB-usage, evaluation or retrieval-log tables. Entries
  include `api/middleware/employerAuth.js`.
- Both walls are transitive, and a computed dynamic `import()` inside a
  checked closure fails the test (the wall must be provable from source).
- Each wall has a self-test against `tests/structural/fixtures/bad/`, so a
  broken checker cannot pass silently.
The walls already caught one real path in this step: the teaching brains
reached the migrations (and through them the rubric store) via `db/init.js`.
Stores now import the DAL directly.

**D-013 — Secrets check: placeholders allowed except under secure-config/** · §10 Secrets separation · *interpretation*
"With real content" is read as: any `*.rubric.*`, `mutants/**` or
`prompts/**` file fails unless its first line is exactly
`<!-- qubirex:placeholder -->` and it is at most 2 KB. Anything under
`secure-config/` fails outright. The check covers every file git would commit
(tracked and untracked-not-ignored) across the whole repository.

**D-014 — Priors match Appendix A** · §2 closed core, v4.3 Appendix A · *resolved*
The build began without the dossier, using the numbers in §8 of the prompt.
Checked against v4.3 Appendix A on receipt: no value differed. The Appendix A
constants and the section-text constants that were missing (graph, learner
model, early warnings, JRI_projected, bridge targets, chunking, retrieval gold
set, name-check honorifics, low-bandwidth) were added, and the A.1 calibration
register now lives in `config/priors.js` and in the admin quality report.

**D-015 — AI gateway, foundation scope** · §8.11 · *staged*
The gateway routes every task to one adapter (`AI_ADAPTER`; gemini by default,
the deterministic mock in tests), retries a timeout or 5xx once, repairs a schema miss
once, and logs each call to `model_calls`. The Gemini SDK is imported only by
`core/ai/adapters/gemini.js`; `instructionEngine.callAI` is a thin wrapper
that names the task (`LEGACY.callAI` until each brain is rebuilt with its own
§8.11 task and versioned prompt). Small/large model routing, pinned eval model
versions, the prompt registry, cost meter, lesson cache and canary come with
the Quality step.

**D-016 — Authentication failures answer 401** · §9 · *interpretation*
Invalid, expired or pre-upgrade tokens answer 401 (previously 403), so the
frontend signs the user out instead of leaving them on a page that cannot load.
Authorisation failures (wrong actor, wrong role, CSRF) answer 403.

**D-017 — Employer roles are owner, recruiter, viewer** · v4.3 §14.1 · *correction*
0002 used owner/admin/member. Migration 0003 rebuilds `employer_users` with
the §14.1 roles (admin and member become recruiter). KYB gating follows §14.1:
an unapproved company may search but may not request access.

**D-018 — Legacy behaviour brought in line before its step is rebuilt** · v4.3 §2A.2, §6, §7.3, §7.7, §17.3 · *interim*
Found by the gap audit (`docs/v4.3-gap-audit.md`):
- EVAL no longer uses other learners' model-scored answers as few-shots, and
  no longer writes them back. It scores zero-shot until the gold set exists.
  The learner's answer is fenced as data.
- The behaviour fingerprint is persisted only for confirmed adults.
- Check responses no longer return the evaluator's score to the learner.
- Simulation-ready follows §7.7.
Fixed later (see the gap audit update): **TEACH writes the check question** (breaks "the teacher never
writes the check", §7). The import wall cannot see it, because the question
travels as data. It is replaced by item-family instances in the Evidence step,
together with a test that the TEACH contract has no check field. CKB ranking
by effectiveness is replaced in the Teaching-loop step.

**D-019 — Learner PIN unlock: staff reset vs delayed unlock** · v4.3 §22 · *approved 30 Sep 2026*
§22 says learner PINs use "lockout with delayed unlock". Today five wrong PINs
lock the enrolment until staff reset the PIN (the behaviour approved in the
institution redesign). Proposal: keep staff reset, and also unlock
automatically after a delay (prior 30 minutes, in params). Approved by the
product owner and built (`security.pinUnlockMinutes`).

**D-020 — AI-call rate limits** · v4.3 §22 · *interpretation*
POST routes under `/api/learner` and `/api/market` (the AI-calling routes) are
limited per learner (30/min) and per institution (600/min). Both are priors in
params. Daily quotas per institution arrive with the cost meter (Quality step).

**D-021 — No demonstrations for pre-v4.3 mastery** · v4.3 §7.11, §9.1 · *interpretation*
Mastery recorded before migration 0005 has no answer provenance, so it cannot
claim A1. Migration 0005 creates no demonstrations from it. Those nodes show
without an assurance level until the learner passes a review, which records a
demonstration with provenance.

**D-022 — Evidence IDs never contain an adjacent 0/Z pair** · v4.3 §9.3 · *interpretation*
Luhn mod-32 over this alphabet catches every single-character error, and every
adjacent swap except 0↔Z. IDs with a 0 next to a Z are never issued, so every
adjacent swap is caught. This costs under 1% of the ID space.

**D-023 — A skill's label follows its weakest mapped node** · v4.3 §9.1 · *interpretation*
When several pathway nodes map to one skill, the passport line takes the lowest
label among them. A skill is never shown stronger than its least-shown part.

**D-024 — Phase 0 verification reads the issuer's own records** · v4.3 §10 · *interpretation*
`/api/verify/:id` checks the stored SD-JWT signature against the published
JWKS and the status list. It does not accept an uploaded credential yet.
Holder-presented SD-JWT verification arrives with employer access (P1).

**D-025 — Employer domain codes are shown on screen outside production** · v4.3 §14.1 · *temporary*
There is no mail provider yet. Outside `NODE_ENV=production`, the domain
verification code is returned in the response and shown in the portal, so the
KYB flow can be tested. Production only sends it by email (queued in
outbound_mail).
