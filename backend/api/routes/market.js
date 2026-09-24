// api/routes/market.js — Learner Career pages (job market, JD gap, topics)
// All routes require a learner token. Market figures come from
// core/market/sampleMarket.js and every response carries `sample: true`
// until a real job feed replaces it. Gap scoring is live: it reads the
// learner's own skill nodes, mastery and self-declared skills.
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../../db/init');
const { authenticateToken, requireRole } = require('../middleware/auth');
const market = require('../../core/market/sampleMarket');
const { getLearnerSkillState, classifySkill, scoreJob } = require('../../core/market/skillGap');
const { explainJobAloud, explainTopicAloud, interviewTurn } = require('../../core/portfolio');

const router = express.Router();
router.use(authenticateToken);
router.use(requireRole('learner'));

const META = { sample: true, source: market.SOURCE_LABEL, updated_at: market.UPDATED_AT };
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function withState(req, fn) {
  const db = getDb();
  try {
    const state = getLearnerSkillState(db, req.user);
    const saved = db.prepare('SELECT job_id, status FROM learner_jobs WHERE learner_id = ?').all(req.user.id);
    return fn({ db, state, saved: new Map(saved.map(r => [r.job_id, r.status])) });
  } finally {
    db.close();
  }
}

function jobCard(job, state, saved) {
  const score = scoreJob(job, state);
  return {
    id: job.id, title: job.title, company: job.company, company_type: job.company_type,
    city: job.city, mode: job.mode, salary_min: job.salary_min, salary_max: job.salary_max,
    experience: job.experience, posted_days_ago: job.posted_days_ago,
    match: score.match, covered: score.covered, total: score.total, gap_hours: score.gap_hours,
    skills: score.skills.map(x => ({ name: x.name, status: x.status, required: x.required })),
    saved_status: saved.get(job.id) || null
  };
}

// ─── GET /market/jobs — filtered, scored job list ──────────────────────────────
// Query: q, city, mode, min_salary (LPA), min_match (0–100), tab (all|saved|applied), sort (match|recent|salary)
router.get('/jobs', (req, res) => {
  const { q = '', city = '', mode = '', tab = 'all', sort = 'match' } = req.query;
  const minSalary = parseFloat(req.query.min_salary) || 0;
  const minMatch = parseInt(req.query.min_match, 10) || 0;

  withState(req, ({ state, saved }) => {
    const needle = q.trim().toLowerCase();
    let cards = market.JOBS
      .filter(j => !city || j.city === city)
      .filter(j => !mode || j.mode === mode)
      .filter(j => j.salary_max >= minSalary)
      .filter(j => !needle || j.title.toLowerCase().includes(needle) || j.skills.some(s => s.name.toLowerCase().includes(needle)))
      .map(j => jobCard(j, state, saved));

    const counts = {
      all: cards.filter(c => c.match >= minMatch).length,
      saved: cards.filter(c => c.saved_status).length,
      applied: cards.filter(c => c.saved_status === 'applied').length
    };

    if (tab === 'saved') cards = cards.filter(c => c.saved_status);
    else if (tab === 'applied') cards = cards.filter(c => c.saved_status === 'applied');
    else cards = cards.filter(c => c.match >= minMatch);

    const sorters = {
      match: (a, b) => b.match - a.match,
      recent: (a, b) => a.posted_days_ago - b.posted_days_ago,
      salary: (a, b) => b.salary_max - a.salary_max
    };
    cards.sort(sorters[sort] || sorters.match);

    res.json({
      ...META,
      filters: {
        cities: Object.keys(market.MONTHLY_DEMAND).filter(c => c !== 'all'),
        modes: ['On-site', 'Hybrid', 'Remote']
      },
      counts,
      jobs: cards
    });
  });
});

