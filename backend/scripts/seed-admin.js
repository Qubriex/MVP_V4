// scripts/seed-admin.js — one-time bootstrap for the first Inferexaa admin account.
//
// Run locally / via server shell access only — never expose this as an HTTP route.
// Usage:
//   node scripts/seed-admin.js <email> <password> [name]
//   ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/seed-admin.js
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/init');

const email = process.argv[2] || process.env.ADMIN_EMAIL;
const password = process.argv[3] || process.env.ADMIN_PASSWORD;
const name = process.argv[4] || process.env.ADMIN_NAME || 'Admin';

if (!email || !password) {
  console.error('Usage: node scripts/seed-admin.js <email> <password> [name]');
  console.error('   or: ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/seed-admin.js');
  process.exit(1);
}

const db = getDb();
try {
  const id = uuidv4();
  const password_hash = bcrypt.hashSync(password, 10);
  const result = db
    .prepare('INSERT OR IGNORE INTO admin_users (id, email, password_hash, name) VALUES (?, ?, ?, ?)')
    .run(id, email, password_hash, name);

  if (result.changes === 0) {
    console.log(`Admin with email ${email} already exists — no changes made.`);
  } else {
    console.log(`Admin account created for ${email}.`);
  }
} finally {
  db.close();
}
