// scripts/seed-test-data.js — LOCAL TEST ACCOUNTS for clicking through the whole site.
//
// Creates (or resets) one institution login and one learner login, with a
// small Full-Stack programme so every institution and learner page has data:
//
//   Institution  http://localhost:3000/login
//     Email:     test.institution@qubirex.local
//     Password:  QubirexTest2026!
//
//   Learner      http://localhost:3000/learner-login
//     Learner reference: TEST-LRNR-001
//     Engagement ID:     4a4c13c4-989e-4c03-b636-3bdba7fd1025
//     PIN:               410585
//
// Safe to run repeatedly: rows use fixed IDs, and the password and PIN are
// reset to the values above on every run. Refuses to run with
// NODE_ENV=production — these credentials are public in the repo.
//
// Usage (from backend/):  npm run seed:test
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { initDb, getDb } = require('../db/init');

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to seed test accounts with NODE_ENV=production.');
  process.exit(1);
}

const INSTITUTION = { id: 'test-inst-0001', name: 'Qubirex Test Institution', email: 'test.institution@qubirex.local', password: 'QubirexTest2026!' };
const ENGAGEMENT_ID = '4a4c13c4-989e-4c03-b636-3bdba7fd1025';
const LEARNER = { id: 'test-learner-0001', name: 'Test Learner', ref: 'TEST-LRNR-001', pin: '410585', language: 'telugu' };
const CT_ID = 'test-ct-0001';
const EL_ID = 'test-el-0001';

// Clusters and nodes, in order. `m` = already mastered: [attainment, attempts, minutes, confidence].
const PROGRAMME = [
  ['Web Basics', [['HTML semantics', [0.92, 1, 20, 0.82]], ['CSS box model', [0.86, 2, 30, 0.64]], ['CSS flexbox', [0.9, 1, 24, 0.8]], ['Responsive design', [0.83, 2, 36, 0.6]], ['Git basics', [0.88, 1, 18, 0.78]]]],
  ['JavaScript Core', [['Variables and types', [0.94, 1, 16, 0.85]], ['Functions and scope', [0.87, 2, 38, 0.66]], ['Array methods', [0.79, 3, 62, 0.52]], ['DOM events', null], ['Async and fetch', null]]],
  ['Frontend Foundations', [['React components', null], ['React state and props', null], ['Hooks', null], ['Forms in React', null], ['Calling APIs', null]]],
  ['Backend and Data', [['Node.js basics', null], ['Express routes', null], ['REST design', null], ['SQL queries', null], ['Joins', null]]]
];
const CURRENT_NODE = 'DOM events';

initDb();
const db = getDb();
try {
  const seed = db.transaction(() => {
    // ── Institution (password reset on every run) ────────────────────────────
    const pwHash = bcrypt.hashSync(INSTITUTION.password, 10);
    db.prepare(`
      INSERT INTO institutions (id, name, type, contact_name, contact_email, city, password_hash)
      VALUES (?, ?, 'coding_bootcamp', 'Test Coordinator', ?, 'Hyderabad', ?)
      ON CONFLICT(id) DO UPDATE SET contact_email = excluded.contact_email, password_hash = excluded.password_hash, is_active = 1
    `).run(INSTITUTION.id, INSTITUTION.name, INSTITUTION.email, pwHash);

    // ── Confirmed capability target + pathway ────────────────────────────────
    db.prepare(`
      INSERT OR IGNORE INTO capability_targets (id, institution_id, version, title, path, domain, raw_input, confirmed, confirmed_at, time_window_weeks, cohort_size, status)
      VALUES (?, ?, '1.0', 'Full-Stack Developer Programme', 'A', 'software', 'Test programme for local review', 1, datetime('now'), 16, 1, 'active')
    `).run(CT_ID, INSTITUTION.id);

    const nodeIds = {};
    PROGRAMME.forEach(([cluster, nodes], ci) => {
      const clusterId = `test-cluster-${ci + 1}`;
      db.prepare(`INSERT OR IGNORE INTO skill_clusters (id, capability_target_id, cluster_label, cluster_ref, sequence_order, estimated_hours)
        VALUES (?, ?, ?, ?, ?, ?)`).run(clusterId, CT_ID, cluster, `C${ci + 1}`, ci + 1, nodes.length * 0.5);
      nodes.forEach(([label], ni) => {
        const nodeId = `test-node-${ci + 1}-${ni + 1}`;
        nodeIds[label] = { id: nodeId, clusterId };
        db.prepare(`INSERT OR IGNORE INTO skill_nodes (id, cluster_id, node_label, sequence_order, difficulty_level, estimated_minutes)
          VALUES (?, ?, ?, ?, ?, 20)`).run(nodeId, clusterId, label, ni + 1, Math.min(ci + 1, 5));
      });
    });

    // ── Engagement (fixed ID — it is part of the learner login) ─────────────
    db.prepare(`
      INSERT OR IGNORE INTO engagements (id, institution_id, capability_target_id, title, language, status, started_at)
      VALUES (?, ?, ?, 'Full-Stack Developer Programme — Test Batch', 'telugu', 'active', datetime('now'))
    `).run(ENGAGEMENT_ID, INSTITUTION.id, CT_ID);

    // ── Learner (PIN reset on every run) ─────────────────────────────────────
    const pinHash = bcrypt.hashSync(LEARNER.pin, 10);
    db.prepare(`
      INSERT INTO learners (id, institution_id, name, email, learner_ref, pin_hash, language, profile_type)
      VALUES (?, ?, ?, 'test.learner@qubirex.local', ?, ?, ?, 'college_student')
      ON CONFLICT(id) DO UPDATE SET pin_hash = excluded.pin_hash, is_active = 1
    `).run(LEARNER.id, INSTITUTION.id, LEARNER.name, LEARNER.ref, pinHash, LEARNER.language);

    const current = nodeIds[CURRENT_NODE];
    db.prepare(`
      INSERT OR IGNORE INTO engagement_learners (id, engagement_id, learner_id, current_node_id, current_cluster_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(EL_ID, ENGAGEMENT_ID, LEARNER.id, current.id, current.clusterId);

    // ── Some mastery already earned, so dashboard, record and gap scoring show data
    PROGRAMME.forEach(([, nodes]) => nodes.forEach(([label, m]) => {
      if (!m) return;
      db.prepare(`
        INSERT OR IGNORE INTO node_mastery (id, engagement_learner_id, skill_node_id, mastery_attainment, attempt_count, time_to_mastery_minutes, confidence_indicator, advanced_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', ?))
      `).run(`test-nm-${nodeIds[label].id}`, EL_ID, nodeIds[label].id, m[0], m[1], m[2], m[3], `-${10 - Object.keys(nodeIds).indexOf(label)} days`);
    }));
    db.prepare(`
      INSERT OR IGNORE INTO streaks (id, engagement_learner_id, current_streak, longest_streak, total_session_days, last_session_date)
      VALUES ('test-streak-0001', ?, 3, 5, 9, date('now', '-1 day'))
    `).run(EL_ID);
  });
  seed();

  console.log('\nTest accounts ready.\n');
  console.log('  Institution  http://localhost:3000/login');
  console.log(`    Email:     ${INSTITUTION.email}`);
  console.log(`    Password:  ${INSTITUTION.password}\n`);
  console.log('  Learner      http://localhost:3000/learner-login');
  console.log(`    Learner reference: ${LEARNER.ref}`);
  console.log(`    Engagement ID:     ${ENGAGEMENT_ID}`);
  console.log(`    PIN:               ${LEARNER.pin}\n`);
} finally {
  db.close();
}
