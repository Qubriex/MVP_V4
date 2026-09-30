// core/return/credentialEngine.js — the Capability Passport (v4.3 §9, §9.5, §10).
//
// Sign facts, compute labels: the credential carries signed node facts
// { nodeId, skillIds, theta, A_at_mastery, E, persistence, masteredAt, codeNode }
// per skill, as SD-JWT disclosures. Labels are never signed or stored; they
// are computed by qep:label_v1 from dated demonstrations whenever the passport
// is shown or verified. Journey metrics (loops, attempts, time) are never in it.
//
// Phase 0 (build step "Credential v1"): one SD-JWT with every skill disclosed
// together; demonstrations after issue are read from the issuer's records at
// verify time. Phase 1 moves them into per-skill attestation chains (§9.4).
import crypto from 'crypto';
import * as dal from '../db/dal.js';
import { ulid } from '../db/ulid.js';
import params from '../../config/params.js';
import { emit } from '../events/outbox.js';
import { newEvidenceId, isValidEvidenceId, normaliseEvidenceId } from '../qep/evidenceId.js';
import { issueSdJwt, verifySdJwt } from '../qep/sdjwt.js';
import { LABEL_FUNCTION, labelV1, missingForConfirmed } from '../qep/labelFn.js';
import * as statusList from '../qep/statusList.js';
import { keyStatus } from './keyRegistry.js';
import { activeKid } from './signing.js';
import { resolveTheta } from '../graph/theta.js';
import { mapSeq } from '../util/seq.js';

const LABEL_RANK = { none: 0, Foundational: 1, Partial: 2, Confirmed: 3 };
const CODE_EVIDENCE = new Set(['sql_exec', 'python_exec']);

export const issuerHost = () => process.env.PUBLIC_HOST || 'qubirex.in';
export const issuerDid = () => `did:web:${issuerHost()}`;
export const publicBase = () => (process.env.PUBLIC_URL || process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');

function subjectSecret() {
  const s = process.env.SUBJECT_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === 'production') throw new Error('SUBJECT_SECRET is not set');
  return 'dev-subject-secret';
}
/** Pseudonymous subject id per learner (never the internal id). */
export const subjectId = (learnerId) => `urn:qbx:subject:${crypto.createHmac('sha256', subjectSecret()).update(learnerId).digest('hex').slice(0, 24)}`;

const iso = (v) => {
  if (!v) return null;
  const s = String(v);
  return s.includes('T') ? new Date(s).toISOString() : new Date(`${s.replace(' ', 'T')}Z`).toISOString();
};

/** Signed node facts for an enrolment's mastered nodes, grouped by skill. */
export async function skillFacts(elId) {
  const nodes = await dal.all(`
    SELECT nm.skill_node_id AS node_id, nm.advanced_at, nm.theta, nm.evidence_level, nm.persistence,
           sn.node_label, sn.mastery_threshold AS node_theta, sc.mastery_threshold AS cluster_theta, sc.evidence_type
    FROM node_mastery nm JOIN skill_nodes sn ON sn.id = nm.skill_node_id JOIN skill_clusters sc ON sc.id = sn.cluster_id
    WHERE nm.engagement_learner_id = ? AND nm.advanced_at IS NOT NULL`, elId);
  const bySkill = new Map();
  for (const n of nodes) {
    const maps = await dal.all(`SELECT m.skill_id, m.weight, s.name FROM node_skill_map m JOIN skills s ON s.skill_id = m.skill_id WHERE m.node_id = ?`, n.node_id);
    const mastery = await dal.one("SELECT assurance FROM demonstrations WHERE el_id = ? AND node_id = ? AND kind = 'mastery' ORDER BY date LIMIT 1", elId, n.node_id);
    const fact = {
      nodeId: n.node_id, label: n.node_label,
      skillIds: maps.map(m => m.skill_id),
      theta: n.theta ?? resolveTheta(n.node_theta, n.cluster_theta),
      A_at_mastery: mastery ? mastery.assurance : null,
      E: n.evidence_level || 'L1',
      persistence: !!n.persistence,
      masteredAt: iso(n.advanced_at),
      codeNode: CODE_EVIDENCE.has(n.evidence_type)
    };
    maps.forEach(m => {
      if (!bySkill.has(m.skill_id)) bySkill.set(m.skill_id, { skillId: m.skill_id, name: m.name, nodes: [] });
      bySkill.get(m.skill_id).nodes.push(fact);
    });
  }
  return [...bySkill.values()].sort((a, b) => a.name.localeCompare(b.name));
}

