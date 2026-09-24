// core/orchestrator.js — ORCH: central coordinator
// Every learner message enters through ORCH. It classifies the request type,
// dispatches brains in parallel via Promise.all(), assembles the response,
// and returns it to the API route. Learners never see ORCH — only TEACH output.
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/init');
const memBrain = require('./brains/memBrain');
const cultBrain = require('./brains/cultBrain');
const currBrain = require('./brains/currBrain');
const teachBrain = require('./brains/teachBrain');
const evalBrain = require('./brains/evalBrain');
const { getMasteryIncrement, selectNextApproach } = require('./instructionEngine');

// ─── Private helpers ────────────────────────────────────────────────────────────

// Vocabulary level used for the CULT call dispatched in parallel with MEM —
// seeded from the last known fingerprint value the route carries in
// sessionState, so CULT never has to wait on this turn's MEM.retrieve().
function _vocabHint(sessionState) {
  return sessionState.vocabularyLevel || 'beginner';
}

// Takes recentHistory from MEM (most recent first), reverses to chronological
// order, slices to the last 8, formats as [{role, content}], appends the
// current learner message.
function _buildHistory(learnerContext, learnerMessage) {
  const chronological = (learnerContext.recentHistory || [])
    .slice()
    .reverse()
    .slice(-8)
    .map(row => ({ role: (row.metadata && row.metadata.role) || 'ai', content: row.content }));
  if (learnerMessage !== undefined && learnerMessage !== null) {
    chronological.push({ role: 'learner', content: learnerMessage });
  }
  return chronological;
}

// Writes both the learner message (if any) and the AI response to MEM as
// two separate writeAfterTurn() calls.
async function _writeTurn(learnerId, elId, nodeId, clusterId, learnerMessage, aiMessage, extra = {}) {
  const writes = [];
  if (learnerMessage !== undefined && learnerMessage !== null) {
    writes.push(memBrain.writeAfterTurn(learnerId, elId, { role: 'learner', content: learnerMessage, nodeId, clusterId }));
  }
  writes.push(memBrain.writeAfterTurn(learnerId, elId, { role: 'ai', content: aiMessage, nodeId, clusterId, ...extra }));
  await Promise.all(writes);
}

// Finds the cultural example that was used (by entry_point match) and calls
// cultBrain.logOutcome() if an outcome is available. A no-op for CONTINUE/CHECK
// turns, where no ADVANCE/LOOP outcome exists yet.
function _cultLog(culturalExamples, culturalExampleUsed, learnerId, sessionId, nodeId, outcome) {
  if (!culturalExampleUsed || !outcome) return;
  const entry = (culturalExamples || []).find(e => e.entry_point === culturalExampleUsed);
  if (entry) cultBrain.logOutcome(entry.id, learnerId, sessionId, nodeId, outcome);
}

