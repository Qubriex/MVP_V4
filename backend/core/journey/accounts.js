// core/journey/accounts.js — the journey test learners: one per stage of the
// learning journey (S0 invited … S12 going stale), Telugu for every stage and
// Hindi for S1, S3 and S7. Fixed ids in the test tenant; scripts/journeyData.js
// builds them and core/testTenant.js adds them to the /dev allowlist.
export const JOURNEY_ENGAGEMENTS = { telugu: '4a4c13c4-989e-4c03-b636-3bdba7fd1025', hindi: 'test-eng-hindi-0001' };

// [key, stage, language, name, what the card says]
export const JOURNEY = [
  ['s0', 'S0', 'telugu', 'Ravi Teja', 'Invited: has an invite link, never signed in'],
  ['s1', 'S1', 'telugu', 'Sravani Reddy', 'First day: welcome steps, language and voice, starting check not started'],
  ['s2', 'S2', 'telugu', 'Kiran Kumar', 'Starting check done: placement, "Start here", first lesson ready'],
  ['s3', 'S3', 'telugu', 'Bhavana Rao', 'Learning: mid-path, 2 reviews due, a bridge programme from the college'],
  ['s4', 'S4', 'telugu', 'Mahesh Babu Naidu', 'Check failed: retry, "explain another way", help asked from the professor'],
  ['s5', 'S5', 'telugu', 'Swathi Priya', 'Skill group done: certificate and Mastery Log'],
  ['s6', 'S6', 'telugu', 'Venkat Sai', 'Nearly ready for a role: bridge plan, 2 skills short'],
  ['s7', 'S7', 'telugu', 'Lakshmi Durga', 'Ready: Confirmed skills (A2 and A3), Passport shared publicly'],
  ['s8', 'S8', 'telugu', 'Harsha Vardhan', 'Employer request waiting, with an interview promise'],
  ['s9', 'S9', 'telugu', 'Divya Sri', 'Day-One Simulation: practice done, scored run pending'],
  ['s10', 'S10', 'telugu', 'Naveen Chandra', 'Offer: applied → shortlisted → interview → offer'],
  ['s11', 'S11', 'telugu', 'Anusha Kodali', 'Hired: placed, 90-day employer rating on the Passport'],
  ['s12', 'S12', 'telugu', 'Srinivas Goud', 'Going stale: skills ageing, Passport renewal due'],
  ['s1-hi', 'S1', 'hindi', 'Pooja Verma', 'पहला दिन: स्वागत के कदम, शुरुआती जाँच बाकी'],
  ['s3-hi', 'S3', 'hindi', 'Rohit Sharma', 'सीख रहे हैं: बीच का रास्ता, 2 रिव्यू बाकी, कॉलेज का ब्रिज प्रोग्राम'],
  ['s7-hi', 'S7', 'hindi', 'Anjali Singh', 'तैयार: Confirmed skills, Passport सार्वजनिक']
].map(([key, stage, language, name, note]) => ({
  key, stage, language, name, note,
  learnerId: `test-j-${key}`, elId: `test-jel-${key}`, ref: `TEST-J-${key.toUpperCase()}`,
  accountKey: `journey_${key.replace('-', '_')}`,
  engagementId: JOURNEY_ENGAGEMENTS[language]
}));

/** Plain-words names of the stages, for /dev, the college's Students page and the journey checklist. */
export const STAGE_NAMES = {
  S0: 'Invited', S1: 'First day', S2: 'Starting check done', S3: 'Learning', S4: 'Check not passed yet', S5: 'Skill group done',
  S6: 'Nearly ready', S7: 'Ready', S8: 'Employer request', S9: 'Day-One Simulation', S10: 'Offer', S11: 'Hired', S12: 'Going stale'
};
