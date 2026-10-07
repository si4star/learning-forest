# The Learning Forest

A times table practice app for children aged 7–9. Each fact is a tree on an 11 × 11 grid (2–12 × 2–12; 6 × 7 and 7 × 6 are the same tree, so 66 trees). A tree only grows when the fact is recalled correctly on the day it is due, so the forest shows retention rather than time played.

Runs on Cloudflare Pages, with Pages Functions for the API and D1 for storage. It's a PWA: installable, and it updates itself when a new version is published.

This repo is **The Learning Forest** (`learn.thetreefella.co.uk`), free learning modules from The Tree Fella:

| Path | Module |
| --- | --- |
| `/` | Portal and website for schools, school pack |
| `/trees/` | How does a tree work? (one page, no login; see **How does a tree work?** below) |
| `/app/` | The Learning Forest app: one login (Forest Pass for pupils, email for grown-ups), classes and class devices for every module. After logging in, a pupil picks a module. |
| (in the app) | Grow your times tables: the module described below |
| `/tables/` | Old address: forwards to `/app/` |
| `/soil/` | What is soil? (coming soon) |

## Accounts

- **Grown-ups** create an account with email and password (at least 10 characters), confirming they are the parent, carer or teacher.
- Each **child** added gets generated credentials, shown once on a printable **Forest Pass**:
  - username: adjective + tree + two digits, e.g. `MightyOak42`
  - password: three easy words, e.g. `otter-river-lemon`
  - recovery code: `1234-5678`
- The grown-up has to tick "We've written it down or printed it" before continuing.
- Login is forgiving: case, spaces and dashes don't matter.
- **Opening the installed app from a link:** Android passes links for the site to the installed app. iPhone and iPad can't (Apple doesn't let links open home-screen apps), so the installed app has its own scanner.
- **QR login.** Each Forest Pass also carries a QR code: a link to the site with a 256-bit login key after `#qr=` (the part after `#` never reaches the server or its logs). Scanning it with the device's camera app opens the site logged in. Inside the installed app, **Scan my Forest Pass** on the login screen uses the camera directly (needed on iPhone/iPad, where the camera app opens Safari rather than the installed app). Only a hash of the key is stored. Grown-ups can make a **New QR card** (the password stays the same; the old QR stops working); a new Forest Pass or recovery also replaces it. Bad scans are limited to 30 per internet address in 15 minutes (higher than passwords, because a school shares one address). Children added before QR login get a code by making a New QR card.
- A forgotten password is replaced with the recovery code (the child gets a new card) or by the grown-up ("New Forest Pass"). Both sign out the old sessions.
- Passwords and recovery codes are stored as PBKDF2-SHA256 hashes (10,000 iterations for now; see **Upgrade later**). Sessions are random tokens in HttpOnly, Secure, SameSite=Lax cookies (30 days for grown-ups, 180 days for children).
- 10 failed logins per account, or 50 per IP address, in 15 minutes locks out further attempts for 15 minutes.

Data held: grown-up email; child first name or nickname; facts progress; settings (season); forest friends; practice check scores; for reminders, the device's push address, time and time zone; every answer (fact, answer given, right/wrong, time taken, kind). Failed login records are deleted after a day. The font is self-hosted, so the page makes no third-party requests.

## Classes (schools)

A grown-up account can run classes (up to 10, up to 40 pupils each), alongside its own children.

