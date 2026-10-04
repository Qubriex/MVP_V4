// Learner features from the 4 October review: one device at a time, Settings
// (devices, PIN, parent-share consent, my data, delete request), switching
// sections, graduation year, voice metrics, and spoken helpers that never
// cache a failed reply.
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import * as dal from '../../core/db/dal.js';
import { freshDb, makeApp, seedInstitution, seedPathway, login, PIN } from '../helpers/setup.js';
import { setResponder } from '../../core/ai/adapters/mock.js';
import { deviceLabel } from '../../core/devices.js';

let app; let A; let P;
let restore = () => {};
afterEach(() => restore());
const learnerLogin = (headers = {}) => {
  const agent = request.agent(app);
  return agent.post('/api/auth/learner/login').set(headers).send({ learner_ref: A.learnerRef, join_code: A.joinCode, pin: PIN })
    .then(res => ({ agent, token: res.body.token, res }));
};
const auth = (s) => ({ Authorization: `Bearer ${s.token}` });

beforeAll(async () => {
  await freshDb();
  app = await makeApp();
  A = await seedInstitution('lf');
  P = await seedPathway(A);
});

describe('one device at a time', () => {
  it('signing in on a new device signs out the old one, which is told why', async () => {
    const phone = await learnerLogin({ 'user-agent': 'Mozilla/5.0 (Linux; Android 14) Chrome/120 Mobile', 'x-vercel-ip-city': 'Hyderabad' });
    expect((await phone.agent.get('/api/learner/settings').set(auth(phone))).status).toBe(200);
    const laptop = await learnerLogin({ 'user-agent': 'Mozilla/5.0 (Windows NT 10.0) Chrome/120', 'x-vercel-ip-city': 'Hyderabad' });
    const old = await phone.agent.get('/api/learner/settings').set(auth(phone));
    expect(old.status).toBe(401);
    expect(old.body.error).toMatch(/used on another device/);
    const s = await laptop.agent.get('/api/learner/settings').set(auth(laptop));
    expect(s.body.devices).toHaveLength(1);
    expect(s.body.devices[0]).toMatchObject({ device: 'Chrome on Windows', city: 'Hyderabad', current: true });
  });

  it('two cities on one day are written to the access history once', async () => {
    await learnerLogin({ 'x-vercel-ip-city': 'Mumbai' });
    await learnerLogin({ 'x-vercel-ip-city': 'Hyderabad' });
    const rows = await dal.all("SELECT detail FROM access_events WHERE learner_id = ? AND event = 'shared_account_suspected'", A.learnerId);
    expect(rows).toHaveLength(1);
    expect(rows[0].detail).toMatch(/Hyderabad/);
    expect(rows[0].detail).toMatch(/Mumbai/);
  });

  it('labels common devices', () => {
    expect(deviceLabel('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit Version/17.0 Mobile Safari/604.1')).toBe('Safari on iPhone');
  });
});

describe('settings', () => {
  it('PIN change from Settings needs the current PIN and signs out other devices', async () => {
    const s = await learnerLogin();
    const bad = await s.agent.put('/api/learner/pin').set(auth(s)).send({ current_pin: '000000', new_pin: '135790' });
    expect(bad.status).toBe(403);
    const ok = await s.agent.put('/api/learner/pin').set(auth(s)).send({ current_pin: PIN, new_pin: '135790' });
    expect(ok.status).toBe(200);
    const again = await request(app).post('/api/auth/learner/login').send({ learner_ref: A.learnerRef, join_code: A.joinCode, pin: '135790' });
    expect(again.status).toBe(200);
    // put the original PIN back for the other tests
    const back = { token: again.body.token };
    await request(app).put('/api/learner/pin').set(auth(back)).send({ current_pin: '135790', new_pin: PIN });
  });

  it('parent-share consent turns on and off; my data downloads; deletion is requested once', async () => {
    const s = await learnerLogin();
    await s.agent.put('/api/learner/consents/parent-share').set(auth(s)).send({ on: true });
    expect((await s.agent.get('/api/learner/settings').set(auth(s))).body.parent_share.on).toBe(true);
    await s.agent.put('/api/learner/consents/parent-share').set(auth(s)).send({ on: false });
    expect((await s.agent.get('/api/learner/settings').set(auth(s))).body.parent_share.on).toBe(false);
    const data = await s.agent.get('/api/learner/my-data').set(auth(s));
    expect(data.status).toBe(200);
    const body = JSON.parse(data.text);
    expect(body.learner.learner_ref).toBe(A.learnerRef);
    expect(body.consents).toHaveLength(1);
    expect(JSON.stringify(body)).not.toMatch(/pin_hash/);
    await s.agent.post('/api/learner/delete-request').set(auth(s)).send({});
    await s.agent.post('/api/learner/delete-request').set(auth(s)).send({});
    expect((await dal.all("SELECT 1 FROM access_events WHERE learner_id = ? AND event = 'deletion_requested'", A.learnerId))).toHaveLength(1);
  });
});

