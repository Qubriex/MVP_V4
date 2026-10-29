// core/outboundMail.js
// Outgoing email. No mail provider is configured yet, so every message is
// recorded in outbound_messages (and printed in development). Callers also
// return the link to the staff member who triggered it, so invites work
// today by copy-and-share. Wiring a provider means sending here and setting
// status to 'sent'.
import { v4 as uuidv4 } from 'uuid';
import { currentSandbox } from './requestContext.js';

const appUrl = () => (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');

// Inside a demo sandbox nothing is ever sent: the message is kept with the
// sandbox id and shown in the visitor's on-screen Demo inbox (status
// 'demo_inbox'), and a mail provider wired here must skip those rows.
async function queueEmail(db, { institutionId = null, to, subject, body, kind }) {
  const sandbox = currentSandbox();
  await db.prepare(`
    INSERT INTO outbound_messages (id, institution_id, to_email, subject, body, kind, sandbox_id, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(uuidv4(), institutionId, to, subject, body, kind || null, sandbox, sandbox ? 'demo_inbox' : 'queued');
  if (process.env.NODE_ENV !== 'production' && !sandbox) {
    console.log(`\n[mail] to ${to} — ${subject}\n${body}\n`);
  }
}

export { queueEmail, appUrl };
