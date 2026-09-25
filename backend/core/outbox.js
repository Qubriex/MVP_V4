// core/outbox.js
// Outgoing email. No mail provider is configured yet, so every message is
// recorded in outbound_messages (and printed in development). Callers also
// return the link to the staff member who triggered it, so invites work
// today by copy-and-share. Wiring a provider means sending here and setting
// status to 'sent'.
const { v4: uuidv4 } = require('uuid');

const appUrl = () => (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');

function queueEmail(db, { institutionId = null, to, subject, body, kind }) {
  db.prepare(`
    INSERT INTO outbound_messages (id, institution_id, to_email, subject, body, kind)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(uuidv4(), institutionId, to, subject, body, kind || null);
  if (process.env.NODE_ENV !== 'production') {
    console.log(`\n[outbox] to ${to} — ${subject}\n${body}\n`);
  }
}

module.exports = { queueEmail, appUrl };
