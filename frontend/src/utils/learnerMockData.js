// src/utils/learnerMockData.js
// DEV-ONLY fallback data for the learner pages (/learn/*). Each export has
// the same shape as the API response it stands in for, so pages render the
// same way with or without a backend. Market numbers are made up — the API's
// own market data is sample data too and the UI labels it "Sample data".

const skill = (name, status, required = true) => ({ name, status, required });

export const MOCK_LEARNER_DASHBOARD = {
  engagement_title: 'Full-Stack Developer Programme',
  language: 'telugu',
  progress_pct: 38,
  nodes_mastered: 12,
  total_nodes: 32,
  current_node_label: 'React state and props',
  current_cluster_label: 'Frontend Foundations',
  current_node_index: 13,
  current_node_minutes: 20,
  last_approach: 'analogy',
  last_loop_count: 1,
  overall_status: 'in_progress',
  streak: { current_streak: 5, longest_streak: 9 },
  week_minutes: 220,
  clusters_done: 2,
  total_clusters: 4,
  recently_mastered: ['HTML semantics', 'CSS flexbox', 'CSS grid', 'JS variables and types', 'Functions and scope', 'Array methods', 'DOM events', 'Git basics']
};

export const MOCK_MARKET_SNAPSHOT = {
  sample: true,
  jobs: [
    { id: 'job-001', title: 'Junior Frontend Developer', company_type: 'Product startup', city: 'Hyderabad', salary_min: 4, salary_max: 6, match: 78, missing: ['TypeScript'] },
    { id: 'job-002', title: 'UI Developer (Fresher)', company_type: 'Fintech', city: 'Remote', salary_min: 4, salary_max: 7, match: 71, missing: ['Accessibility basics'] },
    { id: 'job-003', title: 'Full-Stack Trainee', company_type: 'IT services', city: 'Hyderabad', salary_min: 3.5, salary_max: 5, match: 64, missing: ['SQL', 'REST APIs'] }
  ],
  skills: [
    { key: 'typescript', name: 'TypeScript', pct: 62, status: 'not_in_path' },
    { key: 'rest', name: 'REST APIs', pct: 55, status: 'in_path' },
    { key: 'sql', name: 'SQL', pct: 48, status: 'in_path' },
    { key: 'git', name: 'Git', pct: 44, status: 'mastered' },
    { key: 'ai_tools', name: 'AI coding assistants', pct: 31, status: 'not_in_path' }
  ],
  topics: [
    { id: 'ai-agents', name: 'AI agents and LLM applications', growth: 'Rising fast', roles: ['LLM application developer', 'AI QA / evaluation analyst'] },
    { id: 'data-eng-ai', name: 'Data engineering for AI', growth: 'Rising', roles: ['Data pipeline engineer'] },
    { id: 'cloud-security', name: 'Cloud security', growth: 'Rising', roles: ['Cloud security associate'] }
  ]
};

export const MOCK_PROFILE_BASICS = { name: 'Priya Reddy', learner_ref: 'LRNR-001', completeness: { pct: 67, missing: ['projects', 'goals'] } };

export const MOCK_SESSION_START = {
  session_id: 'demo-session-1',
  node_label: 'React state and props',
  cluster_label: 'Frontend Foundations',
  approach: 'analogy',
  loop_count: 1,
  history: [
    { role: 'ai', message_type: 'diagnosis', content: 'నిన్నటి పాఠం గుర్తుందా? component అంటే ఏమిటో మీ మాటల్లో చెప్పండి.', caption_en: 'Remember yesterday’s lesson? Tell me in your own words what a component is.' },
    { role: 'learner', message_type: 'response', input_mode: 'voice', content: 'component అంటే page లో ఒక చిన్న భాగం, దాన్ని మళ్ళీ మళ్ళీ వాడుకోవచ్చు.' },
    {
      role: 'ai', message_type: 'instruction',
      content: 'సరిగ్గా చెప్పారు! ఇప్పుడు props గురించి. ఒక component కి బయట నుండి వచ్చే సమాచారమే props. అమ్మ పెట్టిన lunch box లాగా — తెరిచి వాడుకోవచ్చు, కానీ లోపల ఉన్నది మార్చలేరు.',
      caption_en: 'Props are the information a component receives from outside. Like a lunch box packed at home: you can open and use it, but you can’t change what’s inside.',
      mermaid: 'flowchart LR\n  App -- "props: item" --> LunchBox',
      code: 'function LunchBox({ item }) {\n  return <p>Today: {item}</p>;\n}\n\n<LunchBox item="Pulihora" />'
    }
  ]
};

