// api/routes/employerHiring.js — the employer's hiring loop (v4.3 canvas
// E1–E8, E10). Mounted at /api/employer; errors use the v2 shape.
//   GET  /home                        E1: waiting for your decision, roles, funnel
//   POST /roles/parse                 E2: skills from a job description, with market share
//   GET  /roles · POST /roles · GET /roles/:id · PUT /roles/:id
//   GET  /roles/:id/candidates        E3: ranked, anonymous; best colleges
//   POST /roles/:id/candidates/:elId/watch | /request
//   GET  /pipeline · GET /pipeline.csv  E6: funnel, weeks to decide
//   GET  /candidates/:id              E4: evidence per skill after a yes
//   POST /pipeline/:id/stage          { stage: interview|dayone|offer|hired|hold|not_now }
//   POST /pipeline/:id/nudge
//   GET  /sponsorships · POST /sponsorships   E7
//   GET  /colleges                    E10: colleges & insights (groups under 5 hidden)
//   POST /verify/bulk                 E8: { ids: [...] } up to 200 Evidence IDs
import express from 'express';
import * as dal from '../../core/db/dal.js';
import { employerAuth, requireEmployerRole } from '../middleware/employerAuth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import {
  skillsFromJd, barVsMarket, createRole, updateRole, roleView, findCandidates, watchOrRequest, pipeline, candidate,
  setStage, nudge, sponsor, collegeInsights
} from '../../core/hiringLoop.js';
import { skillLines, skillFacts, activeCredential, verify } from '../../core/return/credentialEngine.js';
import { listFor } from '../../core/notify.js';
import { mapSeq } from '../../core/util/seq.js';
import * as market from '../../core/market/sampleMarket.js';

const router = express.Router();
const session = employerAuth({ sessionOnly: true });
const writer = requireEmployerRole('owner', 'recruiter');
const v2 = (res, status, code, message) => res.status(status).json({ error: { code, message } });
const fail = (res, e) => (e.status ? v2(res, e.status, 'rejected', e.message) : v2(res, 500, 'server_error', 'Something went wrong.'));
const csvCell = (v) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) || /^[=+\-@]/.test(s) ? `"${s.replace(/^([=+\-@])/, "'$1").replace(/"/g, '""')}"` : s; };

async function ownRole(req, res) {
  const r = await dal.one('SELECT * FROM employer_roles WHERE id = ? AND employer_id = ?', req.params.id, req.employer.id);
  if (!r) v2(res, 404, 'not_found', 'Role not found.');
  return r;
}

router.get('/home', session, async (req, res) => {
  const roles = await dal.all("SELECT * FROM employer_roles WHERE employer_id = ? AND status = 'open' ORDER BY created_at DESC", req.employer.id);
  const p = await pipeline(req.employer.id);
  res.json({
    waiting: p.waiting, roles: roles.map(roleView), funnel: p.funnel, weeks_to_decide: p.weeks_to_decide,
    waiting_rows: p.rows.filter(r => ['access_granted', 'applied'].includes(r.stage)).slice(0, 9),
    unanswered: p.rows.filter(r => r.stage === 'requested').length,
    notifications: (await listFor(req)).items.slice(0, 5)
  });
});

router.post('/roles/parse', session, (req, res) => {
  const skills = barVsMarket(skillsFromJd(req.body?.jd_text));
  res.json({ skills, all_skills: Object.entries(market.SKILLS).map(([key, s]) => ({ key, name: s.name })) });
});

router.get('/roles', session, async (req, res) => {
  const rows = await dal.all(`SELECT r.*, (SELECT COUNT(*) FROM employer_pipeline p WHERE p.role_id = r.id AND p.stage != 'watching') AS in_pipeline
    FROM employer_roles r WHERE r.employer_id = ? ORDER BY r.created_at DESC`, req.employer.id);
  res.json(rows.map(r => ({ ...roleView(r), in_pipeline: Number(r.in_pipeline) })));
});
router.post('/roles', session, writer, async (req, res) => {
  try { res.status(201).json({ id: await createRole(req.employer.id, req.employerUser.id, req.body || {}) }); } catch (e) { fail(res, e); }
});
router.get('/roles/:id', session, async (req, res) => {
  const r = await ownRole(req, res); if (!r) return;
  res.json({ ...roleView(r), jd_text: r.jd_text });
});
router.put('/roles/:id', session, writer, async (req, res) => {
  const ok = await updateRole(req.employer.id, req.params.id, req.body || {});
  if (!ok) return v2(res, 404, 'not_found', 'Role not found.');
  res.json({ ok: true });
});

