// core/brains/cultBrain.js — CULT: Cultural Knowledge Base
// Retrieves curated, culturally-grounded examples and analogies before every
// TEACH call. Examples that lead to ADVANCE outcomes gain effectiveness over
// time — the CKB is self-improving.
const culturalStore = require('../stores/culturalStore');

const REGION_MAP = {
  telugu: 'telangana',
  hindi: 'north_india'
};

// Exact node-label matches first, then fuzzy keyword fallback.
const CONCEPT_TAG_MAP = {
  'variables and assignment': 'variables',
  'loop structures — while and for': 'loops'
};

// Order matters — more specific tags (sql_joins, git_branching) are checked
// before their broader siblings (sql_select, git).
const FUZZY_KEYWORDS = [
  { tag: 'sql_joins', keywords: ['join'] },
  { tag: 'sql_select', keywords: ['sql', 'select', 'query'] },
  { tag: 'git_branching', keywords: ['branch', 'merge'] },
  { tag: 'git', keywords: ['git', 'version control'] },
  { tag: 'loops', keywords: ['loop', 'while', 'iteration', 'for loop'] },
  { tag: 'conditionals', keywords: ['condition', 'if/else', 'if-else', 'branching logic'] },
  { tag: 'functions', keywords: ['function', 'def ', 'method'] },
  { tag: 'dictionaries', keywords: ['dictionary', 'dict', 'key-value', 'hashmap'] },
  { tag: 'lists', keywords: ['list', 'array'] },
  { tag: 'inheritance', keywords: ['inheritance', 'subclass', 'superclass'] },
  { tag: 'classes', keywords: ['class', 'object-oriented', 'oop'] },
  { tag: 'recursion', keywords: ['recursion', 'recursive'] },
  { tag: 'error_handling', keywords: ['error', 'exception', 'try/catch', 'try-except'] },
  { tag: 'api_json', keywords: ['api', 'json', 'rest'] },
  { tag: 'strings', keywords: ['string', 'text processing'] },
  { tag: 'modules_imports', keywords: ['module', 'import', 'package', 'library'] },
  { tag: 'file_io', keywords: ['file i/o', 'file handling', 'read/write', 'file reading', 'file writing'] },
  { tag: 'algorithms', keywords: ['algorithm', 'sorting', 'searching'] },
  { tag: 'variables', keywords: ['variable', 'assignment'] }
];

// ─── getConceptTag() ───────────────────────────────────────────────────────────
function getConceptTag(nodeLabel) {
  const normalized = (nodeLabel || '').toLowerCase().trim();
  if (CONCEPT_TAG_MAP[normalized]) return CONCEPT_TAG_MAP[normalized];

  const match = FUZZY_KEYWORDS.find(({ keywords }) => keywords.some(k => normalized.includes(k)));
  return match ? match.tag : 'variables'; // default fallback
}

// ─── retrieveExamples() ────────────────────────────────────────────────────────
function retrieveExamples(nodeLabel, language, vocabularyLevel = 'beginner') {
  const conceptTag = getConceptTag(nodeLabel);
  const region = REGION_MAP[language] || 'telangana';
  return culturalStore.retrieveByConceptTag(conceptTag, language, region, vocabularyLevel);
}

// ─── logOutcome() ───────────────────────────────────────────────────────────────
function logOutcome(ckbEntryId, learnerId, sessionId, nodeId, outcome) {
  return culturalStore.logOutcome(ckbEntryId, learnerId, sessionId, nodeId, outcome);
}

module.exports = { retrieveExamples, logOutcome, getConceptTag, CONCEPT_TAG_MAP, REGION_MAP };
