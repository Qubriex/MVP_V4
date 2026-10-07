// src/components/shared/glossary.js — plain words for every term the app shows
// (the same wording Ask Qubirex uses; backend core/assist.js GLOSSARY).
export const GLOSSARY = {
  A0: ['Authorship A0', 'Not checked yet.'],
  A1: ['Authorship A1', 'Done on their own, in their own words.'],
  A2: ['Authorship A2', 'Explained the answer aloud and handled a follow-up question.'],
  A3: ['Authorship A3', 'Done under supervision, watched live.'],
  authorship: ['Authorship', 'How sure Qubirex is that the learner did the work. A0 not checked · A1 self-done · A2 explained aloud · A3 watched live.'],
  L1: ['Evidence L1', 'Checked against a rubric.'],
  L2: ['Evidence L2', 'The learner’s code was run and worked.'],
  L3: ['Evidence L3', 'A faculty member reviewed it.'],
  L4: ['Evidence L4', 'Confirmed outside Qubirex, for example by an employer.'],
  evidence: ['Evidence level', 'How strongly a skill was assessed: L1 rubric · L2 code run · L3 faculty · L4 outside.'],
  readiness: ['Readiness', 'How well proven skills match the best-fitting target role, out of 100. Ready from 80, Nearly ready from 60, Building below that. Only verified skills count.'],
  ready: ['Ready', 'Readiness 80 or more: proven skills cover what the target role asks for.'],
  nearly: ['Nearly ready', 'Readiness 60–79: one or two required skills still to prove.'],
  building: ['Building', 'Readiness under 60: still learning the core skills.'],
  fresh: ['Freshness', 'Fresh — shown recently. Ageing — a short review is due soon. Needs refresh — not shown for a long time.'],
  passport: ['Capability Passport', 'The learner’s signed record of what they proved. Anyone can check it with the Evidence ID; the learner chooses who sees the details.'],
  bridge: ['Bridge programme', 'Extra work for students who are nearly ready, then a re-test that shows whether it worked.'],
  mastery: ['Mastery', 'A skill counts as mastered when the learner passes a fresh check on it, written by the assessment system, not the teacher.'],
  loops: ['Loops', 'How many times a learner needed the skill taught a different way before passing. A reason to help, not a mark against them.']
};