const node = (label, status, extra = {}) => ({ id: label, label, status, ...extra });
const m = (label, pct, attempts, minutes, conf) => node(label, 'mastered', { mastery_pct: pct, attempt_count: attempts, time_minutes: minutes, confidence_label: conf });

export const MOCK_PATH = {
  engagement_title: 'Full-Stack Developer Programme',
  summary: { nodes_mastered: 12, total_nodes: 32, average_mastery_pct: 86, active_minutes: 860, cluster_certificates: 2 },
  clusters: [
    { id: 'c1', label: 'Web Basics', status: 'done', mastered: 6, total: 6, nodes: [m('HTML semantics', 92, 1, 20, 'high'), m('Git basics', 88, 1, 18, 'high'), m('CSS box model', 86, 2, 30, 'solid'), m('CSS flexbox', 90, 1, 24, 'high'), m('CSS grid', 84, 2, 34, 'solid'), m('Responsive design', 83, 2, 36, 'solid')] },
    { id: 'c2', label: 'JavaScript Core', status: 'done', mastered: 5, total: 5, nodes: [m('Variables and types', 94, 1, 16, 'high'), m('Functions and scope', 87, 2, 38, 'solid'), m('Array methods', 79, 3, 62, 'building'), m('DOM events', 91, 1, 26, 'high'), m('Async and fetch', 84, 2, 48, 'solid')] },
    { id: 'c3', label: 'Frontend Foundations', status: 'now', mastered: 1, total: 8, nodes: [m('React components', 82, 2, 44, 'solid'), node('React state and props', 'current'), node('Hooks', 'upcoming'), node('Lists and keys', 'upcoming'), node('Forms in React', 'upcoming'), node('Routing', 'upcoming'), node('Calling APIs', 'upcoming'), node('Testing basics', 'upcoming')] },
    { id: 'c4', label: 'Backend and Data', status: 'next', mastered: 0, total: 13, nodes: ['Node.js basics', 'Express routes', 'REST design', 'Auth with JWT', 'SQL queries', 'Joins', 'Data modelling', 'Transactions', 'Validation', 'Error handling', 'Logging', 'Deployment basics', 'Capstone API'].map(l => node(l, 'upcoming')) }
  ]
};
MOCK_PATH.evidence = MOCK_PATH.clusters.flatMap(c => c.nodes.filter(n => n.status === 'mastered').map(n => ({ ...n, cluster: c.label }))).slice(0, 8);

export const MOCK_PROFILE = {
  name: 'Priya Reddy', learner_ref: 'LRNR-001', language: 'telugu', email: 'priya.r@example.com',
  engagement_title: 'Full-Stack Developer Programme', institution_name: '[Institution name]',
  phone: '', city: 'Hyderabad', link_url: '', headline: 'Aspiring frontend developer · B.Tech CSE, final year',
  about: 'Final-year CSE student learning full-stack development. I enjoy turning designs into clean, fast interfaces and want to start as a frontend developer in Hyderabad.',
  target_roles: ['Frontend developer', 'UI developer'], preferred_cities: ['Hyderabad', 'Bengaluru', 'Remote'],
  available_from: 'June 2027', expected_salary: '', self_skills: ['Jest basics', 'Figma', 'English, Telugu, Hindi'],
  experience: [], certifications: [], ui_language: 'telugu',
  voice_prefs: { voice: 'A', rate: 1, startInVoice: true, showEnglishCaptions: true, dailyReminder: false },
  education: [{ degree: 'B.Tech, Computer Science', institution_name: '[College name]', city: 'Hyderabad', start_year: '2023', end_year: '2027', grade: '' }],
  projects: [],
  verified_skills: ['HTML semantics', 'CSS flexbox', 'CSS grid', 'JavaScript fundamentals', 'DOM events', 'React components', 'Git basics'],
  learning_skills: ['React state and props', 'Hooks', 'Lists and keys'],
  record: { nodes_mastered: 12, total_nodes: 32, clusters_done: ['Web Basics', 'JavaScript Core'] },
  completeness: { pct: 67, sections: { personal: true, education: true, projects: false, skills: true, goals: true, preferences: true }, missing: ['projects'] }
};

