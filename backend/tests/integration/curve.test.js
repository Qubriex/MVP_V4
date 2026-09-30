// Learning-curve signals (§12.3) and benchmarks (§16).
import { describe, it, expect, beforeAll } from 'vitest';
import * as dal from '../../core/db/dal.js';
import { freshDb, makeApp, seedInstitution, seedPathway, login, PIN, PASSWORD } from '../helpers/setup.js';
import { theilSen } from '../../core/readiness/learningCurve.js';

let app; let A; let P;

async function master(elId, nodeId, loops, minutes, daysAgo) {
  const sid = `ls-${elId}-${nodeId}`;
  await dal.run("INSERT INTO learning_sessions (id, engagement_learner_id, skill_node_id, language, status, active_minutes, loop_count) VALUES (?, ?, ?, 'telugu', 'completed', ?, ?)", sid, elId, nodeId, minutes, loops);
  await dal.run('INSERT INTO node_mastery (id, engagement_learner_id, skill_node_id, mastery_attainment, advanced_at, loops, provisional) VALUES (?, ?, ?, 0.8, ?, ?, 0)',
    `nm-${sid}`, elId, nodeId, new Date(Date.now() - daysAgo * 86400000).toISOString(), loops);
}

beforeAll(async () => {
  await freshDb();
  app = await makeApp();
  A = await seedInstitution('a');
  P = await seedPathway(A);
  await master(A.elId, P.nodes[0], 3, 60, 5);
  await master(A.elId, P.nodes[1], 1, 30, 3);
  await master(A.elId, P.nodes[2], 0, 20, 1);
});

describe('learning curve (§12.3)', () => {
  it('Theil-Sen is robust to one bad node', () => {
    expect(theilSen([3, 2, 1, 0])).toBe(-1);
    expect(theilSen([1, 1, 9, 1, 1])).toBe(0);
  });

  it('learner and professor see progress vs active hours, the cohort median, and a falling loops trend', async () => {
    const learner = await login(app, '/api/auth/learner/login', { learner_ref: A.learnerRef, join_code: A.joinCode, pin: PIN });
    const c = (await learner.agent.get('/api/learner/learning-curve').expect(200)).body;
    expect(c.points.map(p => p.hours)).toEqual([0, 1, 1.5, 1.83]);
    expect(c.points[c.points.length - 1].progress).toBe(100);
    expect(c.loops.map(l => l.loops)).toEqual([3, 1, 0]);
    expect(c.loops_trend).toBeLessThan(0);
    expect(c.cohort_median.points.length).toBeGreaterThan(1);
    const prof = await login(app, '/api/auth/institution/login', { email: A.profEmail, password: PASSWORD });
    const p = (await prof.agent.get(`/api/institution/students/${A.elId}/learning-curve`).expect(200)).body;
    expect(p.student.learner_ref).toBe(A.learnerRef);
    const B = await seedInstitution('b');
    await prof.agent.get(`/api/institution/students/${B.elId}/learning-curve`).expect(404);
  });
});

describe('benchmarks (§16)', () => {
  it('the regional median is withheld below 3 other institutions, then published without names', async () => {
    const admin = await login(app, '/api/auth/institution/login', { email: A.adminEmail, password: PASSWORD });
    await dal.run("UPDATE institutions SET city = 'Hyderabad'");
    let b = (await admin.agent.get(`/api/institution/insights/benchmarks?engagement_id=${A.engagementId}`).expect(200)).body;
    expect(b.ours).toMatchObject({ learners: 1, progress_pct: 100, mastered_per_learner: 3 });
    expect(b.regional.published).toBe(false);
    for (const tag of ['c', 'd', 'e']) {
      const X = await seedInstitution(tag);
      const Q = await seedPathway(X);
      await master(X.elId, Q.nodes[0], 2, 40, 2);
    }
    await dal.run("UPDATE institutions SET city = 'Hyderabad'");
    b = (await admin.agent.get(`/api/institution/insights/benchmarks?engagement_id=${A.engagementId}`).expect(200)).body;
    expect(b.regional).toMatchObject({ published: true, institutions: 4 });
    expect(b.regional.values.progress_pct).toBeCloseTo(33.3, 0);
    expect(JSON.stringify(b.regional)).not.toMatch(/Institution name|inst-/);
  });
});
