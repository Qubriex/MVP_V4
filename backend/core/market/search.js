// core/market/search.js — tolerant job search for the learner job market
// (shown only with FEATURE_LEARNER_JOBS). "frntend devloper", "js", "front end",
// "reactjs" and "data analist" all find what a person means:
//   • short forms and spellings map to one word (js → javascript, front end → frontend)
//   • each word may be off by a letter or two (typos), scaled by word length
//   • every query word must match the job title or one of its skills
// When few jobs match, related roles are suggested (jobs that share skills
// with the query), with topics (courses) to learn for them and plain outbound
// search links (Naukri, LinkedIn, Indeed) built from the role and city only:
// no tracking parameters, no personal data.

const SYNONYMS = [
  [/\bfront[\s-]?end\b/g, 'frontend'], [/\bback[\s-]?end\b/g, 'backend'], [/\bfull[\s-]?stack\b/g, 'fullstack'],
  [/\bnode[\s.]?js\b/g, 'node'], [/\breact[\s.]?js\b/g, 'react'], [/\bjs\b/g, 'javascript'], [/\bts\b/g, 'typescript'],
  [/\bpy\b/g, 'python'], [/\bml\b|\bmachine learning\b|\bdeep learning\b|\bdata science\b/g, 'llm python'], [/\bai\b/g, 'llm'], [/\bgen ai\b/g, 'llm'],
  [/\bsde\b/g, 'software engineer'], [/\bswe\b/g, 'software engineer'], [/\bui\s*\/\s*ux\b/g, 'ui'],
  [/\bdevelopers?\b|\bdev\b|\bengineers?\b|\bprogrammers?\b/g, 'developer'],
  [/\bfreshers?\b|\btrainees?\b|\binterns?\b|\bjunior\b|\bassociate\b|\bentry level\b/g, ' '],
  [/\bjobs?\b|\broles?\b|\bvacanc(y|ies)\b|\bin\b|\bfor\b/g, ' '],
  [/\banalysts?\b/g, 'analyst'], [/\bexcel\b/g, 'spreadsheets']
];

export function normalise(text) {
  let s = ` ${String(text || '').toLowerCase().replace(/[^a-z0-9.+#/\s-]/g, ' ')} `;
  for (const [re, to] of SYNONYMS) s = s.replace(re, to);
  return s.replace(/[.\-/]/g, ' ').split(/\s+/).filter(w => w.length > 1 || /^[cr]$/.test(w));
}

function distance(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 3;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j += 1) d[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

// A query word matches a job word when equal, a prefix (3+ letters), or a small typo.
function wordMatches(q, w) {
  if (q === w) return true;
  if (q.length >= 3 && w.startsWith(q) && w.length - q.length <= 3) return true;
  const allowed = q.length >= 8 ? 2 : q.length >= 4 ? 1 : 0;
  return allowed > 0 && distance(q, w) <= allowed;
}

const jobWords = (job) => normalise([job.title, ...job.skills.map(s => s.name)].join(' '));

/** Does this job match the query? Every query word must match some word of the title or skills. */
export function matchesJob(job, query) {
  const q = normalise(query).filter(w => !wordMatches(w, 'developer'));
  if (!q.length) return true;
  const words = jobWords(job);
  return q.every(qw => words.some(w => wordMatches(qw, w)));
}

/** Jobs that share a word or skill with the query (job words like "developer" aside), for "Related roles". */
export function relatedRoles(jobs, query, exclude = new Set(), limit = 4) {
  const q = normalise(query).filter(w => !wordMatches(w, 'developer'));
  if (!q.length) return [];
  const scored = jobs.filter(j => !exclude.has(j.id)).map(j => {
    const words = jobWords(j);
    return { job: j, hits: q.filter(qw => words.some(w => wordMatches(qw, w))).length };
  }).filter(x => x.hits > 0).sort((a, b) => b.hits - a.hits);
  const seen = new Set();
  return scored.filter(x => !seen.has(x.job.title) && seen.add(x.job.title)).slice(0, limit)
    .map(x => ({ title: x.job.title, q: x.job.title.replace(/\s*\(.*\)\s*/, ' ').trim() }));
}

const COURSE_WORDS = { python: ['python', 'analyst', 'data', 'llm'], java: ['java', 'software', 'backend'], sql: ['sql', 'data', 'analyst', 'backend'], javascript: ['javascript', 'frontend', 'node', 'react', 'fullstack', 'ui'], react: ['react', 'frontend', 'ui'], web: ['html', 'css', 'frontend', 'ui'], 'data-analysis': ['analyst', 'data', 'statistics', 'spreadsheets'], 'ai-basics': ['llm', 'prompt', 'machine', 'learning'], dsa: ['software', 'developer'] };

/** Course ids to suggest for a query ("Add to my topics"), best first. */
export function topicsFor(query, courseIds) {
  const q = normalise(query);
  return courseIds.map(id => ({ id, hits: (COURSE_WORDS[id] || [id]).filter(cw => q.some(w => wordMatches(w, cw))).length }))
    .filter(x => x.hits > 0).sort((a, b) => b.hits - a.hits).map(x => x.id).slice(0, 3);
}

const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** Plain search links on job sites: role and city only, no tracking, no personal data. */
export function outboundLinks(query, city = '') {
  const role = String(query || '').trim().slice(0, 80);
  if (!role) return [];
  const where = String(city || '').trim().slice(0, 40);
  const qs = (o) => new URLSearchParams(Object.entries(o).filter(([, v]) => v)).toString();
  return [
    { site: 'Naukri', url: `https://www.naukri.com/${slug(role)}-jobs${where ? `-in-${slug(where)}` : ''}` },
    { site: 'LinkedIn', url: `https://www.linkedin.com/jobs/search/?${qs({ keywords: role, location: where })}` },
    { site: 'Indeed', url: `https://in.indeed.com/jobs?${qs({ q: role, l: where })}` }
  ];
}
