// config/priors.js
// Prior defaults for every calibrated number in the engine: v4.3 Appendix A
// (checked against the dossier, docs/decisions.md D-014) plus the numbers
// stated in the section text that Appendix A does not list. These are a DEVELOPMENT FALLBACK only: in
// production config/params.js refuses to start without secure-config/.
// Code reads these through params.get('label.confirmed.minPasses'), never as
// literals. Changing a value here is a decision recorded in docs/decisions.md.
export const PRIORS = {
  graph: {
    resolveJaccard: 0.60,                          // §3.2 token match floor
    coverage: { covered: 0.8, partly: 0.3 }        // §3.3
  },
  learner: {
    vocabulary: { promoteAfterPasses: 5, demoteGaps: 2, demoteWindow: 3 },  // §6
    heartbeat: { intervalSeconds: 30, inputWithinMinutes: 3 },              // §6 active minutes
    maxTargetRoles: 3
  },
  retrieval: {
    perBrainTimeoutMs: 250,
    stageP95Ms: 300,
    mem: { recentTurns: 8, recentWindow: 20, relatedK: 3, relatedMinPrel: 0.60 },
    cult: { k: 5, minPrel: 0.65 },
    note: { k: 4, minPrel: 0.55 },
    eval: { k: 4 },
    curr: { k: 3, minPrel: 0.70, zeroShotConfidencePenalty: 0.15, specCacheMs: 300000 },
    calibration: { maxEce: 0.05, minLabelledPairs: 50 },
    budget: {
      rules: 900, node: 500, template: 400, ckb: 250, history: 350, doubt: 900,
      related: 300, extras: 200, recentTurns: 1400, minRecentTurns: 4, total: 5200
    },
    grounding: { doubtSampleRate: 0.10, instructSampleRate: 0.02, minGroundedRate: 0.90, windowDays: 7 },
    overflowReviewRate: 0.02,                      // §2A.5
    chunking: { summaryEveryTurns: 10, summaryTokens: 120, noteMaxTokens: 350, briefMinTokens: 300, briefMaxTokens: 500, briefOverlap: 50 },
    hybrid: { rrfK: 60, upgradeActiveLearners: 100, upgradeRecallAt5: 0.80, upgradeMissRate: 0.15, upgradeMissWeeks: 2 },
    gold: { minPairs: 300, recallAt5Ckb: 0.85, recallAt5Notes: 0.85, recallAt5Memory: 0.90, maxLanguageGap: 0.05 },
    doubtGroundingFloor: 0.55
  },
  teaching: {
    maxWarmups: 2,
    doubtEscalateAfter: 2,
    bandit: { priorPseudoObs: 2, exploration: 0.10, overrideProbability: 0.8, propensitySamples: 500, minPropensityFactor: 0.10 },
    cult: { leakageReward: 0.2, exploration: 0.10, retireAfterExposures: 200, upliftQuantile: 0.90 },
    leakage: { notTransferred: 0.5, minCorrect: 2 },
    ltiPhraseBank: -1.5
  },
  evidence: {
    instance: { maxGenerationMs: 200, maxRejects: 5 },
    knownWrongMargin: 0.15,
    rasch: { splitSd: 0.5, minN: 40 },
    sql: {
      heapMb: 32, workerMb: 64, maxStatementBytes: 4096, maxValueBytes: 1048576,
      maxCompoundTerms: 20, maxExprDepth: 100, wallMs: 1000, maxRows: 1000
    },
    python: { cpuSeconds: 2, memoryMb: 256, pids: 64, stdoutBytes: 1048576, tmpfsMb: 16 },
    fusion: {
      defaultTheta: 0.70, minTheta: 0.60,
      persistenceLoops: 5, persistenceMargin: 0.10, persistenceFloor: 0.60,
      failedVisibleCap: 0.5, hiddenWeight: 0.6, conceptWeight: 0.4, minHiddenRate: 0.80
    },
    attainmentBase: 1.5,
    assurance: {
      a1MaxVoiceEditRatio: 0.30, a1MaxPastedRatio: 0.20, a1MaxSinglePaste: 80,
      challengeSampleRate: 0.20, challengeStartWithinS: 20, challengeMinS: 20, challengeMaxS: 60
    },
    similarity: { ngram: 5, jaccard: 0.85 },
    goldSetPerNode: 30,                            // §7.9
    parityNaturalisticShareLater: 0.30, parityLaterLearners: 500,  // §5.6
    faculty: {
      minutesPerReview: 2,                         // §7.8 load forecast
      borderline: 0.10, calibrationTarget: 30, calibrationWeeks: 8, minSampleRate: 0.10, maxSampleRate: 1.0,
      kappa: { minN: 20, minLower: 0.50, minPoint: 0.60, ci: 0.90 }
    },
    releaseGate: {
      maxAgreementDrop: 5, maxPassRateShift: 10, parityMargin: 0.05, parityAlpha: 0.05,
      minParityPairs: 60, minNaturalisticShare: 0.15, minSpanCheckRate: 0.98
    },
    attempts: {
      reviewRetryDays: 1, renewalAttempts: 2, renewalCooldownDays: 7,
      practicalAttempts: 3, practicalWindowDays: 90, practicalCooldownDays: 14
    }
  },
  retention: {
    initialIntervalDays: 3, strongMargin: 0.10, strongFactor: 2.5, marginalFactor: 1.8,
    maxIntervalDays: 120, failIntervalDays: 1,
    freshness: { floorOverdue: 0.7, overdueSlope: 0.3, staleMonths: 18, stale: 0.5 },
    consolidationGapDays: 14
  },
  label: {
    confirmed: { window: 6, minPasses: 3, minSpanDays: 14, minCq: 0.75, thetaMargin: 0.10, minFreshness: 0.85, minAssurance: 'A2', codeMinEvidence: 'L2' },
    foundational: { maxCq: 0.50, persistenceMinPasses: 2 },
    crossNodeMinWeight: 0.25
  },
  credential: { validMonths: 18, statusCacheHours: 24 },
  verify: { perIpPerHour: 100, notFoundPerHour: 20 },
  nameCheck: { minSeenCount: 3, honorifics: ['mr', 'ms', 'dr', 'sri', 'smt', 'kumari'], minMass: 0.6, commonIdf: 1.5, jaroWinkler: 0.92, initialsWeight: 0.6, coldStartNames: 5000, coldStartPairs: 2, perIdPerHour: 10, perIpPerHour: 30 },
  readiness: {
    gate: { minLabel: 'Partial', minEvidence: 'L1', minTheta: 0.70, minAssurance: 'A1', minAssuranceNoInterview: 'A3', minFreshness: 0.70 },
    labelValue: { Confirmed: 1.00, Partial: 0.80, Foundational: 0.55 },
    evidenceFactor: { L1: 0.85, L2: 1.00, L3: 1.00, L4: 1.05 },
    assuranceFactor: { A1: 0.90, A2: 1.00, A3: 1.00 },
    thetaFactor: { base: 0.85, slope: 0.5, pivot: 0.60 },
    practicalFloor: 0.9,
    weights: { must: 1.0, nice: 0.5 },
    caps: { mustHaveUnmet: 59, testMissing: 79 },
    bands: { ready: 80, nearReady: 65, building: 45 },
    projected: { currentNode: 0.30, planned: 0.15, selfDeclared: 0.25 },     // §11.2, learner-only
    bridge: { mustTarget: 0.80, niceTarget: 0.55, nodeGain: 0.80 },          // §13
    earlyWarning: {                                                         // §12.4
      paceCollapseShare: 0.40, paceCollapseWeeks: 2, stuckLoops: 4, stuckSessions: 3,
      risingNodes: 3, disengagedShare: 0.30, disengagedWindow: 20,
      retentionPassRate: 0.60, retentionWindow: 10, retentionWarmups: 3,
      authenticityA0Share: 0.30, authenticityWindow: 10
    },
    velocity: { pseudoCount: 5, ewmaAlpha: 0.5, ewmaWeeks: 4 },
    agility: { minNodes: 10, maxNodes: 15, efficient: -0.30, improving: 0.05, improvingStrongly: 0.15, ci: 0.80 }
  },
  match: {
    kAnon: 5, roundTo: 5, searchesPerDay: 200, nearDuplicateQueries: 20, nearDuplicateWindowMin: 10,
    fairBucketWidth: 3, accessExpiryDays: 7, deniedCooldownDays: 30, expiredCooldownDays: 14,
    pendingPerWeek: 30, endorsementMinRating: 4
  },
  dayOne: { minMinutes: 60, maxMinutes: 90, minTickets: 3, maxTickets: 5, handoverSeconds: 60 },
  reverseReceive: { confirmedTheta: 0.80, interviewTriggerJri: 80 },
  outcomes: {
    weightTruncation: 0.95, stepY1: 0.05, stepY2: 0.10, minY1PerDomain: 100, minY2PerSkill: 50,
    demand: { openings: 1.0, searches: 0.2, requests: 0.5, offers: 2.0, external: 0.3, trendMonths: 3, minEmployers: 3, maxEmployerShare: 0.40, staleDays: 60 },
    fairness: { minGroup: 30, fourFifths: 0.8, maxCalibrationGap: 0.10 }
  },
  consent: { searchDropSeconds: 60, retentionMonths: 12, credentialRetentionMonths: 12 },
  outcomesElicitation: { syntheticProfiles: 40 },
  institution: { placementMinGroup: 5, benchmarkMinInstitutions: 3 },   // §16
  lowBandwidth: { opusKbps: 16, cachedNodeSkeletons: 2 },              // §19
  ai: {
    timeoutMs: 20000, retries: 1, schemaRepairs: 1,
    costAlarmFactor: 1.3, costAlarmDays: 3,
    canary: { frozenAnswers: 200, teachingPrompts: 50, maxAgreementDrop: 3, maxMeanAbsDelta: 0.05, maxSchemaFailures: 0.01, maxParityD: 0.05 }
  },
  security: {
    passwordMinLength: 10, bcryptRounds: 10,
    lockout: { maxFailures: 5, windowMinutes: 15 },
    session: { staffHours: 168, learnerHours: 168, employerHours: 24, adminHours: 24 },
    rateLimits: {
      login: { perIp: 30, perAccount: 10, windowMinutes: 15 },
      ai: { perAccountPerMinute: 30, perInstitutionPerMinute: 600 }
    },
    webhookMaxDriftSeconds: 300
  },
  outbox: { pollMs: 2000, batch: 50, backoffMinutes: [1, 5, 30, 120, 720] },
  // Feature flags (E7): new behaviour ships off and is recorded as an erratum.
  flags: {
    cookieOnlyAuth: false, // when on, Bearer tokens are refused (after the frontend moves to cookies)
    hybridRetrieval: false
  }
};

