// Job market search (FEATURE_LEARNER_JOBS): typos, short forms and spellings
// find what the learner means; related roles when few match; topics to add;
// outbound links carry only the role and city.
import { describe, it, expect } from 'vitest';
import { JOBS } from '../../core/market/sampleMarket.js';
import { matchesJob, relatedRoles, topicsFor, outboundLinks } from '../../core/market/search.js';

const titles = (q) => [...new Set(JOBS.filter(j => matchesJob(j, q)).map(j => j.title))];
const COURSES = ['python', 'java', 'sql', 'javascript', 'react', 'web', 'data-analysis', 'ai-basics', 'dsa', 'c'];

describe('tolerant job search: five sample searches', () => {
  it('"frntend devloper" (typos) finds the frontend role', () => {
    expect(titles('frntend devloper')).toContain('Junior Frontend Developer');
    expect(topicsFor('frntend devloper', COURSES)).toEqual(expect.arrayContaining(['javascript', 'react']));
  });
  it('"front end" and "reactjs fresher" (spellings and short forms) find frontend roles', () => {
    expect(titles('front end')).toContain('Junior Frontend Developer');
    expect(titles('reactjs fresher')).toEqual(expect.arrayContaining(['Junior Frontend Developer', 'UI Developer (Fresher)']));
  });
  it('"data analist" finds the data analyst role and suggests Python, SQL and Data analysis', () => {
    expect(titles('data analist')).toContain('Junior Data Analyst');
    expect(topicsFor('data analist', COURSES)).toEqual(expect.arrayContaining(['python', 'sql', 'data-analysis']));
  });
  it('"pyhton" (swapped letters) finds Python roles; "java developer" does not match JavaScript jobs', () => {
    expect(titles('pyhton')).toContain('Python Developer Trainee');
    expect(titles('java developer')).toEqual(['Associate Software Engineer']);
  });
  it('"machine learning" has no exact role, so related roles are offered', () => {
    expect(titles('machine learning')).toEqual([]);
    const related = relatedRoles(JOBS, 'machine learning').map(r => r.title);
    expect(related).toContain('LLM Application Developer (Junior)');
    expect(topicsFor('machine learning', COURSES)).toContain('ai-basics');
  });
  it('nonsense finds nothing and suggests nothing', () => {
    expect(titles('xyzzy')).toEqual([]);
    expect(relatedRoles(JOBS, 'xyzzy')).toEqual([]);
  });
});

describe('outbound job-site links', () => {
  const links = outboundLinks('Frontend developer', 'Hyderabad');
  it('go to Naukri, LinkedIn and Indeed with the role and city only', () => {
    expect(links.map(l => l.site)).toEqual(['Naukri', 'LinkedIn', 'Indeed']);
    expect(links[0].url).toBe('https://www.naukri.com/frontend-developer-jobs-in-hyderabad');
    expect(links[1].url).toBe('https://www.linkedin.com/jobs/search/?keywords=Frontend+developer&location=Hyderabad');
    expect(links[2].url).toBe('https://in.indeed.com/jobs?q=Frontend+developer&l=Hyderabad');
  });
  it('carry no tracking parameters or personal data', () => {
    for (const { url } of links) {
      const u = new URL(url);
      expect(u.protocol).toBe('https:');
      expect([...u.searchParams.keys()].every(k => ['keywords', 'location', 'q', 'l'].includes(k))).toBe(true);
      expect(url).not.toMatch(/utm_|ref=|src=|email|phone|learner/i);
    }
  });
  it('without a city, leave the location out; without a role, give no links', () => {
    expect(outboundLinks('sql', '')[2].url).toBe('https://in.indeed.com/jobs?q=sql');
    expect(outboundLinks('', 'Hyderabad')).toEqual([]);
  });
});
