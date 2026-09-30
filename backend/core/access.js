// core/access.js
// ─────────────────────────────────────────────────────────────────────────────
// Student and staff access primitives, shared by auth and institution routes.
//
// - Join codes: short cohort codes (QX-FSA-7K2) that replace the 36-character
//   engagement ID on the learner login. Unambiguous alphabet, unique per DB.
// - PINs: 6 digits, bcrypt-hashed. A one-time PIN (printed slip, reset) sets
//   pin_must_change so the learner picks their own at first sign-in.
// - Invite tokens: 32 random bytes in the link; only the sha256 is stored.
// - Access state for the roster is derived, never stored twice.
// - Every access change writes an access_events row (the roster's history).
//   The table is append-only (triggers reject UPDATE/DELETE): a PIN-reset
//   request is closed by a later pin_reset_resolved event, never by a flag.
// ─────────────────────────────────────────────────────────────────────────────
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { ulid } from './db/ulid.js';
import params from '../config/params.js';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I
const INVITE_DAYS = 7;
const MAX_PIN_ATTEMPTS = 5;

const randomChars = (n) => Array.from({ length: n }, () => CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)]).join('');

// "Full-Stack Developer · Section A" → "FSA" (initials of the words, letters only)
function codePrefix(title = '') {
  const letters = String(title).toUpperCase().split(/[^A-Z]+/).filter(Boolean).map(w => w[0]).join('');
  return (letters + 'QXQ').slice(0, 3);
}

function generateJoinCode(db, title) {
  for (let i = 0; i < 20; i += 1) {
    const code = `QX-${codePrefix(title)}-${randomChars(3)}`;
    if (!db.prepare('SELECT 1 FROM engagements WHERE join_code = ?').get(code)) return code;
  }
  return `QX-${randomChars(3)}-${randomChars(4)}`;
}

// Learners type codes loosely: "qx fsa 7k2", "QXFSA7K2" → "QX-FSA-7K2"
function normaliseJoinCode(input = '') {
  const raw = String(input).toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (raw.length === 8 && raw.startsWith('QX')) return `QX-${raw.slice(2, 5)}-${raw.slice(5)}`;
  return String(input).trim().toUpperCase();
}

const generatePin = () => String(crypto.randomInt(100000, 1000000));
const hashPin = (pin) => bcrypt.hashSync(String(pin), 10);
const isValidPin = (pin) => /^\d{6}$/.test(String(pin || ''));

const newToken = () => crypto.randomBytes(32).toString('base64url');
const hashToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');
const inviteExpiry = () => new Date(Date.now() + INVITE_DAYS * 86400000).toISOString();

function logEvent(db, { institutionId, learnerId = null, elId = null, event, detail = null, actorStaffId = null }) {
  db.prepare(`
    INSERT INTO access_events (id, institution_id, learner_id, engagement_learner_id, event, detail, actor_staff_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(ulid(), institutionId, learnerId, elId, event, detail, actorStaffId, new Date().toISOString());
}

// SQL predicate: access_events row `alias` is a PIN-reset request that no
// later pin_reset_resolved event has closed.
const openResetRequest = (alias = 'ae') => `${alias}.event = 'pin_reset_requested' AND NOT EXISTS (
  SELECT 1 FROM access_events r WHERE r.engagement_learner_id = ${alias}.engagement_learner_id
    AND r.event = 'pin_reset_resolved' AND r.created_at >= ${alias}.created_at)`;

// Close every open PIN-reset request for a learner (the PIN is per learner).
function resolvePinResetRequests(db, { institutionId, learnerId, actorStaffId = null }) {
  const open = db.prepare(`SELECT DISTINCT ae.engagement_learner_id AS el_id FROM access_events ae
    WHERE ae.learner_id = ? AND ${openResetRequest('ae')}`).all(learnerId);
  open.forEach(r => logEvent(db, { institutionId, learnerId, elId: r.el_id, event: 'pin_reset_resolved', detail: 'PIN reset by staff', actorStaffId }));
  return open.length;
}

// Create a learner invite for one enrolment; returns the plaintext token.
function createLearnerInvite(db, { learnerId, elId, staffId }) {
  const token = newToken();
  db.prepare('UPDATE learner_invites SET used_at = COALESCE(used_at, ?) WHERE engagement_learner_id = ? AND used_at IS NULL')
    .run('superseded', elId);
  db.prepare(`
    INSERT INTO learner_invites (id, learner_id, engagement_learner_id, token_hash, expires_at, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(uuidv4(), learnerId, elId, hashToken(token), inviteExpiry(), staffId || null);
  return token;
}

// Roster state, strongest first:
//   removed         — access removed by staff; login blocked, record kept
//   locked          — too many wrong PINs; a PIN reset unlocks
//   invited         — invite sent, no PIN set yet
//   never_signed_in — has a PIN (slip or set) but has not signed in
//   active          — has signed in
// A PIN lock lifts by itself after security.pinUnlockMinutes (delayed unlock,
// v4.3 §22); staff can still reset the PIN at any time.
function lockActive(lockedAt, now = Date.now()) {
  if (!lockedAt) return false;
  const s = String(lockedAt);
  const t = Date.parse(s.includes('T') ? s : `${s.replace(' ', 'T')}Z`);
  return !Number.isFinite(t) || now - t < params.get('security.pinUnlockMinutes') * 60000;
}

function accessState(row) {
  if (row.access_status === 'removed') return 'removed';
  if (lockActive(row.locked_at)) return 'locked';
  if (!row.pin_hash) return 'invited';
  if (!row.last_login_at) return 'never_signed_in';
  return 'active';
}

export { MAX_PIN_ATTEMPTS, INVITE_DAYS, generateJoinCode, normaliseJoinCode, generatePin, hashPin, isValidPin, newToken, hashToken, inviteExpiry, logEvent, lockActive, openResetRequest, resolvePinResetRequests, createLearnerInvite, accessState };
