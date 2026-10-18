# Qubirex UI/UX overhaul — report

Branch `claude/learner-side-updates-vthycg`, commits `80187db` (phase 1) →
`85cbd30` (2) → `65daa93` (3) → `7fdcf41` (4) → `cd3af82` (5) → this report.

## 1. Summary

1. One design foundation: self-hosted Outfit + Anek + JetBrains Mono, a six-size type scale, one primary red, band colours (Ready green · Nearly amber · Building blue), and a shared component kit used on every side.
2. Every learner, college, employer and admin screen is translated: 3,064 keys each in English, Telugu and Hindi, with one language switch everywhere and `npm run i18n:check` guarding it.
3. Words are consistent: College, cohort, skill group, lesson, target, Confirmed / Partial / Not yet, Fresh / Ageing / Needs refresh. Placeholders are gone, and job cards now name what is left to learn.
4. Phones: learner bottom tab bar, tables become cards, Ask button icon-only, bigger voice controls. No sideways scroll at 360 px on any of the 62 routes.
5. Interactivity: hero sample lesson and animated Passport; guided demo tours; FAQ; screenshot strip; progress ring; Passport filters, grid and share card; college heat-map; employer sample JD; toasts and skeletons.

## 2. Design foundation

- **Fonts:** Outfit (headings), Anek Latin/Telugu/Devanagari (body, Hind fallback), JetBrains Mono (code). All are self-hosted in `public/fonts` (OFL), use `font-display: swap`, and preload the Latin faces plus the face for the saved language. Stats and tables use tabular numbers.
- **Brand book needs an update:** web fonts = Outfit + Anek. IBRAND stays for the logo and marketing only.
- **Type scale:** `--fs-display`, `--fs-h1`, `--fs-h2`, `--fs-h3`, `--fs-body`, `--fs-small`, `--fs-caption`. 212 `fontSize` values now use these tokens. The only literals left are the printed résumé's own point sizes.
- **Colour:**
  - One primary colour: `--brand-primary-strong` #C4302A. Orange is decoration only.
  - Band colours as above. Red only for errors, locked, revoked and overdue.
  - `#9B3A2A` and the slate palette are gone.
  - Dark mode was checked with the same token pairs (see the contrast table).
- **Kit** (`components/shared/ui`): Button, IconButton, Select, Input, Textarea, Field, Card, StatTile, Table (cards below 640 px), Tabs, Pill, BandPill, BandBar, EmptyState (with action), Skeleton, Toast, Tooltip, Modal, Drawer, PageHeader, plus new **Switch** and **ProgressRing**.
- **Widths:** one content width plus `ui-narrow` (860 px) for forms. The Verify, Sponsor-form and sign-in Verify card widths are fixed.

### Contrast (WCAG AA 4.5:1)

| Theme | Pair | Ratio |
|---|---|---|
| Light | Body #17222B on page #FAF8F6 / card #FFFFFF | 15.25 / 16.15 |
| Light | Secondary #5B6670 on page / card / surface-2 | 5.54 / 5.87 / 4.95 |
| Light | White on primary #C4302A (buttons); #C4302A links on white | 5.52 |
| Light | Ready #287045 on #E6F3EB · Nearly #9A5B00 on #FBF0DD · Building #2F5F8A on #E6EEF6 · Error #B42318 on #FCE8E6 | 5.26 · 4.81 · 5.74 · 5.58 |
| Dark | Body #F5F1EC on page / card · secondary #A9B4BD on card | 15.62 / 13.83 · 7.37 |
| Dark | Ready · Nearly · Building · Error tags | 7.28 · 7.33 · 7.21 · 6.53 |
| Sidebar | #F5F1EC on ink #17222B | 14.36 |

The success green was darkened from #2E7D4F (4.42:1, failed) to #287045 after axe flagged it.

## 3. Issue table

