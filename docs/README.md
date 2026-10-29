# QUBIREX — MVP Codebase

**Inferexaa Private Limited · Your Language. Your Skills. Your Future.**

The only platform that teaches technical skills in Telugu, and proves they were
learned — with a Mastery Log, not a certificate. Qubirex constructs
explanations natively in Telugu or Hindi (never translated from English) via
Professor Qubirex, its AI teaching persona, and returns a verified Mastery Log
per learner to the commissioning institution.

---

## THE THREE-VERB MODEL (internal)

The product's internal operating model. It is no longer the public tagline —
user-facing text uses "Your Language. Your Skills. Your Future."

| Verb | What It Means |
|---|---|
| **RECEIVE** | Accept a capability brief from any institution, in any format |
| **BUILD** | Construct capability natively in the learner's language through an adaptive AI instruction cycle |
| **RETURN** | Produce a clean, structured Mastery Log as evidence |

---

## ARCHITECTURE — RAG MULTI-BRAIN V2

Six AI brains are dispatched in parallel (`Promise.all()`) at every learner
interaction. No learner interacts with any brain directly — they only ever
see output from TEACH.

| Brain | File | Role |
|---|---|---|
| ORCH | `core/orchestrator.js` | Central coordinator — classifies the request, dispatches brains, assembles the response |
| TEACH | `core/brains/teachBrain.js` | RAG-grounded native-language instruction engine |
| MEM | `core/brains/memBrain.js` | Learner memory — reads before TEACH, writes after every turn |
| CULT | `core/brains/cultBrain.js` | Cultural Knowledge Base — retrieves curated examples before every explanation |
| EVAL | `core/brains/evalBrain.js` | Mastery evaluator — calibrated rubric scoring, temperature 0.3 |
| CURR | `core/brains/currBrain.js` | Curriculum brain — brief ingestion, node decomposition, node spec retrieval |

Four knowledge stores back the brains: `learnerMemoryStore`, `culturalStore`
(the CKB), `rubricStore`, and `briefStore` (curriculum store).

AI engine: **Google Gemini** (via `core/ai/gateway.js`). Database:
**PostgreSQL**. Production uses Neon on Vercel (`DATABASE_URL`); local
development and tests use PGlite in-process. See `DEPLOY-VERCEL.md`.

---

## PROJECT STRUCTURE

