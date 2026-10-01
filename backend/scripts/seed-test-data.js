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
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { initDb, getDb } from '../db/init.js';
import { close as closeDb } from '../core/db/dal.js';
import { mapPathway } from '../core/graph/coverage.js';
import { produceEngagementMasteryLogs } from '../core/masteryLog.js';
import { ensureSigningKey } from '../core/return/signing.js';
import { eachSeq } from '../core/util/seq.js';

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

const INSTITUTION = { id: 'test-inst-0001', name: 'Qubirex Test Institution', email: 'test.institution@qubirex.local', password: 'QubirexTest2026!' };
const ENGAGEMENT_ID = '4a4c13c4-989e-4c03-b636-3bdba7fd1025';
const LEARNER = { id: 'test-learner-0001', name: 'Test Learner', ref: 'TEST-LRNR-001', pin: '410585', language: 'telugu' };
const CT_ID = 'test-ct-0001';
const EL_ID = 'test-el-0001';
const JOIN_CODE = 'QX-FSD-T01';
const PROFESSOR = { id: 'test-staff-prof-0001', email: 'test.professor@qubirex.local', name: 'Lakshmi Rao' };
const EMPLOYER = { id: 'test-employer-0001', userId: 'test-employer-user-0001', name: '[Company name] (test)', domain: 'qubirex.local', email: 'test.employer@qubirex.local', userName: 'Test Hiring Lead' };

// Classmates in different access states, so Students & access has something
// to show. None of them can sign in with a known PIN.
const CLASSMATES = [
  ['TEST-LRNR-002', 'Kavya Nair', 'kavya.nair@student.test', 'active', 4],
  ['TEST-LRNR-003', 'Arjun Reddy', 'arjun.reddy@student.test', 'invited', 0],
  ['TEST-LRNR-004', 'Meena Kumari', null, 'never_signed_in', 0],
  ['TEST-LRNR-005', 'Sai Charan', 'sai.charan@student.test', 'locked', 2],
  ['TEST-LRNR-006', 'Farhan Ali', 'farhan.ali@student.test', 'active', 6],
  ['TEST-LRNR-007', 'Pooja Shetty', null, 'removed', 1]
];

// Clusters and nodes, in order. `m` = already mastered: [attainment, attempts, minutes, last check score].
// Confidence is never seeded: it is computed from the seeded sessions and checks.
const PROGRAMME = [
  ['Web Basics', [['HTML semantics', [0.92, 1, 20, 0.82]], ['CSS box model', [0.86, 2, 30, 0.64]], ['CSS flexbox', [0.9, 1, 24, 0.8]], ['Responsive design', [0.83, 2, 36, 0.6]], ['Git basics', [0.88, 1, 18, 0.78]]]],
  ['JavaScript Core', [['Variables and types', [0.94, 1, 16, 0.85]], ['Functions and scope', [0.87, 2, 38, 0.66]], ['Array methods', [0.79, 3, 62, 0.52]], ['DOM events', null], ['Async and fetch', null]]],
  ['Frontend Foundations', [['React components', null], ['React state and props', null], ['Hooks', null], ['Forms in React', null], ['Calling APIs', null]]],
  ['Backend and Data', [['Node.js basics', null], ['Express routes', null], ['REST design', null], ['SQL queries', null], ['Joins', null]]]
];
const CURRENT_NODE = 'DOM events';

await initDb();
// Against a deployed database, sign with the deployment's own key (D-030),
// so the seeded Mastery Log verifies like any other.
if (remoteUrl) await ensureSigningKey();
const db = getDb();

// The facts behind a mastered node: one completed session with `attempts`
// checks, the last one passed. Confidence and labels are computed from these.
async function seedFacts(elId, nodeId, key, attempts, score, daysAgo) {
  const sid = `test-ls-${key}`;
  const when = `-${daysAgo} days`;
  await db.prepare(`INSERT OR IGNORE INTO learning_sessions (id, engagement_learner_id, skill_node_id, language, status, started_at, completed_at, loop_count)
    VALUES (?, ?, ?, 'telugu', 'completed', datetime('now', ?), datetime('now', ?), ?)`).run(sid, elId, nodeId, when, when, attempts - 1);
  for (let i = 1; i <= attempts; i += 1) {
    const passed = i === attempts;
    await db.prepare(`INSERT OR IGNORE INTO mastery_checks (id, session_id, skill_node_id, engagement_learner_id, check_number, question_text, passed, score, evaluated_at, created_at)
      VALUES (?, ?, ?, ?, ?, 'Seeded check', ?, ?, datetime('now', ?), datetime('now', ?))`).run(`${sid}-c${i}`, sid, nodeId, elId, i, passed ? 1 : 0, passed ? score : 0.5, when, when);
  }
}