| # | Item | Status |
|---|---|---|
| 1 | Fonts broken / inconsistent (Telugu glyphs on slow networks) | Fixed — self-hosted, preloaded |
| 2 | 23 ad-hoc font sizes | Fixed — six-size scale |
| 3 | Several "primary" colours, orange buttons | Fixed — one primary |
| 4 | Band colours differ by page | Fixed — one BandPill/BandBar everywhere |
| 5 | Leftover hex / Tailwind slate | Fixed |
| 6 | Verify, Sponsor and sign-in Verify widths | Fixed |
| 7 | Two language pickers (/learner-login had its own) | Fixed — one LangSwitch, same state |
| 8 | Portals mostly English in Telugu/Hindi mode | Fixed — all screens translated; median Telugu share 85 % |
| 9 | Old tagline "Receive. Build. Return." | Fixed — sign-in pages, health API, Mastery Log, brand line |
| 10 | Institution vs College; "Staff sign in" | Fixed — "College staff sign in" |
| 11 | Portal sidebars in different styles | Fixed — **dark ink for all** (reasons below) |
| 12 | Jargon: cluster / node / bar / Engagement / L-A codes | Fixed — plain words; codes in a glossary popover |
| 13 | "Partial mastery", freshness % | Fixed — Confirmed / Partial / Not yet; Fresh / Ageing / Needs refresh, % only in the Passport tooltip |
| 14 | Visible placeholders ([PRICE], [Institution name], [Company name], [Name]) | Fixed |
| 15 | "60% match" + "No required skills missing" | Fixed — top skills still to learn (Dashboard, Jobs; market cards already list chips) |
| 16 | Every tab titled the same | Fixed — unique translated titles per route |
| 17 | Employer badge meant something else than the page | Fixed — Home = waiting for decision; Company = setup steps |
| 18 | Learner home had both a search bar and an ask bar | Fixed — one Ask Qubirex box with "Search jobs" |
| 19 | Cohort activity chart showed a whole year | Fixed — last 12 weeks, "Show all" for 52 |
| 20 | Sign-in pages had no way back / no language | Fixed — slim header: back to home + language switch |
| M1 | Learner nav on phones | Bottom tab bar Home · Learn · Passport · Jobs · Me, safe-area aware |
| M2 | Wide tables on phones | Cards below 640 px |
| M3 | Public header on phones | Language switch and Talk to us inside the menu sheet |
| M4 | Ask Qubirex button wrapped | Never wraps; icon-only below 640 px |
| M5 | Voice session on phones | 96 px mic; transcript sheet with a 44 px handle |
| M6 | Sideways scroll | 0 of 62 routes overflow at 360 px or 1440 px (Playwright) |

**Why a dark sidebar for every portal (item 11):**
- College, employer and admin already used it, so only the learner side changed.
- The logo has an on-dark version made for it.
- It separates navigation from content clearly in both light and dark themes.
- Its text contrast is 14.4:1.

## 4. Translation coverage

- 3,064 keys, complete in en, te and hi. `npm run i18n:check` passes. It fails on:
  - missing keys;
  - changed `{placeholders}`;
  - unknown keys;
  - `t()` calls with no hook in scope;
  - English JSX text not wrapped in `t()`.
- Playwright Telugu-mode share of Telugu letters, by route: median 85 %. The lowest is admin Evaluator quality at 28 %, which is mostly metric names and skill data.
- English left in Telugu/Hindi mode by design: product names (Qubirex, Evidence ID codes), skill and topic names, job descriptions, company names, sample people, code, and the English résumé content a learner types.
- Board report: English, Telugu and Hindi. It follows the screen language unless `?lang=` is set.

