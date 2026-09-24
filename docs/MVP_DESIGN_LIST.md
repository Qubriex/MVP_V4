# QUBIREX MVP — COMPLETE DESIGN LIST

**Inferexaa Private Limited · Qubirex · Confidential**

---

## MODULE 1 — TARGET INGESTION SYSTEM

### 1.1 Path A — Structured Input
- [ ] Receive Capability Target Document in standard format
- [ ] Parse fields: clusters, proficiency levels, mastery thresholds, priority, time window, evidence type
- [ ] Map incoming cluster labels to internal learning structure at runtime (no hardcoded values)
- [ ] Handle taxonomy changes without code change (reads from document)

### 1.2 Path B — Any Format Input
- [ ] Accept: curriculum document, JD, skills list, competency matrix, government framework, plain text
- [ ] AI extraction of capability intent: what skills, what proficiency level, what timeline
- [ ] Structure extracted targets into internal format
- [ ] Return confirmation summary to institution BEFORE instruction begins
- [ ] Confirmation mandatory — no silent misinterpretation
- [ ] Human-assisted at MVP stage; AI automation in next release

### 1.3 Pathway Design
- [ ] Decompose each cluster into ordered skill nodes (micro-skill graph)
- [ ] Foundational nodes precede applied nodes
- [ ] Prerequisite relationships respected
- [ ] Difficulty progression set against target proficiency level
- [ ] Pathway is Qubirex's internal operating plan — not shared with institution

---

## MODULE 2 — INSTRUCTION ENGINE

### 2.1 Native-Language Construction
- [ ] Explanations constructed FROM SCRATCH in Hindi or Telugu
- [ ] NOT translated from English — generation process begins in target language
- [ ] Culturally familiar entry point selected for each learner profile
- [ ] English technical term introduced ONLY AFTER concept understood in native language
- [ ] Quality test: concept transfers without English support

### 2.2 Adaptive Branching
- [ ] ADVANCE decision: mastery check passes threshold — move to next node
- [ ] LOOP decision: mastery check fails — new approach, not same explanation
- [ ] 5 explanation approaches available per node: native_concept, analogy, worked_example, decomposition, socratic
- [ ] Loop count logged per node per learner
- [ ] High loop count = signal about explanation architecture, not learner failure
- [ ] No hard loop limit at MVP — continues until mastery confirmed

### 2.3 Explanation Approaches
| Approach | Description |
|---|---|
| native_concept | Build from culturally familiar native-language entry point |
| analogy | One powerful everyday analogy from learner's actual life |
| worked_example | Complete worked example BEFORE abstract concept |
| decomposition | Identify and teach missing prerequisite micro-skill |
| socratic | Ask questions that guide the learner to the concept through their own reasoning |

### 2.4 Session Management
- [ ] Session started per learner per skill node
- [ ] Full conversation history maintained per session
- [ ] Session logged internally (proprietary — not shared)
- [ ] Active instruction time tracked (minutes, not calendar time)
- [ ] New session created for each loop with new approach

---

## MODULE 3 — MASTERY CHECK SYSTEM

### 3.1 Check Design
- [ ] Applied question or micro-task — learner USES concept, not recalls it
- [ ] Scenario-based: "here is situation Y, how would you use X?" not "what is X?"
- [ ] Check in native language (Hindi or Telugu)
- [ ] AI evaluates quality of understanding, not keyword matching

### 3.2 Scoring Rubric
| Score | Meaning | Decision |
|---|---|---|
| 0.90–1.00 | Confident, correct application | ADVANCE |
| 0.70–0.89 | Understanding with minor gaps | ADVANCE (log gaps) |
| 0.50–0.69 | Partial understanding | LOOP with targeted correction |
| 0.00–0.49 | Fundamental misunderstanding | LOOP from different angle |

**Threshold: ≥ 0.70 = ADVANCE. < 0.70 = LOOP.**

### 3.3 Check Integrity Rule
- [ ] Advancement must be conditioned on response QUALITY, not submission
- [ ] ANY response without demonstrated understanding = LOOP
- [ ] Check number logged per node
- [ ] All check results stored for mastery attainment calculation

---

## MODULE 4 — MASTERY LOG PRODUCTION

