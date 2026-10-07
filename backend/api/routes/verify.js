// api/routes/verify.js — public verification (v4.3 §10), mounted at /api/verify.
//   GET /jwks.json            public keys, including retired keys
//   GET /status/:listId       bitstring status list (cacheable 24 h)
//   GET /:evidenceId          malformed | not_found | revoked | expired | signature_invalid | valid
//   POST /:evidenceId/name-check  { name } → { match } — is this the person in front of you?
//                             The stored name is never returned; 10 checks/h per IP.
// Rate limits: 100 requests/h per IP; after 20 not_found in an hour, 429 for that IP.
// The holder's name and contact are never returned. Errors use {error: {code, message}}.
//
// Structural wall: this module may not reach session, memory, provenance,
// CKB-usage or evaluation stores (tests/structural/walls.test.js).
import express from 'express';
import params from '../../config/params.js';
import { hit, peek, clientIp } from '../middleware/rateLimit.js';
import { verify, activeCredential } from '../../core/return/credentialEngine.js';
import { normaliseEvidenceId } from '../../core/qep/evidenceId.js';
import * as dal from '../../core/db/dal.js';
import { jwks } from '../../core/return/keyRegistry.js';
import { encodedList } from '../../core/qep/statusList.js';

const router = express.Router();
const HOUR = 3600000;

router.get('/jwks.json', async (req, res) => {
  res.set('Cache-Control', 'public, max-age=3600');
  res.json(await jwks());
});

router.get('/status/:listId', async (req, res) => {
  const list = await encodedList(req.params.listId);
  if (!list) return res.status(404).json({ error: { code: 'not_found', message: 'Unknown status list' } });
  res.set('Cache-Control', `public, max-age=${params.get('credential.statusCacheHours') * 3600}`);
  res.json(list);
});

router.get('/:evidenceId', async (req, res) => {
  const ip = clientIp(req);
  const v = params.get('verify');
  if (!hit('verify:ip', ip, v.perIpPerHour, HOUR).allowed) {
    return res.status(429).json({ error: { code: 'rate_limited', message: 'Too many verification requests. Try again later.' } });
  }
  // Probing guard: once an IP has had 20 not_found this hour, refuse it.
  if (peek('verify:nf', ip) >= v.notFoundPerHour) {
    return res.status(429).json({ error: { code: 'rate_limited', message: 'Too many unknown IDs from this network. Try again later.' } });
  }
  const result = await verify(req.params.evidenceId);
  if (result.status === 'malformed') return res.status(400).json({ status: 'malformed', error: { code: 'malformed', message: 'That is not a valid Evidence ID. Check for typos.' } });
  if (result.status === 'not_found') {
    hit('verify:nf', ip, v.notFoundPerHour, HOUR);
    return res.status(404).json({ status: 'not_found' });
  }
  res.set('Cache-Control', 'no-store');
  return res.json(result);
});

// Names match when every typed word is the holder's word or its initial,
// in any order, and every holder word is accounted for ("K. Ravi Kumar" =
// "Ravi Kumar K", "R Kumar K" = "Kumar Ravi K.").
const words = (s) => String(s || '').toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
export function namesMatch(typed, stored) {
  const a = words(typed); const b = words(stored);
  if (!a.length || !b.length || a.length !== b.length) return false;
  const left = [...b];
  const take = (pred) => { const i = left.findIndex(pred); if (i < 0) return false; left.splice(i, 1); return true; };
  // Full words first, then initials, so an initial never steals a full word.
  const full = a.filter(w => w.length > 1); const initials = a.filter(w => w.length === 1);
  return full.every(w => take(x => x === w)) && initials.every(w => take(x => x[0] === w));
}

router.post('/:evidenceId/name-check', express.json(), async (req, res) => {
  const ip = clientIp(req);
  if (!hit('verify:name', ip, 10, HOUR).allowed) return res.status(429).json({ error: { code: 'rate_limited', message: 'Too many name checks. Try again in an hour.' } });
  const name = String(req.body?.name || '').slice(0, 120);
  if (words(name).length < 2) return res.status(400).json({ error: { code: 'invalid', message: 'Type the full name, at least two words.' } });
  const c = await activeCredential('evidence_id = ?', normaliseEvidenceId(req.params.evidenceId));
  if (!c) return res.status(404).json({ status: 'not_found' });
  const holder = await dal.one('SELECT l.name FROM engagement_learners el JOIN learners l ON l.id = el.learner_id WHERE el.id = ?', c.el_id);
  res.set('Cache-Control', 'no-store');
  res.json({ match: namesMatch(name, holder?.name) });
});

export default router;