**TODO-review** (natural but worth a native reviewer's eye; not marked in the UI so the strings stay clean):
- Telugu:
  - "రచయితత్వం" (authorship)
  - "కేపబిలిటీ పాస్‌పోర్ట్" (kept as a transliteration)
  - "మూల్యాంకనకర్త" (evaluator)
  - "క్యాలిబ్రేటెడ్"
  - "పాతబడుతోంది / మళ్లీ చూపాలి" (Ageing / Needs refresh)
  - "లెర్నర్ రిఫరెన్స్"
  - "బ్యాచ్" for cohort (matches the existing public pages)
- Hindi:
  - "लेखकत्व" (authorship)
  - "पुष्ट" (Confirmed)
  - "दोहराव" (review)
  - "प्रमाण" (evidence)
  - "बैच" for cohort
- Both: the Telugu sample sentences in the home hero and the employer tour text.

## 5. Interactivity added

- **Home:**
  - Tap-to-play Telugu sample lesson with a waveform and Telugu + English captions. It uses the browser's Telugu voice; without one, captions play alone and say so.
  - The sample Passport then animates two skills to Confirmed. All of this is reduced-motion aware.
  - Screenshot strip, FAQ accordion, and "Trusted by" behind `config/features.js` (off).
- **Demos:** a 3-step guided tour per side, "Demo only — nothing is saved". Esc closes it, and it opens once by itself.
- **Learner:**
  - Progress ring, streak with flame, "Continue learning" card (kept).
  - Passport: filter chips with counts, sort, list/grid view, share-card PNG (shows only what the public check shows), switch for public details, and a Confirmed celebration.
- **College:** band drill-down drawer; cohort × skill-group heat-map ("Too few to show" under 5, numbers in every cell); sticky bulk-action bar (kept).
- **Employer:** "Use a sample job description", a 1-2-3 stepper, a disabled button that explains why, and empty states with a primary action.
- **Everywhere:**
  - Skeleton rows instead of "Loading…" on 16 pages.
  - A toast after every create / update / delete.
  - "/" focuses the Ask box.
  - Esc closes drawers.
  - Focus rings; hover states on cards.
  - The activity chart has hover and focus tooltips.

## 6. Before / after

- **Home:** a static sample card becomes a playable Telugu lesson plus a Passport that updates, then how it works, screenshots, FAQ and sign-in. The brand line uses the new tagline in three languages.
- **Learner home:**
  - Before: search bar and ask bar side by side, a percentage bar, "Node 9 of 20", "No required skills missing" under a 60 % match.
  - After: one Ask box, a progress ring with "8 of 20 skills done", "Lesson 9 of 20", and "Still to learn: …".
- **Passport:**
  - Before: "L2 · Execution-verified", "Freshness 73%" and a checkbox.
  - After: plain tags ("Checked by running the work", code in a popover), a Fresh / Ageing / Needs refresh tag with the % in a tooltip, filters, grid, share card and switch.
- **College home:** band bar opens a drawer of those students; a new skill-group heat-map; the board report in three languages; English mixed into Telugu mode is gone.
- **Students (phone):** filter chips show real labels (they showed raw keys); the table becomes cards; the bulk bar wraps; no sideways scroll at 360 px.
- **Employer home:** the badge matches "waiting for your decision"; setup steps sit on Company. Empty Roles leads straight to "New role" with a sample JD.

## 7. Testing

| Check | Result |
|---|---|
| `CI=true npx react-scripts build` (warnings = errors) | Passes |
| Frontend `npm test` | 15 / 15 |
| Backend `npm test` | 225 / 225 (23 structural incl. the employer/session wall, 202 unit/integration) |
| `npm run i18n:check` | OK |
| `node e2e/smoke.mjs`: 62 routes, seed accounts | 0 console errors · 0 overflow at 360 / 1440 · 0 duplicate titles · 0 raw keys |
| axe on Home, Learner home, College home, Employer home, Verify | 0 serious / critical |

**Not changed:**
- Auth flows, protected routes, consent rules, verify/signing logic.
- What employers can see.
- The only API additions are:
  - `to_learn` on the learner's own job snapshot;
  - `to_verify` on the learner's own view of employer roles;
  - structured `covered/total/missing` beside the existing college topic text.
- None of these exposes learner data to anyone new.

## 8. Open items and decisions

- **Recorded hero clip:** the hero uses the browser's Telugu voice, not a recorded clip. A recorded MP3 with timed captions would sound the same on every device. This needs a voice recording.
- **"Foundational" label:** still shown when the backend returns it. The spec lists only Confirmed / Partial / Not yet, so decide whether to fold it into Partial server-side.
- **Admin Evaluator quality:** one backend hint sentence is English.
- **Grievance officer's name:** not set (`config/contact.js`). The role is shown until it is.
- **"Trusted by":** off until partners agree to be listed.
- **Screenshot strip:** uses seed data ("Test Learner"). Re-shoot with demo names via `node e2e/screens.mjs` before launch.
- **Codemods:** `scripts/i18n-extract.js`, `i18n-consts.js` and `i18n-deep.js` stay for future bulk moves. `i18n-check.js` is the guard.

## 9. Local commands

```bash
cd backend && npm install && npm run seed:test && npm start          # :3001 (AI_ADAPTER=mock works offline)
cd frontend && npm install && npm start                              # :3000
cd frontend && npm run i18n:check                                    # translation guard
cd frontend && CI=true npx react-scripts build && npm test -- --watchAll=false
cd frontend && BASE=http://localhost:3000 node e2e/smoke.mjs         # needs Playwright
cd frontend && node e2e/screens.mjs                                  # refresh home screenshots
cd backend && npm test
```