// ─── GET /market/trends — headline numbers, monthly demand, top skills ─────────
router.get('/trends', (req, res) => {
  const city = req.query.city && market.MONTHLY_DEMAND[req.query.city] ? req.query.city : 'all';
  withState(req, ({ state, saved }) => {
    const series = market.MONTHLY_DEMAND[city];
    const months = Object.keys(series).sort().slice(-6).map(key => ({
      month: key, label: MONTH_NAMES[parseInt(key.slice(5), 10) - 1], count: series[key]
    }));
    const last = months[months.length - 1];
    const prev = months[months.length - 2];

    const skills = market.SKILL_SHARE.map(([key, pct]) => {
      const skill = { key, ...market.SKILLS[key] };
      const c = classifySkill(skill, state);
      return { key, name: skill.name, pct, status: c.status };
    });

    const best = market.JOBS
      .filter(j => city === 'all' || j.city === city)
      .map(j => jobCard(j, state, saved))
      .sort((a, b) => b.match - a.match)[0];

    res.json({
      ...META,
      city,
      months,
      skills,
      kpis: {
        open_roles: last.count,
        open_roles_change: prev ? last.count - prev.count : 0,
        median_salary_lpa: market.MEDIAN_SALARY_LPA,
        fastest_growing_role: market.FASTEST_GROWING_ROLE,
        best_match: best ? { id: best.id, title: best.title, match: best.match } : null
      }
    });
  });
});

// ─── GET /market/jobs/:id — full JD + skill gap ────────────────────────────────
function findJob(req, res) {
  const job = market.JOBS.find(j => j.id === req.params.id);
  if (!job) res.status(404).json({ error: 'Job not found' });
  return job;
}

router.get('/jobs/:id', (req, res) => {
  const job = findJob(req, res);
  if (!job) return;
  withState(req, ({ state, saved }) => {
    const gap = scoreJob(job, state);
    res.json({
      ...META,
      job: {
        id: job.id, title: job.title, company: job.company, company_type: job.company_type,
        city: job.city, mode: job.mode, salary_min: job.salary_min, salary_max: job.salary_max,
        experience: job.experience, posted_days_ago: job.posted_days_ago,
        about: job.about, responsibilities: job.responsibilities,
        requirements: job.skills.map(s => (s.required ? s.name : `Nice to have: ${s.name}`)),
        saved_status: saved.get(job.id) || null
      },
      gap
    });
  });
});

router.get('/jobs/:id/gap', (req, res) => {
  const job = findJob(req, res);
  if (!job) return;
  withState(req, ({ state }) => res.json({ ...META, job_id: job.id, gap: scoreJob(job, state) }));
});

// ─── Read the JD aloud in the learner's language ─────────────────────────────
// Cached per job + language: the JD does not change and this is read often.
const readAloudCache = new Map();
router.post('/jobs/:id/read-aloud', async (req, res) => {
  const job = findJob(req, res);
  if (!job) return;
  const key = `${job.id}:${req.user.language}`;
  try {
    if (!readAloudCache.has(key)) readAloudCache.set(key, await explainJobAloud({ job, language: req.user.language }));
    res.json({ job_id: job.id, language: req.user.language, ...readAloudCache.get(key) });
  } catch (err) {
    res.status(502).json({ error: 'Could not prepare the reading', detail: err.message });
  }
});

// ─── Practise an interview by voice ────────────────────────────────────────────
// Body: { turns: [{ role: 'interviewer' | 'candidate', text }] }. Stateless and
// not stored — practice answers are not evidence of mastery.
router.post('/jobs/:id/interview', async (req, res) => {
  const job = findJob(req, res);
  if (!job) return;
  const turns = Array.isArray(req.body.turns)
    ? req.body.turns.slice(-20).map(x => ({ role: x.role === 'interviewer' ? 'interviewer' : 'candidate', text: String(x.text || '').slice(0, 2000) }))
    : [];
  const db = getDb();
  const verified = db.prepare(`
    SELECT sn.node_label FROM node_mastery nm JOIN skill_nodes sn ON sn.id = nm.skill_node_id
    WHERE nm.engagement_learner_id = ? AND nm.advanced_at IS NOT NULL
  `).all(req.user.el_id).map(r => r.node_label);
  db.close();
  try {
    res.json(await interviewTurn({ job, language: req.user.language, turns, verifiedSkills: verified }));
  } catch (err) {
    res.status(502).json({ error: 'The interviewer is unavailable right now', detail: err.message });
  }
});