// Determines the first teaching approach from the diagnostic response content.
function _selectApproachFromDiagnosis(diagnosisResponse, usedApproaches = []) {
  const text = (diagnosisResponse || '');
  const lower = text.toLowerCase();
  if (text.length > 50 && /(already|know|ante|teluso)/.test(lower)) return 'worked_example';
  if (text.length < 20 || /(don't know|dont know|telidhu|pata nahi)/.test(lower)) return 'native_concept';
  return selectNextApproach(usedApproaches);
}

function _logOrchestration(sessionId, learnerId, requestType, brainsActivated, processingMs) {
  const db = getDb();
  db.prepare(`
    INSERT INTO orchestration_log (id, session_id, learner_id, request_type, brains_activated, processing_ms)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(uuidv4(), sessionId || null, learnerId || null, requestType, JSON.stringify(brainsActivated), processingMs);
  db.close();
}

// ─── processMessage() — the single entry point ──────────────────────────────────
async function processMessage(params) {
  const startedAt = Date.now();
  const {
    requestType, learnerId, engagementLearnerId, sessionId, nodeId, nodeLabel,
    clusterLabel, language, learnerMessage, sessionState = {}
  } = params;

  let result;
  let brainsActivated;

  switch (requestType) {

    // ── SESSION_START ──────────────────────────────────────────────────────
    case 'SESSION_START': {
      brainsActivated = ['MEM', 'CULT', 'CURR'];
      const [learnerContext, culturalExamples, nodeSpec] = await Promise.all([
        Promise.resolve(memBrain.retrieve(learnerId, nodeId)),
        Promise.resolve(cultBrain.retrieveExamples(nodeLabel, language, _vocabHint(sessionState))),
        Promise.resolve(currBrain.retrieveNodeContext(nodeId, nodeLabel))
      ]);

      brainsActivated.push('TEACH');
      const diagnosis = await teachBrain.runDiagnosis({ nodeLabel, clusterLabel, language, learnerContext });

      await memBrain.writeAfterTurn(learnerId, engagementLearnerId, {
        role: 'ai', content: diagnosis.message, nodeId, clusterId: sessionState.clusterId,
        decision: 'DIAGNOSE', behaviourSignal: diagnosis.behaviourSignal
      });

      result = {
        message: diagnosis.message, decision: 'DIAGNOSE', state: 'DIAGNOSE',
        culturalExamplesRetrieved: culturalExamples.length, nodeSpec, culturalExamples
      };
      break;
    }

    // ── DIAGNOSIS_RESPONSE ─────────────────────────────────────────────────
    case 'DIAGNOSIS_RESPONSE': {
      brainsActivated = ['MEM', 'CULT', 'CURR'];
      const approach = _selectApproachFromDiagnosis(learnerMessage, sessionState.approachesUsed || []);
      const [learnerContext, culturalExamples, nodeSpec] = await Promise.all([
        Promise.resolve(memBrain.retrieve(learnerId, nodeId)),
        Promise.resolve(cultBrain.retrieveExamples(nodeLabel, language, _vocabHint(sessionState))),
        Promise.resolve(currBrain.retrieveNodeContext(nodeId, nodeLabel))
      ]);

      brainsActivated.push('TEACH');
      const instruction = await teachBrain.generateInstruction({
        nodeLabel, clusterLabel, language, approach,
        approachesAlreadyUsed: sessionState.approachesUsed || [],
        conversationHistory: _buildHistory(learnerContext, learnerMessage),
        loopCount: 0, behaviourSignal: 'engaged', learnerContext, culturalExamples, nodeSpec
      });

      await _writeTurn(learnerId, engagementLearnerId, nodeId, sessionState.clusterId, learnerMessage, instruction.message, {
        decision: instruction.decision, approachUsed: approach, behaviourSignal: instruction.behaviourSignal
      });
      _cultLog(culturalExamples, instruction.culturalExampleUsed, learnerId, sessionId, nodeId, null);

      result = { ...instruction, approach, culturalExamples };
      break;
    }

    // ── LEARNER_MESSAGE ─────────────────────────────────────────────────────
    case 'LEARNER_MESSAGE': {
      brainsActivated = ['MEM', 'CULT', 'CURR'];
      const approach = sessionState.currentApproach || 'native_concept';
      const [learnerContext, culturalExamples, nodeSpec] = await Promise.all([
        Promise.resolve(memBrain.retrieve(learnerId, nodeId)),
        Promise.resolve(cultBrain.retrieveExamples(nodeLabel, language, _vocabHint(sessionState))),
        Promise.resolve(currBrain.retrieveNodeContext(nodeId, nodeLabel))
      ]);

      brainsActivated.push('TEACH');
      const instruction = await teachBrain.generateInstruction({
        nodeLabel, clusterLabel, language, approach,
        approachesAlreadyUsed: sessionState.approachesUsed || [],
        conversationHistory: _buildHistory(learnerContext, learnerMessage),
        loopCount: sessionState.loopCount || 0,
        behaviourSignal: sessionState.behaviourSignal || 'engaged',
        learnerContext, culturalExamples, nodeSpec
      });

      await _writeTurn(learnerId, engagementLearnerId, nodeId, sessionState.clusterId, learnerMessage, instruction.message, {
        decision: instruction.decision, approachUsed: approach, behaviourSignal: instruction.behaviourSignal
      });
      _cultLog(culturalExamples, instruction.culturalExampleUsed, learnerId, sessionId, nodeId, null);

      result = { ...instruction, approach, culturalExamples };
      break;
    }

    // ── CHECK_RESPONSE — the most complex flow ─────────────────────────────
    case 'CHECK_RESPONSE': {
      brainsActivated = ['MEM', 'EVAL', 'CULT', 'CURR'];
      const [learnerContext, evaluation, culturalExamples, nodeSpec] = await Promise.all([
        Promise.resolve(memBrain.retrieve(learnerId, nodeId)),
        evalBrain.evaluate({
          nodeLabel, language, question: sessionState.checkQuestion,
          learnerResponse: learnerMessage, loopCount: sessionState.loopCount || 0
        }),
        Promise.resolve(cultBrain.retrieveExamples(nodeLabel, language, _vocabHint(sessionState))),
        Promise.resolve(currBrain.retrieveNodeContext(nodeId, nodeLabel))
      ]);

      if (evaluation.passed) {
        // ── ADVANCE ──────────────────────────────────────────────────────
        brainsActivated.push('TEACH');
        const masteryIncrement = getMasteryIncrement(sessionState.loopCount || 0);
        const advanceMessage = await teachBrain.generateInstruction({
          nodeLabel, clusterLabel, language, approach: sessionState.currentApproach || 'native_concept',
          approachesAlreadyUsed: sessionState.approachesUsed || [],
          conversationHistory: _buildHistory(learnerContext, learnerMessage),
          loopCount: sessionState.loopCount || 0, behaviourSignal: 'accelerating',
          learnerContext, culturalExamples, nodeSpec
        });

        await _writeTurn(learnerId, engagementLearnerId, nodeId, sessionState.clusterId, learnerMessage, advanceMessage.message, {
          decision: 'ADVANCE', masteryScore: evaluation.score, behaviourSignal: 'accelerating'
        });
        _cultLog(culturalExamples, advanceMessage.culturalExampleUsed, learnerId, sessionId, nodeId, 'ADVANCE');

        result = { decision: 'ADVANCE', masteryIncrement, evaluation, ...advanceMessage };
      } else {
        // ── LOOP ─────────────────────────────────────────────────────────
        brainsActivated.push('TEACH');
        const newLoopCount = (sessionState.loopCount || 0) + 1;
        const nextApproach = selectNextApproach(sessionState.approachesUsed || []);

        const loopInstruction = await teachBrain.generateInstruction({
          nodeLabel, clusterLabel, language, approach: nextApproach,
          approachesAlreadyUsed: sessionState.approachesUsed || [],
          conversationHistory: _buildHistory(learnerContext, learnerMessage),
          loopCount: newLoopCount, behaviourSignal: 'confused',
          learnerContext, culturalExamples, nodeSpec
        });

        memBrain.writeStruggle(learnerId, engagementLearnerId, {
          nodeId, loopCount: newLoopCount, approachThatFailed: sessionState.currentApproach || 'native_concept',
          approachThatResolved: null, gapsIdentified: evaluation.understandingGaps || [], content: evaluation.evaluation
        });

        await _writeTurn(learnerId, engagementLearnerId, nodeId, sessionState.clusterId, learnerMessage, loopInstruction.message, {
          decision: 'LOOP', behaviourSignal: 'confused'
        });
        _cultLog(culturalExamples, loopInstruction.culturalExampleUsed, learnerId, sessionId, nodeId, 'LOOP');

        result = { decision: 'LOOP', nextApproach, evaluation, culturalExamples, ...loopInstruction };
      }
      break;
    }

    // ── DOUBT_QUERY ─────────────────────────────────────────────────────────
    case 'DOUBT_QUERY': {
      brainsActivated = ['MEM', 'CULT', 'CURR'];
      const [learnerContext, culturalExamples, nodeSpec] = await Promise.all([
        Promise.resolve(memBrain.retrieve(learnerId, nodeId)),
        Promise.resolve(cultBrain.retrieveExamples(nodeLabel, language, _vocabHint(sessionState))),
        Promise.resolve(currBrain.retrieveNodeContext(nodeId, nodeLabel))
      ]);

      brainsActivated.push('TEACH');
      const doubtAnswer = await teachBrain.answerDoubt({
        questionText: learnerMessage, nodeLabel, clusterLabel, language, learnerContext, culturalExamples
      });

      await memBrain.writeAfterTurn(learnerId, engagementLearnerId, {
        role: 'doubt', content: learnerMessage, nodeId, clusterId: sessionState.clusterId
      });
      await memBrain.writeAfterTurn(learnerId, engagementLearnerId, {
        role: 'ai', content: doubtAnswer.answer, nodeId, clusterId: sessionState.clusterId
      });

      result = { message: doubtAnswer.answer, answer: doubtAnswer.answer, decision: 'DOUBT_ANSWERED' };
      break;
    }

    default:
      throw new Error(`Unknown requestType: ${requestType}`);
  }

  _logOrchestration(sessionId, learnerId, requestType, brainsActivated, Date.now() - startedAt);
  return result;
}

module.exports = { processMessage };
