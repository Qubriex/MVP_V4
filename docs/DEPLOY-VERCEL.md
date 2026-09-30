# Deploying Qubirex on Vercel

One Vercel project serves the whole product:

| Part | What runs | Where it lives |
|---|---|---|
| Website | The React app, built to static files | `frontend/` → `frontend/build` |
| API | The Express backend as one Vercel Function | `api/index.js` → `backend/vercel/handler.js` |
| Database | PostgreSQL (Neon, from the Vercel Marketplace) | `DATABASE_URL` |
| Events | The outbox drains after each write request, plus a daily cron | `/api/cron/outbox` |

`vercel.json` at the repository root wires it together. It routes `/api/*` and
`/.well-known/did.json` to the function and everything else to the React app.
The build runs `backend/scripts/vercel-build.js`, which applies database
migrations and then builds the frontend.

## 1. Project settings

In Vercel → your project (`mvp-v4`) → **Settings → Build and Deployment**:

- **Root Directory:** empty (the repository root, where `vercel.json` is).
  If it is currently `frontend`, clear it.
- **Framework Preset:** Other. `vercel.json` sets the install, build and
  output commands, so leave those overrides off.
- **Node.js Version:** 22.x.

## 2. Database

Vercel → **Storage → Create Database → Neon (Postgres)**, then connect it to
the project for Production and Preview. This adds `DATABASE_URL` (pooled) and
`POSTGRES_URL` to the project's environment variables. The app uses
`DATABASE_URL`, or `POSTGRES_URL` if the first is missing.

Nothing else is needed: the first deploy creates all 70 tables, triggers and
reference data (skills ontology, cultural examples). Later deploys apply only
new migrations.

## 3. Environment variables

Generate the secrets once, on your own machine:

```bash
cd backend && npm install && npm run secrets:generate
```

Then add these in Vercel → **Settings → Environment Variables**. Scope them to
Production (and to Preview if you deploy previews), and mark every secret
**Sensitive**:

| Variable | Value |
|---|---|
| `JWT_SECRET`, `SUBJECT_SECRET`, `ITEM_SEED_SECRET`, `CRON_SECRET` | From `secrets:generate` |
| `SIGNING_KEY_ID`, `SIGNING_KEY_PEM` | From `secrets:generate`; paste the PEM line as printed, with its `\n` |
| `GEMINI_API_KEY` | Your Google AI Studio key. Without it, teaching and grading answer 503 and the rest works |
| `PUBLIC_URL`, `FRONTEND_URL` | The site's URL, e.g. `https://mvp-v4.vercel.app` |
| `PUBLIC_HOST` | The same host without `https://`, e.g. `mvp-v4.vercel.app`. Passports are issued as `did:web:<host>`, so verifiers fetch the keys from this site |
| `SECURE_CONFIG_PARAMS_JSON` | The contents of `params.json` from the private secure-config repository |
| `QBX_ALLOW_PRIORS` | `1` **only** for a staging deployment without secure-config. It runs on the repository's prior defaults and says so in `/api/health?deep=1` |
| `QBX_ECHO_EMAIL_CODES` | `1` **only** on staging. No mail provider is connected yet, so this shows the employer's domain code on screen |

Keep a copy of every generated secret in the secure-config repository. They
must never change:
- `SIGNING_KEY_*` verifies every passport already issued.
- `SUBJECT_SECRET` keeps credential subject IDs stable.
- `JWT_SECRET` keeps people signed in.

If one is missing, every API call answers 503 with `missing_env` naming it.

## 4. Deploy

Push to the connected branch, or run `vercel deploy --prod`. The build log
should show `Migrations applied: 0001_schema, 0002_reference_data` on the first
deploy (`Database schema is up to date.` afterwards), then
`Compiled successfully.`

## 5. Check the deployment

1. `https://<your-site>/api/health?deep=1` should report `"status":"ok"`,
   `"database":{"ok":true,"driver":"pg","migrations":2,…}`, the outbox counts,
   where the parameters came from, and whether the Gemini key is set.
2. `https://<your-site>/.well-known/did.json` and `/api/verify/jwks.json` should
   list your `SIGNING_KEY_ID`.
3. Open the site and sign in.

### Test data on a staging database (optional)

The test accounts in `docs/README.md` use public passwords. Seed them only into
a staging or preview database, never a production one:

```bash
cd backend
DATABASE_URL='<the staging database URL>' QBX_SEED_REMOTE=1 \
SIGNING_KEY_ID='<same as Vercel>' SIGNING_KEY_PEM='<same as Vercel>' \
npm run seed:test
```

With the same signing key, the seeded Mastery Log is signed exactly as a
production one would be. The test learner's passport is issued by the deployed
function on the next write request, for example any sign-in. Then open
Capability Passport and check the Evidence ID at `/verify`.

## Local development

Nothing changes for local work. Without `DATABASE_URL`, the backend runs
PostgreSQL in-process (PGlite) with its data in `backend/data/pglite`, so no
database server is needed. The tests do the same in memory. Point
`DATABASE_URL` at any PostgreSQL to use a real server.
