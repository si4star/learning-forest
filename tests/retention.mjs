// Retention and account deletion, on the real API and Worker code with an in-memory database.
// - pupils who haven't played for 12 months are deleted (with their logins and progress)
// - grown-up accounts unused for 12 months are deleted once they have no pupils left
// - a grown-up can delete their own account, with their password
// Usage: node tests/retention.mjs
import assert from 'node:assert/strict';
import { handle } from '../src/server/api.js';
import { purgeInactive } from '../workers/reminders/index.js';
import { d1 } from './d1-shim.mjs';

const env = { DATA: d1() }, db = env.DATA, jar = {};
async function call(who, method, path, body) {
  const headers = { cookie: jar[who] || '' };
  if (body) headers['content-type'] = 'application/json';
  const res = await handle(new Request('https://forest.test/api' + path, { method, headers, body: body ? JSON.stringify(body) : undefined }), env);
  const set = res.headers.get('set-cookie');
  if (set) jar[who] = set.split(';')[0];
  return res;
}
const ok = async r => { assert.equal(r.status, 200, await r.clone().text()); return r.json(); };
const DAY = 864e5, now = Date.now();
const count = async (sql, ...a) => (await db.prepare(sql).bind(...a).first()).n;

// a teacher with two pupils: one active, one idle for 13 months
await ok(await call('t', 'POST', '/parent/signup', { email: 't@school.test', password: 'a-long-enough-pass', consent: true }));
const { card: active } = await ok(await call('t', 'POST', '/parent/children', { name: 'Ava' }));
const { card: idle } = await ok(await call('t', 'POST', '/parent/children', { name: 'Ben' }));
await ok(await call('ben', 'POST', '/child/qr', { key: idle.qr }));
await ok(await call('ben', 'POST', '/child/sync', { facts: { '2x3': { box: 2, due: 0 } }, answers: [{ fact: '2x3', a: 2, b: 3, given: 6, correct: true, ms: 900, kind: 'new', at: now }] }));
const benId = (await db.prepare("SELECT id FROM children WHERE name = 'Ben'").first()).id;
await db.prepare('UPDATE children SET last_played = ?, created_at = ? WHERE id = ?').bind(now - 400 * DAY, now - 500 * DAY, benId).run();

// the grown-up's list carries when each pupil was last active, for the warning
const list = await ok(await call('t', 'GET', '/parent/children'));
assert.ok(now - list.children.find(c => c.name === 'Ben').activeAt > 334 * DAY, 'idle pupil shows as idle');
assert.ok(now - list.children.find(c => c.name === 'Ava').activeAt < DAY, 'new pupil counts from when they were added');

// someone else's account: unused for 13 months, no pupils
await ok(await call('gone', 'POST', '/parent/signup', { email: 'gone@school.test', password: 'a-long-enough-pass', consent: true }));
await db.prepare("UPDATE parents SET last_seen = ?, created_at = ? WHERE email = 'gone@school.test'").bind(now - 400 * DAY, now - 400 * DAY).run();
// and an unused account that still has a pupil who plays: kept
await ok(await call('busy', 'POST', '/parent/signup', { email: 'busy@school.test', password: 'a-long-enough-pass', consent: true }));
await ok(await call('busy', 'POST', '/parent/children', { name: 'Cal' }));
await db.prepare("UPDATE parents SET last_seen = ?, created_at = ? WHERE email = 'busy@school.test'").bind(now - 400 * DAY, now - 400 * DAY).run();

await purgeInactive(db, now);
assert.equal(await count('SELECT COUNT(*) AS n FROM children WHERE id = ?', benId), 0, 'idle pupil deleted');
assert.equal(await count('SELECT COUNT(*) AS n FROM answers WHERE child_id = ?', benId), 0, 'their answers too');
assert.equal((await call('ben', 'GET', '/child/state')).status, 401, 'and they are logged out');
assert.equal(await count("SELECT COUNT(*) AS n FROM children WHERE name = 'Ava'"), 1, 'active pupil kept');
assert.equal(await count("SELECT COUNT(*) AS n FROM parents WHERE email = 'gone@school.test'"), 0, 'unused empty account deleted');
assert.equal(await count("SELECT COUNT(*) AS n FROM parents WHERE email = 'busy@school.test'"), 1, 'account with pupils kept');
await purgeInactive(db, now);   // running again changes nothing

// logging in counts as using the account
await db.prepare("UPDATE parents SET last_seen = ? WHERE email = 'busy@school.test'").bind(now - 400 * DAY).run();
await ok(await call('busy2', 'POST', '/parent/login', { email: 'busy@school.test', password: 'a-long-enough-pass' }));
assert.ok(now - (await db.prepare("SELECT last_seen FROM parents WHERE email = 'busy@school.test'").first()).last_seen < DAY);

// deleting your own account: wrong password refused, right password removes everything
const k = await ok(await call('t', 'POST', '/parent/classes', { name: 'Oak class' }));
await ok(await call('t', 'POST', `/parent/classes/${k.id}/pupils`, { names: ['Dev'] }));
await ok(await call('ava', 'POST', '/child/qr', { key: active.qr }));
assert.equal((await call('t', 'DELETE', '/parent/account', { password: 'not-the-password' })).status, 401);
assert.equal(await count("SELECT COUNT(*) AS n FROM parents WHERE email = 't@school.test'"), 1, 'still there after a wrong password');
await ok(await call('t', 'DELETE', '/parent/account', { password: 'a-long-enough-pass' }));
assert.equal(await count("SELECT COUNT(*) AS n FROM parents WHERE email = 't@school.test'"), 0);
assert.equal(await count("SELECT COUNT(*) AS n FROM children WHERE name IN ('Ava', 'Dev')"), 0, 'pupils deleted');
assert.equal(await count('SELECT COUNT(*) AS n FROM classes'), 0, 'class deleted');
assert.equal((await call('ava', 'GET', '/child/state')).status, 401, 'pupils logged out');
assert.equal((await call('t', 'GET', '/parent/children')).status, 401, 'grown-up logged out');
assert.equal(await count("SELECT COUNT(*) AS n FROM children WHERE name = 'Cal'"), 1, "other accounts untouched");

console.log('PASS retention: idle pupils and empty unused accounts deleted; account deletion with password');
