// api/routes/learnerEvidence.js — reviews, rechecks and the Capability Passport,
// mounted at /api/learner (v4.3 §8, §9, §9.5).
//
//   GET  /reviews/due                    due reviews (warm-ups first) and rechecks
//   POST /reviews/:nodeId/start          a fresh review instance (one per due date)
//   POST /reviews/instances/:id/answer   { answer, provenance } → gate + EVAL + demonstration
//   GET  /passport                       Evidence ID, window, status, skills with labels computed now
//   POST /passport/share                 { public: boolean } — may the public verifier show skill details?
//   POST /passport/renew                 start a renewal test (one instance per skill, §9.5)
// Scores are never returned to the learner (v4.3 §2A.2).
import express from 'express';
import * as dal from '../../core/db/dal.js';
import { authenticateToken, requireRole, requireActiveLearner } from '../middleware/auth.js';
import { dueReviews } from '../../core/retention/schedule.js';
import { issueInstance } from '../../core/evidence/checkWriter.js';
import { answerInstance } from '../../core/evidence/answer.js';
import { activeCredential, skillLines, skillFacts, isPublic, setPublic, publicBase } from '../../core/return/credentialEngine.js';
import { renewalTargets, renewalCooldown, completeRenewalIfDone } from '../../core/return/renewal.js';
import { verifySdJwt } from '../../core/qep/sdjwt.js';
import * as statusList from '../../core/qep/statusList.js';
import { ulid } from '../../core/db/ulid.js';
import { learningCurve } from '../../core/readiness/learningCurve.js';
import { mapSeq } from '../../core/util/seq.js';

const router = express.Router();
router.use(authenticateToken, requireRole('learner'), requireActiveLearner);

const openInstance = async (elId, nodeId, purpose) => await dal.one(`SELECT fi.* FROM family_instances fi WHERE fi.el_id = ? AND fi.node_id = ? AND fi.purpose = ?
  AND NOT EXISTS (SELECT 1 FROM evidence_records e WHERE e.instance_id = fi.id AND e.assurance != 'A0') ORDER BY fi.created_at DESC LIMIT 1`, elId, nodeId, purpose);

router.get('/reviews/due', async (req, res) => {
  const reviews = await mapSeq(await dueReviews(req.user.el_id), async r => ({ ...r, kind: 'review', open_instance: (await openInstance(req.user.el_id, r.node_id, 'review'))?.id || null }));
  const rechecks = await mapSeq(await dal.all(`SELECT nm.skill_node_id AS node_id, sn.node_label, sc.cluster_label FROM node_mastery nm JOIN skill_nodes sn ON sn.id = nm.skill_node_id
    JOIN skill_clusters sc ON sc.id = sn.cluster_id WHERE nm.engagement_learner_id = ? AND nm.recheck_required = 1`, req.user.el_id), async r => ({ ...r, kind: 'recheck', open_instance: (await openInstance(req.user.el_id, r.node_id, 'check'))?.id || null }));
  const upcoming = await dal.all(`SELECT r.node_id, r.due_at, sn.node_label FROM node_retention r JOIN skill_nodes sn ON sn.id = r.node_id
    WHERE r.el_id = ? AND r.due_at > ? ORDER BY r.due_at LIMIT 5`, req.user.el_id, dal.nowIso());
  res.json({ due: [...rechecks, ...reviews], upcoming, warmups: reviews.slice(0, 2).map(r => r.node_id) });
});

router.post('/reviews/:nodeId/start', async (req, res) => {
  const elId = req.user.el_id;
  const recheck = !!await dal.one('SELECT 1 FROM node_mastery WHERE engagement_learner_id = ? AND skill_node_id = ? AND recheck_required = 1', elId, req.params.nodeId);
  const due = await dal.one('SELECT 1 FROM node_retention WHERE el_id = ? AND node_id = ? AND due_at <= ?', elId, req.params.nodeId, dal.nowIso());
  if (!recheck && !due) return res.status(409).json({ error: 'This review is not due yet.' });
  const purpose = recheck ? 'check' : 'review';
  // One review per due date (§7.12): reuse the open instance until it is answered.
  let inst = await openInstance(elId, req.params.nodeId, purpose);
  if (!inst) {
    const node = await dal.one('SELECT ct.institution_id FROM skill_nodes sn JOIN skill_clusters sc ON sc.id = sn.cluster_id JOIN capability_targets ct ON ct.id = sc.capability_target_id WHERE sn.id = ?', req.params.nodeId);
    const issued = await issueInstance({ elId, learnerId: req.user.id, nodeId: req.params.nodeId, language: req.user.language, purpose, institutionId: node?.institution_id });
    inst = { id: issued.id, question_text: issued.question_text };
  }
  res.json({ instance_id: inst.id, question: inst.question_text, kind: recheck ? 'recheck' : 'review' });
});