async function demonstrationsFor(elId, nodeId) {
  return (await dal.all('SELECT date, kind, passed, score, level, assurance FROM demonstrations WHERE el_id = ? AND node_id = ? ORDER BY date', elId, nodeId))
    .map(d => ({ ...d, passed: !!d.passed }));
}

/** Labels computed now (never stored). A skill shows its weakest node's label. */
export async function skillLines(elId, skills, asOf = new Date().toISOString()) {
  const p = { confirmed: params.get('label.confirmed'), foundational: params.get('label.foundational'), retention: params.get('retention') };
  return await mapSeq(skills, async s => {
    const nodes = await mapSeq(s.nodes, async f => {
      const demos = await demonstrationsFor(elId, f.nodeId);
      const r = labelV1(f, demos, asOf, p);
      return { node_id: f.nodeId, node: f.label, label: r.label, evidence: r.evidence, assurance: r.assurance,
        freshness: Math.round(r.freshness * 100) / 100, last_demonstrated: r.lastDemonstrated, theta: f.theta,
        missing_for_confirmed: missingForConfirmed(f, demos, asOf, p) };
    });
    const weakest = nodes.reduce((w, n) => (!w || LABEL_RANK[n.label] < LABEL_RANK[w.label] ? n : w), null);
    const top = (key, order) => nodes.map(n => n[key]).filter(Boolean).sort((a, b) => order.indexOf(b) - order.indexOf(a))[0] || null;
    return {
      skill_id: s.skillId, name: s.name, label: weakest ? weakest.label : 'none',
      evidence: top('evidence', ['L1', 'L2', 'L3', 'L4']), assurance: top('assurance', ['A1', 'A2', 'A3']),
      freshness: nodes.length ? Math.min(...nodes.map(n => n.freshness)) : 0,
      last_demonstrated: nodes.map(n => n.last_demonstrated).filter(Boolean).sort().pop() || null,
      theta: nodes.length ? Math.min(...nodes.map(n => n.theta)) : null,
      nodes
    };
  });
}

export const activeCredential = async (where, arg) => await dal.one(`SELECT * FROM credentials WHERE ${where} AND active = 1 ORDER BY version DESC LIMIT 1`, arg);

/**
 * Issue (or reissue) the passport for an enrolment. Reissue keeps the Evidence
 * ID, adds a version with a new 18-month window and supersedes the old one.
 * @returns {null | {evidence_id: string, version: number, credential_id: string}}
 */
export async function issueCredential(elId, { reason = 'issue' } = {}) {
  const el = await dal.one(`SELECT el.id, el.learner_id, e.capability_target_id, e.language, e.institution_id, ct.title, ct.version AS ct_version, i.name AS institution
    FROM engagement_learners el JOIN engagements e ON e.id = el.engagement_id JOIN capability_targets ct ON ct.id = e.capability_target_id
    JOIN institutions i ON i.id = e.institution_id WHERE el.id = ?`, elId);
  if (!el) throw Object.assign(new Error('Unknown enrolment'), { status: 404 });
  const skills = await skillFacts(elId);
  if (!skills.length) return null;

  return await dal.tx(async () => {
    const previous = await activeCredential('el_id = ?', elId);
    const evidenceId = previous ? previous.evidence_id : newEvidenceId();
    const version = previous ? previous.version + 1 : 1;
    const now = new Date();
    const until = new Date(now); until.setUTCMonth(until.getUTCMonth() + params.get('credential.validMonths'));
    const { listId, index } = await statusList.allocate('revocation');
    const credentialId = ulid();
    const subject = subjectId(el.learner_id);
    const kid = await activeKid();
    const payload = {
      iss: issuerDid(), iat: Math.floor(now.getTime() / 1000), vct: 'QubirexCapabilityPassport',
      vc: {
        '@context': ['https://www.w3.org/ns/credentials/v2', 'https://qubirex.in/qep/v1'],
        type: ['VerifiableCredential', 'QubirexCapabilityPassport'],
        id: `urn:qbx:${evidenceId}`, issuer: issuerDid(), version,
        validFrom: now.toISOString(), validUntil: until.toISOString(),
        credentialStatus: { type: 'BitstringStatusListEntry', statusPurpose: 'revocation', statusListIndex: String(index), statusListCredential: `${publicBase()}/api/verify/status/${listId}` },
        credentialSubject: { id: subject, target: { title: el.title, version: el.ct_version, commissionedBy: el.institution, language: el.language }, labelFunction: LABEL_FUNCTION }
      }
    };
    const { compact } = await issueSdJwt(payload, skills.map(s => [`skill:${s.skillId}`, s]));
    if (previous) await dal.run('UPDATE credentials SET active = 0 WHERE credential_id = ?', previous.credential_id);
    await dal.run(`INSERT INTO credentials (credential_id, evidence_id, version, el_id, learner_id, target_id, sd_jwt, kid, subject_id, valid_from, valid_until, status_list_id, status_index, active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`, credentialId, evidenceId, version, elId, el.learner_id, el.capability_target_id,
    compact, kid, subject, now.toISOString(), until.toISOString(), listId, index, now.toISOString());
    await emit(previous ? 'CREDENTIAL_REISSUED' : 'CREDENTIAL_ISSUED', { aggregateType: 'credential', aggregateId: evidenceId, payload: { version, reason } });
    return { evidence_id: evidenceId, version, credential_id: credentialId };
  });
}

