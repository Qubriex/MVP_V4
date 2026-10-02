// core/graph/coverage.js
// How much of a skill a pathway teaches (v4.3 §3.3), and the node → skill
// mapping that makes it arithmetic instead of keyword luck.
//
//   coverage(j, P) = min(1, Σ weights of P's nodes mapped to j
//                           + mean coverage of j's child skills)
//   covered ≥ 0.8 · partly ≥ 0.3 · missing otherwise
//
// A node mapped to a skill gets weight 1 / (nodes in the pathway mapped to
// that skill): a skill split across four nodes gets 0.25 each. Mapping comes
// from CURR (skill IDs from the ontology, validated) or from resolveSkill on
// the node label and concept tags; nothing unmapped is ever defaulted — it
// goes to the ontology review queue.
import * as dal from '../db/dal.js';
import params from '../../config/params.js';
import { resolveSkill } from './resolveSkill.js';
import { children, mapNode } from './ontology.js';
import { eachSeq, filterSeq, mapSeq, reduceSeq } from '../util/seq.js';

export async function pathwayNodes(capabilityTargetId) {
  return await dal.all(`SELECT sn.id, sn.node_label, sn.concept_tags, sn.estimated_minutes, sn.sequence_order, sc.id AS cluster_id, sc.cluster_label
    FROM skill_nodes sn JOIN skill_clusters sc ON sc.id = sn.cluster_id
    WHERE sc.capability_target_id = ? ORDER BY sc.sequence_order, sn.sequence_order`, capabilityTargetId);
}

/** Map every unmapped node of a pathway, then rebalance weights. */
export async function mapPathway(capabilityTargetId, { curr = {} } = {}) {
  const nodes = await pathwayNodes(capabilityTargetId);
  const unmapped = [];
  for (const n of nodes) {
    const explicit = await filterSeq(curr[n.id] || [], async s => await dal.one('SELECT 1 FROM skills WHERE skill_id = ?', s.skill_id));
    if (explicit.length) {
      await eachSeq(explicit, async s => await mapNode(n.id, s.skill_id, { weight: s.weight ?? 1, source: 'curr', confidence: s.confidence ?? 0.8 }));
      continue;
    }
    if (await dal.one('SELECT 1 FROM node_skill_map WHERE node_id = ?', n.id)) continue;
    const ctx = { capabilityTargetId, nodeId: n.id, cluster: n.cluster_label };
    let r = await resolveSkill(n.node_label, { source: 'node', context: ctx, queue: false });
    if (!r.skill) {
      let tags = [];
      try { tags = JSON.parse(n.concept_tags || '[]'); } catch { tags = []; }
      for (const tag of tags) {
        r = await resolveSkill(String(tag).replace(/_/g, ' '), { source: 'node', queue: false });
        if (r.skill) break;
      }
    }
    if (r.skill) await mapNode(n.id, r.skill.skill_id, { source: 'resolve', confidence: r.conf });
    else { await resolveSkill(n.node_label, { source: 'node', context: ctx }); unmapped.push(n.node_label); }
  }
  await rebalance(capabilityTargetId);
  return { nodes: nodes.length, unmapped };
}

/** Automatic mappings share a skill evenly across the pathway's nodes. */
export async function rebalance(capabilityTargetId) {
  const rows = await dal.all(`SELECT m.node_id, m.skill_id, m.source FROM node_skill_map m
    JOIN skill_nodes sn ON sn.id = m.node_id JOIN skill_clusters sc ON sc.id = sn.cluster_id
    WHERE sc.capability_target_id = ? AND m.source != 'curr'`, capabilityTargetId);
  const count = new Map();
  rows.forEach(r => count.set(r.skill_id, (count.get(r.skill_id) || 0) + 1));
  await eachSeq(rows, async r => await dal.run('UPDATE node_skill_map SET weight = ? WHERE node_id = ? AND skill_id = ?', 1 / count.get(r.skill_id), r.node_id, r.skill_id));
}

/** node_id → [{skill_id, weight}] for a pathway */
export async function pathwayMap(capabilityTargetId) {
  const rows = await dal.all(`SELECT m.node_id, m.skill_id, m.weight FROM node_skill_map m
    JOIN skill_nodes sn ON sn.id = m.node_id JOIN skill_clusters sc ON sc.id = sn.cluster_id
    WHERE sc.capability_target_id = ?`, capabilityTargetId);
  const bySkill = new Map();
  rows.forEach(r => { if (!bySkill.has(r.skill_id)) bySkill.set(r.skill_id, []); bySkill.get(r.skill_id).push(r); });
  return { rows, bySkill };
}

/**
 * Coverage of one skill by a pathway map. `onlyNodes` restricts to a node set
 * (e.g. a learner's mastered nodes) to get that learner's verified coverage.
 */
export async function coverageOf(skillId, map, { onlyNodes = null, memo = new Map() } = {}) {
  if (memo.has(skillId)) return memo.get(skillId);
  const direct = (map.bySkill.get(skillId) || [])
    .filter(r => !onlyNodes || onlyNodes.has(r.node_id))
    .reduce((a, r) => a + r.weight, 0);
  const kids = await children(skillId);
  const childPart = kids.length ? await reduceSeq(kids, async (a, k) => a + await coverageOf(k, map, { onlyNodes, memo }), 0) / kids.length : 0;
  const c = Math.min(1, direct + childPart);
  memo.set(skillId, c);
  return c;
}

export function coverageStatus(c) {
  if (c >= params.get('graph.coverage.covered')) return 'covered';
  if (c >= params.get('graph.coverage.partly')) return 'partly';
  return 'missing';
}

/** Node ids in the pathway that teach a skill or any of its descendants. */
export async function nodesForSkill(skillId, map) {
  const ids = new Set();
  const walk = async (s) => { (map.bySkill.get(s) || []).forEach(r => ids.add(r.node_id)); await eachSeq(await children(s), walk); };
  await walk(skillId);
  return ids;
}

/** Full coverage report for a pathway: every skill the pathway touches. */
export async function pathwayCoverage(capabilityTargetId) {
  const map = await pathwayMap(capabilityTargetId);
  const memo = new Map();
  const skills = (await mapSeq(await dal.all('SELECT skill_id, name, parent_skill_id, domain FROM skills'), async s => ({
    ...s, coverage: Math.round(await coverageOf(s.skill_id, map, { memo }) * 100) / 100
  }))).filter(s => s.coverage > 0);
  const unmapped = await dal.all(`SELECT sn.id, sn.node_label FROM skill_nodes sn JOIN skill_clusters sc ON sc.id = sn.cluster_id
    WHERE sc.capability_target_id = ? AND NOT EXISTS (SELECT 1 FROM node_skill_map m WHERE m.node_id = sn.id)`, capabilityTargetId);
  return {
    skills: skills.map(s => ({ ...s, status: coverageStatus(s.coverage) })).sort((a, b) => b.coverage - a.coverage),
    unmapped_nodes: unmapped
  };
}