export const MOCK_RESUME = {
  profile: MOCK_PROFILE,
  resume: { version: 2, template: 'classic', sections: ['summary', 'skills', 'projects', 'education', 'experience', 'certifications', 'capability_record'].map(key => ({ key, on: !['experience', 'certifications'].includes(key) })), summary: null, skill_order: null, tailored_job_id: null, created_at: null },
  versions: [{ version: 2, template: 'classic', created_at: '2026-09-24 06:30:00' }, { version: 1, template: 'classic', created_at: '2026-09-20 10:00:00' }],
  saved_jobs: [{ id: 'job-001', title: 'Junior Frontend Developer', company_type: 'Product startup' }]
};

export const MOCK_JOBS = {
  sample: true, source: 'Sample feed', updated_at: '2026-09-24T06:00:00Z',
  filters: { cities: ['Hyderabad', 'Bengaluru', 'Remote', 'Vijayawada', 'Visakhapatnam'], modes: ['On-site', 'Hybrid', 'Remote'] },
  counts: { all: 4, saved: 1, applied: 0 },
  jobs: [
    { id: 'job-001', title: 'Junior Frontend Developer', company_type: 'Product startup', city: 'Hyderabad', mode: 'Hybrid', salary_min: 4, salary_max: 6, posted_days_ago: 2, match: 78, saved_status: 'saved', skills: [skill('JavaScript', 'mastered'), skill('React', 'in_progress'), skill('HTML and CSS', 'mastered'), skill('TypeScript', 'not_in_path')] },
    { id: 'job-002', title: 'UI Developer (Fresher)', company_type: 'Fintech', city: 'Remote', mode: 'Remote', salary_min: 4, salary_max: 7, posted_days_ago: 4, match: 71, saved_status: null, skills: [skill('HTML and CSS', 'mastered'), skill('JavaScript', 'mastered'), skill('Accessibility basics', 'not_in_path')] },
    { id: 'job-003', title: 'Full-Stack Trainee', company_type: 'IT services', city: 'Hyderabad', mode: 'On-site', salary_min: 3.5, salary_max: 5, posted_days_ago: 7, match: 64, saved_status: null, skills: [skill('JavaScript', 'mastered'), skill('Git', 'mastered'), skill('SQL', 'in_path'), skill('REST APIs', 'in_path')] },
    { id: 'job-004', title: 'Associate Software Engineer', company_type: 'Global capability centre', city: 'Hyderabad', mode: 'Hybrid', salary_min: 5, salary_max: 8, posted_days_ago: 8, match: 61, saved_status: null, skills: [skill('JavaScript', 'mastered'), skill('Data structures', 'not_in_path'), skill('Java', 'not_in_path')] }
  ]
};

export const MOCK_TRENDS = {
  sample: true, city: 'Hyderabad',
  months: [['Apr', 820], ['May', 910], ['Jun', 1040], ['Jul', 980], ['Aug', 1170], ['Sep', 1284]].map(([label, count]) => ({ label, count })),
  skills: [['JavaScript', 71, 'mastered'], ['React', 64, 'in_progress'], ['TypeScript', 62, 'not_in_path'], ['REST APIs', 55, 'in_path'], ['SQL', 48, 'in_path'], ['Git', 44, 'mastered'], ['AI coding assistants', 31, 'not_in_path']].map(([name, pct, status]) => ({ name, pct, status })),
  kpis: { open_roles: 1284, open_roles_change: 114, median_salary_lpa: 4.2, fastest_growing_role: 'LLM app developer', best_match: { id: 'job-001', title: 'Junior Frontend Developer', match: 78 } }
};

