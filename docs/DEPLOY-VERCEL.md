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
"database": { "ok": true, "driver": "pg", "migrations": 4, … },
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

## Developer login (/dev)

A one-click way for the founder and the testing team to open any side of the
site (learner, college admin, professor, employer, admin) as the seeded test
accounts, and switch between them. It is **off unless you turn it on**, and it
can only ever open the fixed test accounts in "Qubirex Test Institution" and
"[Company name] (test)". Real learners, colleges and employers are never
shown in a developer session.

### Turn it on

In Vercel → **mvp-v4 → Settings → Environment Variables**, add (names only;
choose the environment as described below, and mark the secret Sensitive):

| Name | Value |
|---|---|
| `DEV_LOGIN_ENABLED` | `true` |
| `DEV_LOGIN_SECRET` | a passcode of **32 characters or more** |
| `DEV_LOGIN_ALLOWED_IPS` | optional: comma-separated IPs allowed to use it |
| `QBX_SEED_TEST_DATA` | `1`, so the test accounts exist (or use Reset test data on /dev) |

Make a strong passcode on your own computer and paste it straight into Vercel:

```bash
openssl rand -base64 48
```

Never put it in the code, a `REACT_APP_*` variable, a chat or a document.
Share it with testers through a password manager. Redeploy, then open
`https://<your-deployment>/dev`.

If `DEV_LOGIN_ENABLED=true` is set with a passcode shorter than 32 characters,
the deployment refuses to start and `/api/*` answers 503, naming
`DEV_LOGIN_SECRET` (never its value).

### Turn it off

Delete `DEV_LOGIN_ENABLED` (or set it to anything but `true`) and redeploy.
`/api/dev/*` then answers 404 as if it never existed, and `/dev` goes to the
home page. Changing `DEV_LOGIN_SECRET` ends every unlocked browser at once.

### What protects it

- The passcode is checked only on the server, in constant time. Each IP gets
  5 tries per 15 minutes, counted in the database so every instance shares
  the count.
- A correct passcode gives an 8-hour unlock (an httpOnly cookie). Opening a
  role card gives a **real** server session for that test account, marked
  `dev: true` and `actor: "developer"`, which lasts 8 hours.
- The browser only sends a card name (`learner_te`, `college_admin` …). The
  server maps it to a fixed test account and checks that account is still in
  the test tenant by fixed ID. Any other value answers 404.
- Every unlock, failed try, sign-in, switch, reset, skipped wait and end is in
  the `dev_audit` table: when, which role, which session and IP. The
  passcode is never stored.
- Test and real data never mix:
  - Test colleges and companies are flagged `is_test`.
  - Real employers never find test learners, and test learners never see real
    jobs.
  - Test colleges never count in a real college's benchmark.
  - A real admin's numbers leave test data out.
  - The test admin, and any developer session, sees only test data and cannot
    change shared reference data.

### Where to run it

**Recommended: a separate staging deployment.**

1. In Vercel → Storage, create a second Neon database (or a Neon branch of
   the production one) and connect it to the **Preview** environment only.
2. Push a `staging` branch. Vercel deploys it as a Preview.
3. Add `DEV_LOGIN_ENABLED`, `DEV_LOGIN_SECRET` and `QBX_SEED_TEST_DATA` for
   **Preview** only. Production never has them.
4. Seed or refresh the staging database from your computer, against
   **staging only**:
   `cd backend && DATABASE_URL='<staging connection string>' QBX_SEED_REMOTE=1 npm run seed:test`
5. Test on the staging URL, then merge to `main` to promote.

**If it must also run on production**, the rules above still hold: it can only
open the test accounts, and their data stays walled off from real users. Set
the variables for Production too, use the IP allowlist, and turn it off when
testing is done. Never set `QBX_SEED_TEST_DATA` on a production database
that real users depend on without first agreeing to the public test
passwords it creates.

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

## Speed: run it in Mumbai (do both steps together)

Today the functions run in Washington, D.C. (`iad1`) and the Neon database is
in AWS US East (`us-east-1`). They are next to each other, so database
queries are fast, but every click from India crosses to the US and back
(about a quarter of a second per round trip, before any work). Moving only the functions to Mumbai
would be **slower**: each page makes several database queries, and every one
would then cross the ocean. Move both:

1. **Database.** Vercel → mvp-v4 → Storage → Create Database → Neon, region
   **Asia Pacific (Mumbai) aws-ap-south-1**, and connect it to the project
   (Production and Preview). Disconnect the US one. The new database starts
   empty: the deployment creates the tables, its secrets and (with
   `QBX_SEED_TEST_DATA=1`) the test accounts on first start. Test progress in
   the old database is not copied; sign-ins and passports issued there stop
   working, because the new database has new secrets.
2. **Functions.** Add `"regions": ["bom1"]` to `vercel.json` (or Settings →
   Functions → Function Region → Mumbai, bom1), then redeploy.

Check: `/api/health?deep=1` shows `"database": {"ok": true …}` and answers
in well under a second from India.

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
