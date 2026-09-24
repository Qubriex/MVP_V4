// core/market/sampleMarket.js
// ─────────────────────────────────────────────────────────────────────────────
// SAMPLE job-market data for the learner Career pages (/learn/market,
// /learn/topics). Every figure here is made up to exercise the layout — the
// API marks each response `sample: true` and the UI shows a "Sample data"
// badge wherever these numbers appear.
//
// To go live, replace this module with a job-feed ingestion job that writes
// the same shapes (jobs, monthly demand, skill share, topics). The gap
// scoring in skillGap.js only depends on each skill's `keywords`, so it keeps
// working unchanged against real JDs once their skills are extracted.
// ─────────────────────────────────────────────────────────────────────────────

// Canonical skills. `keywords` are matched (case-insensitive substring)
// against the learner's skill-node labels and self-declared skills.
const SKILLS = {
  javascript:   { name: 'JavaScript', keywords: ['javascript', 'js ', 'js core', 'variables and types', 'functions and scope', 'array methods'], hours: 8 },
  html_css:     { name: 'HTML and CSS', keywords: ['html', 'css', 'flexbox', 'grid', 'responsive'], hours: 6 },
  react:        { name: 'React', keywords: ['react'], hours: 10 },
  typescript:   { name: 'TypeScript', keywords: ['typescript'], hours: 4 },
  git:          { name: 'Git', keywords: ['git'], hours: 2 },
  rest:         { name: 'REST APIs', keywords: ['rest', 'api', 'fetch', 'express'], hours: 5 },
  sql:          { name: 'SQL', keywords: ['sql', 'joins', 'database', 'data modelling'], hours: 6 },
  node:         { name: 'Node.js', keywords: ['node'], hours: 6 },
  testing:      { name: 'Testing (Jest)', keywords: ['test', 'jest'], hours: 3 },
  a11y:         { name: 'Accessibility basics', keywords: ['accessib', 'a11y'], hours: 2 },
  python:       { name: 'Python', keywords: ['python', 'loops', 'conditionals', 'variables & data types', 'function definitions'], hours: 10 },
  dsa:          { name: 'Data structures', keywords: ['data structure', 'dsa', 'linked list', 'arrays and lists'], hours: 12 },
  java:         { name: 'Java', keywords: ['java '], hours: 14 },
  excel:        { name: 'Excel and spreadsheets', keywords: ['excel', 'spreadsheet'], hours: 4 },
  statistics:   { name: 'Statistics basics', keywords: ['statistic', 'probability'], hours: 6 },
  llm_api:      { name: 'Calling an LLM API', keywords: ['llm', 'openai', 'gemini', 'prompt'], hours: 3 },
  prompting:    { name: 'Prompt design and structured output', keywords: ['prompt'], hours: 4 },
  retrieval:    { name: 'Retrieval over documents', keywords: ['retrieval', 'rag', 'embedding'], hours: 6 },
  ai_eval:      { name: 'Testing AI answers', keywords: ['evaluat', 'ai test'], hours: 4 },
  ai_tools:     { name: 'AI coding assistants', keywords: ['ai coding', 'copilot', 'ai assistant'], hours: 2 },
  cloud:        { name: 'Cloud basics', keywords: ['cloud', 'aws', 'azure', 'gcp'], hours: 8 },
  linux:        { name: 'Linux command line', keywords: ['linux', 'shell', 'command line'], hours: 4 },
  networking:   { name: 'Networking basics', keywords: ['network', 'tcp', 'http'], hours: 5 },
  pipelines:    { name: 'Data pipelines', keywords: ['pipeline', 'etl'], hours: 8 },
  ev_basics:    { name: 'Battery and EV basics', keywords: ['battery', 'ev '], hours: 12 },
  low_code:     { name: 'Low-code automation', keywords: ['low-code', 'automation', 'power automate', 'zapier'], hours: 5 }
};

const s = (key, required = true) => ({ key, ...SKILLS[key], required });