router.post('/reviews/instances/:id/answer', async (req, res) => {
  try {
    const out = await answerInstance({
      instanceId: req.params.id, elId: req.user.el_id, learnerId: req.user.id, language: req.user.language,
      engagementId: req.user.engagement_id, answer: req.body.answer, provenance: req.body.provenance
    });
    if (out.purpose === 'renewal') {
      const run = (await dal.all("SELECT id, instances_json FROM renewal_runs WHERE el_id = ? AND status = 'open'", req.user.el_id))
        .find(r => JSON.parse(r.instances_json).some(i => i.instance_id === req.params.id));
      if (run) out.reissued = await completeRenewalIfDone(run.id);
    }
    res.json(out);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Could not save your answer. Try again.' });
  }
});

// Learning-curve signals (v4.3 §12.3): the learner's own view.
router.get('/learning-curve', async (req, res) => res.json(await learningCurve(req.user.el_id)));

// ─── Passport ────────────────────────────────────────────────────────────────
async function passportView(elId) {
  const c = await activeCredential('el_id = ?', elId);
  if (!c) {
    const skills = await skillFacts(elId);
    return { issued: false, eligible_skills: skills.length, skills: await skillLines(elId, skills) };
  }
  const checked = await verifySdJwt(c.sd_jwt);
  const skills = checked ? checked.claims.filter(cl => cl.name.startsWith('skill:')).map(cl => cl.value) : [];
  const revoked = !!await statusList.getBit(c.status_list_id, c.status_index);
  const run = await dal.one("SELECT * FROM renewal_runs WHERE el_id = ? AND status = 'open' ORDER BY created_at DESC LIMIT 1", elId);
  return {
    issued: true, evidence_id: c.evidence_id, version: c.version, valid_from: c.valid_from, valid_until: c.valid_until,
    status: revoked ? 'revoked' : c.valid_until < dal.nowIso() ? 'expired' : 'valid',
    public: await isPublic(c.evidence_id), verify_url: `${publicBase()}/verify/${c.evidence_id}`,
    skills: await skillLines(elId, skills),
    renewal: run ? {
      id: run.id,
      items: await mapSeq(JSON.parse(run.instances_json), async i => ({
        ...i, answered: !!await dal.one("SELECT 1 FROM evidence_records WHERE instance_id = ? AND assurance != 'A0'", i.instance_id),
        question: (await dal.one('SELECT question_text FROM family_instances WHERE id = ?', i.instance_id))?.question_text
      }))
    } : null,
    // Journey metrics (loops, attempts, time) are never part of the passport.
    note: 'Labels are computed today from signed, dated facts. They change as skills are shown again or go stale.'
  };
}

router.get('/passport', async (req, res) => res.json(await passportView(req.user.el_id)));

router.post('/passport/share', async (req, res) => {
  const c = await activeCredential('el_id = ?', req.user.el_id);
  if (!c) return res.status(404).json({ error: 'Your passport has not been issued yet.' });
  await setPublic(c.evidence_id, req.user.id, req.body.public === true);
  res.json(await passportView(req.user.el_id));
});

router.post('/passport/renew', async (req, res) => {
  const elId = req.user.el_id;
  const c = await activeCredential('el_id = ?', elId);
  if (!c) return res.status(404).json({ error: 'Your passport has not been issued yet.' });
  if (await dal.one("SELECT 1 FROM renewal_runs WHERE el_id = ? AND status = 'open'", elId)) return res.json(await passportView(elId));
  const skills = (await verifySdJwt(c.sd_jwt))?.claims.filter(cl => cl.name.startsWith('skill:')).map(cl => cl.value) || [];
  const targets = await renewalTargets(elId, skills);
  const blocked = (await mapSeq(targets, async t => ({ ...t, until: await renewalCooldown(elId, t.node_id) }))).filter(t => t.until);
  if (blocked.length) return res.status(429).json({ error: `Renewal is on a 7-day cooldown until ${blocked[0].until.slice(0, 10)} after two attempts.` });
  const items = [];
  for (const t of targets) {
    const inst = await issueInstance({ elId, learnerId: req.user.id, nodeId: t.node_id, language: req.user.language, purpose: 'renewal' });
    items.push({ ...t, instance_id: inst.id });
  }
  await dal.run('INSERT INTO renewal_runs (id, evidence_id, el_id, status, instances_json, created_at) VALUES (?, ?, ?, ?, ?, ?)', ulid(), c.evidence_id, elId, 'open', JSON.stringify(items), dal.nowIso());
  res.json(await passportView(elId));
});

export default router;
