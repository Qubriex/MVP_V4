// core/brains/memBrain.js — MEM: Learner Memory
// Activated at every session turn. Reads learner context BEFORE TEACH
// generates a response, writes the interaction + fingerprint update AFTER.
import * as learnerMemoryStore from '../stores/learnerMemoryStore.js';

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

export { retrieve, writeAfterTurn, writeStruggle };
