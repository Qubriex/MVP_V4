# App screen-recording plan (Playwright)

Record from the running app using the dev login stage accounts or the demo sandbox. Never record real student data.

## Before recording
- Set "Learning in" = Telugu (Telugu videos and every "in your language" shot). Record an English-mode take too, for English-only reels where noted.
- Wait until audio and data have loaded: no "Getting the audio ready...", spinners or skeletons in frame.
- Viewport 1440x900, deviceScaleFactor 2, 30 fps, visible cursor (inject a small cursor dot).
- "Sample data" badge on; no "Test", "TEST-LRNR-..." IDs or real names on screen.
- Save each clip to `video/assets/screens/<shot-id>.mp4`, plus the app's own lesson audio if it plays.

## Shot list
| Shot id | Account / page | Action | Zoom area | Used in |
|---|---|---|---|---|
| S01-topic | Learner > Topics | Open Python > Loops | Topic tree | explainer, reel-2, investor |
| S02-lesson-te | Learner > Lesson (Telugu) | Press Listen, 10 s of voice | Lesson panel | pitch, explainer, institution, investor |
| S03-code-walk | Learner > See the code | "Walk me through it" | Code block with line highlight | pitch, explainer, reel-1 |
| S04-practise | Learner > Practise | Type fix, open hint, run tests | Editor + test results | explainer, investor |
| S05-check | Learner > Check | Pass a fresh check | Result card | explainer, investor |
| S06-passport | Learner > Passport | Open passport, show QR | Passport card | pitch, reel-3, employer, investor |
| S07-ask | Learner > Ask Qubirex | Voice/typed doubt in Telugu, answer | Q&A panel | reel-4 |
| S08-cohort | Institution > Cohort readiness | Scroll table, open "Why not ready?" | Readiness table | institution, investor |
| S09-gaps | Institution > Topic gaps | Hover a weak topic, send nudge | Gap chart + nudge | institution |
| S10-verify | Public verify page | Open passport link / scan QR | Evidence per skill | employer, reel-3 |
| S11-search | Employer > Search | Filter by proven skill, invite | Results list | employer, investor |

If a shot cannot be recorded (page missing or broken), list it in REPORT.md and use a clearly labelled design mock-up only if the founder approves.
