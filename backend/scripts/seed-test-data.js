// scripts/seed-test-data.js — LOCAL TEST ACCOUNTS for clicking through the whole site.
//
// Creates (or resets) one institution login and one learner login, with a
// small Full-Stack programme so every institution and learner page has data:
//
//   Institution  http://localhost:3000/login
//     Email:     test.institution@qubirex.local
//     Password:  QubirexTest2026!
//
//   Professor    http://localhost:3000/login   (sees only the test cohort)
//     Email:     test.professor@qubirex.local
//     Password:  QubirexTest2026!
//
//   Employer     http://localhost:3000/employer/login
//     Email:     test.employer@qubirex.local
//     Password:  QubirexTest2026!     (company verification: pending)
//
//   Admin        http://localhost:3000/admin/login   (Qubirex platform staff)
//     Email:     test.admin@qubirex.local
//     Password:  QubirexTest2026!
//
//   Learner      http://localhost:3000/learner-login
//     Learner reference: TEST-LRNR-001
//     Join code:         QX-FSD-T01   (the old Engagement ID below also works)
//     Engagement ID:     4a4c13c4-989e-4c03-b636-3bdba7fd1025
//     PIN:               410585
//
// Safe to run repeatedly: rows use fixed IDs, and the password and PIN are
// reset to the values above on every run. Refuses to run with
// NODE_ENV=production — these credentials are public in the repo.
//
// Usage (from backend/):  npm run seed:test
import 'dotenv/config';
import { initDb } from '../db/init.js';
import { close as closeDb } from '../core/db/dal.js';
import { ensureSigningKey } from '../core/return/signing.js';
import { seedTestData } from './testData.js';

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to seed test accounts with NODE_ENV=production.');
  process.exit(1);
}
// A remote database (e.g. a Vercel/Neon staging database) gets these public
// credentials only when asked for explicitly.
const remoteUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (remoteUrl && !/@(localhost|127\.0\.0\.1)[:/]/.test(remoteUrl) && process.env.QBX_SEED_REMOTE !== '1') {
  console.error('DATABASE_URL points at a remote database. These test credentials are public:');
  console.error('seed only a staging or preview database, and confirm with QBX_SEED_REMOTE=1.');
  process.exit(1);
}

await initDb();
// Against a deployed database, sign with the deployment's own key (D-030),
// so the seeded Mastery Log verifies like any other.
if (remoteUrl) await ensureSigningKey();
try {
  await seedTestData();
} finally {
  await closeDb();
}
