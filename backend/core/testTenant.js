// core/testTenant.js — the seeded test tenant (scripts/testData.js), by fixed ID.
//
// Two rules hang off these IDs:
//   1. The developer login (api/routes/dev.js) may open ONLY the accounts in
//      DEV_ACCOUNTS, and only after checking each one still belongs to the
//      test tenant. There is no free-form ID anywhere in that path.
//   2. Test and real data never meet. institutions/employers/admin_users
//      carry is_test (migration 0007); matching, jobs, sponsorships,
//      benchmarks and admin analytics compare it (see testScope below), so
//      real employers never find test learners, test numbers never reach
//      real analytics, and a test or developer session never sees real people.
import * as dal from './db/dal.js';

export const TEST_INSTITUTION_ID = 'test-inst-0001';
export const TEST_PEER_INSTITUTION_IDS = ['test-peer-inst-1', 'test-peer-inst-2', 'test-peer-inst-3'];
export const TEST_INSTITUTION_IDS = [TEST_INSTITUTION_ID, ...TEST_PEER_INSTITUTION_IDS];
export const TEST_EMPLOYER_IDS = ['test-employer-0001', 'test-employer-0002'];
export const TEST_ADMIN_ID = 'test-admin-0001';
export const TEST_ADMIN_EMAIL = 'test.admin@qubirex.local';

// Every account /dev can open. The key is all a client may send.
export const DEV_ACCOUNTS = {
  learner_te: { actor: 'learner', learnerId: 'test-learner-0001', elId: 'test-el-0001', home: '/learn/dashboard', lang: 'telugu' },
  learner_hi: { actor: 'learner', learnerId: 'test-learner-hi01', elId: 'test-el-hi01', home: '/learn/dashboard', lang: 'hindi' },
  learner_new: { actor: 'learner', learnerId: 'test-learner-new1', elId: 'test-el-new1', home: '/learn/welcome', lang: 'telugu' },
  college_admin: { actor: 'staff', email: 'test.institution@qubirex.local', home: '/institution/home' },
  professor: { actor: 'staff', email: 'test.professor@qubirex.local', home: '/institution/home' },
  employer_verified: { actor: 'employer', employerId: 'test-employer-0002', userId: 'test-employer-user-0002', home: '/employer/home' },
  employer_pending: { actor: 'employer', employerId: 'test-employer-0001', userId: 'test-employer-user-0001', home: '/employer/home' },
  admin: { actor: 'admin', home: '/admin/overview' }
};

/** Whether an institution / employer is in the test tenant (fixed IDs, then the flag). */
export const isTestInstitutionId = (id) => TEST_INSTITUTION_IDS.includes(id);
export const isTestEmployerId = (id) => TEST_EMPLOYER_IDS.includes(id);

export async function institutionIsTest(institutionId) {
  if (!institutionId) return false;
  const r = await dal.one('SELECT is_test FROM institutions WHERE id = ?', institutionId);
  return !!r?.is_test;
}

export async function employerIsTest(employerId) {
  if (!employerId) return false;
  const r = await dal.one('SELECT is_test FROM employers WHERE id = ?', employerId);
  return !!r?.is_test;
}

// ─── Worlds ───────────────────────────────────────────────────────────────────
// Every college and company lives in exactly one world: real, the test tenant,
// or one demo sandbox (migration 0008). A world is { isTest: 0|1, sandbox: ''|id }
// and cross-tenant queries compare both parts, so no world ever sees another.
export const REAL_WORLD = Object.freeze({ isTest: 0, sandbox: '' });
const worldRow = (r) => (r ? { isTest: r.is_test ? 1 : 0, sandbox: r.sandbox_id || '' } : REAL_WORLD);
export async function institutionWorld(institutionId) {
  if (!institutionId) return REAL_WORLD;
  return worldRow(await dal.one('SELECT is_test, sandbox_id FROM institutions WHERE id = ?', institutionId));
}
export async function employerWorld(employerId) {
  if (!employerId) return REAL_WORLD;
  return worldRow(await dal.one('SELECT is_test, sandbox_id FROM employers WHERE id = ?', employerId));
}
/** SQL condition: the row aliased `a` (institutions or employers) is in the world given by worldArgs(w). */
export const worldSql = (a) => `COALESCE(${a}.is_test, 0) = ? AND COALESCE(${a}.sandbox_id, '') = ?`;
export const worldArgs = (w) => [w.isTest, w.sandbox];

/**
 * Which side of the wall a signed-in request is on: 1 for the test tenant
 * (any developer session, or any session of a test account), 0 for real.
 * Admin analytics and lists compare against this.
 */
export async function testScope(req) {
  if (req.user?.dev || req.session?.is_dev) return 1;
  switch (req.session?.actor_type) {
    case 'admin': return (await dal.one('SELECT is_test FROM admin_users WHERE id = ?', req.session.actor_id))?.is_test ? 1 : 0;
    case 'employer': return (await employerIsTest(req.session.employer_id)) ? 1 : 0;
    case 'staff':
    case 'learner': return (await institutionIsTest(req.session.institution_id)) ? 1 : 0;
    default: return 0;
  }
}
