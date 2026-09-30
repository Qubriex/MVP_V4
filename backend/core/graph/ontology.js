// core/graph/ontology.js
// The Capability Graph (v4.3 §3.1): one canonical ID per skill, a parent
// hierarchy, aliases, a prerequisite DAG (validated acyclic on write) and the
// weighted node → skill map. Every other engine reads skills from here.
import * as dal from '../db/dal.js';
import { ulid } from '../db/ulid.js';
import { normalise } from './resolveSkill.js';
import { eachSeq, someSeq } from '../util/seq.js';

export const getSkill = async (id) => await dal.one('SELECT * FROM skills WHERE skill_id = ?', id);

export async function listSkills() {
  return await dal.all(`SELECT s.*, (SELECT COUNT(*) FROM skill_aliases a WHERE a.skill_id = s.skill_id) AS alias_count
    FROM skills s ORDER BY s.domain, COALESCE(s.parent_skill_id, s.skill_id), s.parent_skill_id IS NOT NULL, s.name`);
}

export const children = async (id) => (await dal.all('SELECT skill_id FROM skills WHERE parent_skill_id = ?', id)).map(r => r.skill_id);

export async function descendants(id) {
  const out = [];
  const walk = async (s) => await eachSeq(await children(s), async c => { out.push(c); await walk(c); });
  await walk(id);
  return out;
}

export async function ancestors(id) {
  const out = [];
  let cur = await getSkill(id);
  while (cur && cur.parent_skill_id) { out.push(cur.parent_skill_id); cur = await getSkill(cur.parent_skill_id); }
  return out;
}

export async function addAlias(alias, skillId, source = 'review') {
  const norm = normalise(alias);
  if (!norm) throw new Error('Empty alias');
  if (!await getSkill(skillId)) throw new Error(`Unknown skill ${skillId}`);
  const taken = await dal.one('SELECT skill_id FROM skill_aliases WHERE alias_norm = ?', norm);
  if (taken && taken.skill_id !== skillId) throw new Error(`"${alias}" is already an alias of ${taken.skill_id}`);
  await dal.run('INSERT OR IGNORE INTO skill_aliases (alias_norm, skill_id, source, created_at) VALUES (?, ?, ?, ?)', norm, skillId, source, dal.nowIso());
  return norm;
}

export async function createSkill({ id, name, domain = 'general', parent = null, hours = null, description = null }) {
  const skillId = id || normalise(name).replace(/ /g, '_').slice(0, 40);
  if (!skillId || !name) throw new Error('A skill needs a name');
  if (await getSkill(skillId)) throw new Error(`Skill ${skillId} already exists`);
  if (parent && !await getSkill(parent)) throw new Error(`Unknown parent ${parent}`);
  await dal.run(`INSERT INTO skills (skill_id, name, domain, description, typical_hours, parent_skill_id, version, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?)`, skillId, name, domain, description, hours, parent, dal.nowIso());
  await addAlias(name, skillId, 'name');
  return skillId;
}

/** True when `from` can reach `to` through prerequisite edges. */
async function reaches(from, to, seen = new Set()) {
  if (from === to) return true;
  if (seen.has(from)) return false;
  seen.add(from);
  return await someSeq(await dal.all('SELECT prereq_skill_id FROM skill_prereqs WHERE skill_id = ?', from), async r => await reaches(r.prereq_skill_id, to, seen));
}

/** Add skill → prerequisite; rejects any edge that would close a cycle. */
export async function addPrereq(skillId, prereqId) {
  if (!await getSkill(skillId) || !await getSkill(prereqId)) throw new Error('Unknown skill in prerequisite');
  if (skillId === prereqId || await reaches(prereqId, skillId)) {
    const err = new Error(`${prereqId} → ${skillId} would create a prerequisite cycle`);
    err.code = 'cycle';
    throw err;
  }
  await dal.run('INSERT OR IGNORE INTO skill_prereqs (skill_id, prereq_skill_id) VALUES (?, ?)', skillId, prereqId);
}

export const prereqsOf = async (id) => (await dal.all('SELECT prereq_skill_id FROM skill_prereqs WHERE skill_id = ?', id)).map(r => r.prereq_skill_id);

/** Topological order of a set of nodes' prerequisite DAG (node ids); throws on a cycle. */
export function checkAcyclic(edges) {
  const graph = new Map();
  edges.forEach(([a, b]) => { if (!graph.has(a)) graph.set(a, []); graph.get(a).push(b); if (!graph.has(b)) graph.set(b, []); });
  const state = new Map();
  const visit = (n, path) => {
    if (state.get(n) === 1) throw Object.assign(new Error(`Prerequisite cycle: ${[...path, n].join(' → ')}`), { code: 'cycle' });
    if (state.get(n) === 2) return;
    state.set(n, 1);
    graph.get(n).forEach(m => visit(m, [...path, n]));
    state.set(n, 2);
  };
  [...graph.keys()].forEach(n => visit(n, []));
  return true;
}

export async function mapNode(nodeId, skillId, { weight = 1, source = 'resolve', confidence = 1 } = {}) {
  await dal.run(`INSERT INTO node_skill_map (node_id, skill_id, weight, source, confidence, created_at) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(node_id, skill_id) DO UPDATE SET weight = excluded.weight, source = excluded.source, confidence = excluded.confidence`,
  nodeId, skillId, weight, source, confidence, dal.nowIso());
}

export const nodeSkills = async (nodeId) => await dal.all(`SELECT m.skill_id, m.weight, m.source, m.confidence, s.name
  FROM node_skill_map m JOIN skills s ON s.skill_id = m.skill_id WHERE m.node_id = ?`, nodeId);

export { ulid };
