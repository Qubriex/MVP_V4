// core/return/renewal.js — renewal instead of blanket expiry (v4.3 §9.5).
// A short test: one review instance per skill the passport holds (latest
// mastered node teaching it, map weight ≥ 0.25), within the retake policy
// (2 attempts per skill, then a 7-day cooldown, §7.12). When every instance is
// answered the credential is reissued with a new 18-month window; a skill
// failed at renewal keeps its older facts and the label shows lower freshness.
import * as dal from '../db/dal.js';
import params from '../../config/params.js';
import { issueCredential } from './credentialEngine.js';
import { everySeq, findSeq, mapSeq } from '../util/seq.js';

/** Latest mastered node teaching each skill in the credential (weight ≥ 0.25). */
export async function renewalTargets(elId, skills) {
  const min = params.get('label.crossNodeMinWeight');
  return (await mapSeq(skills, async s => {
    const node = await findSeq([...s.nodes].sort((a, b) => String(b.masteredAt).localeCompare(String(a.masteredAt))), async f => ((await dal.one('SELECT weight FROM node_skill_map WHERE node_id = ? AND skill_id = ?', f.nodeId, s.skillId))?.weight ?? 0) >= min);
    return node ? { skill_id: s.skillId, name: s.name, node_id: node.nodeId } : null;
  })).filter(Boolean);
}

/** Retake policy (§7.12): 2 renewal attempts per skill, then a 7-day cooldown. */
export async function renewalCooldown(elId, nodeId, now = Date.now()) {
  const a = params.get('evidence.attempts');
  const since = new Date(now - a.renewalCooldownDays * 86400000).toISOString();
  const recent = await dal.all("SELECT created_at FROM evidence_records WHERE el_id = ? AND node_id = ? AND purpose = 'renewal' AND assurance != 'A0' AND created_at >= ? ORDER BY created_at", elId, nodeId, since);
  if (recent.length < a.renewalAttempts) return null;
  return new Date(Date.parse(recent[a.renewalAttempts - 1].created_at) + a.renewalCooldownDays * 86400000).toISOString();
}


/** Close a renewal run once every instance has an evaluated answer; reissue with a new window. */
export async function completeRenewalIfDone(runId) {
  const run = await dal.one("SELECT * FROM renewal_runs WHERE id = ? AND status = 'open'", runId);
  if (!run) return null;
  const items = JSON.parse(run.instances_json);
  const answered = await everySeq(items, async i => await dal.one("SELECT 1 FROM evidence_records WHERE instance_id = ? AND assurance != 'A0'", i.instance_id));
  if (!answered) return null;
  const reissued = await issueCredential(run.el_id, { reason: 'renewal' });
  await dal.run("UPDATE renewal_runs SET status = 'complete', completed_at = ? WHERE id = ?", dal.nowIso(), runId);
  return reissued;
}