export async function revokeCredential(evidenceId, reason = 'revoked') {
  const c = await activeCredential('evidence_id = ?', evidenceId);
  if (!c) return false;
  await dal.tx(async () => {
    await statusList.setBit(c.status_list_id, c.status_index, true);
    await emit('CREDENTIAL_REVOKED', { aggregateType: 'credential', aggregateId: evidenceId, payload: { reason } });
  });
  return true;
}

export async function isPublic(evidenceId) {
  return !!(await dal.one('SELECT is_public FROM passport_shares WHERE evidence_id = ? ORDER BY created_at DESC, seq DESC LIMIT 1', evidenceId))?.is_public;
}

export async function setPublic(evidenceId, learnerId, on) {
  await dal.run('INSERT INTO passport_shares (id, evidence_id, learner_id, is_public, created_at) VALUES (?, ?, ?, ?, ?)', ulid(), evidenceId, learnerId, on ? 1 : 0, dal.nowIso());
}

/**
 * Public verification (v4.3 §10). Three truths stay separate: `proof` (authentic
 * and unaltered), evidence level L and assurance level A per skill.
 * @returns {{status: string, ...}}
 */
export async function verify(rawId, asOf = new Date().toISOString()) {
  const evidenceId = normaliseEvidenceId(rawId);
  if (!isValidEvidenceId(evidenceId)) return { status: 'malformed' };
  const c = await activeCredential('evidence_id = ?', evidenceId);
  if (!c) return { status: 'not_found' };
  if (await statusList.getBit(c.status_list_id, c.status_index)) return { status: 'revoked', evidence_id: evidenceId };
  if (asOf > c.valid_until) return { status: 'expired', evidence_id: evidenceId, valid_until: c.valid_until };
  const checked = await verifySdJwt(c.sd_jwt);
  if (!checked) return { status: 'signature_invalid', evidence_id: evidenceId };
  if (await keyStatus(checked.header.kid) === 'compromised') return { status: 'signature_invalid', reissue_required: true, evidence_id: evidenceId };

  const vc = checked.payload.vc;
  const base = {
    status: 'valid', proof: 'authentic_and_unaltered', evidence_id: evidenceId, issuer: vc.issuer,
    version: vc.version, valid_from: vc.validFrom, valid_until: vc.validUntil, target: vc.credentialSubject.target,
    label_function: vc.credentialSubject.labelFunction, key_id: checked.header.kid
  };
  if (!await isPublic(evidenceId)) return { ...base, skills_public: false, skills: [] };
  const skills = checked.claims.filter(cl => cl.name.startsWith('skill:')).map(cl => cl.value);
  return {
    ...base, skills_public: true,
    skills: (await skillLines(c.el_id, skills, asOf)).map(({ nodes, ...s }) => ({ ...s, nodes: nodes.map(({ missing_for_confirmed, ...n }) => n) })),
    practical_tests: [], agility: null, chain_lengths: {}
  };
}

