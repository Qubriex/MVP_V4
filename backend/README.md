# Qubirex backend (v4.3.1)

The API, core engines and data model for institutions, learners, employers
and the public verifier. Node 22, Express, plain ES modules with JSDoc,
PostgreSQL behind an async data-access layer: a hosted server (Neon on Vercel)
when `DATABASE_URL` is set, otherwise PGlite (PostgreSQL in WebAssembly,
in-process) for local development and tests. Deployment: `../docs/DEPLOY-VERCEL.md`.

**Build status:** Phase 0: Foundation, plus the v4.3 core that the site needs
end to end: Capability Graph, checks written outside TEACH with the A0/A1
gate, faculty review and κ, retention, the signed Capability Passport with
public verification and renewal, learning curves, benchmarks, and employer
KYB with API keys. `../docs/v4.3-gap-audit.md` lists what is built and what
is still planned. See

[`../docs/decisions.md`](../docs/decisions.md) for every interpretation of the
build prompt, and the phase status reports in the pull request history.

## Setup

```bash
cd backend
npm install
cp .env.example .env        # set JWT_SECRET (and GEMINI_API_KEY for live AI)
npm run migrate             # optional: npm start also migrates
npm run seed:test           # test accounts for every portal (refuses NODE_ENV=production)
npm start                   # http://localhost:3001
```

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3001` | HTTP port |
| `FRONTEND_URL` | `http://localhost:3000` | CORS origin and links in emails |
| `DATABASE_URL` (or `POSTGRES_URL`) | — | PostgreSQL connection string; when set, the pg driver is used |
| `DB_PATH` | `./data/pglite` | PGlite data directory when `DATABASE_URL` is not set (`:memory:` in tests) |
| `PG_POOL_MAX` | `5` | Connections per process (pg driver) |
| `SUBJECT_SECRET`, `ITEM_SEED_SECRET` | dev fallbacks | Required in production: credential subject IDs, check-instance seeds |
| `SIGNING_KEY_PEM`, `SIGNING_KEY_ID` | — | Production signing key (or secure-config/keys); `npm run secrets:generate` |
| `SECURE_CONFIG_PARAMS_JSON` | — | secure-config `params.json` content, for hosts without the mounted directory |
| `QBX_ALLOW_PRIORS`, `QBX_ECHO_EMAIL_CODES` | off | Staging only: run production on priors; show employer domain codes on screen |
| `QBX_REQUIRE_SECRETS` | off | On Vercel, refuse to start without configured secrets instead of generating them into the database (D-030) |
| `CRON_SECRET` | — | Authorises `/api/cron/outbox` (Vercel Cron) |
| `JWT_SECRET` | — (required) | Signs session tokens |
| `AI_ADAPTER` | `gemini` (`mock` in tests) | Model adapter behind `core/ai/gateway.js` |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | — / `gemini-3.6-flash` | Gemini adapter |
| `SECURE_CONFIG_DIR` | `./secure-config` | Where the private secure-config repository is mounted |
| `TRUST_PROXY` | off | Proxy hops, so rate limits and lockout see the client IP |
| `PUBLIC_HOST`, `PUBLIC_URL` | `qubirex.in` / `FRONTEND_URL` | Issuer did:web host and the base of status-list and verify links |
| `DEV_KEY_DIR` | `./data/dev-keys` | Development signing keys (production keys come from secure-config) |
| `ITEM_SEED_SECRET` | dev fallback | HMAC secret for check-instance seeds |
| `LOG_LEVEL` | `info` (`silent` in tests) | Structured JSON logs |
| `FEATURE_*` | off | Feature flags (erratum E7), e.g. `FEATURE_COOKIE_ONLY_AUTH=1` |

## secure-config (closed core)

Calibrated parameters, rubric texts, generators, mutants, CKB lexicons,
prompts and the canary set live in **secure-config**, a separate private
repository. It is never committed here: `.gitignore` excludes `secure-config/`
and `npm run check:secrets` (run in CI) fails if any secure-config content,
`*.rubric.*`, `mutants/**` or `prompts/**` file with real content appears.

Mount it at runtime and point `SECURE_CONFIG_DIR` at it:

