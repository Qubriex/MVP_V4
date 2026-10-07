// api/routes/portfolio.js — Learner profile, resume, skill requests, speech-to-text
// Mounted at /api/learner alongside learner.js. All learner-private except
// skill_requests, which the institution reads to decide on its pathway.
import express from 'express';
import { notify } from '../../core/notify.js';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { legacyHandle as getDb } from '../../core/db/dal.js';
import { authenticateToken, requireRole, requireActiveLearner } from '../middleware/auth.js';
import { parseJSON } from '../../core/market/skillGap.js';
import * as market from '../../core/market/sampleMarket.js';
import * as portfolio from '../../core/portfolio.js';
import { eachSeq } from '../../core/util/seq.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.use(authenticateToken);
router.use(requireRole('learner'));
router.use(requireActiveLearner);

const DEFAULT_VOICE_PREFS = { voice: 'A', rate: 1, startInVoice: true, showEnglishCaptions: true, dailyReminder: false };
const RESUME_SECTIONS = ['summary', 'skills', 'projects', 'education', 'experience', 'certifications', 'capability_record'];
const DEFAULT_SECTIONS = RESUME_SECTIONS.map(key => ({ key, on: !['experience', 'certifications'].includes(key) }));

// ─── Shared reads ──────────────────────────────────────────────────────────────
async function loadProfile(db, user) {
  const learner = await db.prepare(`
    SELECT l.id, l.name, l.email, l.learner_ref, l.language, l.profile_type,
           e.title as engagement_title, i.name as institution_name
    FROM learners l
    JOIN engagement_learners el ON el.learner_id = l.id
    JOIN engagements e ON e.id = el.engagement_id
    JOIN institutions i ON i.id = l.institution_id
    WHERE l.id = ? AND el.id = ?
  `).get(user.id, user.el_id);
  if (!learner) return null;

  const p = await db.prepare('SELECT * FROM learner_profiles WHERE learner_id = ?').get(user.id) || {};
  const education = await db.prepare('SELECT * FROM learner_education WHERE learner_id = ? ORDER BY sequence_order').all(user.id);
  const projects = (await db.prepare('SELECT * FROM learner_projects WHERE learner_id = ? ORDER BY sequence_order').all(user.id))
    .map(x => ({ ...x, tools: parseJSON(x.tools, []) }));
  const nodes = await db.prepare(`
    SELECT sn.node_label, sc.cluster_label, nm.advanced_at, sn.id = el.current_node_id as is_current
    FROM skill_nodes sn
    JOIN skill_clusters sc ON sc.id = sn.cluster_id
    JOIN engagement_learners el ON el.id = ?
    LEFT JOIN node_mastery nm ON nm.skill_node_id = sn.id AND nm.engagement_learner_id = el.id
    WHERE sc.capability_target_id = (SELECT capability_target_id FROM engagements WHERE id = ?)
    ORDER BY sc.sequence_order, sn.sequence_order
  `).all(user.el_id, user.engagement_id);
  const clusters = [...new Set(nodes.map(n => n.cluster_label))];
  const clustersDone = clusters.filter(c => nodes.filter(n => n.cluster_label === c).every(n => n.advanced_at));

  const profile = {
    ...learner,
    has_profile: !!p.learner_id,   // false until the first save — drives the first-run /learn/welcome flow
    phone: p.phone || '', city: p.city || '', link_url: p.link_url || '', headline: p.headline || '', about: p.about || '',
    target_roles: parseJSON(p.target_roles, []), preferred_cities: parseJSON(p.preferred_cities, []),
    available_from: p.available_from || '', graduation_year: p.graduation_year ?? null, expected_salary: p.expected_salary || '',
    self_skills: parseJSON(p.self_skills, []), experience: parseJSON(p.experience, []), certifications: parseJSON(p.certifications, []),
    ui_language: p.ui_language || learner.language,
    voice_prefs: { ...DEFAULT_VOICE_PREFS, ...parseJSON(p.voice_prefs, {}) },
    share_with_institution: !!p.share_with_institution,
    education, projects,
    verified_skills: nodes.filter(n => n.advanced_at).map(n => n.node_label),
    learning_skills: nodes.filter(n => !n.advanced_at).slice(0, 4).map(n => n.node_label),
    record: { nodes_mastered: nodes.filter(n => n.advanced_at).length, total_nodes: nodes.length, clusters_done: clustersDone }
  };
  profile.completeness = completeness(profile);
  return profile;
}