router.get('/roles/:id/candidates', session, async (req, res) => {
  const r = await ownRole(req, res); if (!r) return;
  const out = await findCandidates(req.employer.id, r, { city: String(req.query.city || ''), band: String(req.query.band || '') });
  res.json({ role: roleView(r), ...out, candidates: out.candidates.map(({ el_id, ...c }) => ({ ...c, ref: el_id })) });
});
for (const kind of ['watch', 'request']) {
  router.post(`/roles/:id/candidates/:elId/${kind}`, session, writer, async (req, res) => {
    const r = await ownRole(req, res); if (!r) return;
    try { res.json({ id: await watchOrRequest(req.employer, r, req.params.elId, kind, { items: Array.isArray(req.body?.items) ? req.body.items : undefined, note: req.body?.note || null }) }); } catch (e) { fail(res, e); }
  });
}

router.get('/pipeline', session, async (req, res) => res.json(await pipeline(req.employer.id, req.query.role_id || null)));
router.get('/pipeline.csv', session, async (req, res) => {
  const p = await pipeline(req.employer.id, req.query.role_id || null);
  const head = 'candidate,name,college,city,role,stage,readiness,interview_promised,updated_at';
  const lines = p.rows.map(r => [r.code, r.name || '', r.college, r.city || '', r.role_title, r.stage_label, r.readiness, r.interview_promised ? 'yes' : 'no', r.updated_at].map(csvCell).join(','));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="pipeline.csv"');
  res.send([head, ...lines].join('\n'));
});
router.get('/candidates/:id', session, async (req, res) => {
  const c = await candidate(req.employer.id, req.params.id, { skillLines, skillFacts, activeCredential });
  if (!c) return v2(res, 404, 'not_found', 'Candidate not found.');
  res.json(c);
});
router.post('/pipeline/:id/stage', session, writer, async (req, res) => {
  try {
    const ok = await setStage(req.employer, req.params.id, String(req.body?.stage || ''), req.body?.note ? String(req.body.note).slice(0, 500) : null);
    if (!ok) return v2(res, 404, 'not_found', 'Not found.');
    res.json({ ok: true });
  } catch (e) { fail(res, e); }
});
router.post('/pipeline/:id/nudge', session, writer, async (req, res) => {
  try { await nudge(req.employer, req.params.id); res.json({ ok: true }); } catch (e) { fail(res, e); }
});

router.get('/sponsorships', session, async (req, res) => {
  res.json(await dal.all(`SELECT s.id, s.seats, s.interview_promise, s.message, s.status, s.created_at, s.decided_at, i.name AS college, r.title AS role_title
    FROM sponsorships s JOIN institutions i ON i.id = s.institution_id LEFT JOIN employer_roles r ON r.id = s.role_id WHERE s.employer_id = ? ORDER BY s.created_at DESC`, req.employer.id));
});
router.post('/sponsorships', session, writer, async (req, res) => {
  try { res.status(201).json({ id: await sponsor(req.employer, req.body || {}) }); } catch (e) { fail(res, e); }
});

router.get('/colleges', session, async (req, res) => {
  const roles = await dal.all("SELECT * FROM employer_roles WHERE employer_id = ? AND status = 'open'", req.employer.id);
  res.json(await collegeInsights(roles));
});

router.post('/verify/bulk', session, rateLimit({ name: 'employer:bulk-verify', limit: 20, windowMs: 3600000, key: (req) => req.employer.id, legacyErrors: false }), async (req, res) => {
  const ids = [...new Set((Array.isArray(req.body?.ids) ? req.body.ids : []).map(s => String(s).trim()).filter(Boolean))];
  if (!ids.length) return v2(res, 400, 'invalid', 'Add at least one Evidence ID.');
  if (ids.length > 200) return v2(res, 400, 'invalid', 'Up to 200 Evidence IDs at a time.');
  const results = await mapSeq(ids, async (id) => {
    const r = await verify(id);
    return { input: id, status: r.status, evidence_id: r.evidence_id || null, valid_until: r.valid_until || null, skills_public: r.skills_public ?? null, skills: (r.skills || []).map(s => ({ name: s.name, label: s.label, last_demonstrated: s.last_demonstrated })) };
  });
  res.json({ results, counts: results.reduce((a, r) => ({ ...a, [r.status]: (a[r.status] || 0) + 1 }), {}) });
});

export default router;