```bash
git clone <private-url>/secure-config /srv/qubirex/secure-config   # read-only, per-role access
SECURE_CONFIG_DIR=/srv/qubirex/secure-config npm start
```

`config/params.js` deep-merges `secure-config/params.json` over the priors in
`config/priors.js`. **Production (`NODE_ENV=production`) refuses to start
without it**; development and tests fall back to the priors.
`params.report()` lists every parameter with its stage (`prior` or
`secure-config`) for the phase status reports.

## Structural guarantees

| Guarantee | Enforced by |
|---|---|
| Teaching never writes its own exam | `tests/structural/walls.test.js`: the transitive import closure of `teachBrain`, `cultBrain`, `memBrain` (and `core/cult/*`) may not reach `core/evidence/`, `core/validators/`, the rubric store, `evalBrain`, item families or mutants, nor name their tables |
| Employers never touch session data | same test: `api/routes/employer.js`, `api/routes/verify.js`, `api/middleware/employerAuth.js` and `core/match/*` may not reach session, memory, provenance, CKB-usage or evaluation stores, brains, the orchestrator or retrieval, nor name their tables |
| Sign facts, compute labels | `tests/structural/schema.test.js`: `node_mastery` and `credentials` have no label or confidence column |
| Model-agnostic AI | `tests/structural/sdk.test.js`: model SDKs only under `core/ai/adapters/` |
| Closed core | `tests/structural/secrets.test.js` + `npm run check:secrets` |

Each wall test has a self-test against deliberately broken fixtures in
`tests/structural/fixtures/bad/`, so a checker that stops working fails too.

## Layout

```
api/app.js                 Express app factory (MOUNTS table → openapi.json)
api/middleware/auth.js     sessions (cookie + CSRF, Bearer during migration), actors, tenancy
api/middleware/rateLimit.js  rate limits and login lockout
api/middleware/employerAuth.js, staff.js
api/routes/*.js            auth (4 actors), institution*, learner, portfolio, market, employer, admin
config/params.js, priors.js
core/db/{dal,sql,pg,pglite,migrate,ulid}.js   async DAL, ? → $n translation, drivers
core/util/seq.js           mapSeq/filterSeq/… for async callbacks, run in order
vercel/handler.js          the app as a Vercel Function (outbox drained after writes)
core/events/{outbox,worker,subscribers}.js   transactional outbox
core/ai/gateway.js, core/ai/adapters/{gemini,mock}.js
core/consent/levels.js     append-only consents, withdraw()
core/graph/                ontology, resolveSkill, coverage, θ
core/evidence/             checkWriter, authenticity gate, assess, faculty review and κ
core/learner/              vocabulary level, active time
core/retention/, core/qep/ review schedule; label_v1, Evidence IDs, SD-JWT, status lists
core/return/               signing (the only module with keys), credentials, renewal
core/employer/             GSTIN check, API keys
core/readiness/, core/benchmarks.js   learning curve; regional benchmarks
core/logger.js
migrations/NNNN_*.js       applied in order; never edited once applied
tests/{structural,unit,integration,property,e2e}/
```

## Sessions and CSRF

Every login creates an `auth_sessions` row and sets an httpOnly
`SameSite=Strict` cookie `qbx_session` plus a readable `qbx_csrf` cookie; the
body also returns `token` and `csrf_token`. Cookie-authenticated
POST/PUT/PATCH/DELETE requests must send `X-CSRF-Token`. Bearer tokens are
accepted until the frontend moves to cookies (`FEATURE_COOKIE_ONLY_AUTH`).
`POST /api/auth/logout` revokes the session; `GET /api/auth/csrf` rotates the
CSRF token. Password logins lock after 5 failures in 15 minutes per account
and per IP.

## Events

State changes and their events commit together: `emit()` throws outside a
transaction. The worker (started by `server.js`) polls every 2 s, delivers in
order per aggregate, retries after 1m, 5m, 30m, 2h and 12h, then dead-letters.
Subscribers register in `core/events/subscribers.js`, whose `ROUTES` table is
the §7 routing map.

## Tests

```bash
npm test                  # structural first (fails the build alone), then the rest
npm run test:structural
npm run test:rest
npm run openapi           # regenerate openapi.json after changing routes
```

Tests use an in-memory database per file and the deterministic mock AI adapter.
