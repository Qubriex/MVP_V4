#!/usr/bin/env node
// scripts/check-build.js — fails (exit 1) when the production build in build/
// still carries the old client-only developer bypass (fake dev-* tokens,
// DevNav) or names a server-only secret. Run after `npm run build`.
const fs = require('fs');
const path = require('path');

const BUILD = path.join(__dirname, '..', 'build');
const FORBIDDEN = ['dev-institution-token', 'dev-learner-token', 'DevNav', 'REACT_APP_DEV_MODE', 'DEV_LOGIN_SECRET', 'JWT_SECRET'];

function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(d => (d.isDirectory() ? files(path.join(dir, d.name)) : [path.join(dir, d.name)]));
}
if (!fs.existsSync(BUILD)) { console.error('check-build: no build/ folder; run npm run build first.'); process.exit(1); }
const hits = [];
for (const f of files(BUILD).filter(f => /\.(js|html|map|json|css)$/.test(f))) {
  const text = fs.readFileSync(f, 'utf8');
  FORBIDDEN.forEach(word => { if (text.includes(word)) hits.push(`${path.relative(BUILD, f)}: ${word}`); });
}
if (hits.length) { hits.forEach(h => console.error(h)); console.error(`check-build: ${hits.length} forbidden string(s) in build/`); process.exit(1); }
console.log(`check-build: OK — none of ${FORBIDDEN.join(', ')} in build/`);
