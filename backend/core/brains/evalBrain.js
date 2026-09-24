// core/brains/evalBrain.js — EVAL: Mastery Evaluator
// The only brain that does NOT activate during instruction. Activates ONLY
// when the learner responds to a mastery check question. Temperature 0.3 —
// lower than TEACH — for deterministic evaluation.
const rubricStore = require('../stores/rubricStore');
const { callAI, safeParseJSON } = require('../instructionEngine');

const ADVANCE_THRESHOLD = 0.70;
const PERSISTENCE_LOOP_COUNT = 5;
const PERSISTENCE_THRESHOLD = 0.60;

function buildSystemPrompt(nodeLabel, language, rubric, passingExamples, failingExamples) {
  const passingBlock = passingExamples.length
    ? passingExamples.map((e, i) => `${i + 1}. "${e.response_text}" — scored ${e.score}`).join('\n')
    : 'None recorded yet.';
  const failingBlock = failingExamples.length
    ? failingExamples.map((e, i) => `${i + 1}. "${e.response_text}" — scored ${e.score}, gaps: ${e.gaps_identified}`).join('\n')
    : 'None recorded yet.';

  return `You are Professor Qubirex's mastery evaluator for the skill node "${nodeLabel}" (language of instruction: ${language}).

EVALUATION INTEGRITY RULE: Evaluate the QUALITY of understanding, not the fact of submission. A one-word or copied response scores 0.

RUBRIC — PASSING CRITERIA:
${rubric.passingCriteria.map(c => `- ${c}`).join('\n')}

RUBRIC — FAILING INDICATORS:
${rubric.failingIndicators.map(c => `- ${c}`).join('\n')}

EXAMPLES OF PASSING RESPONSES:
${passingBlock}

EXAMPLES OF FAILING RESPONSES:
${failingBlock}

SCORING RUBRIC:
0.9-1.0 -> ADVANCE (confident, correct application)
0.7-0.89 -> ADVANCE (understanding with minor gaps — log gaps)
0.5-0.69 -> LOOP (partial understanding)
0.0-0.49 -> LOOP (fundamental misunderstanding or no meaningful response)

THRESHOLD: score >= 0.70 -> passed=true. Exception: if loopCount >= 5 AND score >= 0.60 -> passed=true (learner has worked hard at a functional level).

GAP TAXONOMY (pick the gap type that most explains failure, and its recommended next approach):
${Object.entries(rubric.gapTaxonomy).map(([gap, v]) => `- ${gap} -> ${v.approach}: ${v.description}`).join('\n')}

Respond ONLY with this JSON:
{
  "passed": true | false,
  "score": 0.0,
  "evaluation": "what the learner understood and what they missed",
  "feedbackForLearner": "constructive feedback in the learner's language",
  "loopApproachIfFailed": "gap type that most explains failure",
  "recommendedApproach": "analogy | worked_example | decomposition | socratic | native_concept",
  "understandingGaps": ["specific gap 1", "specific gap 2"]
}`;
}

// ─── evaluate() ─────────────────────────────────────────────────────────────────
async function evaluate({ nodeLabel, language, question, learnerResponse, loopCount = 0 }) {
  const rubric = rubricStore.retrieveRubric(nodeLabel, language);
  const [passingExamples, failingExamples] = await Promise.all([
    Promise.resolve(rubricStore.retrieveExampleResponses(nodeLabel, language, 'pass', 2)),
    Promise.resolve(rubricStore.retrieveExampleResponses(nodeLabel, language, 'fail', 2))
  ]);

  const system = buildSystemPrompt(nodeLabel, language, rubric, passingExamples, failingExamples);
  const userMessage = `Mastery check question: "${question}"\n\nLearner's response: "${learnerResponse}"\n\nEvaluate this response for the skill node "${nodeLabel}".`;

  const text = await callAI({ system, userMessage, maxTokens: 1200, temperature: 0.3 });
  const parsed = safeParseJSON(text, {
    passed: false, score: 0.5, evaluation: text, feedbackForLearner: text,
    loopApproachIfFailed: 'concept_not_understood', recommendedApproach: 'native_concept', understandingGaps: []
  });

  const score = typeof parsed.score === 'number' ? parsed.score : 0.5;
  // Threshold is enforced here, authoritatively — never trusted blindly from the model.
  const passed = score >= ADVANCE_THRESHOLD || (loopCount >= PERSISTENCE_LOOP_COUNT && score >= PERSISTENCE_THRESHOLD);

  const result = { ...parsed, passed, score };

  rubricStore.writeEvaluation(nodeLabel, language, learnerResponse, passed ? 'pass' : 'fail', score, result.understandingGaps || []);

  return result;
}

module.exports = { evaluate };
