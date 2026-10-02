// Institution activity: live status, activity exports, per-student pathway,
// evidence report, curriculum upload, and the job-match fix in Where we stand.
import { describe, it, expect, beforeAll } from 'vitest';
import zlib from 'node:zlib';
import * as dal from '../../core/db/dal.js';
import { freshDb, makeApp, seedInstitution, seedPathway, login, PASSWORD } from '../helpers/setup.js';

let app; let A; let P; let admin; let prof;
const auth = (s) => ({ Authorization: `Bearer ${s.token}` });
const ago = (min) => new Date(Date.now() - min * 60000).toISOString();

beforeAll(async () => {
  await freshDb();
  app = await makeApp();
  A = await seedInstitution('ia');
  P = await seedPathway(A);
  // A second student who has never started.
  await dal.run(`INSERT INTO learners (id, institution_id, name, learner_ref, language) VALUES ('learner-ia2', ?, 'Second', 'REF-ia2', 'telugu')`, A.institutionId);
  await dal.run(`INSERT INTO engagement_learners (id, engagement_id, learner_id) VALUES ('el-ia2', ?, 'learner-ia2')`, A.engagementId);
  // The first student: mastered node 1 yesterday, now on node 2 with 3 loops, active 2 minutes ago.
  await dal.run(`INSERT INTO learning_sessions (id, engagement_learner_id, skill_node_id, language, status, started_at, completed_at, active_minutes, loop_count)
    VALUES ('s1', ?, ?, 'telugu', 'completed', ?, ?, 25, 1)`, A.elId, P.nodes[0], ago(1500), ago(1450));
  await dal.run(`INSERT INTO node_mastery (id, engagement_learner_id, skill_node_id, mastery_attainment, advanced_at, evidence_level) VALUES ('nm1', ?, ?, 0.8, ?, 'L2')`, A.elId, P.nodes[0], ago(1450));
  await dal.run(`INSERT INTO learning_sessions (id, engagement_learner_id, skill_node_id, language, status, started_at, active_minutes, loop_count, last_heartbeat_at)
    VALUES ('s2', ?, ?, 'telugu', 'active', ?, 12, 3, ?)`, A.elId, P.nodes[1], ago(30), ago(2));
  await dal.run(`INSERT INTO session_messages (id, session_id, role, content, message_type, created_at) VALUES ('m1', 's2', 'learner', 'secret answer text', 'response', ?)`, ago(3));
  await dal.run('UPDATE engagement_learners SET current_node_id = ? WHERE id = ?', P.nodes[1], A.elId);
  admin = await login(app, '/api/auth/institution/login', { email: A.adminEmail, password: PASSWORD });
  prof = await login(app, '/api/auth/institution/login', { email: A.profEmail, password: PASSWORD });
});

describe('live status', () => {
  it('lights each student: stuck on 3 loops is red, never started is red, with reasons and timestamps', async () => {
    const r = await admin.agent.get(`/api/institution/engagements/${A.engagementId}/live`).set(auth(admin));
    expect(r.status).toBe(200);
    const first = r.body.students.find(s => s.el_id === A.elId);
    const second = r.body.students.find(s => s.el_id === 'el-ia2');
    expect(first).toMatchObject({ light: 'red', loops: 3, current_node: 'Joins' });
    expect(first.reason).toMatch(/Stuck/);
    expect(Date.parse(first.last_active_at)).toBeGreaterThan(Date.now() - 5 * 60000);
    expect(second).toMatchObject({ light: 'red', last_active_at: null, reason: 'Has not started yet' });
    expect(r.body.counts.red).toBe(2);
  });

  it('green when active now without loops', async () => {
    await dal.run('UPDATE learning_sessions SET loop_count = 0 WHERE id = ?', 's2');
    const r = await admin.agent.get(`/api/institution/engagements/${A.engagementId}/live`).set(auth(admin));
    expect(r.body.students.find(s => s.el_id === A.elId).light).toBe('green');
    await dal.run('UPDATE learning_sessions SET loop_count = 3 WHERE id = ?', 's2');
  });

  it('is scoped: another institution gets 404', async () => {
    const B = await seedInstitution('ib');
    const other = await login(app, '/api/auth/institution/login', { email: B.adminEmail, password: PASSWORD });
    expect((await other.agent.get(`/api/institution/engagements/${A.engagementId}/live`).set(auth(other))).status).toBe(404);
  });
});