export const MOCK_JOB_DETAIL = {
  sample: true, source: 'Sample feed',
  job: {
    id: 'job-001', title: 'Junior Frontend Developer', company: null, company_type: 'Product startup', city: 'Hyderabad', mode: 'Hybrid',
    salary_min: 4, salary_max: 6, experience: '0–1 yr', posted_days_ago: 2, saved_status: 'saved',
    about: 'You will build and maintain customer-facing screens in React, working with designers and a backend team. You will ship small features within your first month, with a senior developer reviewing your code.',
    responsibilities: ['Turn Figma designs into responsive React components', 'Connect screens to REST APIs and handle loading and error states', 'Write unit tests for components you build', 'Take part in code reviews and daily stand-ups'],
    requirements: ['JavaScript', 'HTML and CSS', 'React', 'TypeScript', 'Git', 'REST APIs', 'Nice to have: Testing (Jest)', 'Nice to have: Accessibility basics']
  },
  gap: {
    match: 78, covered: 7, total: 9, gap_hours: 6,
    skills: [
      { name: 'JavaScript', status: 'mastered', evidence: 'Mastered · 91%', required: true, hours: 8 },
      { name: 'HTML and CSS', status: 'mastered', evidence: 'Mastered · 88%', required: true, hours: 6 },
      { name: 'React', status: 'in_progress', evidence: 'In progress', required: true, hours: 10 },
      { name: 'Git', status: 'mastered', evidence: 'Mastered · 85%', required: true, hours: 2 },
      { name: 'REST APIs', status: 'in_path', evidence: 'In your path', required: true, hours: 5 },
      { name: 'Testing (Jest)', status: 'declared', evidence: 'Self-declared', required: false, hours: 3 },
      { name: 'TypeScript', status: 'not_in_path', evidence: 'Not in your programme', required: true, hours: 4 },
      { name: 'Accessibility basics', status: 'not_in_path', evidence: 'Not in your programme', required: false, hours: 2 }
    ]
  }
};

const steps = (list) => list.map(([name, hours, status], i) => ({ n: i + 1, name, hours, status }));
export const MOCK_TOPICS = {
  sample: true,
  sectors: ['Software', 'Data and AI', 'Cloud and security', 'Energy and EV', 'Business and ops'],
  featured: {
    id: 'ai-agents', sector: 'Data and AI', name: 'AI agents and LLM applications', growth: 'Rising fast', have_pct: 20,
    desc: 'Companies are building apps on top of large language models: chat assistants, document search, automated workflows. Most of the work is ordinary web development plus a few new skills.',
    roles: ['LLM application developer', 'AI QA / evaluation analyst', 'Prompt and workflow designer'],
    steps: steps([['JavaScript', 8, 'mastered'], ['Calling an LLM API', 3, 'not_in_path'], ['Prompt design and structured output', 4, 'not_in_path'], ['Retrieval over documents', 6, 'not_in_path'], ['Testing AI answers', 4, 'not_in_path']])
  },
  topics: [
    { id: 'data-eng-ai', sector: 'Data and AI', name: 'Data engineering for AI', growth: 'Rising', desc: 'Cleaning and moving the data that AI systems learn from and search.', roles: ['Data pipeline engineer'], have_pct: 35, steps: steps([['Python', 10, 'not_in_path'], ['SQL', 6, 'in_path']]) },
    { id: 'cloud-security', sector: 'Cloud and security', name: 'Cloud security', growth: 'Rising', desc: 'Protecting apps and data that now run mostly on cloud platforms.', roles: ['Cloud security associate'], have_pct: 20, steps: steps([['Linux command line', 4, 'not_in_path']]) },
    { id: 'ai-assisted-dev', sector: 'Software', name: 'AI-assisted development', growth: 'Rising fast', desc: 'Using AI coding tools well: reviewing, testing and fixing their output.', roles: ['AI-augmented developer'], have_pct: 55, steps: steps([['JavaScript', 8, 'mastered'], ['Git', 2, 'mastered']]) },
    { id: 'ev-systems', sector: 'Energy and EV', name: 'EV battery and charging systems', growth: 'Rising', desc: 'Design, testing and maintenance of batteries and charging networks.', roles: ['Battery test technician'], have_pct: 5, steps: steps([['Battery and EV basics', 12, 'not_in_path']]) },
    { id: 'low-code', sector: 'Business and ops', name: 'Automation with low-code tools', growth: 'Steady', desc: 'Automating office workflows without writing full applications.', roles: ['Automation specialist'], have_pct: 30, steps: steps([['Low-code automation', 5, 'not_in_path']]) },
    { id: 'product-analytics', sector: 'Data and AI', name: 'Product analytics', growth: 'Steady', desc: 'Reading user data to decide what a product team builds next.', roles: ['Product analyst'], have_pct: 25, steps: steps([['SQL', 6, 'in_path']]) }
  ]
};
