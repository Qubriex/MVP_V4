# Deploying Qubirex on Vercel

One Vercel project serves the whole product:

| Part | What runs | Where it lives |
|---|---|---|
| Website | The React app, built to static files | `frontend/` → `frontend/build` |
| API (backend) | The Express backend as one Vercel Function | `api/index.js` → `backend/vercel/handler.js` |
| Database | PostgreSQL (Neon, added from Vercel → Storage) | `DATABASE_URL`, set by Vercel |

`vercel.json` at the repository root wires it together. It routes `/api/*` and
`/.well-known/did.json` to the function, and everything else to the React app.

## Quick start: no secrets to set

You only connect a database. The deployment generates everything else itself.

### 1. Project settings (once)

Vercel → **mvp-v4 → Settings → Build and Deployment**:
- **Root Directory:** empty (the repository root).
- **Framework Preset:** Other.
- **Install/Build/Output overrides:** off (`vercel.json` sets them).
- **Node.js Version:** 22.x.

### 2. Connect a database (once, no copy-paste)

Vercel → **mvp-v4 → Storage → Create Database → Neon (Postgres)**. Choose the
free plan and a region close to your users (e.g. Washington, D.C. / iad1),
then **Connect** it to the project for **Production** and **Preview**. Vercel
adds the connection string itself; you never see or type it.

### 3. Deploy the branch that has the backend

The backend lives on `claude/learner-side-updates-vthycg` until it is merged.
- **To try it now:** in Vercel → Deployments, open the latest deployment of
  that branch, then **⋯ → Redeploy**. It must be a build that started after
  you connected the database.
- **For the production domain:** merge the branch into `main` on GitHub.
  Vercel deploys `main` to production automatically.

### 4. Check it

Open `https://<your-deployment>/api/health?deep=1`. You should see:

```json
"database": { "ok": true, "driver": "pg", "migrations": 3, … },
"secrets": "database (JWT_SECRET, SUBJECT_SECRET, ITEM_SEED_SECRET, CRON_SECRET, signing key)",
"params": "priors (QBX_ALLOW_PRIORS)"
```

Then open the site and sign in. Deployments are behind Vercel Authentication,
so you sign in to Vercel first. To make the site public, turn it off under
Settings → Deployment Protection.

What happens on the first request:
- The function finds the database and creates all tables and reference data.
- It generates its secrets and signing key once and keeps them in the
  database's `system_secrets` table, so every instance uses the same ones.
- Site URLs come from Vercel's own variables.
- It runs on the default (prior) parameters, and shows employer
  domain-verification codes on screen, because no email service is connected
  yet.

### Optional: the AI tutor

Teaching sessions, check grading, captions and resume tailoring need a Google
Gemini key. Without one, those screens say "The AI tutor is not set up on this
deployment yet". Everything else (sign-in, cohorts, students, reviews, the
passport, verification, employer and admin portals) works.

To turn it on, go to Settings → Environment Variables → add `GEMINI_API_KEY`
(from https://aistudio.google.com/app/apikey), marked Sensitive, then redeploy.

### Optional: test accounts

Add the environment variable `QBX_SEED_TEST_DATA` = `1` (Production and
Preview), then redeploy. On its first start the deployment creates the test
accounts from `docs/README.md` once.

The passwords are public in this repository, so use this only on a test
deployment, and remove the variable before real users arrive. Seeding from
your own machine works too:

```bash
cd backend && npm install
DATABASE_URL='<connection string>' QBX_SEED_REMOTE=1 npm run seed:test
```

## Before a real launch

The quick start keeps secrets in the database. Anyone who can read the
database can then also read the signing key. Before real learners use the
site:

1. Run `cd backend && npm run secrets:generate`. Add every line it prints in
   Settings → Environment Variables (Production, Sensitive), and keep a copy in
   the private secure-config repository.
2. Add `SECURE_CONFIG_PARAMS_JSON` (the contents of secure-config's
   `params.json`).
3. Add `QBX_REQUIRE_SECRETS=1`. The deployment then refuses to start if any
   secret is missing, instead of generating its own.
4. Connect a mail provider before turning off on-screen employer codes.

Values in the environment always take precedence over the database. Change
the signing key and `SUBJECT_SECRET` before issuing real passports: passports
signed with the old key stay verifiable (old public keys remain published),
but subject IDs change.

## Troubleshooting

| Symptom | Cause |
|---|---|
| Build log: `cd: backend: No such file or directory` | Root Directory is set to a subfolder (step 1) |
| `/api/...` answers 503 with `missing_env` | No database connected (step 2), or `QBX_REQUIRE_SECRETS=1` with secrets missing |
| `/api/health?deep=1` shows `"database":{"ok":false,…}` | The database is unreachable; check Storage → your database |
| The site loads but every API call 404s | The deployment is from `main` before the backend was merged (step 3) |

## Local development

Without `DATABASE_URL`, the backend runs PostgreSQL in-process (PGlite) with
its data in `backend/data/pglite`, so no database server is needed. The tests
do the same in memory.