describe('activity and downloads', () => {
  it('summarises a date range per student, with start and last-active times', async () => {
    const r = await admin.agent.get(`/api/institution/engagements/${A.engagementId}/activity`).set(auth(admin));
    const s = r.body.students.find(x => x.el_id === A.elId);
    expect(s).toMatchObject({ sessions: 2, active_minutes: 37, nodes_mastered_total: 1, total_nodes: 3 });
    expect(s.days_active).toBeGreaterThanOrEqual(1);
    expect(s.started_at).toBeTruthy();
    expect(s.last_active_at).toBeTruthy();
  });

  it('CSV download never contains session text, and is written to each student’s access history', async () => {
    const r = await admin.agent.get(`/api/institution/engagements/${A.engagementId}/activity.csv?from=2020-01-01&to=2999-12-31`).set(auth(admin));
    expect(r.status).toBe(200);
    expect(r.text.split('\n')[0]).toMatch(/^learner_reference,learner_name,language,access,enrolled_at,started_at,last_active_at,days_active/);
    expect(r.text).not.toMatch(/secret answer text/);
    const logged = await dal.all("SELECT * FROM access_events WHERE event = 'data_exported'");
    expect(logged.map(l => l.engagement_learner_id).sort()).toEqual([A.elId, 'el-ia2'].sort());
    expect(logged[0].detail).toMatch(/Activity data .* by Admin/);
  });

  it('selected students only', async () => {
    const r = await admin.agent.get(`/api/institution/engagements/${A.engagementId}/activity?el_ids=el-ia2`).set(auth(admin));
    expect(r.body.students.map(s => s.el_id)).toEqual(['el-ia2']);
  });

  it('counts students practising per day for the last 365 days', async () => {
    const r = await admin.agent.get(`/api/institution/engagements/${A.engagementId}/activity-days`).set(auth(admin));
    expect(r.body.series).toHaveLength(365);
    expect(r.body.unique_active).toBe(1);
    expect(r.body.enrolled).toBe(2);
    expect(r.body.series.reduce((a, d) => a + d.students, 0)).toBeGreaterThanOrEqual(1);
  });

  it('mastery log CSV has start and exit timestamps', async () => {
    await admin.agent.post(`/api/institution/engagements/${A.engagementId}/produce-mastery-logs`).set(auth(admin)).set('X-CSRF-Token', admin.csrf).send({});
    const r = await admin.agent.get(`/api/institution/engagements/${A.engagementId}/mastery-logs.csv`).set(auth(admin));
    expect(r.text.split('\n')[0]).toMatch(/^learner_reference,learner_name,started_at,exit_at,/);
  });
});

describe('each student’s own pathway', () => {
  it('shows only what this student completed: mastered 100%, current node learning at 0%, the rest 0%', async () => {
    const r = await prof.agent.get(`/api/institution/engagements/${A.engagementId}/students/${A.elId}/pathway`).set(auth(prof));
    expect(r.status).toBe(200);
    const nodes = r.body.clusters.flatMap(c => c.nodes);
    expect(nodes.map(n => [n.label, n.status, n.pct])).toEqual([['SQL queries', 'mastered', 100], ['Joins', 'learning', 0], ['Python loops', 'not_started', 0]]);
    expect(r.body.pct).toBe(33);
    const other = await prof.agent.get(`/api/institution/engagements/${A.engagementId}/students/el-ia2/pathway`).set(auth(prof));
    expect(other.body.pct).toBe(0);
    expect(other.body.clusters.flatMap(c => c.nodes).every(n => n.pct === 0)).toBe(true);
  });
});