// ── v4.3 evidence for the test learner (§7, §8, §9) ──────────────────────────
// Each mastered node gets the check it passed (family instance, evidence
// record with typed-answer provenance → A1) and its mastery demonstration.
// Older nodes also carry a passed review. Retention: two reviews are due now.
async function seedEvidence(elId, learnerId, nodes) {
  const ins = async (sql, ...a) => await db.prepare(sql).run(...a);
  await eachSeq(nodes, async ({ id: nodeId, label, score, daysAgo }, i) => {
    const at = new Date(Date.now() - daysAgo * 86400000).toISOString();
    const fi = `test-fi-${nodeId}`; const ev = `test-ev-${nodeId}`;
    await ins(`INSERT OR IGNORE INTO family_instances (id, el_id, learner_id, node_id, family_id, purpose, attempt_no, seed, params_json, question_text, generator, created_at)
      VALUES (?, ?, ?, ?, ?, 'check', 1, 'seed', '{}', ?, 'template', ?)`, fi, elId, learnerId, nodeId, `gen:${nodeId}`, `In your own words: how would you use ${label} in a small project, and what goes wrong if you get it wrong?`, at);
    await ins(`INSERT OR IGNORE INTO evidence_records (id, el_id, node_id, family_id, instance_id, purpose, answer_hash, r_c, passed, level, assurance, authentic, provisional, theta, created_at)
      VALUES (?, ?, ?, ?, ?, 'check', ?, ?, 1, 'L1', 'A1', 1, 0, 0.6, ?)`, ev, elId, nodeId, `gen:${nodeId}`, fi, crypto.createHash('sha256').update(ev).digest('hex'), score, at);
    await ins(`INSERT OR IGNORE INTO answer_provenance (evidence_id, mode, answer_chars, pasted_chars, paste_events, largest_paste, edit_ratio) VALUES (?, 'typed', 240, 0, 0, 0, 0.1)`, ev);
    await ins(`INSERT OR IGNORE INTO demonstrations (id, el_id, node_id, kind, date, passed, score, level, assurance, evidence_id, created_at)
      VALUES (?, ?, ?, 'mastery', ?, 1, ?, 'L1', 'A1', ?, ?)`, `test-demo-${nodeId}`, elId, nodeId, at, score, ev, at);
    await ins('UPDATE node_mastery SET theta = 0.6, evidence_level = \'L1\', loops = ? WHERE engagement_learner_id = ? AND skill_node_id = ?', i % 3 === 1 ? 1 : 0, elId, nodeId);
    const reviewed = daysAgo >= 7;
    if (reviewed) {
      const rAt = new Date(Date.now() - (daysAgo - 3) * 86400000).toISOString();
      await ins(`INSERT OR IGNORE INTO demonstrations (id, el_id, node_id, kind, date, passed, score, level, assurance, created_at)
        VALUES (?, ?, ?, 'review', ?, 1, ?, 'L1', 'A1', ?)`, `test-demo-r-${nodeId}`, elId, nodeId, rAt, Math.min(0.95, score + 0.04), rAt);
    }
    // Two nodes due for review now; the rest later.
    const due = new Date(Date.now() + (i < 2 ? -86400000 : (i + 2) * 86400000)).toISOString();
    await ins(`INSERT INTO node_retention (el_id, node_id, interval_days, due_at, last_review_at, last_result, reviews_passed, reviews_failed, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?) ON CONFLICT(el_id, node_id) DO UPDATE SET due_at = excluded.due_at`,
      elId, nodeId, reviewed ? 7.5 : 3, due, reviewed ? at : null, reviewed ? 'pass' : null, reviewed ? 1 : 0, at);
  });
}

