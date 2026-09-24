// core/brains/teachBrain.js — TEACH: RAG-grounded native-language instruction engine
// The only brain whose output reaches the learner. Generates native-language
// explanations grounded in retrieved cultural examples (CULT), learner
// history (MEM), and node specifications (CURR). Never invents cultural
// examples when retrieval returns results.
const { callAI, safeParseJSON } = require('../instructionEngine');

// ─── LANGUAGE_CONTEXTS ─────────────────────────────────────────────────────────
const LANGUAGE_CONTEXTS = {
  telugu: {
    lang_name: 'Telugu',
    script_note: 'Use Telugu script',
    greeting: 'నమస్కారం',
    advance_message: 'మీకు అర్థమైంది. ముందుకు వెళ్దాం.',
    loop_message: 'మంచి ప్రయత్నం. దీన్ని మరో కోణం నుండి చూద్దాం.',
    check_prompt: 'అర్థమైందా?',
    still_confused: 'ఇంకా అయోమయంగా ఉందా?',
    region: 'Telangana/Andhra Pradesh'
  },
  hindi: {
    lang_name: 'Hindi',
    script_note: 'Use Devanagari script',
    greeting: 'नमस्ते',
    advance_message: 'आपने इसे समझ लिया। आगे बढ़ते हैं।',
    loop_message: 'अच्छी कोशिश। चलिए इसे एक नए नज़रिए से देखते हैं।',
    check_prompt: 'क्या आप इसे समझ गए?',
    still_confused: 'अभी भी उलझन में हैं?',
    region: 'North India'
  }
};

// ─── APPROACH_GUIDES ────────────────────────────────────────────────────────────
const APPROACH_GUIDES = {
  native_concept: (region) => `Build from a culturally familiar entry point for someone from ${region}. Use the retrieved cultural example as your PRIMARY entry point — start with it, build from it to the concept.`,
  analogy: () => `Use the retrieved cultural example as your core analogy. Map EVERY element of the concept to the analogy. Make it visceral and complete.`,
  worked_example: () => `Show the retrieved example in action FIRST. Do not explain the concept before showing it. Demonstrate, then reverse-engineer.`,
  decomposition: (region) => `The learner is missing a prerequisite. Identify it from the learner context. Teach the prerequisite using a familiar example from ${region}. Then return to the main concept.`,
  socratic: () => `Do not explain. Ask questions that guide the learner to arrive at the concept through their own reasoning. Use retrieved cultural context to frame each question.`
};

const BEHAVIOUR_GUIDANCE = {
  confused: 'Learner is confused. Slow down. Use the cultural example more deeply. Try decomposition.',
  disengaged: 'Learner seems disengaged. Be warm. Use their name. Ask a question before explaining.',
  accelerating: 'Learner is advancing fast. Go deeper. Challenge with a harder application scenario.',
  engaged: 'Continue at current pace.'
};

// ─── RAG context formatting ─────────────────────────────────────────────────────
function formatCulturalContext(culturalExamples = []) {
  if (!culturalExamples || culturalExamples.length === 0) {
    return 'RETRIEVED CULTURAL EXAMPLES: None retrieved — generate a culturally appropriate example from your knowledge of the region.';
  }
  const examples = culturalExamples
    .map((ex, i) => `Example ${i + 1}: ${ex.entry_point}\n${ex.explanation_text || ''}`)
    .join('\n\n');
  return `RETRIEVED CULTURAL EXAMPLES (use these — do not invent new ones):\n${examples}`;
}

function formatMemoryContext(learnerContext = {}, loopCount = 0) {
  const struggles = learnerContext.nodeStruggles || [];
  if (struggles.length === 0) return 'LEARNER HISTORY AT THIS NODE: No previous history at this node.';
  return `LEARNER HISTORY AT THIS NODE: Previously struggled. Loop count to date: ${loopCount}. Known gaps: ${JSON.stringify(struggles.map(s => s.metadata))}`;
}

function formatNodeSpecContext(nodeSpec) {
  if (!nodeSpec) return 'NODE SPECIFICATION: No node spec retrieved — use general knowledge of the concept.';
  const objectives = (nodeSpec.learning_objectives || []).map(o => `  - ${o}`).join('\n');
  const prereqs = (nodeSpec.prerequisite_labels || []).length ? nodeSpec.prerequisite_labels.join(', ') : 'None (foundational node)';
  return `NODE SPECIFICATION (from Curriculum Store):
Learning objectives:
${objectives}
Prerequisites: ${prereqs}
Mastery threshold: ${nodeSpec.mastery_threshold ?? 0.70}
Phase: ${nodeSpec.phase ?? 1} | Difficulty: ${nodeSpec.difficulty_level ?? 1}/5 | Est. time: ${nodeSpec.estimated_minutes ?? 20} min`;
}

function formatHistory(conversationHistory = []) {
  return conversationHistory.slice(-6)
    .map(m => `${m.role === 'ai' ? 'Professor Qubirex' : 'Learner'}: ${m.content}`)
    .join('\n');
}

