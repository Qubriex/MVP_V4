// core/brains/currBrain.js — CURR: Curriculum Brain
// Handles everything BEFORE a learner starts a session: brief ingestion,
// cluster decomposition into atomic skill nodes, and node spec retrieval
// that TEACH uses at session start. Uses RAG for brief ingestion — retrieves
// similar past confirmed briefs as extraction templates before extracting.
const briefStore = require('../stores/briefStore');
const { callAI, safeParseJSON } = require('../instructionEngine');

// ─── inferDomain() ──────────────────────────────────────────────────────────────
const DOMAIN_KEYWORDS = [
  { domain: 'software_development', keywords: ['python', 'javascript', 'programming', 'coding', 'software'] },
  { domain: 'data_analytics', keywords: ['sql', 'data analyst', 'data science', 'pandas', 'machine learning'] },
  { domain: 'communication', keywords: ['communication', 'soft skill', 'interview', 'presentation'] },
  { domain: 'finance', keywords: ['finance', 'accounting', 'tally', 'gst'] },
  { domain: 'digital_marketing', keywords: ['marketing', 'digital', 'seo', 'social media'] },
  { domain: 'cloud_devops', keywords: ['cloud', 'aws', 'azure', 'devops'] }
];

function inferDomain(rawInput) {
  const lower = (rawInput || '').toLowerCase();
  const match = DOMAIN_KEYWORDS.find(({ keywords }) => keywords.some(k => lower.includes(k)));
  return match ? match.domain : 'general';
}

// ─── extractCapabilityTargets() ─────────────────────────────────────────────────
async function extractCapabilityTargets({ rawInput, language, institutionId }) {
  const domain = inferDomain(rawInput);

  // RAG: retrieve up to 2 confirmed briefs from the same domain/language as templates
  const templates = briefStore.retrieveSimilarBriefs(domain, language, null, 2);
  const templateContext = templates.length
    ? `PAST CONFIRMED EXTRACTIONS FROM THIS DOMAIN (use as a structural template, do not copy content):\n${templates.map((t, i) => `Template ${i + 1}: ${JSON.stringify(t.extracted_clusters)}`).join('\n')}`
    : 'No confirmed briefs exist yet for this domain — extract from first principles.';

  const system = `You are Professor Qubirex's curriculum ingestion brain (CURR). Extract structured capability targets from any input format: curriculum document, job description, skills list, competency matrix, government framework, or plain text.

${templateContext}

Extract 3-8 skill clusters, each representing 3-6 hours of instruction. List ambiguous areas separately rather than guessing.

Respond ONLY with JSON:
{
  "title": "Inferred engagement title",
  "domain": "${domain}",
  "clusters": [
    {
      "label": "Skill cluster name (clear English technical term)",
      "description": "What this cluster covers and why",
      "required_proficiency": "beginner | intermediate | advanced",
      "priority": "high | normal | low",
      "evidence_type": "What applied performance this builds toward",
      "mastery_threshold": 0.75,
      "estimated_hours": 4
    }
  ],
  "time_window_weeks": null,
  "cohort_description": "Who the learners are",
  "extraction_confidence": 0.8,
  "ambiguities": ["Areas needing clarification"],
  "confirmation_summary": "Clean summary to send to institution"
}`;

  const text = await callAI({
    system,
    userMessage: `Extract capability targets from this input:\n\n${rawInput}`,
    maxTokens: 3072,
    temperature: 0.3
  });

  const extracted = safeParseJSON(text, {
    title: 'Capability Target', domain, clusters: [], time_window_weeks: null,
    cohort_description: '', extraction_confidence: 0, ambiguities: [], confirmation_summary: ''
  });
  extracted.domain = extracted.domain || domain;

  const briefId = briefStore.writeBrief(
    institutionId, domain, language,
    (rawInput || '').slice(0, 500), extracted, extracted.extraction_confidence || 0
  );

  return { ...extracted, briefId };
}

// ─── decomposeClusterToNodes() ───────────────────────────────────────────────────
async function decomposeClusterToNodes({ clusterLabel, clusterDescription, proficiencyLevel, language, skillNodeIds = [] }) {
  const system = `You are Professor Qubirex's curriculum brain (CURR). Decompose a skill cluster into ordered, atomic skill nodes. Each node must be teachable in 15-30 minutes of active instruction. Foundational nodes come before applied nodes. Prerequisite relationships must be respected. Design for ${language === 'hindi' ? 'Hindi' : 'Telugu'}-language learners.

Respond ONLY with JSON:
{
  "nodes": [
    {
      "label": "Node name — clear English technical term",
      "description": "What this node teaches and how it builds on prerequisites",
      "sequence_order": 1,
      "difficulty_level": 1,
      "node_type": "concept | applied | procedural | analytical",
      "phase": 1,
      "prerequisite_indices": [],
      "estimated_minutes": 20,
      "concept_tags": ["variables"],
      "learning_objectives": ["objective 1", "objective 2", "objective 3"],
      "mastery_threshold": 0.70
    }
  ]
}`;

  const text = await callAI({
    system,
    userMessage: `Cluster: "${clusterLabel}"\nDescription: "${clusterDescription || 'As specified in the capability target'}"\nRequired proficiency: "${proficiencyLevel || 'intermediate'}"`,
    maxTokens: 3072,
    temperature: 0.3
  });

  const decomposed = safeParseJSON(text, { nodes: [] });
  const nodes = decomposed.nodes || [];

  // Node spec storage — only if skillNodeIds is provided, in the same order as nodes.
  if (skillNodeIds.length === nodes.length) {
    nodes.forEach((n, i) => {
      briefStore.writeNodeSpec(skillNodeIds[i], {
        nodeLabel: n.label,
        clusterLabel,
        learningObjectives: n.learning_objectives || [],
        prerequisiteLabels: (n.prerequisite_indices || []).map(pi => nodes[pi] ? nodes[pi].label : null).filter(Boolean),
        masteryThreshold: n.mastery_threshold ?? 0.70,
        phase: n.phase ?? 1,
        difficultyLevel: n.difficulty_level ?? 1,
        estimatedMinutes: n.estimated_minutes ?? 20,
        conceptTags: n.concept_tags || []
      });
    });
  }

  return { nodes };
}

// ─── retrieveNodeContext() ────────────────────────────────────────────────────────
// Tries by skillNodeId first (precise). Falls back to label lookup. Returns
// null if not found — TEACH handles that gracefully with general knowledge.
function retrieveNodeContext(nodeId, nodeLabel) {
  const bySkillNodeId = briefStore.retrieveNodeSpecById(nodeId);
  if (bySkillNodeId) return bySkillNodeId;
  return briefStore.retrieveNodeSpecByLabel(nodeLabel) || null;
}

// ─── confirmBrief() ────────────────────────────────────────────────────────────────
function confirmBrief(briefId) {
  return briefStore.confirmBrief(briefId);
}

module.exports = {
  extractCapabilityTargets,
  decomposeClusterToNodes,
  retrieveNodeContext,
  confirmBrief,
  inferDomain
};
