// scripts/seed-admin.js — one-time bootstrap for the first Inferexaa admin account.
//
// Run locally / via server shell access only — never expose this as an HTTP route.
// Usage:
//   node scripts/seed-admin.js <email> <password> [name]
//   ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/seed-admin.js
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { getDb, initDb } from '../db/init.js';

const email = process.argv[2] || process.env.ADMIN_EMAIL;
const password = process.argv[3] || process.env.ADMIN_PASSWORD;
const name = process.argv[4] || process.env.ADMIN_NAME || 'Admin';

if (!email || !password) {
  console.error('Usage: node scripts/seed-admin.js <email> <password> [name]');
  console.error('   or: ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/seed-admin.js');
  process.exit(1);
}
if (String(password).length < 10) {
  console.error('Admin passwords must be at least 10 characters.');
  process.exit(1);
}

await initDb();
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
