# QUBIREX — MVP Codebase

**Inferexaa Private Limited · Receive. Build. Return.**

The only platform that teaches technical skills in Telugu, and proves they were
learned — with a Mastery Log, not a certificate. Qubirex constructs
explanations natively in Telugu or Hindi (never translated from English) via
Professor Qubirex, its AI teaching persona, and returns a verified Mastery Log
per learner to the commissioning institution.

---

## THE THREE-VERB MODEL

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

AI engine: **Google Gemini 1.5 Flash**. Database: **SQLite** (better-sqlite3,
WAL mode, foreign keys on).

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
    │   └── ThemeContext.js          # light/dark state, persisted to localStorage
    ├── hooks/useReveal.js           # scroll-reveal IntersectionObserver hook
    ├── styles/
    │   ├── tokens.css               # design tokens — see DESIGN SYSTEM below
    │   └── global.css               # reset + shared component classes
    ├── components/
    │   ├── NavBar.js / Footer.js    # shared page chrome
    │   ├── PhoenixMark.js           # brand mark (placeholder, see note below)
    │   ├── ThemeToggle.js / Reveal.js / PageTransition.js
    │   └── DevNav.js                # dev-only page navigator, not part of the app UI
    ├── utils/api.js
    └── pages/
        ├── LandingPage.js
        ├── InstitutionLogin.js / LearnerLogin.js
        ├── InstitutionDashboard.js
        ├── CapabilityTargetUpload.js
        ├── EngagementSetup.js / EngagementDetail.js
        ├── MasteryLogView.js
        ├── LearnerDashboard.js
        └── LearningSession.js

docs/
├── README.md
├── MVP_DESIGN_LIST.md
└── API_REFERENCE.md
```

---

## DESIGN SYSTEM

The frontend runs on a warm, Claude-inspired design system — a paper/charcoal
base palette with an accent gradient sampled from the phoenix mark (amber →
burnt orange → deep maroon), a Fraunces/Inter type pairing, a 4px spacing
scale, and restrained scroll/hover motion. It replaced an earlier dark
blue-gray UI; no routes, copy, or backend behavior changed as part of that
redesign.

**Where things live:**

| File | Purpose |
|---|---|
| `src/styles/tokens.css` | Every color, spacing, type, radius, shadow and motion value as CSS custom properties. Full header comment there explains how to retune the palette — start here before editing any component's styling. |
| `src/styles/global.css` | Reset + shared classes built on those tokens: `.btn`/`.btn-primary`/`.btn-secondary`/`.btn-ghost`, `.card`, `.input`/`.textarea`, `.badge-*`, `.nav`, `.footer`, `.table`, `.reveal`, `.hero-wash`, `.page-fade`. Compose these in new components instead of hardcoding hex/px values. |
| `src/context/ThemeContext.js` | Light/dark toggle. Defaults to light, persists to `localStorage` (`qubirex_theme`), sets `data-theme` on `<html>` — that attribute is what `tokens.css`'s dark overrides key off. |
| `src/components/NavBar.js`, `Footer.js` | Shared chrome. Pages pass page-specific content (login buttons, user menu, logout) via the `right` prop so behavior stays page-owned. |
| `src/components/Reveal.js`, `src/hooks/useReveal.js` | Fade-up-on-scroll wrapper, staggered via a `delay` (ms) prop. No-ops to fully visible under `prefers-reduced-motion`. |
| `src/components/PageTransition.js` | Wraps the router so navigating between pages fades instead of cutting. |
| `src/components/PhoenixMark.js` | **Placeholder** brand mark built from the accent gradient — the real logo file was shared in chat, not as a repo asset. Drop it in as `public/phoenix-logo.png` (or similar) and swap the `<svg>` in this file for an `<img>`; `NavBar`/`Footer` don't need any other changes. |

**Retuning the palette:** every accent color lives in the `--accent-*` scale
at the top of `tokens.css`, with the gradient itself in `--gradient-accent`.
Base surface colors are `--color-bg` / `--color-surface` / `--color-border` /
`--color-text` (light values on `:root`, dark overrides under
`[data-theme='dark']`). Change values there once — every component picks it
up automatically since nothing hardcodes a hex value.

---

## QUICK START

### Prerequisites
- Node.js 18+
- A Google Gemini API key (https://aistudio.google.com/app/apikey)

### Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Edit .env — add your GEMINI_API_KEY and JWT_SECRET
node server.js
```

Backend runs on http://localhost:3001

### Frontend Setup

```bash
cd frontend
npm install
npm start
```

Frontend runs on http://localhost:3000

### Seed Admin User

```bash
curl -X POST http://localhost:3001/api/admin/seed-admin \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@inferexaa.com","password":"your_password","secret":"your_jwt_secret"}'
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
