// scripts/generate-secrets.js — prints fresh values for every secret a
// production deployment needs (npm run secrets:generate). Paste them into
// Vercel → Settings → Environment Variables (Production), mark them
// Sensitive, and keep a copy in the private secure-config repository.
// They must stay the same across deploys: SIGNING_KEY_* verifies every
// passport already issued, SUBJECT_SECRET keeps credential subject IDs stable,
// JWT_SECRET keeps people signed in. Never commit the output.
import crypto from 'crypto';

const rand = () => crypto.randomBytes(32).toString('base64url');
const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).trim();
const kid = `qbx-${new Date().toISOString().slice(0, 10)}-${crypto.randomBytes(3).toString('hex')}`;

console.log(`JWT_SECRET=${rand()}`);
console.log(`SUBJECT_SECRET=${rand()}`);
console.log(`ITEM_SEED_SECRET=${rand()}`);
console.log(`CRON_SECRET=${rand()}`);
console.log(`SIGNING_KEY_ID=${kid}`);
console.log(`SIGNING_KEY_PEM=${pem.replace(/\n/g, '\\n')}`);
