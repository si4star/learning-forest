# Reminders Worker

Sends Times Table Forest's daily reminder notifications. Runs every 15 minutes (cron in `wrangler.toml`).

For each device that turned a reminder on (table `push_subs`), it sends one push a day, at or up to an hour after the chosen local time, and only if the child hasn't played yet that day. Expired subscriptions (404/410 from the push service) are deleted.

- Deploy: Cloudflare Workers Builds from `main`, root directory `workers/reminders`, deploy command `npx wrangler deploy`.
- Secret: `VAPID_PRIVATE_JWK` (Settings → Variables and Secrets).
- Logs: the Worker's Logs tab shows failed sends (`push failed <status>`) and errors.
- Test: `node tests/reminders.mjs` from the repo root.