### 4.1 Field Specification
| Field | Status | Owner |
|---|---|---|
| learner_reference | Always populated | Shared |
| capability_target_document_reference | Always populated | Qubirex |
| cluster_covered | Always populated (institution's labels) | Qubirex produces |
| skill_node | Always populated | Qubirex (proprietary) |
| mastery_attainment (%) | Always populated | Qubirex (proprietary) |
| time_to_mastery_minutes | Always populated | Qubirex (proprietary) |
| attempt_count | Always populated | Qubirex (proprietary) |
| confidence_indicator | Always populated | Qubirex (proprietary) |
| simulation_readiness_flag | Always populated | Qubirex signal |
| **readiness_classification** | **ALWAYS BLANK** | **Institution only** |
| **external_score** | **ALWAYS BLANK** | **Assessment platform only** |

### 4.2 Calculation Logic
- **Mastery Attainment**: Recency-weighted average of check scores (more recent checks weighted higher)
- **Confidence Indicator**: Combination of pass rate, loop penalty, and score consistency (stability measure, not readiness)
- **Simulation Readiness**: Binary flag — all nodes mastered + avg mastery ≥ 75% + avg confidence ≥ 60%

### 4.3 Boundary Statement
Every Mastery Log includes: *"This Mastery Log records capability movement and instruction evidence only. Readiness classification and external scoring are owned by the commissioning institution and are not populated by Qubirex under any circumstances."*

---

## MODULE 5 — INSTITUTION PORTAL

### 5.1 Onboarding
- [ ] Institution registration with type classification
- [ ] Contact details, city (Hyderabad default)
- [ ] JWT authentication (7-day tokens)

### 5.2 Learner Management
- [ ] Add individual learners (name, ref number, language, profile type)
- [ ] Bulk import via JSON array
- [ ] Language assignment per learner (Hindi or Telugu)
- [ ] Learner reference is institution's own ID

### 5.3 Engagement Management
- [ ] Create engagement against confirmed capability target
- [ ] Assign learner cohort to engagement
- [ ] View cohort progress (current node, nodes mastered, status)
- [ ] Engagement ID visible for learner login distribution
- [ ] Produce Mastery Logs on completion
- [ ] Download/view structured Mastery Log per learner

### 5.4 Dashboard
- [ ] List of all engagements with status
- [ ] Learner count, completion count per engagement
- [ ] Quick actions: upload target, start engagement

---

## MODULE 6 — LEARNER PORTAL

Nine pages under `/learn/*`, sharing one sidebar (Learn · Career · Me). The
voice session runs full screen.

### 6.1 Authentication (`/learner-login`)
- [ ] Login via learner reference number + engagement ID + 6-digit PIN
- [ ] Interface language picked on the login page: Telugu / Hindi / English (labels only — teaching language stays set by the institution)
- [ ] "Keep me signed in" and a Forgot-PIN pointer to the institution
- [ ] First sign-in goes through a 3-step setup (`/learn/welcome`): basics, goals, voice check

### 6.2 Home Dashboard (`/learn/dashboard`)
- [ ] Welcome in native language (नमस्ते / నమస్కారం)
- [ ] Continue learning: current node, node position, estimated time, last approach — voice-first start button, "type instead"
- [ ] Overall progress, day streak, active time this week, clusters done
- [ ] Jobs that fit your skills (match %), skills worth learning next, topics creating new jobs — labelled Sample data
- [ ] Recently mastered nodes; nudge to finish the profile

### 6.3 Voice Learning Session (`/learn/session`, desktop + phone)
- [ ] Professor Qubirex speaks each turn (browser TTS); speaking / listening / thinking indicator
- [ ] Live native-language caption with an English line under it (TEACH returns `captionEn`)
- [ ] Big mic button (on-device speech recognition, or server transcription of recorded audio), replay, speed, pause
- [ ] Switch to typing at any time
- [ ] Side panel: transcript (every message replayable) and a Board tab for the diagrams (mermaid) and code TEACH sends
- [ ] Approach badge, language badge, loop counter, session timer
- [ ] "I'm ready for the check" button — asks TEACH to set the mastery check now
- [ ] Mastery check banner in check mode; ADVANCE result with next node; programme-complete state
- [ ] Active instruction time tracked by heartbeat, visible tab only

### 6.4 Skill Path & Record (`/learn/record`)
- [ ] The learner's own view of their mastery record: clusters, node status, evidence per mastered node (mastery %, attempts, time, confidence)
- [ ] Session content stays private; share the record as text

### 6.5 Career (`/learn/market`, `/learn/market/:jobId`, `/learn/topics`)
- [ ] Job market: filters, headline numbers, monthly demand chart (with table view), skills JDs ask for most tagged mastered / in your path / not in path, job cards with match % and skill chips, saved / applied
- [ ] Job detail: full JD, match score, skills you have (with evidence), skills to learn with hours, tailor resume, practise interview by voice, read the JD aloud in the learner's language
- [ ] Emerging topics: featured topic with new roles and an ordered learning list, grid filtered by sector, 2-minute spoken intro
- [ ] Skills outside the programme show **Request**, never "add to path" — the institution owns the pathway and sees aggregated requests
- [ ] All market figures are sample data until a job feed is connected; every page showing them says so

### 6.6 Me (`/learn/profile`, `/learn/resume`)
- [ ] Profile: personal info, education, experience, projects, skills (verified by Qubirex vs self-declared), certifications, career goals, learning & voice preferences, account & PIN
- [ ] Speak the "About you" summary in Telugu/Hindi; it is written in English
- [ ] Resume builder: template, section toggles and order, tailoring to a saved job (only verified or declared skills), live A4 preview, PDF download, saved versions

## MODULE 7 — DATA ARCHITECTURE

### 7.1 Proprietary Data (Qubirex only)
- Full session interaction logs (`session_messages`)
- Mastery check evaluation details (`mastery_checks`)
- Advance/loop decision reasoning
- Explanation pathway taken per learner
- Internal skill node graph

### 7.2 Shared Data
- Mastery Log (produced by Qubirex, used by institution)
- Learner reference (institution's own ID, used in log)

### 7.3 Institution-Only Data
- Readiness classification
- External assessment score
- Placement/progression decisions

### 7.4 Data Sovereignty Rules
- Session logs never returned to institutions directly
- No PII export
- Engagement data isolated per institution

---

## MODULE 8 — ADMIN & QUALITY MONITORING

### 8.1 Admin Dashboard
- [ ] Total institutions, learners, engagements
- [ ] Active engagement count
- [ ] Mastery logs produced
- [ ] Sessions total, checks passed/failed
- [ ] Average mastery attainment
- [ ] Average loop count

### 8.2 Quality Reports
- [ ] Node difficulty ranking (by avg_attempts) — high = explanation architecture issue
- [ ] Approach effectiveness (which approaches used most, avg loops per approach)
- [ ] Time-to-mastery by node type
- [ ] Confidence indicator distribution
- [ ] Loop frequency by cluster

---

## MODULE 9 — DEFERRED (POST-MVP)

| Feature | Reason Deferred |
|---|---|
| Full multi-language beyond Hindi/Telugu | Validate one language before adding breadth |
| Consumer / direct-to-learner channel | Requires Default Capability Target Library (not built yet) |
| Path B full AI automation | Process must be proven manually before automated |
| Institutional readiness dashboards | These show readiness — Qubirex doesn't frame evidence as readiness |
| Native LMS API integrations | Scaling feature — build after engine is validated |
| ~~Voice-based instruction~~ | **Moved into the MVP** (6.3) with the learner-side redesign — browser speech in/out, server transcription fallback. Server-side TTS voices remain post-MVP. |
| ~~Personal capability portfolio~~ | **Partly moved into the MVP**: learner-facing record (6.4), profile and resume (6.6). Public verification links remain post-MVP. |
| Live job feed | Market pages ship on sample data (6.5); feed ingestion + JD skill extraction is post-MVP |
| Employer connect | Year 2 target (job pages link out; no employer-side accounts) |

---

## PILOT READINESS CHECKLIST

- [ ] Hindi instruction engine operational: natively constructed, mastery check running
- [ ] Telugu instruction engine operational (Phase 1 dual launch)
- [ ] Path B extraction: human-assisted extraction and confirmation process documented
- [ ] One non-Provenor client engaged: real brief, real instruction, real Mastery Log
- [ ] Mastery attainment logged per node per learner
- [ ] Blank fields confirmed blank in all produced Mastery Logs
- [ ] Loop count and alternative approach data captured
- [ ] Advance/loop decisions conditioned on check quality, not submission
- [ ] Institution can view cohort progress without accessing session logs
- [ ] Mastery Log delivered as formal structured document (not a dashboard, not a summary call)

---

*Inferexaa Private Limited · Qubirex · Strictly Confidential · MVP Design List v2.0*