- **Add pupils** by pasting first names or initials, one per line. Each pupil gets a username, password and recovery code (for home), a QR code, and **three pictures** from a set of 12 (🦊 🐸 🦉 🍎 🍓 🚂 🚀 ⭐ 🌈 ⚽ 🎈 🐝). The teacher can always see a pupil's pictures and make new ones.
- **Login cards:** a printable sheet with each pupil's name, pictures, username and QR code. Printing from the class page makes new QR codes for everyone (the old ones stop working). Print from a computer browser; installed apps on iPhone and iPad can't print.
- **Class devices:** on a shared iPad or Chromebook, the teacher logs in and taps **Use this device for [class]**. The teacher is logged out, and the device shows the class's name tiles whenever nobody is logged in. A pupil taps their name, then their three pictures in order. **I'm done** logs them out and returns to the tiles. Pupil sessions on class devices last 8 hours. The device stays set up for a year, until a grown-up taps **Stop** (on the grown-up screen on that device) or **Sign out all class devices**.
- **Picture login only works on class devices.** Three pictures from 12 is about 1,300 combinations, too few for the open internet. 5 wrong tries lock that pupil for 15 minutes; others carry on.
- **Shared school address:** failed logins from class devices don't count towards the 50-per-address limit, so a class's typing mistakes can't lock the school out.
- **Delete this class and all its pupils** (the only way to remove a class, since pupils can't yet be moved to another class) deletes every pupil's progress, answers, reminders and logins straight away, and signs out the class devices.
- **Same first names:** names in a class must be different (capitals ignored), because each pupil has a name tile. Adding a second "Bob" is refused with a suggestion to add a surname initial ("Bob A", "Bob B"). **Rename** changes a pupil's name without touching their progress, pictures or QR code.

## Starting check

On first login the child taps the tables they think they know.

- Each picked table is tested with at least 5 facts (×10 isn't used as a partner because it's too easy). A fact counts towards both its tables, so 3 × 7 tests the 3s and the 7s.
- No right/wrong feedback is given during the check.
- A table is **passed** at 80% or more.
- Passed tables are planted. Facts answered correctly within 6 seconds start as saplings (due in 3 days). Slower correct answers start as sprouts (due tomorrow). Wrong answers start as seeds. Untested facts in passed tables start as sprouts, spread over the next 3 days.
- Failed tables are not planted. If nothing passes, the child starts with the 10s and 2s.
- The next table in the unlock order then unlocks as normal if 80% of planted facts have sprouted.
- The results screen shows each picked table, its score, and "You know these" or "We'll grow these".
- "I don't know any yet" skips the check. A grown-up can "Redo starting check", which wipes that child's progress.

## Installing as an app (PWA)

- On phones and tablets an install pop-up appears once per device. After that, the welcome and forest screens show a "This works best as an app" banner until the app is installed. The × hides the banner for 14 days.
- Android and desktop Chrome or Edge use the browser's own install prompt. On iPhone and iPad the pop-up shows the Safari steps: Share → Add to Home Screen → Add.
- On iPhone and iPad the installed app keeps its own logins, separate from Safari, so the child logs in once more inside it.

## Updates

- `npm run build` copies `public/` to `dist/` and stamps a version (the Git commit on Cloudflare) into the page, the script and style URLs, and the service worker.
- Each deploy installs a new service worker with a fresh cache and deletes the old one.
- Open apps check for updates when brought to the front, and every hour. The new version takes over and the page reloads only on screens where nothing is lost (welcome, forest, grown-up and table-picking screens). It never happens mid-round or while a Forest Pass is on screen.
- The version number is shown at the bottom of the grown-up screen.
- Scripts and styles are cached for a year because each version has its own URLs. `sw.js` and the manifest are never cached (see `public/_headers`).

## Splash screens

- iPhone and iPad show a launch screen (tree and title on the summer green) when the installed app opens. There are 38 images in `public/app/splash/`, one per screen shape in portrait and landscape, matched by the `apple-touch-startup-image` tags in `index.html`.
- Android builds its splash from the manifest's `background_color` and 512 px icon.
- To regenerate the icons and splash screens after changing `public/app/icons/icon.svg`: `node scripts/make-images.mjs`.

## Seasons

There are four forest themes: spring, summer, autumn and winter. Each changes the colours, the trees and what drifts down the screen.

| Season | Look |
| --- | --- |
| Spring | Cherry Blossom: pink trees with white and deep-pink flowers, drifting petals, pink buttons |
| Summer | Strawberry Meadow: lush greens, strawberries and wild strawberries, floating dandelion seeds |
| Autumn | Warm cream, orange and gold trees, red apples, falling leaves |
| Winter | Darkest: night blue with dark pine trees, snow on the treetops and ground, red berries, dim falling snow |

- The season follows the date by default (UK meteorological seasons: winter is December to February).
- A child can pick a season in Settings (the cog on the forest screen). The choice is saved to their account.
- Screens before login follow the date.
- Drifting stops if the device is set to reduce motion.

## Features

- **Table introductions.** When a table is newly planted, the next round opens with its strategy in one sentence and three worked examples (×2, ×3, ×4) using that table's strategy. Tables passed in the starting check skip this.
- **Question shapes.** Young and Mature trees are sometimes asked as `6 × ? = 42` or `42 ÷ 6` (a third each), so the whole fact family is practised. A wrong answer walks through the multiplication.
- **Forest friends.** When every fact in a table is a Young tree or Mature tree, an animal moves in (10s owl, 2s squirrel, 5s hedgehog, 11s rabbit, 3s fox, 4s robin, 9s deer, 6s badger, 8s butterfly, 12s frog, 7s ladybird). Friends stay once earned.
- **Gentler streak.** One missed day in any 7 doesn't break a run of days.
- **Personal bests.** Quickest facts in the last 7 days, and facts whose best time beat the week before by 0.3 s or more.
- **Practice check.** Opens when every table is planted and at least 34 of 66 facts are Trees. 25 questions, 6 seconds each, a 3-second pause between them, no feedback until the end. The 6, 7, 8, 9 and 12 tables are weighted twice as heavily. It doesn't change any trees. The last 10 scores are kept.
- **Tricky facts** (grown-up screen). For each child: this week's questions and % right; up to 8 facts, ordered by how often they're wrong, then by how slow they are, over the last 30 days; and practice check scores.
- **Daily reminder** (Settings, on the child's device). One notification a day at the chosen time, only if the child hasn't played yet that day. Needs the reminders Worker (below). On iPhone and iPad it needs iOS 16.4 or later, and the app installed to the home screen.
- **Offline play.** The last forest is kept on the device. With no connection the app opens it and rounds can be played; answers save when the connection returns. Logging in, personal bests and the practice check need the internet.

## Daily reminders (one-off setup)

Pages Functions can't run on a schedule, so a small separate Worker sends the reminders (`workers/reminders/`, every 15 minutes). It's on the Workers Free plan.

1. **D1 database.** Set in `workers/reminders/wrangler.toml`: binding `DATA` and the database ID, the same database the Pages project binds as `DATA`. If the database changes, copy the new ID from Storage & Databases → D1.
2. **Create the Worker.** Workers & Pages → Create → **Import a repository** → `si4star/learning-forest`. Set **Root directory** to `workers/reminders`. Leave the build command empty. Deploy.
3. **Secret.** In the new Worker → Settings → Variables and Secrets → add a **Secret** named `VAPID_PRIVATE_JWK` with the private key (supplied separately, never committed). Redeploy.
4. `SITE_URL` in `wrangler.toml` is the site's address (`https://learn.thetreefella.co.uk`). Change it if the site moves.

The matching public key is in `src/server/push.js` and `public/app/js/app.js` (`VAPID_PUBLIC_KEY`). If the key pair is ever replaced, change both and existing devices must turn reminders off and on again.

## Method

- **Retrieval practice.** Every question is answered from memory; the answer is never shown alongside the question.
- **Spaced repetition (Leitner).** Correct answers move a fact through: same round → 1 day → 3 days → 7 days → 21 days. A wrong answer resets it to a seed.
- **Strategy sequencing.** Tables unlock in the order 10, 2, 5, 11, 3, 4, 9, 6, 8, 12, 7. Harder facts are taught from easier ones (×9 = ×10 minus one lot; ×8 = double three times). The next table unlocks once every fact in the unlocked tables is planted and 80% have reached sprout.
- **Immediate error correction.** After a wrong answer, the child works the fact out step by step with its strategy (below), and the fact returns 3 questions later.
- **Interactive strategies.** New seeds and corrections don't show the answer; the child builds it in 1–3 small steps, typing each one. For example, 9 × 7: `10 × 7 = 70` → `70 − 7 = 63`. 8 × 6 is three doubles: `12` → `24` → `48`. A wrong step shows its answer and the child types it. Steps are defined in `walkSteps()` in `public/app/js/app.js`, using the same strategy choice as the text hints.
- **Accuracy before speed.** No countdown. Answers slower than 6 seconds (the Multiplication Tables Check limit) still count, but the tree stays at sprout until it is answered quickly.

Rounds are 20 questions (about 4 minutes); the first is shorter. ×1 facts are excluded.

The screen stays on during a round and the starting check, using the browser's Screen Wake Lock API. It's released as soon as the round ends or the app is closed. Devices without support (iPhone/iPad home-screen apps before iOS 18.4, some older browsers) dim as normal.

Progress is saved after every answer. If the connection drops, answers queue on the device and send when it's back.

## Deploying to Cloudflare Pages

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → pick `si4star/learning-forest`.
   - Production branch: `main`
   - Framework preset: None. Build command: `npm run build`. Build output directory: `dist`
2. **Storage & Databases** → **D1** → **Create database**, name it (for example `learning-forest`).
3. Back in the Pages project → **Settings** → **Bindings** → **Add** → **D1 database**: variable name `DATA`, and the database. Add it for both Production and Preview.
4. **Deployments** → retry the latest deployment so it picks up the binding.

## Upgrade later

> **Flagged:** move to Workers Paid ($5/month) and strengthen password hashing.

- The Workers Free plan allows 10 ms of CPU per request.
- Password hashing therefore uses 10,000 PBKDF2 iterations, about 1.8 ms per hash. Recovering a password does three hashes.
- That fits the free plan, but it's weaker than the 100,000 iterations recommended (the most Workers allows).

To upgrade:

1. Switch the Cloudflare account to Workers Paid.
2. In the Pages project → **Settings** → **Variables and Secrets**, add `PBKDF2_ITERATIONS` = `100000` for Production and Preview. Then redeploy.

No data migration is needed. Each stored hash records its own iteration count, so existing passwords still work and are re-hashed at the new strength the next time that person logs in. Recovery codes are re-hashed whenever a new card is issued.

## Local development

```
npm install
npx playwright install chromium   # once, for the tests
npm run dev          # builds, then serves http://localhost:8788 with a local D1 database in .wrangler/
npm test             # reminders unit test, then end-to-end tests against the running dev server
                     # (BASE=... to override; REBUILD="npm run build" also tests the update flow)
```

## Layout

| Path | Contents |
| --- | --- |
| `public/index.html`, `public/site.css`, `public/site-grove.js` | Website for schools |
| `public/school-pack/` | What we store, parents' privacy notice, data processing agreement (drafts) |
| `public/site.js` | Sends old QR links (`/#qr=`) and old home-screen installs to `/app/` |
| `public/sw.js`, `public/tables/sw.js` | Retire the service workers from before the app's moves |
| `public/tables/index.html`, `public/moved.js` | Send `/tables/` links and QR cards on to `/app/` |
| `public/trees/` | How does a tree work?: the imported page, its script, fonts (Atkinson Hyperlegible, SIL OFL) |
| `scripts/import-trees.mjs` | Imports a new version of the How does a tree work? page |
| `public/_partials/header.html`, `footer.html`, `public/chrome.css` | The Learning Forest header and footer. `scripts/build.mjs` puts them into every website page in place of `<!-- lf:header -->` and `<!-- lf:footer -->`, so they're changed in one place. |
| `public/404.html` | Not-found page (without it, Pages serves the home page for unknown paths) |
| `public/app/index.html` | App page shell and tree SVG symbols (the app's service worker only serves this page for `/app/` itself) |
| `public/app/sw.js` | Service worker: offline app shell, versioned caches |
| `public/app/manifest.webmanifest`, `public/app/icons/` | PWA manifest and icons |
| `public/_headers` | Cache and security headers (Cloudflare Pages) |
| `scripts/build.mjs` | Copies `public/` to `dist/` and stamps the version |
| `public/app/css/styles.css` | Styles, the four seasons, print layout for the Forest Pass |
| `public/app/js/app.js` | Client: screens, scheduling, rounds, starting check, sync queue |
| `public/app/fonts/` | Fredoka (SIL Open Font License) |
| `public/app/js/vendor/` | QR code drawing (qrcode-generator, MIT) and reading (jsQR, Apache-2.0), loaded only when needed |
| `functions/api/[[path]].js` | Pages Functions entry for `/api/*` |
| `src/server/api.js` | API routes |
| `src/server/auth.js` | Password hashing and session tokens |
| `src/server/words.js` | Username, password and recovery code generation |
| `src/server/schema.js` | D1 schema and migrations |
| `src/server/push.js` | Web Push (VAPID) signing and sending |
| `workers/reminders/` | Scheduled Worker that sends daily reminders |
| `tests/e2e.mjs` | End-to-end test: accounts, starting check, rounds, sync, PWA |
| `tests/features.mjs` | End-to-end test: shapes, friends, streak, bests, practice check, tricky facts, reminders, offline |
| `tests/reminders.mjs` | Reminders Worker: timing rules and VAPID signature |
| `public/admin/` | Admin dashboard page (see **Admin dashboard**) |
| `tests/admin.mjs`, `tests/admin-e2e.mjs` | Admin dashboard: access, stats, export without secrets, deletion, log |
| `tests/retention.mjs` | Deleting idle pupils and unused accounts; deleting your own account |
| `tests/qr.mjs` | QR login on the server: keys, new QR card, old keys, rate limit |
| `tests/qr-login.mjs` | QR login in the browser: card QR decodes, link login, camera scan, bad and replaced codes |
| `tests/classes.mjs` | Classes on the server: class devices, picture login, lockouts, ownership |
| `tests/classes-e2e.mjs` | Classes in the browser: add pupils, login cards, class device, picture login, I'm done |
| `tests/site.mjs` | Website pages, old QR links, retiring the old service worker |
| `tests/d1-shim.mjs` | D1 stand-in over node:sqlite for the Node tests |

## Website, modules and the app's address

- The website (`/`) is plain HTML and CSS sharing the app's font and colours. Each module is a row that expands to show what it is (`<details>`; `/#tables` opens that one). "For teachers" covers accounts, classes, Forest Passes, home use and end of year, since those are shared by every module. The school pack pages print cleanly and are **drafts**: highlighted placeholders (address, contact email, database region, retention periods) must be filled in, and the processing agreement needs legal review.
- **One app, many modules.** Login, Forest Passes, grown-up accounts, classes and class devices belong to the app, not to a module. After logging in, a pupil sees the module picker (`renderHub` in `app.js`); Grow your times tables opens the forest, which has a back button to the picker. The module screen's cog opens the app's settings (season, reminder, log out); the forest screen has the same cog. Modules without a login (How does a tree work?) open from the picker at `/app/<module>/`: the build makes that copy from the website page, with a back bar to the modules in place of the website header and footer (`public/_partials/app-header.html`), so an installed app stays in its own window. Guests see the website version at `/<module>/`. A new module with a login adds a card to the picker, its own screens, and its own progress tables in a new migration.
- **Address history.** The app was at `/`, then `/app/`, then `/tables/`, and is back at `/app/` (scope `/app/`). Old installs and cards keep working: `public/sw.js` (also served as `/tables/sw.js`) replaces an old service worker, deletes its `ttf-`/`tables-` caches, unregisters itself and reloads open pages; `site.js` and `/tables/index.html` send them on to `/app/`, keeping any `#qr=` key. Installs from the first `/app/` days pick up the current service worker directly. The app's caches are named `lf-` so the retiring workers leave them alone (caches are shared across the whole site).
- Daily reminders turned on before a move belonged to the old service worker and stop. The app notices the missing subscription and shows reminders as off, so they can be turned on again.

## How does a tree work?

The page is written outside this repo as a single HTML file. To publish a new version:

```
node scripts/import-trees.mjs path/to/index.html
```

The import adapts it to this site: the inline script moves to `public/trees/trees.js` (the security policy runs no inline scripts), Google Analytics and its cookie banner come out (the school pack promises no tracking), Google Fonts become self-hosted copies, addresses move from `/` to `/trees/`, the sharing image and logo come out, and The Learning Forest's header and footer replace the page's own. Its section links and progress bar stay as a sticky bar under the site header, and the book credits move into its closing section. Each change must match exactly once, so if the page's structure changes the import stops with the step that failed rather than publishing a half-converted page.

## Admin dashboard (`/admin/`)

Usage numbers and the privacy requests the school pack promises. **Setup:** Pages project → **Settings → Variables and Secrets** → add `ADMIN_EMAILS` (plain text) with the grown-up account email(s) allowed in, comma-separated, for Production. Redeploy. Then log in at `/app/` as that grown-up and open `/admin/`. Anyone else gets "not an admin". Optional second lock: Cloudflare Zero Trust → Access → protect `learn.thetreefella.co.uk/admin*` with a one-time email code.

- **Overview:** grown-up accounts, pupils, classes, class devices, who played in 7 and 30 days, answers, reminders set, and how many pupils and accounts the 12-month rule will delete in the next 30 days. A weekly table for the last 8 weeks. Counts only; no names.
- **Find a grown-up account** by email: **Export data** downloads everything held about the account and its pupils as JSON (for a request to see data; login secrets are held only as hashes and aren't included). **Delete…** removes the account and everything on it after the admin types the account's email back.
- **Find a pupil** by the username on their Forest Pass: export or delete (two taps).
- **Copy all grown-up emails:** for a breach notice or 30 days' notice of a new sub-processor.
- **Admin log:** every export, deletion and email copy, with the admin's email, time, and ids and counts only (`admin_log` table).
- API: `/api/admin/*` in `src/server/api.js`; page: `public/admin/`. Tests: `tests/admin.mjs` (server), `tests/admin-e2e.mjs` (browser). `npm run dev` sets `ADMIN_EMAILS=admin@example.com` locally.

## Keeping data (retention)

- The reminders Worker (`workers/reminders/`, every 15 minutes) also runs `purgeInactive()`: a pupil who hasn't played for 12 months (or was added 12 months ago and never played) is deleted with their progress, answers, reminders and logins. A grown-up account with no login for 12 months (`parents.last_seen`, updated on login and on opening the app) is deleted once it has no pupils left.
- Teachers see a warning on a pupil's row from 11 months (`idleWarning()` in `app.js`). There is no email warning, as the app doesn't send email.
- **Delete my account** (grown-up page) deletes the account and everything on it after the grown-up types their password.
- Tested in `tests/retention.mjs`.

## Not built yet


- **Grown-up password reset by email** (planned). Until then a grown-up who forgets their password can't get back in. The current design leaves room for it:
  - Emails are stored lowercase and unique, so one email maps to one account.
  - Schema changes go in a new migration in `src/server/schema.js`: a `password_resets(token_hash, parent_id, expires_at, used_at)` table. Store only a hash of the token, as sessions do.
  - Routes: `POST /api/parent/forgot {email}` always replies the same way, so it doesn't reveal which emails have accounts, and is rate-limited with the existing `guard()`/`fail()` helpers. `POST /api/parent/reset {token, password}` sets a new hash and deletes the parent's sessions, as child resets already do.
  - It needs an email provider (for example Resend), with an API key stored as a Pages secret.
  - The client needs a "Forgot password?" link on the grown-up login screen, and a reset screen opened from the emailed link (`/app/?reset=<token>`). The service worker already serves the app for any URL.
  - Optionally, add email verification at sign-up using the same token table.

The first Cloudflare version started fresh: progress from the earlier device-only version was not imported. That old data is deleted from each device the first time it opens the new version.
