// config/priors.js
// Prior defaults for every calibrated number in the engine (spec §8, standing
// in for Appendix A of the PDF). These are a DEVELOPMENT FALLBACK only: in
// production config/params.js refuses to start without secure-config/.
// Code reads these through params.get('label.confirmed.minPasses'), never as
// literals. Changing a value here is a decision recorded in docs/decisions.md.
export const PRIORS = {
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
    grounding: { doubtSampleRate: 0.10, instructSampleRate: 0.02, minGroundedRate: 0.90, windowDays: 7 }
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
    faculty: {
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
  nameCheck: { minMass: 0.6, commonIdf: 1.5, jaroWinkler: 0.92, initialsWeight: 0.6, coldStartNames: 5000, coldStartPairs: 2, perIdPerHour: 10, perIpPerHour: 30 },
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
  consent: { searchDropSeconds: 60, retentionMonths: 12 },
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
      ai: { perAccountPerMinute: 30 }
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
