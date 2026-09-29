// tests/helpers/setup.js — fresh in-memory database + app per test file.
import bcrypt from 'bcryptjs';
import request from 'supertest';
import * as dal from '../../core/db/dal.js';
import { migrate } from '../../core/db/migrate.js';
import { ulid } from '../../core/db/ulid.js';
import { resetRateLimits } from '../../api/middleware/rateLimit.js';

export const PASSWORD = 'CorrectHorse42!';
export const PIN = '246810';

export async function freshDb() {
  dal.connect({ file: ':memory:' });
  await migrate();
  resetRateLimits();
}

export async function makeApp() {
  const { createApp } = await import('../../api/app.js');
  return createApp();
}

const hash = (v) => bcrypt.hashSync(v, 4);

/** One institution with an admin and a professor, a cohort, and a learner with a PIN. */
export function seedInstitution(tag = 'a') {
  const now = dal.nowIso();
  const inst = `inst-${tag}`;
  dal.run(`INSERT INTO institutions (id, name, type, contact_email, password_hash) VALUES (?, ?, 'other', ?, ?)`,
    inst, `[Institution name] ${tag}`, `contact-${tag}@inst.test`, hash(PASSWORD));
  dal.run(`INSERT INTO institution_users (id, institution_id, email, password_hash, role, status, name) VALUES (?, ?, ?, ?, 'admin', 'active', 'Admin')`,
    `staff-admin-${tag}`, inst, `admin-${tag}@inst.test`, hash(PASSWORD));
  dal.run(`INSERT INTO institution_users (id, institution_id, email, password_hash, role, status, name) VALUES (?, ?, ?, ?, 'professor', 'active', 'Prof')`,
    `staff-prof-${tag}`, inst, `prof-${tag}@inst.test`, hash(PASSWORD));
  dal.run(`INSERT INTO capability_targets (id, institution_id, version, title, path) VALUES (?, ?, '1', 'Target', 'A')`, `ct-${tag}`, inst);
  dal.run(`INSERT INTO engagements (id, institution_id, capability_target_id, title, language, join_code) VALUES (?, ?, ?, 'Cohort', 'telugu', ?)`,
    `eng-${tag}`, inst, `ct-${tag}`, `QX-TST-${tag.toUpperCase()}0${tag.length}`);
  dal.run(`INSERT INTO staff_cohorts (staff_id, engagement_id) VALUES (?, ?)`, `staff-prof-${tag}`, `eng-${tag}`);
  dal.run(`INSERT INTO learners (id, institution_id, name, learner_ref, pin_hash, language) VALUES (?, ?, 'Learner', ?, ?, 'telugu')`,
    `learner-${tag}`, inst, `REF-${tag}`, hash(PIN));
  dal.run(`INSERT INTO engagement_learners (id, engagement_id, learner_id) VALUES (?, ?, ?)`, `el-${tag}`, `eng-${tag}`, `learner-${tag}`);
  return {
    institutionId: inst, engagementId: `eng-${tag}`, learnerId: `learner-${tag}`, elId: `el-${tag}`,
    adminEmail: `admin-${tag}@inst.test`, profEmail: `prof-${tag}@inst.test`, learnerRef: `REF-${tag}`,
    joinCode: `QX-TST-${tag.toUpperCase()}0${tag.length}`, createdAt: now
  };
}

export function seedAdmin() {
  dal.run('INSERT INTO admin_users (id, email, password_hash, name) VALUES (?, ?, ?, ?)', ulid(), 'root@qubirex.test', hash(PASSWORD), 'Root');
  return { email: 'root@qubirex.test' };
}

/** Log in and return { agent (cookie jar), token, csrf, body }. */
export async function login(app, path, body) {
  const agent = request.agent(app);
  const res = await agent.post(path).send(body);
  return { agent, res, token: res.body.token, csrf: res.body.csrf_token };
}