// ── Faculty review queue (§7.8): one borderline decision, one random sample ──
async function seedReviewQueue(elId, nodeId, answer, reason, stratum, key) {
  const at = new Date(Date.now() - 3600000).toISOString();
  const fi = `test-fi-rq-${key}`; const ev = `test-ev-rq-${key}`;
  await db.prepare(`INSERT OR IGNORE INTO family_instances (id, el_id, learner_id, node_id, family_id, purpose, attempt_no, seed, params_json, question_text, generator, created_at)
    SELECT ?, ?, learner_id, ?, ?, 'check', 2, 'seed', '{}', ?, 'template', ? FROM engagement_learners WHERE id = ?`)
    .run(fi, elId, nodeId, `gen:${nodeId}`, 'A shop page shows 12 product cards. Explain how you would lay them out so they wrap neatly on a phone and a laptop, and why.', at, elId);
  await db.prepare(`INSERT OR IGNORE INTO evidence_records (id, el_id, node_id, family_id, instance_id, purpose, answer_hash, r_c, passed, level, assurance, authentic, provisional, theta, created_at)
    VALUES (?, ?, ?, ?, ?, 'check', ?, ?, 1, 'L1', 'A1', 1, ?, 0.6, ?)`).run(ev, elId, nodeId, `gen:${nodeId}`, fi, crypto.createHash('sha256').update(answer).digest('hex'), reason === 'borderline' ? 0.64 : 0.82, reason === 'borderline' ? 1 : 0, at);
  await db.prepare('INSERT OR IGNORE INTO check_answers (evidence_id, answer_text, created_at) VALUES (?, ?, ?)').run(ev, answer, at);
  await db.prepare(`INSERT OR IGNORE INTO review_queue (id, evidence_id, el_id, node_id, institution_id, engagement_id, stratum, reason, priority, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)`).run(`test-rq-${key}`, ev, elId, nodeId, INSTITUTION.id, ENGAGEMENT_ID, stratum, reason, reason === 'borderline' ? 4 : 5, at);
}