```
backend/
├── server.js                      # Express entry point
├── .env.example                   # Environment template — copy to .env
├── package.json
├── db/
│   └── init.js                    # SQLite schema — V1 core tables + V2 multi-brain tables
├── core/
│   ├── orchestrator.js            # ORCH
│   ├── instructionEngine.js       # Shared utilities + Gemini wrapper
│   ├── masteryLog.js              # Mastery Log production logic
│   ├── brains/
│   │   ├── teachBrain.js
│   │   ├── memBrain.js
│   │   ├── cultBrain.js
│   │   ├── evalBrain.js
│   │   └── currBrain.js
│   └── stores/
│       ├── learnerMemoryStore.js
│       ├── culturalStore.js
│       ├── rubricStore.js
│       └── briefStore.js
└── api/
    ├── middleware/auth.js
    └── routes/
        ├── auth.js
        ├── institution.js
        ├── learner.js
        └── admin.js

frontend/
├── package.json
├── public/index.html
└── src/
    ├── App.js
    ├── context/
    │   ├── AuthContext.js
    │   ├── ThemeContext.js          # light/dark state, persisted to localStorage
    │   └── UiLangContext.js         # learner interface language (Telugu / Hindi / English)
    ├── hooks/useReveal.js           # scroll-reveal IntersectionObserver hook
    ├── styles/
    │   ├── tokens.css               # design tokens — see DESIGN SYSTEM below
    │   └── global.css               # reset + shared component classes
    ├── components/
    │   ├── NavBar.js / Footer.js    # shared page chrome
    │   ├── PhoenixMark.js           # brand mark (placeholder, see note below)
    │   ├── ThemeToggle.js / Reveal.js / PageTransition.js
    │   ├── DevNav.js                # dev-only page navigator, not part of the app UI
    │   ├── learn/                   # LearnerLayout (sidebar shell), ProfileSections, MermaidDiagram, ui.js
    │   └── inst/                    # InstitutionLayout (dark staff shell), StaffProfileForm, AccessResults, CopyLink
    ├── utils/
    │   ├── api.js                   # axios instance + getOr() dev-fallback helper
    │   ├── voice.js                 # browser speech in (recognition / recording) and out (TTS)
    │   └── mockData.js / learnerMockData.js   # dev-only fallbacks
    └── pages/
        ├── LandingPage.js
        ├── InstitutionLogin.js / LearnerLogin.js
        ├── InstitutionDashboard.js
        ├── CapabilityTargetUpload.js
        ├── EngagementSetup.js / EngagementDetail.js
        ├── MasteryLogView.js        # /institution/mastery-log/:id
        ├── LearnerInvite.js         # /learner-invite/:token — student sets their own PIN
        ├── inst/                    # institution (staff) side, under /institution/*
        │   ├── StaffLogin.js / StaffInvite.js / StaffWelcome.js / StaffProfile.js
        │   ├── Home.js / Team.js
        │   ├── Students.js / AddStudents.js
        │   ├── Cohorts.js / NewCohort.js / Cohort.js
        │   └── Curriculum.js / Standing.js
        └── learn/                   # learner side, all under /learn/*
            ├── Dashboard.js         # /learn/dashboard
            ├── Welcome.js           # /learn/welcome — first-run setup
            ├── Session.js           # /learn/session — voice session (desktop + phone)
            ├── Record.js            # /learn/record — skill path & own mastery record
            ├── JobMarket.js         # /learn/market
            ├── JobDetail.js         # /learn/market/:jobId — JD + skill gap
            ├── Interview.js         # /learn/market/:jobId/interview — voice practice
            ├── Topics.js            # /learn/topics — emerging topics
            ├── Profile.js           # /learn/profile
            └── Resume.js            # /learn/resume

docs/
├── README.md
├── MVP_DESIGN_LIST.md
└── API_REFERENCE.md
```

---

## DESIGN SYSTEM

**Fonts** (self-hosted in `frontend/public/fonts/`, OFL; `font-display: swap`,
the two Latin faces preloaded, the Telugu or Devanagari face preloaded for the
saved language): **Outfit** for headings, **Anek** (Latin, Telugu,
Devanagari; Hind as fallback) for body text, **JetBrains Mono** for code.
Numbers in stats and tables use tabular figures. IBRAND stays for the logo and
marketing material only — *the brand book needs an update: web fonts = Outfit
+ Anek.*

**Tokens** (`src/styles/tokens.css`):