// v4.3 Appendix A.1 — calibration register. Every parameter group, its stage
// now, how it is calibrated and when it moves from prior to measured. Shown in
// the admin quality report; no parameter changes outside this process.
export const CALIBRATION_REGISTER = [
  { group: 'θ default, persistence rule, borderline band', keys: ['evidence.fusion', 'evidence.faculty.borderline'], stage: 'prior', method: 'Faculty review of borderline decisions vs later review pass rate', trigger: '≥ 30 reviews per node' },
  { group: 'Bandit prior, exploration, override probability', keys: ['teaching.bandit'], stage: 'prior', method: 'Off-policy evaluation of logged propensities', trigger: '≥ 2,000 logged choices per context' },
  { group: 'CKB leakage cut-offs, lexicons', keys: ['teaching.cult', 'teaching.leakage'], stage: 'prior', method: 'Faculty labels of memorised imagery vs understood; cut-offs at best F1', trigger: '≥ 200 labelled answers per language' },
  { group: 'Retrieval thresholds, k, context budgets', keys: ['retrieval'], stage: 'prior', method: 'Retrieval gold set; budgets tuned on overflow vs answer quality', trigger: '≥ 50 labelled pairs per store and language' },
  { group: 'Authorship: paste/edit limits, challenge windows', keys: ['evidence.assurance'], stage: 'prior', method: 'Red-team vs genuine attempts; false-flag rate ≤ 5%', trigger: '≥ 300 red-team and 1,000 genuine attempts' },
  { group: 'Review schedule, freshness curve', keys: ['retention'], stage: 'prior', method: 'Half-life fit of review pass probability', trigger: '≥ 5,000 reviews' },
  { group: 'Label thresholds (Cq, span, best score)', keys: ['label'], stage: 'prior', method: 'Agreement with faculty-judged durable mastery; later y2', trigger: '≥ 500 faculty-judged nodes' },
  { group: 'Label values, evidence, assurance and θ factors', keys: ['readiness.labelValue', 'readiness.evidenceFactor', 'readiness.assuranceFactor', 'readiness.thetaFactor'], stage: 'expert prior', method: 'Elicitation, then y1 within ±0.05, then y2 within ±0.10 per quarter', trigger: '≥ 100 y1 per domain; ≥ 50 y2 per skill' },
  { group: 'Agility bands', keys: ['readiness.agility'], stage: 'prior', method: 'Band vs later review pass rate and y2', trigger: '≥ 1,000 learners with 10+ nodes' },
  { group: 'Early-warning thresholds', keys: ['readiness.earlyWarning'], stage: 'prior', method: 'Alert precision against learners who later stalled', trigger: '2 full cohorts' },
  { group: 'Fairness flags, k-anonymity k, demand weights', keys: ['outcomes.fairness', 'match.kAnon', 'outcomes.demand'], stage: 'policy', method: 'Set by policy and law, reviewed annually; not fitted', trigger: '—' }
];
