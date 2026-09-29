// core/brains/memBrain.js — MEM: Learner Memory
// Activated at every session turn. Reads learner context BEFORE TEACH
// generates a response, writes the interaction + fingerprint update AFTER.
import * as learnerMemoryStore from '../stores/learnerMemoryStore.js';
import * as dal from '../db/dal.js';

// Minor policy (v4.3 §6, §17.3): the behaviour fingerprint is persisted for
// confirmed adults only. Minors and unknown-age learners are profiled inside
// the live turn at most, never across sessions.
const isConfirmedAdult = (learnerId) => dal.one('SELECT age_status FROM learners WHERE id = ?', learnerId)?.age_status === 'adult';

function retrieve(learnerId, nodeId) {
  return learnerMemoryStore.retrieveLearnerContext(learnerId, nodeId);
}

async function writeAfterTurn(learnerId, elId, turnData) {
  await Promise.all([
    learnerMemoryStore.writeInteraction(learnerId, elId, turnData),
    isConfirmedAdult(learnerId) ? learnerMemoryStore.updateBehaviourFingerprint(learnerId, turnData) : null
  ]);
}

function writeStruggle(learnerId, elId, opts) {
  return learnerMemoryStore.writeStrugglePattern(learnerId, elId, opts);
}

export { retrieve, writeAfterTurn, writeStruggle };
