# Times Table Forest

A times table practice app for children aged 7–9. Each fact is a tree on an 11 × 11 grid (2–12 × 2–12; 6 × 7 and 7 × 6 are the same tree, so 66 trees). A tree only grows when the fact is recalled correctly on the day it is due, so the forest shows retention rather than time played.

Runs on Cloudflare Pages, with Pages Functions for the API and D1 for storage. No build step.

## Accounts

- **Grown-ups** create an account with email and password (at least 10 characters), confirming they are the parent or carer.
- Each **child** added gets generated credentials, shown once on a printable **Forest Pass**:
  - username: adjective + tree + two digits, e.g. `MightyOak42`
  - password: three easy words, e.g. `otter-river-lemon`
  - recovery code: `1234-5678`
- The grown-up has to tick "We've written it down or printed it" before continuing.
- Login is forgiving: case, spaces and dashes don't matter.
- A forgotten password is replaced with the recovery code (the child gets a new card) or by the grown-up ("New Forest Pass"). Both sign out the old sessions.
- Passwords and recovery codes are stored as PBKDF2-SHA256 hashes (100,000 iterations). Sessions are random tokens in HttpOnly, Secure, SameSite=Lax cookies (30 days for grown-ups, 180 days for children).
- 10 failed logins per account, or 50 per IP address, in 15 minutes locks out further attempts for 15 minutes.

Data held: grown-up email; child first name or nickname; facts progress; every answer (fact, answer given, right/wrong, time taken, kind). Failed login records are deleted after a day. The font is self-hosted, so the page makes no third-party requests.

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

## Method

- **Retrieval practice.** Every question is answered from memory; the answer is never shown alongside the question.
- **Spaced repetition (Leitner).** Correct answers move a fact through: same round → 1 day → 3 days → 7 days → 21 days. A wrong answer resets it to a seed.
- **Strategy sequencing.** Tables unlock in the order 10, 2, 5, 11, 3, 4, 9, 6, 8, 12, 7. Harder facts are taught from easier ones (×9 = ×10 minus one lot; ×8 = double three times). The next table unlocks once every fact in the unlocked tables is planted and 80% have reached sprout.
- **Immediate error correction.** A wrong answer shows the correct answer and strategy; the child types it, and the fact returns 3 questions later.
- **Accuracy before speed.** No countdown. Answers slower than 6 seconds (the Multiplication Tables Check limit) still count, but the tree stays at sprout until it is answered quickly.

Rounds are 20 questions (about 4 minutes); the first is shorter. ×1 facts are excluded.

Progress is saved after every answer. If the connection drops, answers queue on the device and send when it's back.

## Deploying to Cloudflare Pages

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → pick `si4star/tree-tables`.
   - Production branch: `main`
   - Framework preset: None. Build command: *(leave empty)*. Build output directory: `public`
2. **Storage & Databases** → **D1** → **Create database**, name it `tree-tables`.
3. Back in the Pages project → **Settings** → **Bindings** → **Add** → **D1 database**: variable name `DB`, database `tree-tables`. Add it for both Production and Preview.
4. **Deployments** → retry the latest deployment so it picks up the binding.

The database tables create themselves on the first request (see `src/server/schema.js`). There is no SQL to run.

Other branches get preview URLs automatically.

**CPU limit:** each password hash takes about 18 ms of CPU, and adding a child does two. The Workers Free plan allows 10 ms of CPU per request, so logins may fail with error 1102 on the free plan. Workers Paid ($5/month) removes this.

## Local development

```
npm install
npx playwright install chromium   # once, for the tests
npm run dev          # http://localhost:8788 with a local D1 database in .wrangler/
npm test             # end-to-end test against the running dev server (BASE=... to override)
```

## Layout

| Path | Contents |
| --- | --- |
| `public/index.html` | Page shell and tree SVG symbols |
| `public/css/styles.css` | Styles, light and dark themes, print layout for the Forest Pass |
| `public/js/app.js` | Client: screens, scheduling, rounds, starting check, sync queue |
| `public/fonts/` | Fredoka (SIL Open Font License) |
| `functions/api/[[path]].js` | Pages Functions entry for `/api/*` |
| `src/server/api.js` | API routes |
| `src/server/auth.js` | Password hashing and session tokens |
| `src/server/words.js` | Username, password and recovery code generation |
| `src/server/schema.js` | D1 schema and migrations |
| `tests/e2e.mjs` | End-to-end test |

## Not built yet

- Timed 25-question mock of the Multiplication Tables Check.
- Parent view of the weakest facts (the answer log needed for it is already stored).
- Grown-up password reset by email (needs an email provider). Until then a grown-up who forgets their password can't get back in.
