// core/consent/levels.js
// Consent records (spec §8.10). The consents table is append-only: a grant is
// a new row, and withdrawal sets withdrawn_at once through withdraw() — the
// database trigger rejects any other change. Withdrawal applies on the next
// request because every read path asks isActive() rather than caching.
//
// Levels: 1 build · 2 institution profile share · 3 discoverable ·
//         4 per-employer access or application · 5 outcome sharing · 6 gold and parity use
// (Minor policy and guardian consent arrive with the Consent and minors step.)
import { ulid } from '../db/ulid.js';
import * as dal from '../db/dal.js';
import { emit } from '../events/outbox.js';

export const LEVELS = Object.freeze({ BUILD: 1, INSTITUTION_SHARE: 2, DISCOVERABLE: 3, EMPLOYER_ACCESS: 4, OUTCOMES: 5, GOLD_PARITY: 6 });

export function grant({ learnerId, institutionId, level, purpose, textVersion, grantedBy = 'learner', guardianRef = null, scope = null }) {
  if (!Number.isInteger(level) || level < 1 || level > 6) throw new Error('Consent level must be 1–6');
  return dal.tx(() => {
    const id = ulid();
    dal.run(`INSERT INTO consents (id, learner_id, institution_id, level, purpose, text_version, granted_by, guardian_ref, scope_json, granted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, id, learnerId, institutionId, level, purpose, textVersion, grantedBy, guardianRef,
    scope ? JSON.stringify(scope) : null, dal.nowIso());
    emit('CONSENT_GRANTED', { aggregateType: 'learner', aggregateId: learnerId, payload: { consentId: id, level } });
    return id;
  });
}

/** The one dedicated way to withdraw consent. */
export function withdraw(consentId) {
  return dal.tx(() => {
    const row = dal.one('SELECT learner_id, level, withdrawn_at FROM consents WHERE id = ?', consentId);
    if (!row || row.withdrawn_at) return false;
    dal.run('UPDATE consents SET withdrawn_at = ? WHERE id = ?', dal.nowIso(), consentId);
    emit('CONSENT_WITHDRAWN', { aggregateType: 'learner', aggregateId: row.learner_id, payload: { consentId, level: row.level } });
    return true;
  });
}

export function isActive(learnerId, level) {
  return !!dal.one('SELECT 1 FROM consents WHERE learner_id = ? AND level = ? AND withdrawn_at IS NULL', learnerId, level);
}
