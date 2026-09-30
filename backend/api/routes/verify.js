// api/routes/verify.js — public verification (v4.3 §10), mounted at /api/verify.
//   GET /jwks.json            public keys, including retired keys
//   GET /status/:listId       bitstring status list (cacheable 24 h)
//   GET /:evidenceId          malformed | not_found | revoked | expired | signature_invalid | valid
// Rate limits: 100 requests/h per IP; after 20 not_found in an hour, 429 for that IP.
// The holder's name and contact are never returned. Errors use {error: {code, message}}.
//
// Structural wall: this module may not reach session, memory, provenance,
// CKB-usage or evaluation stores (tests/structural/walls.test.js).
import express from 'express';
import params from '../../config/params.js';
import { hit, peek, clientIp } from '../middleware/rateLimit.js';
import { verify } from '../../core/return/credentialEngine.js';
import { jwks } from '../../core/return/keyRegistry.js';
import { encodedList } from '../../core/qep/statusList.js';

const router = express.Router();
const HOUR = 3600000;

router.get('/jwks.json', (req, res) => {
  res.set('Cache-Control', 'public, max-age=3600');
  res.json(jwks());
});

router.get('/status/:listId', (req, res) => {
  const list = encodedList(req.params.listId);
  if (!list) return res.status(404).json({ error: { code: 'not_found', message: 'Unknown status list' } });
  res.set('Cache-Control', `public, max-age=${params.get('credential.statusCacheHours') * 3600}`);
  res.json(list);
});

router.get('/:evidenceId', (req, res) => {
  const ip = clientIp(req);
  const v = params.get('verify');
  if (!hit('verify:ip', ip, v.perIpPerHour, HOUR).allowed) {
    return res.status(429).json({ error: { code: 'rate_limited', message: 'Too many verification requests. Try again later.' } });
  }
  // Probing guard: once an IP has had 20 not_found this hour, refuse it.
  if (peek('verify:nf', ip) >= v.notFoundPerHour) {
    return res.status(429).json({ error: { code: 'rate_limited', message: 'Too many unknown IDs from this network. Try again later.' } });
  }
  const result = verify(req.params.evidenceId);
  if (result.status === 'malformed') return res.status(400).json({ status: 'malformed', error: { code: 'malformed', message: 'That is not a valid Evidence ID. Check for typos.' } });
  if (result.status === 'not_found') {
    hit('verify:nf', ip, v.notFoundPerHour, HOUR);
    return res.status(404).json({ status: 'not_found' });
  }
  res.set('Cache-Control', 'no-store');
  return res.json(result);
});

export default router;
