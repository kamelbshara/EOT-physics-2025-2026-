# الهيكل 100 مع استاذ احمد غرايبة

Arabic-first, bilingual Advanced Physics final exam practice for Grades 9–12. Open a grade, select an exam coverage card, and practise with hints, figures, worked answers and an embedded ClassWiz calculator. The timed mock selects one item per blueprint row. MCQs are scored automatically. Written work is retained for comparison with the model solution.

## Running the app

Use Node.js 22.13 or later and run `npm start`. The default address is http://localhost:3000. No dependencies or build step are needed. Set `PORT` for another port. Deploy on a Node host with a persistent disk for student data.

The supplied SQLite bank is read-only in `bank/physics.sqlite`. `PHYSICS_DB` can override the writable progress database, which defaults to `data/practice.sqlite`. Browser drafts are stored in localStorage and practice edits synchronize to the server. A persistent HttpOnly cookie identifies a browser. Student names are self-reported. To retain progress, preserve the student database and cookie. Student data must stay outside the public directory.

The math app's Arabic fonts, colour palette, student watermarks, content shield and vendored calculator are included. Browser copy, printing and focus protections deter casual copying. Operating-system screen captures are still possible. The calculator manual uses screenshots from the embedded fx-991CE X emulator and independent numerical examples. Source notices are in public/vendor and public/fonts.

See BANK_REVIEW.md for scope and coverage.

A student check-in expires after 24 hours. Returning students check in again on the same browser to continue their saved work. The app serves a read-only bank and has no web-based administrative editing endpoints.

## GitHub Pages

The Pages workflow builds the student interface under the repository's project path. It publishes only files from `public/`. The Node service continues to serve private figures, grading and SQLite progress.

Deploy this repository's Node server on an HTTPS origin with a persistent disk for `PHYSICS_DB`. Its default allowed frontend origin is `https://kamelbshara.github.io`; for a custom Pages domain, set `PHYSICS_PAGES_ORIGIN` on the server. The separate frontend uses secure partitioned cookies in compatible browsers.

The production workflow uses https://physics-api-production.up.railway.app and can be overridden with the Actions variable `PHYSICS_API_ORIGIN`. It requests Pages enablement and publishes after pushes to main. If GitHub requires repository-owner setup, select **GitHub Actions** in the repository's Pages settings, then rerun **Deploy Physics to GitHub Pages**. Same-origin Node hosting also works with `npm start`.