// ─── Save / applied ────────────────────────────────────────────────────────────
function setJobStatus(req, res, status) {
  const job = findJob(req, res);
  if (!job) return;
  const db = getDb();
  db.prepare(`
    INSERT INTO learner_jobs (id, learner_id, job_id, status) VALUES (?, ?, ?, ?)
    ON CONFLICT(learner_id, job_id) DO UPDATE SET status = excluded.status
  `).run(uuidv4(), req.user.id, job.id, status);
  db.close();
  res.json({ job_id: job.id, saved_status: status });
}

router.post('/jobs/:id/save', (req, res) => setJobStatus(req, res, 'saved'));
router.post('/jobs/:id/applied', (req, res) => setJobStatus(req, res, 'applied'));
router.delete('/jobs/:id/save', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM learner_jobs WHERE learner_id = ? AND job_id = ?').run(req.user.id, req.params.id);
  db.close();
  res.json({ job_id: req.params.id, saved_status: null });
});

// ─── GET /market/topics — emerging topics, filtered by sector ─────────────────
function topicView(topic, state) {
  const steps = topic.steps.map((skill, i) => {
    const c = classifySkill(skill, state);
    return { n: i + 1, key: skill.key, name: skill.name, hours: skill.hours, status: c.status };
  });
  const have = steps.filter(s => s.status === 'mastered' || s.status === 'declared').length;
  return {
    id: topic.id, sector: topic.sector, name: topic.name, growth: topic.growth, desc: topic.desc,
    roles: topic.roles, steps, have_pct: Math.round((have / steps.length) * 100)
  };
}

router.get('/topics', (req, res) => {
  const sector = req.query.sector || '';
  withState(req, ({ state }) => {
    const all = market.TOPICS.map(t => ({ ...topicView(t, state), featured: !!t.featured }));
    const inSector = all.filter(t => !sector || t.sector === sector);
    const featured = inSector.find(t => t.featured) || inSector[0] || null;
    res.json({
      ...META,
      sectors: market.SECTORS,
      featured,
      topics: inSector.filter(t => !featured || t.id !== featured.id)
    });
  });
});

// ─── POST /market/topics/:id/intro — spoken intro in the learner's language ──
router.post('/topics/:id/intro', async (req, res) => {
  const topic = market.TOPICS.find(t => t.id === req.params.id);
  if (!topic) return res.status(404).json({ error: 'Topic not found' });
  const key = `topic:${topic.id}:${req.user.language}`;
  try {
    if (!readAloudCache.has(key)) readAloudCache.set(key, await explainTopicAloud({ topic, language: req.user.language }));
    res.json({ topic_id: topic.id, language: req.user.language, ...readAloudCache.get(key) });
  } catch (err) {
    res.status(502).json({ error: 'Could not prepare the intro', detail: err.message });
  }
});

// ─── GET /market/snapshot — the three career cards on the home dashboard ──────
router.get('/snapshot', (req, res) => {
  withState(req, ({ state, saved }) => {
    const jobs = market.JOBS.map(j => jobCard(j, state, saved)).sort((a, b) => b.match - a.match).slice(0, 3)
      .map(j => ({ ...j, missing: j.skills.filter(s => s.required && (s.status === 'not_in_path' || s.status === 'requested')).map(s => s.name) }));
    const skills = market.SKILL_SHARE
      .map(([key, pct]) => ({ key, name: market.SKILLS[key].name, pct, status: classifySkill({ key, ...market.SKILLS[key] }, state).status }))
      .sort((a, b) => (a.status === 'mastered') - (b.status === 'mastered') || b.pct - a.pct)
      .slice(0, 5);
    const topics = market.TOPICS.slice(0, 3).map(t => ({ id: t.id, name: t.name, growth: t.growth, roles: t.roles }));
    res.json({ ...META, jobs, skills, topics });
  });
});

module.exports = router;