// ── Regional benchmark peers (§16): three other Hyderabad institutions ─────────
// The regional median is published only with ≥ 3 other institutions, never named.
async function seedPeers() {
  const hash = bcrypt.hashSync(crypto.randomBytes(12).toString('hex'), 4);
  await eachSeq([['Peer College A', 0.55, 2], ['Peer College B', 0.4, 1], ['Peer Institute C', 0.7, 3]], async ([name, share, loops], p) => {
    const inst = `test-peer-inst-${p + 1}`; const ct = `test-peer-ct-${p + 1}`; const eng = `test-peer-eng-${p + 1}`;
    await db.prepare(`INSERT OR IGNORE INTO institutions (id, name, type, contact_name, contact_email, city, password_hash) VALUES (?, ?, 'coding_bootcamp', 'Peer', ?, 'Hyderabad', ?)`)
      .run(inst, `${name} (benchmark sample)`, `peer${p + 1}@peer.test`, hash);
    await db.prepare(`INSERT OR IGNORE INTO capability_targets (id, institution_id, version, title, path, domain, raw_input, confirmed, confirmed_at, status)
      VALUES (?, ?, '1.0', 'Web Developer Track', 'A', 'software', 'benchmark sample', 1, datetime('now'), 'active')`).run(ct, inst);
    const nodes = [];
    for (let c = 0; c < 2; c += 1) {
      const cl = `${ct}-c${c}`;
      await db.prepare(`INSERT OR IGNORE INTO skill_clusters (id, capability_target_id, cluster_label, cluster_ref, sequence_order) VALUES (?, ?, ?, ?, ?)`).run(cl, ct, c ? 'JavaScript' : 'Web Basics', `C${c + 1}`, c + 1);
      for (let n = 0; n < 5; n += 1) {
        const nid = `${cl}-n${n}`; nodes.push({ id: nid, cl });
        await db.prepare(`INSERT OR IGNORE INTO skill_nodes (id, cluster_id, node_label, sequence_order, difficulty_level, estimated_minutes) VALUES (?, ?, ?, ?, 2, 20)`).run(nid, cl, `Topic ${c + 1}.${n + 1}`, n + 1);
      }
    }
    await db.prepare(`INSERT OR IGNORE INTO engagements (id, institution_id, capability_target_id, title, language, status, started_at) VALUES (?, ?, ?, 'Web batch', 'telugu', 'active', datetime('now', '-30 days'))`).run(eng, inst, ct);
    for (let l = 0; l < 4; l += 1) {
      const lid = `test-peer-l-${p + 1}-${l}`; const el = `test-peer-el-${p + 1}-${l}`;
      await db.prepare(`INSERT OR IGNORE INTO learners (id, institution_id, name, learner_ref, language) VALUES (?, ?, ?, ?, 'telugu')`).run(lid, inst, `Peer learner ${l + 1}`, `PEER-${p + 1}-${l}`);
      await db.prepare(`INSERT OR IGNORE INTO engagement_learners (id, engagement_id, learner_id, current_node_id, current_cluster_id) VALUES (?, ?, ?, ?, ?)`).run(el, eng, lid, nodes[0].id, nodes[0].cl);
      const mastered = Math.round(nodes.length * share) - (l % 2);
      await eachSeq(nodes.slice(0, mastered), async (n, k) => {
        await db.prepare(`INSERT OR IGNORE INTO node_mastery (id, engagement_learner_id, skill_node_id, mastery_attainment, attempt_count, advanced_at, loops, provisional)
          VALUES (?, ?, ?, 0.8, 1, datetime('now', ?), ?, ?)`).run(`${el}-nm-${k}`, el, n.id, `-${20 - k} days`, (k + l) % (loops + 1), k % 7 === 0 ? 1 : 0);
        await db.prepare(`INSERT OR IGNORE INTO learning_sessions (id, engagement_learner_id, skill_node_id, language, status, started_at, completed_at, loop_count, active_minutes)
          VALUES (?, ?, ?, 'telugu', 'completed', datetime('now', ?), datetime('now', ?), 0, ?)`).run(`${el}-ls-${k}`, el, n.id, `-${20 - k} days`, `-${20 - k} days`, 14 + p * 4 + (k % 5));
        if (k % 3 === 0) await db.prepare(`INSERT OR IGNORE INTO demonstrations (id, el_id, node_id, kind, date, passed, score, level, assurance, created_at)
          VALUES (?, ?, ?, 'review', datetime('now', ?), ?, 0.75, 'L1', 'A1', datetime('now'))`).run(`${el}-rv-${k}`, el, n.id, `-${10 - (k % 5)} days`, (k + p) % 4 ? 1 : 0);
      });
    }
  });
}
try {
  const seed = db.transaction(async () => {
    // ── Institution (password reset on every run) ────────────────────────────
    const pwHash = bcrypt.hashSync(INSTITUTION.password, 10);
    await db.prepare(`
      INSERT INTO institutions (id, name, type, contact_name, contact_email, city, password_hash)
      VALUES (?, ?, 'coding_bootcamp', 'Test Coordinator', ?, 'Hyderabad', ?)
      ON CONFLICT(id) DO UPDATE SET contact_email = excluded.contact_email, password_hash = excluded.password_hash, is_active = 1
    `).run(INSTITUTION.id, INSTITUTION.name, INSTITUTION.email, pwHash);

    // ── Confirmed capability target + pathway ────────────────────────────────
    await db.prepare(`
      INSERT OR IGNORE INTO capability_targets (id, institution_id, version, title, path, domain, raw_input, confirmed, confirmed_at, time_window_weeks, cohort_size, status)
      VALUES (?, ?, '1.0', 'Full-Stack Developer Programme', 'A', 'software', 'Test programme for local review', 1, datetime('now'), 16, 1, 'active')
    `).run(CT_ID, INSTITUTION.id);

    const nodeIds = {};
    await eachSeq(PROGRAMME, async ([cluster, nodes], ci) => {
      const clusterId = `test-cluster-${ci + 1}`;
      await db.prepare(`INSERT OR IGNORE INTO skill_clusters (id, capability_target_id, cluster_label, cluster_ref, sequence_order, estimated_hours)
        VALUES (?, ?, ?, ?, ?, ?)`).run(clusterId, CT_ID, cluster, `C${ci + 1}`, ci + 1, nodes.length * 0.5);
      await eachSeq(nodes, async ([label], ni) => {
        const nodeId = `test-node-${ci + 1}-${ni + 1}`;
        nodeIds[label] = { id: nodeId, clusterId };
        await db.prepare(`INSERT OR IGNORE INTO skill_nodes (id, cluster_id, node_label, sequence_order, difficulty_level, estimated_minutes)
          VALUES (?, ?, ?, ?, ?, 20)`).run(nodeId, clusterId, label, ni + 1, Math.min(ci + 1, 5));
      });
    });

    // ── Engagement (fixed ID — it is part of the learner login) ─────────────
    await db.prepare(`
      INSERT OR IGNORE INTO engagements (id, institution_id, capability_target_id, title, language, status, started_at, join_code)
      VALUES (?, ?, ?, 'Full-Stack Developer Programme — Test Batch', 'telugu', 'active', datetime('now'), ?)
    `).run(ENGAGEMENT_ID, INSTITUTION.id, CT_ID, JOIN_CODE);
    await db.prepare('UPDATE engagements SET join_code = ? WHERE id = ?').run(JOIN_CODE, ENGAGEMENT_ID);

    // ── Staff: the contact email above signs in as admin; plus one professor ─
    await db.prepare(`
      INSERT INTO institution_users (id, institution_id, email, password_hash, role, status, name, title, designation, department,
        specialisations, teaching_languages, subjects, office_hours, target_roles, profile_completed)
      VALUES (?, ?, ?, ?, 'professor', 'active', ?, 'Dr.', 'Associate Professor', 'Computer Science & Engineering',
        '["Web technologies","Databases"]', '["english","telugu"]', '["Web Technologies (CS501)","DBMS (CS402)"]', 'Tue & Thu, 3–4 pm, Block C 204',
        '["Frontend developer","UI developer","Full-stack developer"]', 1)
      ON CONFLICT(email) DO UPDATE SET password_hash = excluded.password_hash, status = 'active', role = 'professor'
    `).run(PROFESSOR.id, INSTITUTION.id, PROFESSOR.email, pwHash, PROFESSOR.name);
    const profId = (await db.prepare('SELECT id FROM institution_users WHERE email = ?').get(PROFESSOR.email)).id;
    await db.prepare("INSERT OR IGNORE INTO staff_cohorts (staff_id, engagement_id, cohort_role) VALUES (?, ?, 'lead')").run(profId, ENGAGEMENT_ID);
    await db.prepare(`
      INSERT INTO institution_users (id, institution_id, email, password_hash, role, status, name, department, profile_completed)
      VALUES ('test-staff-admin-0001', ?, ?, ?, 'admin', 'active', 'Test Coordinator', 'Administration', 1)
      ON CONFLICT(email) DO UPDATE SET password_hash = excluded.password_hash, status = 'active', role = 'admin'
    `).run(INSTITUTION.id, INSTITUTION.email, pwHash);

    // ── Learner (PIN reset on every run) ─────────────────────────────────────
    const pinHash = bcrypt.hashSync(LEARNER.pin, 10);
    await db.prepare(`
      INSERT INTO learners (id, institution_id, name, email, learner_ref, pin_hash, language, profile_type)
      VALUES (?, ?, ?, 'test.learner@qubirex.local', ?, ?, ?, 'college_student')
      ON CONFLICT(id) DO UPDATE SET pin_hash = excluded.pin_hash, is_active = 1
    `).run(LEARNER.id, INSTITUTION.id, LEARNER.name, LEARNER.ref, pinHash, LEARNER.language);

    const current = nodeIds[CURRENT_NODE];
    await db.prepare("UPDATE learners SET pin_must_change = 0 WHERE id = ?").run(LEARNER.id);
    await db.prepare(`
      INSERT OR IGNORE INTO engagement_learners (id, engagement_id, learner_id, current_node_id, current_cluster_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(EL_ID, ENGAGEMENT_ID, LEARNER.id, current.id, current.clusterId);
    // Re-running always leaves the test learner able to sign in.
    await db.prepare("UPDATE engagement_learners SET access_status = 'active', locked_at = NULL, failed_pin_attempts = 0, engagement_id = ? WHERE id = ?").run(ENGAGEMENT_ID, EL_ID);

    // ── Some mastery already earned, so dashboard, record and gap scoring show data
    await eachSeq(PROGRAMME, async ([, nodes]) => await eachSeq(nodes, async ([label, m]) => {
      if (!m) return;
      await db.prepare(`
        INSERT OR IGNORE INTO node_mastery (id, engagement_learner_id, skill_node_id, mastery_attainment, attempt_count, time_to_mastery_minutes, advanced_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now', ?))
      `).run(`test-nm-${nodeIds[label].id}`, EL_ID, nodeIds[label].id, m[0], m[1], m[2], `-${10 - Object.keys(nodeIds).indexOf(label)} days`);
      await seedFacts(EL_ID, nodeIds[label].id, nodeIds[label].id, m[1], m[3], 10 - Object.keys(nodeIds).indexOf(label));
    }));
    // ── Classmates ───────────────────────────────────────────────────────────
    const lockedPin = bcrypt.hashSync(crypto.randomBytes(8).toString('hex'), 4);
    const firstNode = nodeIds['HTML semantics'];
    await eachSeq(CLASSMATES, async ([ref, name, email, state, mastered], i) => {
      const lid = `test-learner-${String(i + 2).padStart(4, '0')}`;
      const elId = `test-el-${String(i + 2).padStart(4, '0')}`;
      await db.prepare(`INSERT OR IGNORE INTO learners (id, institution_id, name, email, learner_ref, pin_hash, language, profile_type)
        VALUES (?, ?, ?, ?, ?, ?, 'telugu', 'college_student')`).run(lid, INSTITUTION.id, name, email, ref, state === 'invited' ? null : lockedPin);
      const labels = Object.keys(nodeIds);
      const cur = nodeIds[labels[mastered]] || firstNode;
      await db.prepare(`INSERT OR IGNORE INTO engagement_learners (id, engagement_id, learner_id, current_node_id, current_cluster_id, access_status,
          last_login_at, locked_at, removed_at, delivery)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(elId, ENGAGEMENT_ID, lid, cur.id, cur.clusterId,
        state === 'removed' ? 'removed' : 'active',
        ['active', 'locked', 'removed'].includes(state) ? new Date(Date.now() - i * 86400000).toISOString().replace('T', ' ').slice(0, 19) : null,
        state === 'locked' ? new Date().toISOString() : null, state === 'removed' ? new Date().toISOString() : null,
        email ? 'email' : 'slip');
      await eachSeq(labels.slice(0, mastered), async (label, k) => {
        await db.prepare(`
          INSERT OR IGNORE INTO node_mastery (id, engagement_learner_id, skill_node_id, mastery_attainment, attempt_count, time_to_mastery_minutes, advanced_at)
          VALUES (?, ?, ?, ?, ?, ?, datetime('now', ?))
        `).run(`test-nm-${elId}-${k}`, elId, nodeIds[label].id, 0.78 + (k % 3) * 0.06, 1 + (k % 2), 25, `-${12 - k} days`);
        await seedFacts(elId, nodeIds[label].id, `${elId}-${k}`, 1 + (k % 2), 0.78 + (k % 3) * 0.06, 12 - k);
      });
      await db.prepare(`INSERT OR IGNORE INTO access_events (id, institution_id, learner_id, engagement_learner_id, event, detail, created_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-14 days'))`).run(`test-ev-${elId}`, INSTITUTION.id, lid, elId,
        email ? 'invited' : 'slip_issued', email ? 'Invited to the test cohort by email' : 'Added with a printed login slip');
    });
    await db.prepare(`INSERT OR IGNORE INTO learner_profiles (learner_id, share_with_institution) VALUES ('test-learner-0006', 1)`).run();
    await db.prepare(`INSERT OR IGNORE INTO learner_profiles (learner_id, share_with_institution) VALUES ('test-learner-0002', 1)`).run();

    await db.prepare(`
      INSERT OR IGNORE INTO streaks (id, engagement_learner_id, current_streak, longest_streak, total_session_days, last_session_date)
      VALUES ('test-streak-0001', ?, 3, 5, 9, to_char(now() - interval '1 day', 'YYYY-MM-DD'))
    `).run(EL_ID);
  });
  await seed();
  // Map the programme's nodes onto the Capability Graph (v4.3 §3).
  await mapPathway(CT_ID);

  await db.transaction(async () => {
    const ordered = [];
    PROGRAMME.forEach(([, nodes], ci) => nodes.forEach(([label, m], ni) => { if (m) ordered.push({ id: `test-node-${ci + 1}-${ni + 1}`, label, score: m[3] }); }));
    ordered.forEach((n, i) => { n.daysAgo = 10 - i; });
    await seedEvidence(EL_ID, LEARNER.id, ordered);
    await seedReviewQueue('test-el-0002', 'test-node-1-4', 'I would use flexbox with flex-wrap so the cards go onto new lines. On a phone each card is full width and on a laptop they sit three or four in a row. I think media queries also help with the widths.', 'borderline', 'decision', 'kavya');
    await seedReviewQueue('test-el-0006', 'test-node-1-4', 'Use CSS grid: grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)). The browser fits as many 220px columns as there is room for, so the cards wrap on a phone without any media query, and the 1fr shares out the spare space evenly.', 'random', 'calibration', 'farhan');
    await db.prepare('UPDATE institutions SET review_minutes_per_100 = COALESCE(review_minutes_per_100, 120) WHERE id = ?').run(INSTITUTION.id);
    await seedPeers();
  })();

  // A Mastery Log for the test learner (once): its MASTERY_LOG_PRODUCED event
  // issues the Capability Passport when the server's outbox worker runs.
  if (!await db.prepare('SELECT 1 FROM mastery_logs WHERE learner_id = ?').get(LEARNER.id)) {
    await produceEngagementMasteryLogs(ENGAGEMENT_ID, { learnerIds: [LEARNER.id] });
  }

  // ── Admin (Qubirex platform staff; password reset on every run) ───────────
  await db.prepare(`INSERT INTO admin_users (id, email, password_hash, name) VALUES ('test-admin-0001', 'test.admin@qubirex.local', ?, 'Test Admin')
    ON CONFLICT(email) DO UPDATE SET password_hash = excluded.password_hash`).run(bcrypt.hashSync(INSTITUTION.password, 10));

  // ── Employer (password reset on every run) ────────────────────────────────
  const now = new Date().toISOString();
  await db.prepare(`INSERT OR IGNORE INTO employers (id, name, domain, kyb_status, created_at, updated_at) VALUES (?, ?, ?, 'pending', ?, ?)`)
    .run(EMPLOYER.id, EMPLOYER.name, EMPLOYER.domain, now, now);
  await db.prepare(`INSERT OR IGNORE INTO employer_users (id, employer_id, email, password_hash, name, role, status, created_at, updated_at)
    VALUES (?, ?, ?, '', ?, 'owner', 'active', ?, ?)`).run(EMPLOYER.userId, EMPLOYER.id, EMPLOYER.email, EMPLOYER.userName, now, now);
  await db.prepare("UPDATE employer_users SET password_hash = ?, status = 'active', updated_at = ? WHERE id = ?")
    .run(bcrypt.hashSync(INSTITUTION.password, 10), now, EMPLOYER.userId);
  await db.prepare("DELETE FROM login_failures WHERE account_key IN (?, ?, ?, ?)").run(INSTITUTION.email, PROFESSOR.email, EMPLOYER.email, 'test.admin@qubirex.local');

  console.log('\nTest accounts ready.\n');
  console.log('  Institution  http://localhost:3000/login');
  console.log(`    Email:     ${INSTITUTION.email}`);
  console.log(`    Password:  ${INSTITUTION.password}\n`);
  console.log('  Professor    http://localhost:3000/login');
  console.log(`    Email:     ${PROFESSOR.email}`);
  console.log(`    Password:  ${INSTITUTION.password}\n`);
  console.log('  Employer     http://localhost:3000/employer/login');
  console.log(`    Email:     ${EMPLOYER.email}`);
  console.log(`    Password:  ${INSTITUTION.password}   (company verification pending)\n`);
  console.log('  Admin        http://localhost:3000/admin/login');
  console.log(`    Email:     test.admin@qubirex.local`);
  console.log(`    Password:  ${INSTITUTION.password}\n`);
  console.log('  Learner      http://localhost:3000/learner-login');
  console.log(`    Learner reference: ${LEARNER.ref}`);
  console.log(`    Join code:         ${JOIN_CODE}   (or Engagement ID ${ENGAGEMENT_ID})`);
  console.log(`    PIN:               ${LEARNER.pin}\n`);
} finally {
  await closeDb();
}
