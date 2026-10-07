// Admin dashboard API, on the real API code with an in-memory database.
// Usage: node tests/admin.mjs
import assert from 'node:assert/strict';
import { handle } from '../src/server/api.js';
import { d1 } from './d1-shim.mjs';

const env = { DATA: d1(), ADMIN_EMAILS: 'boss@thetreefella.test, second@thetreefella.test' }, db = env.DATA, jar = {};
async function call(who, method, path, body) {
  const headers = { cookie: jar[who] || '' };
  if (body) headers['content-type'] = 'application/json';
  const res = await handle(new Request('https://forest.test/api' + path, { method, headers, body: body ? JSON.stringify(body) : undefined }), env);
  const set = res.headers.get('set-cookie');
  if (set) jar[who] = set.split(';')[0];
  return res;
}
const ok = async r => { assert.equal(r.status, 200, await r.clone().text()); return r.json(); };
const signup = (who, email) => call(who, 'POST', '/parent/signup', { email, password: 'a-long-enough-pass', consent: true });

// a teacher with a class of two and a home pupil who has played
await ok(await signup('t', 'teacher@school.test'));
const k = await ok(await call('t', 'POST', '/parent/classes', { name: 'Oak class' }));
const { cards } = await ok(await call('t', 'POST', `/parent/classes/${k.id}/pupils`, { names: ['Ava', 'Ben'] }));
const { card: home } = await ok(await call('t', 'POST', '/parent/children', { name: 'Cal' }));
await ok(await call('cal', 'POST', '/child/qr', { key: home.qr }));
await ok(await call('cal', 'POST', '/child/sync', { facts: { '2x3': { box: 3, due: 0 } },
  answers: [{ fact: '2x3', a: 2, b: 3, given: 6, correct: true, ms: 900, kind: 'review', at: Date.now() }, { fact: '2x3', a: 3, b: 2, given: 5, correct: false, ms: 2000, kind: 'review', at: Date.now() }] }));
await ok(await signup('x', 'other@school.test'));

// only listed accounts get in; logged-out callers don't either
assert.equal((await call('t', 'GET', '/admin/stats')).status, 403);
assert.equal((await call('nobody', 'GET', '/admin/stats')).status, 401);
await ok(await signup('boss', 'Boss@TheTreeFella.test'));   // case doesn't matter
const stats = await ok(await call('boss', 'GET', '/admin/stats'));
assert.equal(stats.accounts, 3);
assert.equal(stats.pupils, 3);
assert.equal(stats.pupilsInClasses, 2);
assert.equal(stats.pupilsActive7, 1);
assert.equal(stats.classes, 1);
assert.equal(stats.answers7, 2);
assert.equal(stats.weeks.length, 8);
assert.equal(stats.weeks.at(-1).pupils, 3);
assert.equal(stats.weeks.at(-1).activePupils, 1);

// find an account; find a pupil by the username on their Forest Pass (any case, with or without spaces)
const found = await ok(await call('boss', 'GET', '/admin/accounts?q=teacher'));
assert.deepEqual(found.accounts.map(a => [a.email, a.pupils, a.classes]), [['teacher@school.test', 3, 1]]);
const pupil = await ok(await call('boss', 'GET', `/admin/pupil?username=${encodeURIComponent(home.username.toUpperCase())}`));
assert.equal(pupil.name, 'Cal');
assert.equal(pupil.accountEmail, 'teacher@school.test');
assert.equal((await call('boss', 'GET', '/admin/pupil?username=NoSuchPupil99')).status, 404);

// export: everything held, but no login secrets
const acc = found.accounts[0];
const ex = await ok(await call('boss', 'GET', `/admin/accounts/${acc.id}/export`));
assert.equal(ex.account.email, 'teacher@school.test');
assert.deepEqual(ex.pupils.map(p => p.name).sort(), ['Ava', 'Ben', 'Cal']);
const cal = ex.pupils.find(p => p.name === 'Cal');
assert.equal(cal.answers.length, 2);
assert.equal(cal.progress[0].stage, 3);
assert.equal(ex.pupils.find(p => p.name === 'Ava').className, 'Oak class');
assert.ok(ex.pupils.find(p => p.name === 'Ava').hasPictures);
const data = JSON.stringify({ account: ex.account, classes: ex.classes, pupils: ex.pupils });   // the note mentions them by name
assert.doesNotMatch(data, /hash|recovery|pbkdf2|"pics"|password/i, 'no secrets in the export');
for (const c of [...cards, home]) for (const secret of [c.password, c.recovery, c.qr]) assert.ok(!data.includes(secret), 'no Forest Pass secrets');
assert.match(ex.note, /hashes/);
const one = await ok(await call('boss', 'GET', `/admin/pupils/${pupil.id}/export`));
assert.equal(one.pupil.answers.length, 2);

// every grown-up's email, for notices
assert.deepEqual((await ok(await call('boss', 'GET', '/admin/emails'))).emails, ['boss@thetreefella.test', 'other@school.test', 'teacher@school.test']);

// deleting a pupil, then a whole account (the email must be typed back)
await ok(await call('boss', 'DELETE', `/admin/pupils/${pupil.id}`, {}));
assert.equal((await call('cal', 'GET', '/child/state')).status, 401, 'deleted pupil logged out');
assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM answers').first()).n, 0, 'their answers deleted');
assert.equal((await call('boss', 'DELETE', `/admin/accounts/${acc.id}`, { confirm: 'wrong@school.test' })).status, 400);
const del = await ok(await call('boss', 'DELETE', `/admin/accounts/${acc.id}`, { confirm: 'teacher@school.test' }));
assert.deepEqual([del.pupils, del.classes], [2, 1]);
assert.equal((await call('t', 'GET', '/parent/children')).status, 401, 'teacher logged out');
assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM parents WHERE email = 'teacher@school.test'").first()).n, 0);
assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM children').first()).n, 0);
assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM parents WHERE email = 'other@school.test'").first()).n, 1, 'others untouched');

// the log records each action, with ids and counts but no names or emails of the people affected
const { log } = await ok(await call('boss', 'GET', '/admin/log'));
assert.deepEqual(log.map(l => l.action), ['delete account', 'delete pupil', 'copy all emails', 'export pupil', 'export account']);
assert.ok(log.every(l => l.admin === 'boss@thetreefella.test'));
assert.doesNotMatch(JSON.stringify(log.map(l => l.detail)), /Cal|Ava|teacher@/);

console.log('PASS admin: access, stats, search, export without secrets, deletion, emails, log');