| Group | Tokens |
|---|---|
| Type scale (six sizes) | `--fs-display`, `--fs-h1`, `--fs-h2`, `--fs-h3`, `--fs-body`, `--fs-small`, `--fs-caption` with matching `--lh-*` / `--fw-*` |
| Primary | `--brand-primary-strong` (#C4302A, 5.5:1 on white) for every primary button and link; orange (`--brand-accent`) is decoration only |
| Readiness bands | Ready = `--ok` green · Nearly ready = `--warn` amber · Building = `--info` blue · none = grey. Red (`--danger`) only for errors, locked, revoked or overdue |
| Widths | one content width, plus `ui-narrow` (`--content-narrow`, 860 px) for forms |

**Component kit** — `src/components/shared/ui/` (import from
`components/shared/ui`): `Button`, `IconButton`, `Select` (accessible
listbox), `Input`, `Textarea`, `Field`, `Card`, `StatTile`, `Table` (cards
below 640 px; `TableLabels` does this for every `.ln-table`), `Tabs`, `Pill`,
`BandPill`, `BandBar`, `EmptyState` (with a primary action), `Skeleton`,
`Toast` (`useToast`), `Tooltip`, `Modal`/`Drawer`, `PageHeader`. Styles live
in `src/styles/ui.css`. Every portal sidebar uses the same dark-ink style.

**Accessibility rules:** real buttons, links and labels; `aria-label` on icon
buttons; visible focus rings; 44 px touch targets on touch screens; 4.5:1
text contrast; never colour alone (band pills carry the word). Layouts work
from 360 px to 1440 px without sideways scroll, and respect
`prefers-reduced-motion`.

---

## LANGUAGES (interface)

- Every screen — public, learner, college, employer, admin — reads from
  `frontend/src/i18n/{en,te,hi}.json` with namespaced keys (`learn.*`,
  `inst.*`, `emp.*`, `adm.*`, `page.*`, `shared.*`, `title.*`). In Telugu or
  Hindi mode the only English left is product names (Qubirex, Capability
  Passport, Evidence ID…), skill names, code and data.
- One language switch everywhere (`components/shared/LangSwitch.js`):
  "EN · తెలుగు · हिंदी" on desktop, a globe button on phones. The choice is
  kept in `localStorage` (`qubirex_ui_lang`), sets `<html lang>`, and drives
  dates and numbers through `Intl` (`uiLocale()`, `fmtDate`, `fmtNum`).
- `document.title` is set per route in the selected language
  (`hooks/usePageTitle.js`: "Page — Qubirex").
- **Check before you push:** `cd frontend && npm run i18n:check` fails when a
  key is missing in te or hi, a translation drops a `{placeholder}`, a
  `t('key')` is unknown, or English JSX text is shown without `t()`. Mark a
  line that intentionally shows code or data with `/* i18n-ignore */`.
- Adding text: put the English in `en.json`, the Telugu and Hindi in
  `te.json` / `hi.json` under the same key, and call `t('ns.key', { vars })`.
  Write counts as "Reviews due: {n}" rather than plural endings.

## WORDS WE USE

| Say | Not |
|---|---|
| College | Institution (except in legal text) |
| Cohort | Engagement |
| Skill group | Cluster |
| Lesson ("Lesson 9 of 20") / skill ("8 of 20 skills done") | Node |
| Target (an employer's readiness target) | Bar |
| Confirmed · Partial · Not yet | "Partial mastery", "Not yet mastered" |
| Fresh · Ageing · Needs refresh (the % only in the Passport tooltip) | Freshness 73% |
| Plain evidence words ("Checked by running the work"); the L/A code is in the glossary popover | "L2 · Execution-verified" |
| Mastery Log · Capability Passport · Evidence ID · bridge programme · readiness band · authorship · Day-One Simulation · Sponsor a cohort | other spellings |

No visible placeholders: prices read "Talk to us for pricing"; demo data uses
sample names tagged "Sample".

---

## QUICK START

### Prerequisites
- Node.js 22+
- A Google Gemini API key (https://aistudio.google.com/app/apikey)

The backend's own README (`backend/README.md`) covers environment variables,
migrations, secure-config and tests.

### Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Edit .env — add your GEMINI_API_KEY and JWT_SECRET
npm start            # applies migrations, starts the event worker, listens
```

Backend runs on http://localhost:3001

### Frontend Setup

```bash
cd frontend
npm install
npm start
```

Frontend runs on http://localhost:3000

### Test accounts (local only)

To click through the whole site, seed one institution (admin + professor),
one learner and a few classmates in different access states, on a small
Full-Stack programme (some nodes already mastered):

```bash
cd backend
npm run seed:test      # safe to re-run; resets the passwords and PIN below
```

| Login | URL | Credentials |
|---|---|---|
| Institution admin | http://localhost:3000/login | Email `test.institution@qubirex.local` · Password `QubirexTest2026!` |
| Professor (sees only the test cohort) | http://localhost:3000/login | Email `test.professor@qubirex.local` · Password `QubirexTest2026!` |
| Learner | http://localhost:3000/learner-login | Learner reference `TEST-LRNR-001` · Join code `QX-FSD-T01` (the old Engagement ID `4a4c13c4-989e-4c03-b636-3bdba7fd1025` also works) · PIN `410585` |
| Learner (Hindi cohort) | http://localhost:3000/learner-login | `TEST-LRNR-HI1` · Join code `QX-FSD-T02` · PIN `410585` |
| Learner, first time (sees the welcome steps) | http://localhost:3000/learner-login | `TEST-LRNR-NEW` · Join code `QX-FSD-T01` · PIN `410585` |
| Employer owner (company verification pending) | http://localhost:3000/employer/login | Email `test.employer@qubirex.local` · Password `QubirexTest2026!` |
| Employer recruiter (company already verified) | http://localhost:3000/employer/login | Email `test.employer.verified@qubirex.local` · Password `QubirexTest2026!` |
| Qubirex admin (employer KYB, skills ontology, evaluator quality) | http://localhost:3000/admin/login | Email `test.admin@qubirex.local` · Password `QubirexTest2026!` |

All of these are the **test tenant**: they never appear to real employers,
colleges or admins, and real data never appears to them. The fastest way in
is the developer login: run the backend with `DEV_LOGIN_ENABLED=true` and a
32+ character `DEV_LOGIN_SECRET`, then open http://localhost:3000/dev
(docs/DEPLOY-VERCEL.md, "Developer login").

The seed also gives the test learner an issued Capability Passport (open it
under Capability Passport, then check its Evidence ID at
http://localhost:3000/verify), two reviews due, two items in the institution's
Faculty review queue, and three sample Hyderabad institutions so the regional
benchmark publishes. To try employer KYB end to end: sign in as the employer,
add company details, request the domain code (shown on screen outside
production), then approve the company as the admin.

These credentials are public in this repo, so the script refuses to run with
`NODE_ENV=production`. It also refuses a remote `DATABASE_URL` unless you
confirm with `QBX_SEED_REMOTE=1`. Use that only for a staging database
(`DEPLOY-VERCEL.md`), never a production one.
Voice-session replies, captions, transcription and resume tailoring need a
real `GEMINI_API_KEY` in `.env`; without it the session page shows sample
content. `AI_ADAPTER=mock` runs every AI call offline with placeholder text, so
flows can be clicked through, but its grading is not meaningful.

### Seed Admin User

```bash
cd backend
npm run seed:admin -- admin@inferexaa.com 'a-password-of-10+-characters'
```

---

## FIVE REQUEST TYPES / FIVE TEACHING STATES / FIVE APPROACHES

- **Request types**: `SESSION_START` · `DIAGNOSIS_RESPONSE` · `LEARNER_MESSAGE` · `CHECK_RESPONSE` · `DOUBT_QUERY`
- **Teaching states**: `DIAGNOSE` → `EXPLAIN (CONTINUE)` → `CHECK` → `ADVANCE` or `LOOP`
- **Explanation approaches** (tried in order, never repeated at the same node): `native_concept` → `analogy` → `worked_example` → `decomposition` → `socratic`

---

## MASTERY GATES PROGRESSION — NOT TIME

`evalBrain.evaluate()` scores responses on **quality of understanding**.
Score ≥ 0.70 = ADVANCE. Exception: loop count ≥ 5 and score ≥ 0.60 = ADVANCE
(persistence credit). A learner who submits ANY response without
demonstrating understanding does NOT advance.

**Mastery increment on ADVANCE** (rewards prompt mastery):

| Loop count | Increment |
|---|---|
| 0 (first attempt) | 22–25 |
| 1–2 | 15–18 |
| 3–4 | 10–13 |
| 5+ | 7–10 |

---

## DATA PRIVACY ARCHITECTURE

**Never shown to institutions**: `session_messages`, `doubts`, `study_plans`,
`streaks`, `learner_memory`, `learner_behaviour_fingerprint`. These are
learner-private under all circumstances.

**The only learner-specific document shared with institutions is the Mastery
Log.** It contains skill node mastery percentages, time to mastery, attempt
counts, confidence indicators, and simulation readiness flags — never session
content, struggle details, or behavioural patterns.

### The Two Blank Fields

`readiness_classification` and `external_score` are **ALWAYS NULL** in every
Mastery Log. These fields are present in every log output — their intentional
blankness is a structural design statement. Qubirex produces evidence and
stops there; readiness and scoring belong to the commissioning client.

---

## PHASE 1 LANGUAGES
- **Telugu** (తెలుగు) — Telangana / Andhra Pradesh learner profile
- **Hindi** (हिंदी) — North Indian learner profile

---

*Inferexaa Private Limited · Confidential · Qubirex MVP Codebase v2.0*
