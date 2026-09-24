// src/utils/mockData.js
// DEV-ONLY fallback data. Pages fall back to this when a real API call fails
// (no backend running, or dev-mode fake token rejected) so every page can
// still be reviewed with realistic content. Safe to delete once the backend
// is wired up for real end-to-end testing.

export const MOCK_ENGAGEMENTS = [
  {
    id: 'demo-eng-1', title: 'Python Fundamentals — Batch 1', ct_title: 'Python Fundamentals for Bootcamp',
    language: 'telugu', status: 'active', learner_count: 25, completed_count: 9, created_at: '2026-08-01T00:00:00Z'
  },
  {
    id: 'demo-eng-2', title: 'Data Structures — Cohort A', ct_title: 'DSA Core Curriculum',
    language: 'hindi', status: 'setup', learner_count: 18, completed_count: 0, created_at: '2026-08-20T00:00:00Z'
  },
  {
    id: 'demo-eng-3', title: 'Web Dev Basics', ct_title: 'Frontend Foundations',
    language: 'telugu', status: 'completed', learner_count: 30, completed_count: 30, created_at: '2026-06-10T00:00:00Z'
  }
];

export const MOCK_ENGAGEMENT_DETAIL = {
  id: 'demo-eng-1', title: 'Python Fundamentals — Batch 1', ct_title: 'Python Fundamentals for Bootcamp',
  language: 'telugu', status: 'active',
  learners: [
    { name: 'Ananya Reddy', learner_ref: 'LRNR-001', current_node_label: 'Loops — for/while', nodes_mastered: 6, overall_status: 'active' },
    { name: 'Karthik Rao', learner_ref: 'LRNR-002', current_node_label: 'Functions — Parameters', nodes_mastered: 4, overall_status: 'active' },
    { name: 'Sowmya N', learner_ref: 'LRNR-003', current_node_label: null, nodes_mastered: 11, overall_status: 'completed' },
    { name: 'Vikram Teja', learner_ref: 'LRNR-004', current_node_label: 'Variables & Data Types', nodes_mastered: 1, overall_status: 'active' }
  ]
};

export const MOCK_MASTERY_LOGS = [
  { id: 'demo-log-1', learner_name: 'Sowmya N', learner_ref: 'LRNR-003', log_data: { overall_completion: 100 } }
];

export const MOCK_MASTERY_LOG = {
  learner_name: 'Sowmya N',
  capability_target_reference: 'Python Fundamentals for Bootcamp',
  language_of_instruction: 'telugu',
  produced_at: '2026-09-01T00:00:00Z',
  engagement_title: 'Python Fundamentals — Batch 1',
  learner_reference: 'LRNR-003',
  clusters: [
    {
      cluster: 'Core Syntax & Variables', cluster_ref: 'C1', cluster_mastery_average: 92, simulation_readiness_flag: true,
      nodes: [
        { skill_node: 'Variables & Data Types', mastery_attainment: 95, time_to_mastery_minutes: 18, attempt_count: 1, confidence_indicator: 'high', advanced: true },
        { skill_node: 'Operators & Expressions', mastery_attainment: 90, time_to_mastery_minutes: 22, attempt_count: 2, confidence_indicator: 'solid', advanced: true }
      ]
    },
    {
      cluster: 'Control Flow', cluster_ref: 'C2', cluster_mastery_average: 88, simulation_readiness_flag: true,
      nodes: [
        { skill_node: 'Conditionals', mastery_attainment: 91, time_to_mastery_minutes: 20, attempt_count: 1, confidence_indicator: 'high', advanced: true },
        { skill_node: 'Loops — for/while', mastery_attainment: 85, time_to_mastery_minutes: 30, attempt_count: 3, confidence_indicator: 'solid', advanced: true }
      ]
    },
    {
      cluster: 'Functions', cluster_ref: 'C3', cluster_mastery_average: 78, simulation_readiness_flag: false,
      nodes: [
        { skill_node: 'Function Definitions', mastery_attainment: 80, time_to_mastery_minutes: 25, attempt_count: 2, confidence_indicator: 'solid', advanced: true },
        { skill_node: 'Parameters & Return Values', mastery_attainment: 0, time_to_mastery_minutes: null, attempt_count: 0, confidence_indicator: 'building', advanced: false }
      ]
    }
  ],
  qubirex_note: 'This Mastery Log reflects demonstrated understanding only. Readiness classification and external scoring are intentionally left blank — owned by the commissioning institution.'
};

export const MOCK_LEARNER_DASHBOARD = {
  engagement_title: 'Python Fundamentals — Batch 1',
  progress_pct: 55,
  nodes_mastered: 6,
  total_nodes: 11,
  current_node_label: 'Loops — for/while',
  current_cluster_label: 'Control Flow',
  overall_status: 'active'
};

export const MOCK_MASTERY_RECORD = [
  { node_label: 'Variables & Data Types', cluster_label: 'Core Syntax & Variables', mastery_attainment: 0.95, attempt_count: 1 },
  { node_label: 'Operators & Expressions', cluster_label: 'Core Syntax & Variables', mastery_attainment: 0.90, attempt_count: 2 },
  { node_label: 'Conditionals', cluster_label: 'Control Flow', mastery_attainment: 0.91, attempt_count: 1 }
];

export const MOCK_SESSION_START = {
  session_id: 'demo-session-1',
  node_label: 'Loops — for/while',
  cluster_label: 'Control Flow',
  approach: 'analogy',
  loop_count: 0,
  history: [
    {
      role: 'ai', type: 'diagnosis',
      content: 'నమస్కారం! ఈరోజు మనం "Loops" గురించి నేర్చుకుందాం — ఒక పనిని మళ్ళీ మళ్ళీ చేయాల్సి వస్తే, మీరు ఎలా చేస్తారు? ఉదాహరణకు, 1 నుండి 10 వరకు అన్ని సంఖ్యలను ప్రింట్ చేయాలంటే?'
    }
  ]
};
