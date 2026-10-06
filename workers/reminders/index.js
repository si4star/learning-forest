// The Learning Forest's scheduled jobs: daily reminders, and deleting data after 12 months without use.
// Runs every 15 minutes (see wrangler.toml).
// Each device that turned reminders on gets one push a day, at or up to an hour after its
// chosen local time, and only if the child hasn't played yet that day.
import { sendPush, VAPID_PUBLIC_KEY } from '../../src/server/push.js';

const localParts = (when, tz) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(when).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) };
};

export async function run(env, now = new Date()) {
  const privateJwk = JSON.parse(env.VAPID_PRIVATE_JWK);
  const subject = env.SITE_URL || 'https://learn.thetreefella.co.uk';
  const publicKey = env.VAPID_PUBLIC_KEY || VAPID_PUBLIC_KEY;   // must match the key the app subscribed with
  const db = env.DATA;
  const { results } = await db.prepare(`SELECT p.endpoint, p.time, p.tz, p.last_sent, c.last_played
    FROM push_subs p JOIN children c ON c.id = p.child_id`).all();
  const sent = [];
  for (const s of results) {
    try {
      const local = localParts(now, s.tz);
      const [h, m] = s.time.split(':').map(Number), due = h * 60 + m;
      if (s.last_sent === local.date || local.minutes < due || local.minutes > due + 60) continue;
      const markSent = db.prepare('UPDATE push_subs SET last_sent = ? WHERE endpoint = ?').bind(local.date, s.endpoint);
      if (s.last_played && localParts(new Date(s.last_played), s.tz).date === local.date) { await markSent.run(); continue; }
      const status = await sendPush(s.endpoint, privateJwk, subject, publicKey);
      if (status === 404 || status === 410) await db.prepare('DELETE FROM push_subs WHERE endpoint = ?').bind(s.endpoint).run();
      else if (status >= 200 && status < 300) { await markSent.run(); sent.push(s.endpoint); }
      else console.log('push failed', status, new URL(s.endpoint).host);
    } catch (e) { console.log('reminder error', e.message); }
  }
  return sent;
}

// Retention (see the school pack): a pupil who hasn't played for 12 months is deleted with their
// progress, answers, reminders and logins (teachers see a warning in the app from 11 months). A grown-up
// account with no login for 12 months is deleted once it has no pupils left. Safe to run every time.
const YEAR = 365 * 864e5;
export async function purgeInactive(db, now = Date.now()) {
  const cut = now - YEAR, idle = 'COALESCE(last_played, created_at) < ?';
  const emptyIdleParent = 'COALESCE(p.last_seen, p.created_at) < ? AND NOT EXISTS (SELECT 1 FROM children c WHERE c.parent_id = p.id)';
  await db.batch([
    db.prepare(`DELETE FROM sessions WHERE role = 'child' AND user_id IN (SELECT id FROM children WHERE ${idle})`).bind(cut),
    db.prepare(`DELETE FROM children WHERE ${idle}`).bind(cut),   // facts, answers, reminders follow (ON DELETE CASCADE)
    db.prepare(`DELETE FROM sessions WHERE role = 'parent' AND user_id IN (SELECT p.id FROM parents p WHERE ${emptyIdleParent})`).bind(cut),
    db.prepare(`DELETE FROM parents WHERE id IN (SELECT p.id FROM parents p WHERE ${emptyIdleParent})`).bind(cut),   // classes follow
  ]);
}

export default {
  scheduled(event, env, ctx) {
    ctx.waitUntil(run(env, new Date(event.scheduledTime)));
    ctx.waitUntil(purgeInactive(env.DATA, event.scheduledTime).catch(e => console.log('retention error', e.message)));
  },
  fetch() { return new Response('Times tables reminders run on a schedule.'); },
};
