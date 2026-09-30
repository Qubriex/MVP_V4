// core/graph/ontologySeed.js
// The seed Capability Graph (v4.3 §3, §13): canonical skills with parents,
// typical hours, aliases and prerequisites. Parent skill IDs are the keys the
// job-market data uses (javascript, sql, python, …), so JDs, pathways,
// insights and readiness all speak one language. Child skills are the size a
// pathway node teaches.
//
// Aliases are normalised by resolveSkill.normalise before storage. `te`/`hi`
// entries are common Latin-script phrasings from Telugu- and Hindi-medium
// classrooms. New aliases come only through the ontology review queue.

/** [id, name, domain, parent, typicalHours, aliases[]] */
export const SEED_SKILLS = [
  // ── Web ────────────────────────────────────────────────────────────────────
  ['html_css', 'HTML and CSS', 'web', null, 6, ['html', 'css', 'html css', 'html and css', 'web design basics']],
  ['html_semantics', 'Semantic HTML', 'web', 'html_css', 2, ['html semantics', 'semantic html', 'html tags', 'html elements', 'html structure']],
  ['css_box_model', 'CSS box model', 'web', 'html_css', 1, ['css box model', 'box model', 'margin padding border']],
  ['css_flexbox_grid', 'CSS flexbox and grid', 'web', 'html_css', 2, ['css flexbox', 'flexbox', 'css grid', 'grid layout', 'flex layout']],
  ['responsive_design', 'Responsive design', 'web', 'html_css', 2, ['responsive design', 'responsive', 'media queries', 'mobile first']],
  ['javascript', 'JavaScript', 'web', null, 8, ['javascript', 'js', 'js core', 'javascript core', 'ecmascript']],
  ['js_variables_types', 'JavaScript variables and types', 'web', 'javascript', 1, ['variables and types', 'js variables', 'javascript variables', 'data types in javascript', 'let const var']],
  ['js_functions_scope', 'JavaScript functions and scope', 'web', 'javascript', 2, ['functions and scope', 'js functions', 'javascript functions', 'closures', 'scope']],
  ['js_arrays', 'JavaScript arrays and array methods', 'web', 'javascript', 2, ['array methods', 'js arrays', 'map filter reduce', 'javascript arrays']],
  ['js_dom_events', 'DOM and events', 'web', 'javascript', 2, ['dom events', 'dom', 'event handling', 'dom manipulation', 'events']],
  ['js_async', 'Asynchronous JavaScript', 'web', 'javascript', 2, ['async and fetch', 'async await', 'promises', 'fetch api', 'asynchronous javascript']],
  ['react', 'React', 'web', null, 10, ['react', 'reactjs', 'react js']],
  ['react_components', 'React components', 'web', 'react', 2, ['react components', 'components', 'jsx']],
  ['react_state_props', 'React state and props', 'web', 'react', 2, ['react state and props', 'state and props', 'props', 'react state']],
  ['react_hooks', 'React hooks', 'web', 'react', 3, ['hooks', 'react hooks', 'useeffect', 'usestate']],
  ['react_forms', 'Forms in React', 'web', 'react', 2, ['forms in react', 'react forms', 'controlled inputs']],
  ['typescript', 'TypeScript', 'web', null, 4, ['typescript', 'ts']],
  ['a11y', 'Accessibility basics', 'web', null, 2, ['accessibility', 'a11y', 'web accessibility', 'wcag']],
  ['testing', 'Testing (Jest)', 'web', null, 3, ['testing', 'jest', 'unit testing', 'unit tests']],
  // ── Backend ────────────────────────────────────────────────────────────────
  ['node', 'Node.js', 'backend', null, 6, ['node', 'nodejs', 'node js']],
  ['node_basics', 'Node.js runtime and npm', 'backend', 'node', 3, ['npm', 'node modules', 'node runtime', 'event loop']],
  ['express_routes', 'Express routes', 'backend', 'node', 3, ['express routes', 'express', 'expressjs', 'routing']],
  ['rest', 'REST APIs', 'backend', null, 5, ['rest', 'rest apis', 'rest api', 'apis', 'api']],
  ['rest_design', 'REST API design', 'backend', 'rest', 2, ['rest design', 'api design', 'restful design']],
  ['api_calls', 'Calling APIs', 'backend', 'rest', 2, ['calling apis', 'calling an api', 'api integration', 'consuming apis']],
  ['git', 'Git', 'tools', null, 2, ['git', 'version control', 'github']],
  ['git_branching', 'Git branching and pull requests', 'tools', 'git', 1, ['git branching', 'branches', 'pull requests', 'merge conflicts']],
  // ── Data: SQL ──────────────────────────────────────────────────────────────
  ['sql', 'SQL', 'data', null, 6, ['sql', 'database', 'databases', 'sql basics', 'dbms']],
  ['sql_select', 'SQL SELECT queries', 'data', 'sql', 1, ['sql queries', 'select queries', 'select statement', 'sql select', 'queries']],
  ['sql_filtering', 'Filtering and sorting in SQL', 'data', 'sql', 1, ['where clause', 'sql filtering', 'order by', 'filtering rows']],
  ['sql_joins', 'SQL joins', 'data', 'sql', 2, ['joins', 'sql joins', 'left join', 'inner join', 'joins in sql', 'tables kalapadam']],
  ['sql_aggregation', 'SQL aggregation', 'data', 'sql', 2, ['aggregation', 'group by', 'sql aggregation', 'count sum avg', 'aggregate functions']],
  ['sql_subqueries', 'SQL subqueries and CTEs', 'data', 'sql', 2, ['subqueries', 'cte', 'with clause', 'nested queries']],
  ['sql_modelling', 'Data modelling', 'data', 'sql', 3, ['data modelling', 'data modeling', 'schema design', 'normalisation', 'normalization']],
  // ── Data: Python ───────────────────────────────────────────────────────────
  ['python', 'Python', 'data', null, 10, ['python', 'python programming', 'py']],
  ['py_variables_types', 'Python variables and data types', 'data', 'python', 1, ['variables and data types', 'variables data types', 'python variables', 'python data types']],
  ['py_conditionals', 'Python conditionals', 'data', 'python', 1, ['conditionals', 'if else', 'python conditionals', 'if statements']],
  ['py_loops', 'Python loops', 'data', 'python', 2, ['loops', 'python loops', 'for loops', 'while loops', 'loop chalana']],
  ['py_functions', 'Python functions', 'data', 'python', 2, ['function definitions', 'python functions', 'functions in python', 'def']],
  ['py_collections', 'Python lists, dicts and sets', 'data', 'python', 2, ['lists and dictionaries', 'python lists', 'dictionaries', 'python collections', 'tuples']],
  ['py_files', 'Python file handling', 'data', 'python', 1, ['file handling', 'file io', 'reading files', 'python files']],
  ['py_modules', 'Python modules and packages', 'data', 'python', 1, ['modules and imports', 'python modules', 'imports', 'pip packages']],
  ['pandas', 'pandas', 'data', null, 8, ['pandas', 'dataframes', 'data analysis with python']],
  ['pandas_loading', 'Loading data with pandas', 'data', 'pandas', 1, ['loading data', 'read csv', 'pandas loading', 'importing data']],
  ['pandas_cleaning', 'Cleaning data with pandas', 'data', 'pandas', 3, ['pandas cleaning', 'data cleaning', 'missing values', 'cleaning data']],
  ['pandas_groupby', 'Grouping and aggregating in pandas', 'data', 'pandas', 2, ['groupby', 'pandas groupby', 'pivot tables', 'pandas aggregation']],
  ['pandas_merging', 'Merging data in pandas', 'data', 'pandas', 2, ['merging dataframes', 'pandas merge', 'pandas join', 'concat']],
  ['reporting', 'Reporting and charts', 'data', null, 4, ['reporting', 'charts', 'data visualisation', 'data visualization', 'dashboards', 'matplotlib']],
  ['statistics', 'Statistics basics', 'data', null, 6, ['statistics', 'statistics basics', 'probability', 'descriptive statistics']],
  ['excel', 'Excel and spreadsheets', 'data', null, 4, ['excel', 'spreadsheets', 'spreadsheet', 'ms excel', 'google sheets']],
  ['pipelines', 'Data pipelines', 'data', null, 8, ['data pipelines', 'pipelines', 'etl', 'pipeline']],
  ['dsa', 'Data structures', 'cs', null, 12, ['data structures', 'dsa', 'data structures and algorithms']],
  ['dsa_arrays', 'Arrays and lists', 'cs', 'dsa', 3, ['arrays and lists', 'arrays', 'linked list', 'linked lists']],
  ['dsa_sorting', 'Sorting and searching', 'cs', 'dsa', 3, ['sorting', 'searching', 'binary search', 'sorting algorithms']],
  ['java', 'Java', 'cs', null, 14, ['java', 'core java']],
  // ── AI ─────────────────────────────────────────────────────────────────────
  ['llm_api', 'Calling an LLM API', 'ai', null, 3, ['calling an llm api', 'llm api', 'llm', 'openai api', 'gemini api']],
  ['prompting', 'Prompt design and structured output', 'ai', null, 4, ['prompt design', 'prompting', 'prompt engineering', 'structured output']],
  ['retrieval', 'Retrieval over documents', 'ai', null, 6, ['retrieval', 'rag', 'embeddings', 'retrieval augmented generation', 'vector search']],
  ['ai_eval', 'Testing AI answers', 'ai', null, 4, ['testing ai answers', 'ai evaluation', 'llm evaluation', 'evals']],
  ['ai_tools', 'AI coding assistants', 'ai', null, 2, ['ai coding assistants', 'ai coding', 'copilot', 'ai assistant']],
  // ── Infra and other ────────────────────────────────────────────────────────
  ['cloud', 'Cloud basics', 'infra', null, 8, ['cloud', 'cloud basics', 'aws', 'azure', 'gcp', 'cloud computing']],
  ['linux', 'Linux command line', 'infra', null, 4, ['linux', 'command line', 'shell', 'bash', 'linux command line']],
  ['networking', 'Networking basics', 'infra', null, 5, ['networking', 'networking basics', 'tcp ip', 'http basics']],
  ['docker', 'Docker', 'infra', null, 5, ['docker', 'containers', 'containerisation', 'containerization']],
  ['deploy', 'Deployment basics', 'infra', null, 3, ['deployment', 'deploy', 'hosting', 'ci cd', 'deployment basics']],
  ['ev_basics', 'Battery and EV basics', 'energy', null, 12, ['battery and ev basics', 'ev basics', 'battery', 'electric vehicles']],
  ['low_code', 'Low-code automation', 'business', null, 5, ['low code automation', 'low code', 'automation', 'power automate', 'zapier']],
  // ── Rarely demanded (kept so curriculum-vs-market can name them) ──────────
  ['jquery', 'jQuery', 'web', null, 2, ['jquery']],
  ['php', 'PHP basics', 'web', null, 4, ['php', 'php basics']],
  ['bootstrap', 'Bootstrap theming', 'web', null, 2, ['bootstrap', 'bootstrap theming']],
  ['flash', 'Flash / ActionScript', 'web', null, 2, ['flash', 'actionscript']],
  ['vb', 'Visual Basic', 'cs', null, 4, ['visual basic', 'vb net', 'vb6']]
];