describe('evidence report', () => {
  it('reports activity, skills, stuck skills, consent rule and a plain summary — no session text', async () => {
    const r = await admin.agent.get(`/api/institution/engagements/${A.engagementId}/evidence-report?from=2020-01-01&to=2999-12-31&el_ids=${A.elId}`).set(auth(admin));
    expect(r.status).toBe(200);
    const s = r.body.students[0];
    expect(s.skills_mastered.map(x => x.skill)).toEqual(['SQL queries']);
    expect(s.skills_stuck).toEqual([{ skill: 'Joins', loops: 3 }]);
    expect(s.parent_share.allowed).toBe(false);
    expect(s.parent_share.rule).toMatch(/consent/);
    expect(s.plain_summary).toMatch(/mastered 1 of 3 skills/);
    expect(JSON.stringify(r.body)).not.toMatch(/secret answer text/);
    const logged = await dal.all("SELECT * FROM access_events WHERE event = 'data_exported' AND detail LIKE 'Evidence report%'");
    expect(logged).toHaveLength(1);
  });
});

describe('where we stand', () => {
  it('a student with no mastered skills has no job match (verification is no longer always true)', async () => {
    const r = await admin.agent.get(`/api/institution/insights/standing?engagement_id=${A.engagementId}`).set(auth(admin));
    expect(r.status).toBe(200);
    expect(r.body.index).toBeLessThan(100);
  });
});

// Minimal .docx (a ZIP with word/document.xml).
function docx(paragraphs) {
  const xml = Buffer.from(`<?xml version="1.0"?><w:document><w:body>${paragraphs.map(p => `<w:p><w:r><w:t>${p}</w:t></w:r></w:p>`).join('')}</w:body></w:document>`);
  const data = zlib.deflateRawSync(xml); const name = Buffer.from('word/document.xml');
  const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(8, 8); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(xml.length, 22); local.writeUInt16LE(name.length, 26);
  const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(8, 10); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(xml.length, 24); central.writeUInt16LE(name.length, 28); central.writeUInt32LE(0, 42);
  const cdStart = local.length + name.length + data.length;
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10); end.writeUInt32LE(central.length + name.length, 12); end.writeUInt32LE(cdStart, 16);
  return Buffer.concat([local, name, data, central, name, end]);
}

describe('curriculum upload', () => {
  it('reads a .docx and a .txt into text; professors cannot upload; other types are refused', async () => {
    const d = await admin.agent.post('/api/institution/curriculum/upload').set(auth(admin)).set('X-CSRF-Token', admin.csrf)
      .attach('file', docx(['Full-stack developer', 'Unit 1: HTML &amp; CSS', 'Unit 2: React']), 'syllabus.docx');
    expect(d.status).toBe(200);
    expect(d.body.text).toBe('Full-stack developer\nUnit 1: HTML & CSS\nUnit 2: React');
    const t = await admin.agent.post('/api/institution/curriculum/upload').set(auth(admin)).set('X-CSRF-Token', admin.csrf)
      .attach('file', Buffer.from('SQL, Python, REST APIs'), 'brief.txt');
    expect(t.body.text).toBe('SQL, Python, REST APIs');
    const bad = await admin.agent.post('/api/institution/curriculum/upload').set(auth(admin)).set('X-CSRF-Token', admin.csrf)
      .attach('file', Buffer.from('x'), 'image.png');
    expect(bad.status).toBe(415);
    const p = await prof.agent.post('/api/institution/curriculum/upload').set(auth(prof)).set('X-CSRF-Token', prof.csrf)
      .attach('file', Buffer.from('x'), 'brief.txt');
    expect(p.status).toBe(403);
  });
});