const JOBS = [
  {
    id: 'job-001', title: 'Junior Frontend Developer', company: null, company_type: 'Product startup',
    city: 'Hyderabad', mode: 'Hybrid', salary_min: 4, salary_max: 6, experience: '0–1 yr', posted_days_ago: 2,
    about: 'You will build and maintain customer-facing screens in React, working with designers and a backend team. You will ship small features within your first month, with a senior developer reviewing your code.',
    responsibilities: ['Turn Figma designs into responsive React components', 'Connect screens to REST APIs and handle loading and error states', 'Write unit tests for components you build', 'Take part in code reviews and daily stand-ups'],
    skills: [s('javascript'), s('html_css'), s('react'), s('typescript'), s('git'), s('rest'), s('testing', false), s('a11y', false)]
  },
  {
    id: 'job-002', title: 'UI Developer (Fresher)', company: null, company_type: 'Fintech',
    city: 'Remote', mode: 'Remote', salary_min: 4, salary_max: 7, experience: '0–1 yr', posted_days_ago: 4,
    about: 'Build accessible, pixel-accurate interfaces for a payments dashboard used by small businesses.',
    responsibilities: ['Build screens from a shared component library', 'Fix layout and accessibility issues reported by QA', 'Work with the design team on new flows'],
    skills: [s('html_css'), s('javascript'), s('a11y'), s('react', false), s('git')]
  },
  {
    id: 'job-003', title: 'Full-Stack Trainee', company: null, company_type: 'IT services',
    city: 'Hyderabad', mode: 'On-site', salary_min: 3.5, salary_max: 5, experience: '0–1 yr', posted_days_ago: 7,
    about: 'A six-month paid traineeship building internal tools for client projects, with a mentor assigned from day one.',
    responsibilities: ['Build small CRUD features end to end', 'Write SQL queries and simple REST endpoints', 'Document what you build'],
    skills: [s('javascript'), s('git'), s('sql'), s('rest'), s('node'), s('html_css', false)]
  },
  {
    id: 'job-004', title: 'Associate Software Engineer', company: null, company_type: 'Global capability centre',
    city: 'Hyderabad', mode: 'Hybrid', salary_min: 5, salary_max: 8, experience: '0–1 yr', posted_days_ago: 8,
    about: 'Join a platform team maintaining services used across the group. Strong fundamentals matter more than any one framework.',
    responsibilities: ['Fix bugs and add small features to existing services', 'Write unit tests', 'Take part in on-call shadowing after six months'],
    skills: [s('javascript'), s('dsa'), s('java'), s('git'), s('sql', false)]
  },
  {
    id: 'job-005', title: 'Python Developer Trainee', company: null, company_type: 'Analytics consultancy',
    city: 'Bengaluru', mode: 'Hybrid', salary_min: 3.6, salary_max: 5.5, experience: '0–1 yr', posted_days_ago: 3,
    about: 'Write Python scripts that clean and move client data, and help build small internal APIs.',
    responsibilities: ['Write and test Python scripts', 'Query data with SQL', 'Automate recurring reports'],
    skills: [s('python'), s('sql'), s('git'), s('excel', false), s('rest', false)]
  },
  {
    id: 'job-006', title: 'Junior Data Analyst', company: null, company_type: 'E-commerce',
    city: 'Hyderabad', mode: 'On-site', salary_min: 3.5, salary_max: 5, experience: '0–1 yr', posted_days_ago: 5,
    about: 'Answer business questions from order and customer data, and build weekly dashboards for the operations team.',
    responsibilities: ['Write SQL to pull and join data', 'Build and maintain dashboards', 'Present findings to the ops team every week'],
    skills: [s('sql'), s('excel'), s('statistics'), s('python', false)]
  },
  {
    id: 'job-007', title: 'LLM Application Developer (Junior)', company: null, company_type: 'AI startup',
    city: 'Bengaluru', mode: 'Hybrid', salary_min: 6, salary_max: 10, experience: '0–2 yrs', posted_days_ago: 1,
    about: 'Build chat assistants and document-search features on top of large language models. Most of the work is ordinary web development plus a few new skills.',
    responsibilities: ['Build web features that call LLM APIs', 'Design prompts and structured outputs', 'Write tests that check AI answers'],
    skills: [s('javascript'), s('rest'), s('llm_api'), s('prompting'), s('retrieval', false), s('ai_eval', false), s('git')]
  },
  {
    id: 'job-008', title: 'Cloud Support Associate', company: null, company_type: 'Cloud services partner',
    city: 'Visakhapatnam', mode: 'On-site', salary_min: 3.2, salary_max: 4.8, experience: '0–1 yr', posted_days_ago: 9,
    about: 'Help customers troubleshoot cloud deployments, with training on the major platforms in your first quarter.',
    responsibilities: ['Resolve customer tickets', 'Reproduce issues on test accounts', 'Write knowledge-base articles'],
    skills: [s('linux'), s('networking'), s('cloud'), s('python', false)]
  },
  {
    id: 'job-009', title: 'Automation Specialist (Fresher)', company: null, company_type: 'Shared services',
    city: 'Vijayawada', mode: 'On-site', salary_min: 3, salary_max: 4.2, experience: '0–1 yr', posted_days_ago: 6,
    about: 'Automate office workflows for finance and HR teams using low-code tools and spreadsheets.',
    responsibilities: ['Map existing manual processes', 'Build and test automations', 'Train staff on new workflows'],
    skills: [s('low_code'), s('excel'), s('javascript', false)]
  },
  {
    id: 'job-010', title: 'Node.js Backend Intern', company: null, company_type: 'SaaS product',
    city: 'Remote', mode: 'Remote', salary_min: 3, salary_max: 4.5, experience: '0 yr', posted_days_ago: 2,
    about: 'A six-month internship on the API team, with a conversion offer for strong interns.',
    responsibilities: ['Build REST endpoints in Express', 'Write SQL migrations', 'Add tests to existing endpoints'],
    skills: [s('node'), s('rest'), s('sql'), s('javascript'), s('testing', false), s('git')]
  }
];