/** [skill, prerequisite] — a DAG; validated acyclic on write. */
export const SEED_PREREQS = [
  ['css_box_model', 'html_semantics'], ['css_flexbox_grid', 'css_box_model'], ['responsive_design', 'css_flexbox_grid'],
  ['js_functions_scope', 'js_variables_types'], ['js_arrays', 'js_functions_scope'], ['js_dom_events', 'js_functions_scope'],
  ['js_dom_events', 'html_semantics'], ['js_async', 'js_functions_scope'],
  ['react', 'javascript'], ['react_state_props', 'react_components'], ['react_hooks', 'react_state_props'], ['react_forms', 'react_hooks'],
  ['typescript', 'javascript'], ['node', 'javascript'], ['express_routes', 'node_basics'], ['rest_design', 'express_routes'],
  ['api_calls', 'js_async'], ['sql_filtering', 'sql_select'], ['sql_joins', 'sql_select'], ['sql_aggregation', 'sql_filtering'],
  ['sql_subqueries', 'sql_aggregation'], ['sql_modelling', 'sql_joins'],
  ['py_conditionals', 'py_variables_types'], ['py_loops', 'py_conditionals'], ['py_functions', 'py_loops'],
  ['py_collections', 'py_loops'], ['py_files', 'py_functions'], ['py_modules', 'py_functions'],
  ['pandas', 'python'], ['pandas_cleaning', 'pandas_loading'], ['pandas_groupby', 'pandas_cleaning'], ['pandas_merging', 'pandas_cleaning'],
  ['reporting', 'pandas'], ['pipelines', 'sql'], ['pipelines', 'python'], ['dsa_sorting', 'dsa_arrays'],
  ['prompting', 'llm_api'], ['retrieval', 'prompting'], ['ai_eval', 'prompting'], ['docker', 'linux'], ['deploy', 'git']
];
