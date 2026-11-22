# Haykal100 في الفيزياء مع استاذ احمد غرايبة

English-first, bilingual Advanced Physics final exam practice for Grades 9–12. Open a grade, select an exam coverage card, and practise with hints, figures, worked answers and an embedded ClassWiz calculator. The bank contains 675 questions. In practice, image and text formats are interleaved within each outcome. Students can expand a figure and check its original source and page. Cards 1–16 contain only multiple-choice questions. Cards 17–20 contain only written responses. The timed mock selects one question of the prescribed type per blueprint row. Each card gives the student-book page references from its grade’s blueprint. MCQs are scored automatically. All 236 written items are also marked automatically. Each has a rubric of the numerical results and key physics ideas taken from its own worked solution (`lib/grader.mjs`). Hand-written rubrics in `bank/rubric-overrides.json` replace the automatic ones where needed. The grader reads the whole response, typed or in MathLive LaTeX, in English or Arabic. It accepts scientific notation, fractions, π, roots, Arabic-Indic digits, any convertible unit, any order and any listed synonym. It flags sign, power-of-ten and unit slips and recognises a stated opposite idea. Students see a score, a line per marking point and a side-by-side comparison with the worked solution. Matched points are highlighted. Diagrams are not marked automatically. Mock reviews add the written scores to the total. `scripts/verify-bank.mjs` checks that every worked solution earns full marks in both languages. Three side bookmarks open the ClassWiz calculator and its illustrated manual, a solution guide for the selected outcome, and a law sheet with 30 diagrams. Each of the 80 outcomes has an original bilingual example with a strategy and reasoned steps. Selected guides also include a second example with a credited figure from a prior exam or practice booklet.

## Students, teacher dashboard and notebook

**Accounts.** A new student enters a name, a school and an optional class code from the teacher, and receives a six-digit student code. On any device they sign in with that code and their name; spelling variants such as ة/ه and أ/ا are accepted. There is no PIN.

**Teacher dashboard** at `/admin.html` needs `PHYSICS_TEACHER_PASSWORD` set on the server. It covers:
- an overview with the weakest outcomes;
- students, with their mastery map, mock and test scores, and written answers;
- teacher marks that replace the automatic grade, with a note to the student;
- class changes;
- classes with codes and an optional class leaderboard;
- tests generated per outcome in the blueprint question type, or hand-picked, assigned to a class or to everyone with an optional deadline;
- notebook review, student questions, an editor for the automatic marking rubrics, and CSV exports.

**Solution notebook.** Every question opens handwriting pages:
- pen with pressure, highlighter, line, arrow and eraser;
- eight colours, three thicknesses, and undo/redo;
- blank, lined, grid or axes pages, the question figure as background, zoom, and a pen-only mode that ignores the palm;
- replay of the solution as it was written, and PNG export.

Pages save to the device and the server and can be sent to the teacher. The teacher marks them in red on a separate layer, adds a score and comments, and sets the status to reviewed or needs changes.

**Learning tools.** These run without any external service:
- a mistakes queue with spaced review after 1, 3, 7 and 14 days;
- a per-outcome mastery map;
- custom tests covering every outcome, the student's weakest outcomes, or chosen ones;
- a three-step hint ladder: the idea, then the law, then what the answer must contain;
- guiding questions after marking, and an "ask the teacher" inbox;
- a daily streak, a daily goal, badges, and dark mode.

**Operations.**
- The server writes a consistent backup of the progress database every 24 hours. The location is `PHYSICS_BACKUP_DIR`, defaulting to `backups/` beside the database. The 14 newest are kept. `PHYSICS_BACKUP_HOURS=0` turns this off, and `npm run backup` makes one on demand.
- `npm run test:e2e` drives a student and a teacher through the main flows in Chromium.
- On every push to `main`, the workflow verifies the bank and runs the browser tests. It then commits the new build to the `gh-pages` branch.

## Running the app

Use Node.js 22.13 or later and run `npm start`. The default address is http://localhost:3000. No dependencies or build step are needed. Set `PORT` for another port. Deploy on a Node host with a persistent disk for student data.

The supplied SQLite bank is read-only in `bank/physics.sqlite`. `PHYSICS_DB` can override the writable progress database, which defaults to `data/practice.sqlite`. Browser drafts are stored in localStorage and practice edits synchronize to the server. A persistent HttpOnly cookie identifies a browser. Students enter their name and school at check-in. Both fields are self-reported. The Arabic/English language preference is saved on the device. To retain progress, preserve the student database and cookie. Student data must stay outside the public directory.

The math app's Arabic fonts, colour palette, student watermarks, content shield and vendored calculator are included. Browser copy, printing and focus protections deter casual copying. Operating-system screen captures are still possible. The calculator manual uses screenshots from the embedded fx-991CE X emulator and independent numerical examples. Source notices are in public/vendor and public/fonts.

See [the bank review](BANK_REVIEW.md) and [the per-outcome coverage and worked-example audit in Arabic](KPI_COVERAGE_AR.md).

A student check-in expires after 24 hours. Returning students check in again on the same browser to continue their saved work. The question bank itself stays read-only; teacher edits (marks, rubrics, classes, tests, reviews) are stored in the progress database.

## Database (Neon, shared with the maths platform)

When `DATABASE_URL` is set, all student data lives in Neon Postgres, in the same database as the maths platform (eot2026-2027). Every physics table starts with `physics_` (`physics_profiles`, `physics_progress`, `physics_mocks`, `physics_notebook`, ...) so the two subjects never mix; the maths tables are to carry a `math_` prefix. The tables are created automatically on first start. Without `DATABASE_URL` the server uses a local SQLite file, which is what development and the end-to-end tests use (`DATABASE_URL=... npm run test:e2e` runs the same tests against Neon). The code talks to both through one asynchronous layer in `lib/db.mjs`.

To bring over data from an old SQLite file (for example a backup of the Railway volume):

    DATABASE_URL=postgres://... node scripts/migrate-sqlite-to-neon.mjs practice.sqlite

## Vercel (frontend and API)

https://haykal100.vercel.app serves the student interface, the teacher dashboard and the API together: `api/index.mjs` runs the same handler as `server.mjs` as a Vercel Function, and `vercel.json` sends every `/api/*` request to it. Vercel builds from `main` with `PHYSICS_SAME_ORIGIN=1`, so the pages call the API on the same site. Project variables: `DATABASE_URL` (Neon production branch) and `PHYSICS_TEACHER_PASSWORD` (teacher sign-in). The server also accepts cross-origin requests from GitHub Pages; `PHYSICS_PAGES_ORIGIN` can list more origins, separated by commas.

## GitHub Pages

The Pages workflow builds the student interface under the repository's project path. It publishes only files from `public/`. Its pages call the API at `PHYSICS_API_ORIGIN` (default `https://haykal100.vercel.app`), which serves figures, grading and progress.

Deploy this repository's Node server on an HTTPS origin with a persistent disk for `PHYSICS_DB`. Its default allowed frontend origin is `https://kamelbshara.github.io`; for a custom Pages domain, set `PHYSICS_PAGES_ORIGIN` on the server. The separate frontend uses secure partitioned cookies in compatible browsers.

The live site publishes from the root of the gh-pages branch. Pushes to main now build with the production API origin and commit dist/pages to that branch automatically after the tests pass. A read-only workflow checks the live page, calculator and 80-card catalog after main pushes. The manual Actions deployment is available if the owner switches the repository publishing source to GitHub Actions. Same-origin Node hosting also works with `npm start`.
