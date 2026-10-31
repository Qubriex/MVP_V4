# Learner journey: how to test it

Every stage of a learner's journey can be opened, moved forward and checked
without a model key. Test learners use the **scripted tutor**: fixed lessons in
Telugu, Hindi and English (`backend/data/scripted/`), so a run behaves the same
every time.

## The stages

| Stage | What it means | Test learner |
|---|---|---|
| S0 | Invited, never signed in | TEST-J-S0 (opens by invite link) |
| S1 | First day | TEST-J-S1, TEST-J-S1-HI |
| S2 | Starting check done | TEST-J-S2 |
| S3 | Learning | TEST-J-S3, TEST-J-S3-HI |
| S4 | Last check not passed yet | TEST-J-S4 |
| S5 | Skill group just finished | TEST-J-S5 |
| S6 | Nearly ready | TEST-J-S6 |
| S7 | Ready | TEST-J-S7, TEST-J-S7-HI |
| S8 | An employer asked | TEST-J-S8 |
| S9 | Day-One assigned | TEST-J-S9 |
| S10 | Applying or an offer | TEST-J-S10 |
| S11 | Hired | TEST-J-S11 |
| S12 | Skills going stale | TEST-J-S12 |

Join codes: QX-FSD-T01 (Telugu), QX-FSD-T02 (Hindi). PIN 410585.
The stage always comes from the learner's own data; Home's "Start here" shows it.

## By hand

1. Open `/dev`, enter the passcode, and find **Learner journey**.
2. **Open as** any stage. S0 opens its invite link until a PIN is set.
3. `/dev/journey` is a checklist of what to try at each stage.
4. In a lesson, type or say **"I'm ready for the check"** (any language): the
   check always starts. Test learners can answer `#pass` or `#fail`.
5. The developer bar's **Controls** (test learners only):
   - time +1, +7 or +30 days, for this learner only;
   - the next check passes or does not pass;
   - an employer asks to see the Passport;
   - the college assigns a bridge programme;
   - **Make me Ready**: every skill mastered and Confirmed;
   - **Reset learner**: back to the seeded stage, exactly.

## Automatically

Against a running copy with `DEV_LOGIN_ENABLED=true`:

```
DEV_PASS=… BASE=http://localhost:3000 node frontend/e2e/learner-journey.mjs
```

It runs the journey S0 → S11 in Telugu through the screens, a Hindi run, a
390 px phone run, and every learner page at 360 and 1440 px. It looks for
console errors, sideways scroll and test-tutor text.

To run it locally:

```
cd backend && DB_PATH=/tmp/e2edb node scripts/migrate.js && DB_PATH=/tmp/e2edb node scripts/seed-test-data.js
DB_PATH=/tmp/e2edb JWT_SECRET=… DEV_LOGIN_ENABLED=true DEV_LOGIN_SECRET=… AI_ADAPTER=scripted node server.js
cd frontend && npm run build && node e2e/serve.mjs
```

CI runs it on every push and nightly, in the `e2e` job, with secrets made for
that run only.