// Monthly count of open fresher roles, per city (sample). Keys are
// YYYY-MM; the API returns the last six months.
const MONTHLY_DEMAND = {
  all:           { '2026-04': 2380, '2026-05': 2610, '2026-06': 2890, '2026-07': 2760, '2026-08': 3240, '2026-09': 3510 },
  Hyderabad:     { '2026-04': 820, '2026-05': 910, '2026-06': 1040, '2026-07': 980, '2026-08': 1170, '2026-09': 1284 },
  Bengaluru:     { '2026-04': 940, '2026-05': 1010, '2026-06': 1090, '2026-07': 1060, '2026-08': 1230, '2026-09': 1310 },
  Remote:        { '2026-04': 380, '2026-05': 420, '2026-06': 460, '2026-07': 440, '2026-08': 520, '2026-09': 560 },
  Vijayawada:    { '2026-04': 110, '2026-05': 120, '2026-06': 130, '2026-07': 125, '2026-08': 140, '2026-09': 150 },
  Visakhapatnam: { '2026-04': 130, '2026-05': 150, '2026-06': 170, '2026-07': 155, '2026-08': 180, '2026-09': 206 }
};

// Share of open JDs that name each skill (sample, 0–100).
const SKILL_SHARE = [
  ['javascript', 71], ['react', 64], ['typescript', 62], ['rest', 55], ['sql', 48],
  ['git', 44], ['python', 41], ['ai_tools', 31]
];

const MEDIAN_SALARY_LPA = 4.2;
const FASTEST_GROWING_ROLE = 'LLM app developer';

const SECTORS = ['Software', 'Data and AI', 'Cloud and security', 'Energy and EV', 'Business and ops'];

const TOPICS = [
  {
    id: 'ai-agents', sector: 'Data and AI', name: 'AI agents and LLM applications', growth: 'Rising fast', featured: true,
    desc: 'Companies are building apps on top of large language models: chat assistants, document search, automated workflows. Most of the work is ordinary web development plus a few new skills.',
    roles: ['LLM application developer', 'AI QA / evaluation analyst', 'Prompt and workflow designer'],
    steps: ['javascript', 'llm_api', 'prompting', 'retrieval', 'ai_eval'].map(k => SKILLS[k] && { key: k, ...SKILLS[k] })
  },
  {
    id: 'data-eng-ai', sector: 'Data and AI', name: 'Data engineering for AI', growth: 'Rising', desc: 'Cleaning and moving the data that AI systems learn from and search.',
    roles: ['Data pipeline engineer'], steps: ['python', 'sql', 'pipelines', 'cloud'].map(k => ({ key: k, ...SKILLS[k] }))
  },
  {
    id: 'cloud-security', sector: 'Cloud and security', name: 'Cloud security', growth: 'Rising', desc: 'Protecting apps and data that now run mostly on cloud platforms.',
    roles: ['Cloud security associate'], steps: ['linux', 'networking', 'cloud'].map(k => ({ key: k, ...SKILLS[k] }))
  },
  {
    id: 'ai-assisted-dev', sector: 'Software', name: 'AI-assisted development', growth: 'Rising fast', desc: 'Using AI coding tools well: reviewing, testing and fixing their output.',
    roles: ['AI-augmented developer'], steps: ['javascript', 'git', 'testing', 'ai_tools'].map(k => ({ key: k, ...SKILLS[k] }))
  },
  {
    id: 'ev-systems', sector: 'Energy and EV', name: 'EV battery and charging systems', growth: 'Rising', desc: 'Design, testing and maintenance of batteries and charging networks.',
    roles: ['Battery test technician'], steps: ['ev_basics', 'excel'].map(k => ({ key: k, ...SKILLS[k] }))
  },
  {
    id: 'low-code', sector: 'Business and ops', name: 'Automation with low-code tools', growth: 'Steady', desc: 'Automating office workflows without writing full applications.',
    roles: ['Automation specialist'], steps: ['excel', 'low_code', 'javascript'].map(k => ({ key: k, ...SKILLS[k] }))
  },
  {
    id: 'product-analytics', sector: 'Data and AI', name: 'Product analytics', growth: 'Steady', desc: 'Reading user data to decide what a product team builds next.',
    roles: ['Product analyst'], steps: ['sql', 'statistics', 'excel'].map(k => ({ key: k, ...SKILLS[k] }))
  }
];

module.exports = {
  SKILLS, JOBS, MONTHLY_DEMAND, SKILL_SHARE, MEDIAN_SALARY_LPA, FASTEST_GROWING_ROLE, SECTORS, TOPICS,
  SOURCE_LABEL: 'Sample feed',
  UPDATED_AT: '2026-09-24T06:00:00Z'
};
