// Times Table Forest daily reminders. Runs every 15 minutes (see wrangler.toml).
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
  const subject = env.SITE_URL || 'https://tree-tables.pages.dev';
  const publicKey = env.VAPID_PUBLIC_KEY || VAPID_PUBLIC_KEY;   // must match the key the app subscribed with
  const { results } = await env.DB.prepare(`SELECT p.endpoint, p.time, p.tz, p.last_sent, c.last_played
    FROM push_subs p JOIN children c ON c.id = p.child_id`).all();
  const sent = [];
  for (const s of results) {
    try {
      const local = localParts(now, s.tz);
      const [h, m] = s.time.split(':').map(Number), due = h * 60 + m;
      if (s.last_sent === local.date || local.minutes < due || local.minutes > due + 60) continue;
      const markSent = env.DB.prepare('UPDATE push_subs SET last_sent = ? WHERE endpoint = ?').bind(local.date, s.endpoint);
      if (s.last_played && localParts(new Date(s.last_played), s.tz).date === local.date) { await markSent.run(); continue; }
      const status = await sendPush(s.endpoint, privateJwk, subject, publicKey);
      if (status === 404 || status === 410) await env.DB.prepare('DELETE FROM push_subs WHERE endpoint = ?').bind(s.endpoint).run();
      else if (status >= 200 && status < 300) { await markSent.run(); sent.push(s.endpoint); }
      else console.log('push failed', status, new URL(s.endpoint).host);
    } catch (e) { console.log('reminder error', e.message); }
  }
  return sent;
}

export default {
  scheduled(event, env, ctx) { ctx.waitUntil(run(env, new Date(event.scheduledTime))); },
  fetch() { return new Response('Times Table Forest reminders run on a schedule.'); },
};