describe('switching sections', () => {
  it('a section can be started when nothing locks it; the next skill after mastery is the earliest unmastered', async () => {
    const s = await learnerLogin();
    const path = await s.agent.get('/api/learner/path').set(auth(s));
    const python = path.body.clusters.find(c => c.label === 'Python');
    expect(python.can_start).toBe(true);
    const r = await s.agent.post('/api/learner/path/start').set(auth(s)).send({ cluster_id: python.id });
    expect(r.status).toBe(200);
    expect(r.body.current_node_id).toBe(P.nodes[2]);
    const el = await dal.one('SELECT current_node_id FROM engagement_learners WHERE id = ?', A.elId);
    expect(el.current_node_id).toBe(P.nodes[2]);
    const after = await s.agent.get('/api/learner/path').set(auth(s));
    expect(after.body.clusters.find(c => c.label === 'Python').current).toBe(true);
    expect(after.body.clusters.find(c => c.label === 'SQL').can_start).toBe(true);
  });

  it('a section whose prerequisite section is unfinished is locked', async () => {
    await dal.run("INSERT INTO skills (skill_id, name, domain, version, created_at) VALUES ('lf_sql', 'SQL', 'data', 1, ?), ('lf_py', 'Python', 'code', 1, ?) ON CONFLICT DO NOTHING", dal.nowIso(), dal.nowIso());
    await dal.run("INSERT INTO skill_prereqs (skill_id, prereq_skill_id) VALUES ('lf_py', 'lf_sql') ON CONFLICT DO NOTHING");
    await dal.run("INSERT INTO node_skill_map (node_id, skill_id, weight, source, created_at) VALUES (?, 'lf_sql', 1, 'curr', ?), (?, 'lf_py', 1, 'curr', ?) ON CONFLICT DO NOTHING", P.nodes[0], dal.nowIso(), P.nodes[2], dal.nowIso());
    await dal.run('UPDATE engagement_learners SET current_node_id = ? WHERE id = ?', P.nodes[0], A.elId);
    const s = await learnerLogin();
    const path = await s.agent.get('/api/learner/path').set(auth(s));
    const python = path.body.clusters.find(c => c.label === 'Python');
    expect(python.can_start).toBe(false);
    expect(python.locked_by.map(x => x.label)).toEqual(['SQL']);
    const r = await s.agent.post('/api/learner/path/start').set(auth(s)).send({ cluster_id: python.id });
    expect(r.status).toBe(409);
    expect(r.body.error).toMatch(/finish SQL first/);
  });
});

describe('profile and voice metrics', () => {
  it('graduation year sets availability to June of that year', async () => {
    const s = await learnerLogin();
    const r = await s.agent.put('/api/learner/profile').set(auth(s)).send({ graduation_year: 2027 });
    expect(r.status).toBe(200);
    expect(r.body.graduation_year).toBe(2027);
    expect(r.body.available_from).toBe('June 2027');
    expect((await dal.one('SELECT availability FROM learners WHERE id = ?', A.learnerId)).availability).toBe('2027-06');
  });

  it('records time to first audio and the whole turn', async () => {
    const s = await learnerLogin();
    expect((await s.agent.post('/api/learner/voice-metrics').set(auth(s)).send({ first_audio_ms: 1400, turn_ms: 3600 })).status).toBe(204);
    const rows = await dal.all("SELECT task, ms FROM model_calls WHERE task LIKE 'CLIENT.voice%' ORDER BY task");
    expect(rows.map(r => [r.task, r.ms])).toEqual([['CLIENT.voice_first_audio', 1400], ['CLIENT.voice_turn', 3600]]);
  });
});

describe('spoken helpers', () => {
  it('a reply that is not valid JSON is not cached: the next tap asks again', async () => {
    let calls = 0;
    restore = setResponder(() => { calls += 1; return calls <= 2 ? 'not json at all' : JSON.stringify({ text: 'ఇది ఒక పరిచయం.', captionEn: 'An intro.' }); });
    const s = await learnerLogin();
    const topics = await s.agent.get('/api/market/topics').set(auth(s));
    const id = topics.body.featured.id;
    const first = await s.agent.post(`/api/market/topics/${id}/intro`).set(auth(s));
    expect(first.status).toBe(502);
    const second = await s.agent.post(`/api/market/topics/${id}/intro`).set(auth(s));
    expect(second.status).toBe(200);
    expect(second.body.text).toBe('ఇది ఒక పరిచయం.');
  });
});
