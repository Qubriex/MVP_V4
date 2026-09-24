// core/market/skillGap.js
// ─────────────────────────────────────────────────────────────────────────────
// Reads a JD's skills against what the learner has. A skill's status comes
// from (strongest first):
//   mastered     — a skill node matching the skill has advanced (verified by
//                  a Qubirex mastery check)
//   in_progress  — the learner's current skill node matches
//   in_path      — a node in the learner's programme matches, not reached yet
//   declared     — the learner lists it as a self-declared skill (unverified)
//   requested    — not in the programme; the learner asked the institution
//   not_in_path  — not in the programme at all
//
// Match % weights required skills 1 and nice-to-haves 0.5, and credits
// mastered 1, in_progress 0.6, declared 0.5, in_path 0.4, anything else 0.
// ─────────────────────────────────────────────────────────────────────────────

const CREDIT = { mastered: 1, in_progress: 0.6, declared: 0.5, in_path: 0.4, requested: 0, not_in_path: 0 };

function parseJSON(text, fallback) {
  if (!text) return fallback;
  try { return JSON.parse(text); } catch { return fallback; }
}

// Everything about the learner that gap scoring needs, in one read.
function getLearnerSkillState(db, user) {
  const nodes = db.prepare(`
    SELECT sn.id, sn.node_label, sn.estimated_minutes, sc.cluster_label,
           nm.advanced_at, nm.mastery_attainment
    FROM skill_nodes sn
    JOIN skill_clusters sc ON sc.id = sn.cluster_id
    LEFT JOIN node_mastery nm ON nm.skill_node_id = sn.id AND nm.engagement_learner_id = ?
    WHERE sc.capability_target_id = (SELECT capability_target_id FROM engagements WHERE id = ?)
    ORDER BY sc.sequence_order, sn.sequence_order
  `).all(user.el_id, user.engagement_id);
  const el = db.prepare('SELECT current_node_id FROM engagement_learners WHERE id = ?').get(user.el_id);
  const profile = db.prepare('SELECT self_skills FROM learner_profiles WHERE learner_id = ?').get(user.id);
  const requested = db.prepare('SELECT skill_name FROM skill_requests WHERE engagement_learner_id = ?')
    .all(user.el_id).map(r => r.skill_name.toLowerCase());

  return {
    nodes,
    currentNodeId: el ? el.current_node_id : null,
    declared: parseJSON(profile && profile.self_skills, []).map(x => String(x).toLowerCase()),
    requested
  };
}

const norm = (text) => ` ${String(text || '').toLowerCase()} `;
const matches = (text, skill) => skill.keywords.some(k => norm(text).includes(k)) || norm(text).includes(` ${skill.name.toLowerCase()} `);

function classifySkill(skill, state) {
  const hits = state.nodes.filter(n => matches(n.node_label, skill));
  const mastered = hits.find(n => n.advanced_at);
  if (mastered) {
    return { status: 'mastered', evidence: `Mastered · ${Math.round((mastered.mastery_attainment || 0) * 100)}%`, node_label: mastered.node_label };
  }
  const current = hits.find(n => n.id === state.currentNodeId);
  if (current) return { status: 'in_progress', evidence: 'In progress', node_label: current.node_label };
  if (hits.length) {
    const minutes = hits.reduce((sum, n) => sum + (n.estimated_minutes || 20), 0);
    return { status: 'in_path', evidence: 'In your path', node_label: hits[0].node_label, path_minutes: minutes };
  }
  if (state.declared.some(d => matches(d, skill) || d === skill.name.toLowerCase())) return { status: 'declared', evidence: 'Self-declared' };
  if (state.requested.includes(skill.name.toLowerCase())) return { status: 'requested', evidence: 'Requested' };
  return { status: 'not_in_path', evidence: 'Not in your programme' };
}

function scoreJob(job, state) {
  let earned = 0;
  let possible = 0;
  let gapHours = 0;
  const skills = job.skills.map(skill => {
    const c = classifySkill(skill, state);
    const weight = skill.required ? 1 : 0.5;
    earned += weight * CREDIT[c.status];
    possible += weight;
    if (c.status !== 'mastered' && c.status !== 'declared') {
      gapHours += c.path_minutes ? c.path_minutes / 60 : skill.hours;
    }
    return { key: skill.key, name: skill.name, required: skill.required, hours: skill.hours, ...c };
  });
  const covered = skills.filter(x => x.status !== 'not_in_path' && x.status !== 'requested').length;
  return {
    match: possible ? Math.round((earned / possible) * 100) : 0,
    covered,
    total: skills.length,
    gap_hours: Math.round(gapHours),
    skills
  };
}

module.exports = { getLearnerSkillState, classifySkill, scoreJob, parseJSON };