// ─── runDiagnosis() ─────────────────────────────────────────────────────────────
async function runDiagnosis({ nodeLabel, clusterLabel, language, learnerContext = {} }) {
  const ctx = LANGUAGE_CONTEXTS[language];
  const struggles = learnerContext.nodeStruggles || [];
  const struggleHint = struggles.length
    ? `\nThe learner has been at this node before. First recorded struggle: ${JSON.stringify(struggles[0].content || struggles[0]).slice(0, 200)}`
    : '';

  const system = `You are Professor Qubirex, teaching the skill node "${nodeLabel}" (part of cluster "${clusterLabel}") in ${ctx.lang_name}. ${ctx.script_note}. Cultural frame: ${ctx.region}.

Ask a warm, conversational question in ${ctx.lang_name} about what the learner already knows about this topic. Limit to 1-2 sentences plus one question.${struggleHint}

Respond ONLY with JSON:
{
  "message": "your ${ctx.lang_name} diagnostic question",
  "decision": "DIAGNOSE",
  "behaviourSignal": "engaged"
}`;

  const text = await callAI({ system, userMessage: `Begin the diagnosis for "${nodeLabel}".`, maxTokens: 1024, temperature: 0.7 });
  return safeParseJSON(text, { message: text, decision: 'DIAGNOSE', behaviourSignal: 'engaged' });
}

// ─── generateInstruction() ─────────────────────────────────────────────────────
async function generateInstruction({
  nodeLabel, clusterLabel, language, approach = 'native_concept',
  approachesAlreadyUsed = [], conversationHistory = [], loopCount = 0,
  behaviourSignal = 'engaged', learnerContext = {}, culturalExamples = [], nodeSpec = null
}) {
  const ctx = LANGUAGE_CONTEXTS[language];
  const approachGuide = (APPROACH_GUIDES[approach] || APPROACH_GUIDES.native_concept)(ctx.region);
  const behaviourGuidance = BEHAVIOUR_GUIDANCE[behaviourSignal] || BEHAVIOUR_GUIDANCE.engaged;

  const system = `You are Professor Qubirex, teaching "${nodeLabel}" (cluster: "${clusterLabel}") in ${ctx.lang_name}. ${ctx.script_note}. Cultural frame: ${ctx.region}.

EXPLANATION APPROACH THIS TURN: ${approach}
${approachGuide}

${formatCulturalContext(culturalExamples)}

${formatMemoryContext(learnerContext, loopCount)}

${formatNodeSpecContext(nodeSpec)}

BEHAVIOUR GUIDANCE: ${behaviourGuidance}

SYSTEM PROMPT RULES:
- Open in ${ctx.lang_name} — native frame, native entry point
- Build understanding progressively using the selected approach
- Introduce the English technical term ONLY AFTER the concept is understood in ${ctx.lang_name}
- Never say "wrong", "incorrect", "failed" — on loop use: "${ctx.loop_message}"
- Code examples are ALWAYS in English. Explanation of code is in ${ctx.lang_name}.
- When you have explained sufficiently, set decision to CHECK and provide the mastery check question
- Mastery check must require the learner to USE the concept — not recall it. Ask in ${ctx.lang_name}.
- Approaches already used at this node (never repeat): ${approachesAlreadyUsed.join(', ') || 'none'}

CONVERSATION HISTORY (last 6 turns):
${formatHistory(conversationHistory) || '(session start)'}

Respond ONLY with JSON:
{
  "message": "native-language instruction text",
  "decision": "CONTINUE | CHECK",
  "checkQuestion": "mastery check question in learner language — only if decision=CHECK, else null",
  "mermaid": "mermaid diagram string — optional, for logic flow, else null",
  "code": "code snippet in English — optional, else null",
  "behaviourSignal": "engaged | confused | disengaged | accelerating",
  "approachesUsed": ["${approach}"],
  "culturalExampleUsed": "entry_point of the cultural example used — null if none"
}`;

  const lastMessage = conversationHistory.length
    ? conversationHistory[conversationHistory.length - 1].content
    : `Begin teaching "${nodeLabel}" using the ${approach} approach.`;

  const text = await callAI({ system, userMessage: lastMessage, maxTokens: 2048, temperature: 0.7 });
  return safeParseJSON(text, {
    message: text, decision: 'CONTINUE', checkQuestion: null, mermaid: null, code: null,
    behaviourSignal: 'engaged', approachesUsed: [approach], culturalExampleUsed: null
  });
}

// ─── answerDoubt() ──────────────────────────────────────────────────────────────
async function answerDoubt({ questionText, nodeLabel, clusterLabel, language, learnerContext = {}, culturalExamples = [] }) {
  const ctx = LANGUAGE_CONTEXTS[language];

  const system = `You are Professor Qubirex. The learner has raised a doubt while working on "${nodeLabel}" (cluster: "${clusterLabel}"). Answer in ${ctx.lang_name}. ${ctx.script_note}.

${formatCulturalContext(culturalExamples)}

Reference the current node. Try a different angle than previous explanations. End with: "${ctx.still_confused}"

Respond ONLY with JSON:
{
  "answer": "your ${ctx.lang_name} answer to the doubt",
  "approach_used": "brief description of the angle taken"
}`;

  const text = await callAI({ system, userMessage: questionText, maxTokens: 1200, temperature: 0.7 });
  return safeParseJSON(text, { answer: text, approach_used: 'direct_answer' });
}

module.exports = {
  LANGUAGE_CONTEXTS,
  APPROACH_GUIDES,
  runDiagnosis,
  generateInstruction,
  answerDoubt
};
