// core/brains/memBrain.js — MEM: Learner Memory
// Activated at every session turn. Reads learner context BEFORE TEACH
// generates a response, writes the interaction + fingerprint update AFTER.
const learnerMemoryStore = require('../stores/learnerMemoryStore');

function retrieve(learnerId, nodeId) {
  return learnerMemoryStore.retrieveLearnerContext(learnerId, nodeId);
}

async function writeAfterTurn(learnerId, elId, turnData) {
  await Promise.all([
    learnerMemoryStore.writeInteraction(learnerId, elId, turnData),
    learnerMemoryStore.updateBehaviourFingerprint(learnerId, turnData)
  ]);
}

function writeStruggle(learnerId, elId, opts) {
  return learnerMemoryStore.writeStrugglePattern(learnerId, elId, opts);
}

module.exports = { retrieve, writeAfterTurn, writeStruggle };
