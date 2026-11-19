# الهيكل 100 مع استاذ احمد غرايبة

English-first, bilingual Advanced Physics final exam practice for Grades 9–12. Open a grade, select an exam coverage card, and practise with hints, figures, worked answers and an embedded ClassWiz calculator. The timed mock selects one item per blueprint row. MCQs are scored automatically. All 369 written items offer short-answer checkpoints in practice. Students can use MathLive for LaTeX, choose compatible units, or type a short term. Feedback checks individual entries and explains the relevant principles before an explicit worked-solution reveal. Open-ended reasoning and diagrams remain available for model comparison. The Physics laws tab groups equations and their conditions by grade.

## Running the app

Use Node.js 22.13 or later and run `npm start`. The default address is http://localhost:3000. No dependencies or build step are needed. Set `PORT` for another port. Deploy on a Node host with a persistent disk for student data.

The supplied SQLite bank is read-only in `bank/physics.sqlite`. `PHYSICS_DB` can override the writable progress database, which defaults to `data/practice.sqlite`. Browser drafts are stored in localStorage and practice edits synchronize to the server. A persistent HttpOnly cookie identifies a browser. Students enter their name and school at check-in. Both fields are self-reported. The Arabic/English language preference is saved on the device. To retain progress, preserve the student database and cookie. Student data must stay outside the public directory.

The math app's Arabic fonts, colour palette, student watermarks, content shield and vendored calculator are included. Browser copy, printing and focus protections deter casual copying. Operating-system screen captures are still possible. The calculator manual uses screenshots from the embedded fx-991CE X emulator and independent numerical examples. Source notices are in public/vendor and public/fonts.

See BANK_REVIEW.md for scope and coverage.

A student check-in expires after 24 hours. Returning students check in again on the same browser to continue their saved work. The app serves a read-only bank and has no web-based administrative editing endpoints.

## GitHub Pages

The Pages workflow builds the student interface under the repository's project path. It publishes only files from `public/`. The Node service continues to serve private figures, grading and SQLite progress.

Deploy this repository's Node server on an HTTPS origin with a persistent disk for `PHYSICS_DB`. Its default allowed frontend origin is `https://kamelbshara.github.io`; for a custom Pages domain, set `PHYSICS_PAGES_ORIGIN` on the server. The separate frontend uses secure partitioned cookies in compatible browsers.

The live site publishes from the root of the gh-pages branch. To release a frontend update, build with the production API origin and commit the contents of dist/pages to that branch. GitHub automatically builds and deploys updates to gh-pages. A read-only workflow checks the live page, calculator and 80-card catalog after main pushes. The manual Actions deployment is available if the owner switches the repository publishing source to GitHub Actions. Same-origin Node hosting also works with `npm start`.
