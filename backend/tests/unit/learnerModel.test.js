// Learner model (v4.3 §6): vocabulary level, active minutes; and the
// authenticity gate thresholds (§7.11).
import { describe, it, expect, beforeAll } from 'vitest';
import * as dal from '../../core/db/dal.js';
import { freshDb, seedInstitution } from '../helpers/setup.js';
import { recordAttempt, vocabularyLevel } from '../../core/learner/vocabulary.js';
import { heartbeat } from '../../core/learner/activeTime.js';
import { authenticityGate } from '../../core/evidence/assurance.js';

beforeAll(async () => { await freshDb(); seedInstitution('a'); });

describe('vocabulary level', () => {
  it('promotes after 5 clean passes and demotes after 2 vocabulary gaps in 3 attempts', () => {
    for (let i = 0; i < 4; i += 1) recordAttempt('learner-a', { passed: true, vocabGap: false });
    expect(vocabularyLevel('learner-a')).toBe('beginner');
    recordAttempt('learner-a', { passed: true, vocabGap: false });
    expect(vocabularyLevel('learner-a')).toBe('intermediate');
    recordAttempt('learner-a', { passed: false, vocabGap: true });
    recordAttempt('learner-a', { passed: true, vocabGap: false });
    expect(vocabularyLevel('learner-a')).toBe('intermediate');
    recordAttempt('learner-a', { passed: false, vocabGap: true });
    expect(vocabularyLevel('learner-a')).toBe('beginner');
  });

  it('a vocabulary gap resets the clean-pass streak', () => {
    for (let i = 0; i < 4; i += 1) recordAttempt('learner-a', { passed: true, vocabGap: false });
    recordAttempt('learner-a', { passed: true, vocabGap: true });
    recordAttempt('learner-a', { passed: true, vocabGap: false });
    expect(vocabularyLevel('learner-a')).toBe('beginner');
  });
});

describe('active minutes', () => {
  it('credits 30 s per heartbeat only when visible, with input in the last 3 min, and never faster than the interval', () => {
    dal.run("INSERT INTO skill_clusters (id, capability_target_id, cluster_label) VALUES ('c', 'ct-a', 'C')");
    dal.run("INSERT INTO skill_nodes (id, cluster_id, node_label) VALUES ('n', 'c', 'N')");
    dal.run("INSERT INTO learning_sessions (id, engagement_learner_id, skill_node_id, language) VALUES ('s', 'el-a', 'n', 'telugu')");
    const t0 = Date.now() - 600000;
    const at = (ms) => new Date(t0 + ms).toISOString();
    expect(heartbeat({ sessionId: 's', elId: 'el-a', occurredAt: at(0), lastInputAt: at(-10000) }).credited).toBe(30);
    expect(heartbeat({ sessionId: 's', elId: 'el-a', occurredAt: at(10000), lastInputAt: at(0) }).reason).toBe('too_soon');
    expect(heartbeat({ sessionId: 's', elId: 'el-a', occurredAt: at(30000), lastInputAt: at(0), visible: false }).reason).toBe('hidden');
    expect(heartbeat({ sessionId: 's', elId: 'el-a', occurredAt: at(240000), lastInputAt: at(0) }).reason).toBe('idle');
    expect(heartbeat({ sessionId: 's', elId: 'el-a', occurredAt: at(60000), lastInputAt: at(30000) }).credited).toBe(30);
    expect(dal.one("SELECT active_minutes FROM learning_sessions WHERE id = 's'").active_minutes).toBe(1);
    expect(heartbeat({ sessionId: 's', elId: 'el-other', occurredAt: at(120000), lastInputAt: at(110000) }).reason).toBe('no_active_session');
  });
});

describe('authenticity gate thresholds', () => {
  const answer = 'x'.repeat(400);
  it.each([
    [{ mode: 'voice', edit_ratio: 0.30 }, 'A1'],
    [{ mode: 'voice', edit_ratio: 0.31 }, 'A0'],
    [{ mode: 'typed', pasted_chars: 80, largest_paste: 80 }, 'A1'],   // 20% and ≤ 80 chars
    [{ mode: 'typed', pasted_chars: 81, largest_paste: 81 }, 'A0'],   // single paste > 80
    [{ mode: 'typed', pasted_chars: 90, largest_paste: 45 }, 'A0'],   // > 20% pasted
    [null, 'A0']
  ])('%j → %s', (prov, level) => {
    expect(authenticityGate(prov, answer).assurance).toBe(level);
  });
});