// Six sections, equal weight. The dashboard nudge and profile header read this.
function completeness(p) {
  const sections = {
    personal: !!(p.email && p.city && p.about),
    education: p.education.length > 0,
    projects: p.projects.length > 0,
    skills: p.verified_skills.length + p.self_skills.length > 0,
    goals: p.target_roles.length > 0,
    preferences: true
  };
  const done = Object.values(sections).filter(Boolean).length;
  const missing = Object.keys(sections).filter(k => !sections[k]);
  return { pct: Math.round((done / 6) * 100), sections, missing };
}

// ─── Profile ───────────────────────────────────────────────────────────────────
router.get('/profile', async (req, res) => {
  const db = getDb();
  const profile = await loadProfile(db, req.user);
  db.close();
  if (!profile) return res.status(404).json({ error: 'Not found' });
  res.json(profile);
});

const clean = (v, max = 2000) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const cleanList = (v, max = 30) => (Array.isArray(v) ? v.map(x => clean(String(x), 120)).filter(Boolean).slice(0, max) : []);

// Replace-all semantics for education and projects: the client sends the whole list.
router.put('/profile', async (req, res) => {
  const b = req.body || {};
  if (b.ui_language && !['telugu', 'hindi', 'english'].includes(b.ui_language)) {
    return res.status(400).json({ error: 'ui_language must be telugu, hindi or english' });
  }
  const db = getDb();
  const current = await loadProfile(db, req.user);
  if (!current) { db.close(); return res.status(404).json({ error: 'Not found' }); }
  const pick = (key, fn, fallback) => (key in b ? fn(b[key]) : fallback);
  const gradYear = pick('graduation_year', v => { const y = Number(v); return Number.isInteger(y) && y >= 1990 && y <= 2100 ? y : null; }, current.graduation_year ?? null);

  const write = db.transaction(async () => {
    if ('email' in b) await db.prepare('UPDATE learners SET email = ? WHERE id = ?').run(clean(b.email, 200) || null, req.user.id);
    if (gradYear) await db.prepare('UPDATE learners SET availability = ? WHERE id = ?').run(`${gradYear}-06`, req.user.id);
    await db.prepare(`
      INSERT INTO learner_profiles (learner_id, phone, city, link_url, headline, about, target_roles, preferred_cities,
        available_from, graduation_year, expected_salary, self_skills, experience, certifications, ui_language, voice_prefs, share_with_institution, updated_at)
      VALUES (@learner_id, @phone, @city, @link_url, @headline, @about, @target_roles, @preferred_cities,
        @available_from, @graduation_year, @expected_salary, @self_skills, @experience, @certifications, @ui_language, @voice_prefs, @share_with_institution, datetime('now'))
      ON CONFLICT(learner_id) DO UPDATE SET
        phone = excluded.phone, city = excluded.city, link_url = excluded.link_url, headline = excluded.headline,
        about = excluded.about, target_roles = excluded.target_roles, preferred_cities = excluded.preferred_cities,
        available_from = excluded.available_from, graduation_year = excluded.graduation_year, expected_salary = excluded.expected_salary,
        self_skills = excluded.self_skills, experience = excluded.experience, certifications = excluded.certifications,
        ui_language = excluded.ui_language, voice_prefs = excluded.voice_prefs,
        share_with_institution = excluded.share_with_institution, updated_at = datetime('now')
    `).run({
      learner_id: req.user.id,
      phone: pick('phone', v => clean(v, 40), current.phone),
      city: pick('city', v => clean(v, 80), current.city),
      link_url: pick('link_url', v => clean(v, 300), current.link_url),
      headline: pick('headline', v => clean(v, 160), current.headline),
      about: pick('about', v => clean(v, 1500), current.about),
      target_roles: JSON.stringify(pick('target_roles', cleanList, current.target_roles)),
      preferred_cities: JSON.stringify(pick('preferred_cities', cleanList, current.preferred_cities)),
      // Graduation year replaces "Available from": availability is set from it
      // (June of that year), which employers' candidate cards read.
      graduation_year: gradYear,
      available_from: gradYear ? `June ${gradYear}` : pick('available_from', v => clean(v, 40), current.available_from),
      expected_salary: pick('expected_salary', v => clean(v, 40), current.expected_salary),
      self_skills: JSON.stringify(pick('self_skills', cleanList, current.self_skills)),
      experience: JSON.stringify(pick('experience', v => (Array.isArray(v) ? v.slice(0, 20) : []), current.experience)),
      certifications: JSON.stringify(pick('certifications', v => (Array.isArray(v) ? v.slice(0, 20) : []), current.certifications)),
      ui_language: b.ui_language || current.ui_language,
      voice_prefs: JSON.stringify({ ...current.voice_prefs, ...(b.voice_prefs || {}) }),
      // Opt-in: lets the institution's "closest to job-ready" list include this learner.
      share_with_institution: ('share_with_institution' in b ? !!b.share_with_institution : current.share_with_institution) ? 1 : 0
    });

    if (Array.isArray(b.education)) {
      await db.prepare('DELETE FROM learner_education WHERE learner_id = ?').run(req.user.id);
      const ins = db.prepare(`INSERT INTO learner_education (id, learner_id, degree, institution_name, city, start_year, end_year, grade, sequence_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      await eachSeq(b.education.filter(e => clean(e.degree)).slice(0, 10), async (e, i) =>
        await ins.run(uuidv4(), req.user.id, clean(e.degree, 160), clean(e.institution_name, 160), clean(e.city, 80),
          clean(e.start_year, 10), clean(e.end_year, 10), clean(e.grade, 40), i));
    }
    if (Array.isArray(b.projects)) {
      await db.prepare('DELETE FROM learner_projects WHERE learner_id = ?').run(req.user.id);
      const ins = db.prepare(`INSERT INTO learner_projects (id, learner_id, title, description, tools, link_url, sequence_order)
        VALUES (?, ?, ?, ?, ?, ?, ?)`);
      await eachSeq(b.projects.filter(p => clean(p.title)).slice(0, 20), async (p, i) =>
        await ins.run(uuidv4(), req.user.id, clean(p.title, 160), clean(p.description, 1000), JSON.stringify(cleanList(p.tools, 15)), clean(p.link_url, 300), i));
    }
  });
  await write();
  const updated = await loadProfile(db, req.user);
  db.close();
  res.json(updated);
});

// ─── Speech → English summary ("say it in Telugu, we'll write it in English") ─
router.post('/profile/summary-from-speech', async (req, res) => {
  const transcript = clean(req.body && req.body.transcript, 4000);
  if (!transcript) return res.status(400).json({ error: 'transcript required' });
  const db = getDb();
  const profile = await loadProfile(db, req.user);
  db.close();
  try {
    const summary = await portfolio.summaryFromSpeech({
      transcript, language: req.user.language, name: profile.name,
      verifiedSkills: profile.verified_skills, targetRoles: profile.target_roles
    });
    res.json({ summary, transcript });
  } catch (err) {
    res.status(502).json({ error: 'Could not write the summary', detail: err.message });
  }
});

// ─── Speech-to-text (fallback when the browser has no on-device recognition) ─
router.post('/transcribe', upload.single('audio'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'audio file required (multipart field "audio")' });
  try {
    const transcript = await portfolio.transcribeAudio({
      audioBase64: req.file.buffer.toString('base64'),
      mimeType: req.file.mimetype || 'audio/webm',
      language: req.body.language || req.user.language
    });
    res.json({ transcript });
  } catch (err) {
    res.status(502).json({ error: 'Transcription failed', detail: err.message });
  }
});

// ─── Resume ────────────────────────────────────────────────────────────────────
// Keep the client's order, drop unknown or repeated keys, and append any
// section the list left out (with its default on/off) so none goes missing.
function normalizeSections(list) {
  const seen = new Set();
  const kept = (Array.isArray(list) ? list : [])
    .filter(x => x && RESUME_SECTIONS.includes(x.key) && !seen.has(x.key) && seen.add(x.key))
    .map(x => ({ key: x.key, on: !!x.on }));
  return [...kept, ...DEFAULT_SECTIONS.filter(d => !seen.has(d.key))];
}

function resumeRow(row) {
  if (!row) return null;
  return { ...row, sections: normalizeSections(parseJSON(row.sections, DEFAULT_SECTIONS)), skill_order: parseJSON(row.skill_order, null) };
}

router.get('/resume', async (req, res) => {
  const db = getDb();
  const profile = await loadProfile(db, req.user);
  const latest = resumeRow(await db.prepare('SELECT * FROM resume_versions WHERE learner_id = ? ORDER BY version DESC LIMIT 1').get(req.user.id));
  const versions = await db.prepare('SELECT version, template, tailored_job_id, created_at FROM resume_versions WHERE learner_id = ? ORDER BY version DESC').all(req.user.id);
  const saved = (await db.prepare('SELECT job_id FROM learner_jobs WHERE learner_id = ?').all(req.user.id)).map(r => r.job_id);
  db.close();
  res.json({
    profile,
    resume: latest || { version: 0, template: 'classic', sections: DEFAULT_SECTIONS, summary: profile.about, skill_order: null, tailored_job_id: null },
    versions,
    saved_jobs: market.JOBS.filter(j => saved.includes(j.id)).map(j => ({ id: j.id, title: j.title, company_type: j.company_type }))
  });
});

router.get('/resume/versions/:version', async (req, res) => {
  const db = getDb();
  const row = resumeRow(await db.prepare('SELECT * FROM resume_versions WHERE learner_id = ? AND version = ?').get(req.user.id, parseInt(req.params.version, 10)));
  db.close();
  if (!row) return res.status(404).json({ error: 'Version not found' });
  res.json(row);
});

router.post('/resume', async (req, res) => {
  const b = req.body || {};
  const template = ['classic', 'modern', 'compact'].includes(b.template) ? b.template : 'classic';
  const sections = normalizeSections(b.sections);
  const db = getDb();
  const next = ((await db.prepare('SELECT MAX(version) as v FROM resume_versions WHERE learner_id = ?').get(req.user.id)).v || 0) + 1;
  await db.prepare(`
    INSERT INTO resume_versions (id, learner_id, version, template, sections, summary, skill_order, tailored_job_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(uuidv4(), req.user.id, next, template, JSON.stringify(sections), clean(b.summary, 1500) || null,
    Array.isArray(b.skill_order) ? JSON.stringify(cleanList(b.skill_order, 60)) : null,
    market.JOBS.some(j => j.id === b.tailored_job_id) ? b.tailored_job_id : null);
  const row = resumeRow(await db.prepare('SELECT * FROM resume_versions WHERE learner_id = ? AND version = ?').get(req.user.id, next));
  db.close();
  res.status(201).json(row);
});

router.post('/resume/tailor', async (req, res) => {
  const job = market.JOBS.find(j => j.id === (req.body && req.body.job_id));
  if (!job) return res.status(404).json({ error: 'Job not found' });
  const db = getDb();
  const profile = await loadProfile(db, req.user);
  db.close();
  try {
    const tailored = await portfolio.tailorResume({
      job, about: profile.about,
      verifiedSkills: profile.verified_skills, learningSkills: profile.learning_skills, declaredSkills: profile.self_skills
    });
    res.json({ job_id: job.id, ...tailored });
  } catch (err) {
    res.status(502).json({ error: 'Could not tailor the resume', detail: err.message });
  }
});

// ─── Skill requests — ask the institution to add a skill to the pathway ───────
router.get('/skill-requests', async (req, res) => {
  const db = getDb();
  const rows = await db.prepare('SELECT id, skill_name, source, status, created_at FROM skill_requests WHERE engagement_learner_id = ? ORDER BY created_at DESC').all(req.user.el_id);
  db.close();
  res.json(rows);
});

router.post('/skill-requests', async (req, res) => {
  const skillName = clean(req.body && req.body.skill_name, 120);
  if (!skillName) return res.status(400).json({ error: 'skill_name required' });
  const db = getDb();
  const inserted = await db.prepare(`
    INSERT OR IGNORE INTO skill_requests (id, engagement_learner_id, engagement_id, skill_name, source)
    VALUES (?, ?, ?, ?, ?)
  `).run(uuidv4(), req.user.el_id, req.user.engagement_id, skillName, clean(req.body.source, 80) || null);
  const row = await db.prepare('SELECT id, skill_name, source, status, created_at FROM skill_requests WHERE engagement_learner_id = ? AND skill_name = ?').get(req.user.el_id, skillName);
  const e = await db.prepare('SELECT institution_id, title FROM engagements WHERE id = ?').get(req.user.engagement_id);
  db.close();
  if (e && inserted.changes) {
    await notify({ to: { type: 'institution', id: e.institution_id }, kind: 'skill_request', title: `A student in ${e.title} asked to add ${skillName}`, href: `/institution/cohorts/${req.user.engagement_id}` });
  }
  res.status(201).json(row);
});

export default router;
export { loadProfile };