// Two devices, one forest: a device holding an older copy (left open for days, or a second device)
// can't take progress backwards, and a forest started again by a grown-up can't be overwritten by old progress.
// Usage: node --no-warnings tests/sync.mjs
import assert from 'node:assert/strict';
import { handle } from '../src/server/api.js';
import { d1 } from './d1-shim.mjs';

const env = { DATA: d1() }, jar = {};
async function call(who, method, path, body) {
  const headers = { cookie: jar[who] || '', origin: 'https://forest.test' };
  if (body) headers['content-type'] = 'application/json';
  const res = await handle(new Request('https://forest.test/api' + path, { method, headers, body: body ? JSON.stringify(body) : undefined }), env);
  const set = res.headers.get('set-cookie');
  if (set) jar[who] = set.split(';')[0];
  return res;
}
const ok = async r => { assert.equal(r.status, 200, await r.clone().text()); return r.json(); };
const DAY = 864e5, D = Math.floor(1.8e12 / DAY) * DAY;   // a day, as the app stores it

await ok(await call('p', 'POST', '/parent/signup', { email: 'two@example.com', password: 'a-long-enough-pass', consent: true }));
const { card } = await ok(await call('p', 'POST', '/parent/children', { name: 'Ash' }));
for (const dev of ['tablet', 'phone']) await ok(await call(dev, 'POST', '/child/login', { username: card.username, password: card.password }));
const { resetAt } = await ok(await call('tablet', 'GET', '/child/state'));
const meta = (lastDay, streak, tables, extra) => ({ tables, streak, lastDay, assessedAt: D - 10 * DAY, theme: 'auto', extra });
const sync = (dev, m, rs = resetAt) => call(dev, 'POST', '/child/sync', { meta: m, resetAt: rs });
const state = async () => ok(await call('tablet', 'GET', '/child/state'));

// the tablet is well ahead
await ok(await sync('tablet', meta(D, 5, [10, 2, 5, 11], { friends: [10, 2], intros: [10, 2, 5, 11], acorns: 3, acornDay: D, mocks: [{ at: D - DAY, score: 20 }] })));
// the phone, loaded days ago, saves its older copy
await ok(await sync('phone', meta(D - 3 * DAY, 1, [10, 2], { friends: [10], intros: [10, 2], acorns: 1, acornDay: D - 3 * DAY, mocks: [{ at: D - 4 * DAY, score: 15 }] })));
let s = await state();
assert.deepEqual([s.streak, s.lastDay], [5, D], 'an older day played changes nothing');
assert.deepEqual(s.tables, [10, 2, 5, 11]);
assert.deepEqual(s.extra.friends, [10, 2], 'friends kept');
assert.equal(s.extra.acorns, 3, 'acorns never go down');
assert.deepEqual(s.extra.mocks.map(x => x.score), [15, 20], 'practice check scores from both');

// next day the stale phone plays: it worked its streak out from its old copy (1), the server from the saved one (6)
await ok(await sync('phone', meta(D + DAY, 1, [10, 2], { friends: [10], acorns: 2, acornDay: D + DAY })));
s = await state();
assert.deepEqual([s.streak, s.lastDay], [6, D + DAY], 'streak carried on from the saved one');
assert.equal(s.extra.acorns, 3, 'still the most acorns');
assert.equal(s.extra.acornDay, D + DAY);
// same day on both: the longer streak
await ok(await sync('tablet', meta(D + DAY, 4, [10, 2, 5, 11], {})));
assert.equal((await state()).streak, 6);
// a missed day is the week's rest day; a second gap in the week breaks the run
await ok(await sync('tablet', meta(D + 3 * DAY, 1, [10, 2, 5, 11], {})));
s = await state();
assert.deepEqual([s.streak, s.extra.restDay], [7, D + 2 * DAY], 'one missed day kept the run');
await ok(await sync('tablet', meta(D + 5 * DAY, 8, [10, 2, 5, 11], {})));
assert.equal((await state()).streak, 1, 'two missed days in a week break it');

// a grown-up redoes the starting check: the old copies can't be saved over the fresh start
await ok(await call('p', 'POST', `/parent/children/${s.id}/reassess`, {}));
assert.equal((await sync('phone', meta(D + 6 * DAY, 9, [10, 2, 5, 11], { friends: [10, 2] }))).status, 409);
s = await state();
assert.deepEqual([s.tables, s.streak, s.extra.friends], [[], 0, undefined], 'still a fresh start');
assert.notEqual(s.resetAt, resetAt);
await ok(await sync('tablet', meta(D + 6 * DAY, 1, [10, 2], { friends: [] }), s.resetAt));
assert.deepEqual((await state()).tables, [10, 2], 'a device that has the new start saves as normal');
console.log('PASS sync: an older device copy never takes progress backwards; a fresh start is kept');
