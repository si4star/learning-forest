// The gift of two golden acorns for pupils already playing when acorns arrived (migration 11):
// it's added to what they earn, and a device can neither wipe it out nor change it.
// Usage: node --no-warnings tests/acorns.mjs
import assert from 'node:assert/strict';
import { handle } from '../src/server/api.js';
import { MIGRATIONS } from '../src/server/schema.js';
import { d1 } from './d1-shim.mjs';

const env = { DATA: d1() }, db = env.DATA, jar = {};
async function call(who, method, path, body) {
  const headers = { cookie: jar[who] || '', origin: 'https://forest.test' };
  if (body) headers['content-type'] = 'application/json';
  const res = await handle(new Request('https://forest.test/api' + path, { method, headers, body: body ? JSON.stringify(body) : undefined }), env);
  const set = res.headers.get('set-cookie');
  if (set) jar[who] = set.split(';')[0];
  return res;
}
const ok = async r => { assert.equal(r.status, 200, await r.clone().text()); return r.json(); };

await ok(await call('p', 'POST', '/parent/signup', { email: 'gift@example.com', password: 'a-long-enough-pass', consent: true }));
const { card } = await ok(await call('p', 'POST', '/parent/children', { name: 'Ash' }));
const { card: later } = await ok(await call('p', 'POST', '/parent/children', { name: 'Bo' }));
await db.prepare("UPDATE children SET extra = '{\"friends\":[10]}' WHERE display_username = ?").bind(card.username).run();
await db.prepare("UPDATE children SET extra = 'not json' WHERE display_username = ?").bind(later.username).run();
// the migration, as it ran on the live database
for (const sql of MIGRATIONS[10]) await db.prepare(sql).run();

await ok(await call('ash', 'POST', '/child/login', { username: card.username, password: card.password }));
let state = await ok(await call('ash', 'GET', '/child/state'));
assert.equal(state.extra.acornGift, 2, 'the gift');
assert.deepEqual(state.extra.friends, [10], 'the rest of extra untouched');

// a device that loaded before the gift earns one acorn: it sends acorns 1 and no gift, and tries to set its own gift
const meta = { tables: [10, 2], streak: 1, lastDay: 0, assessedAt: Date.now(), theme: 'auto' };
await ok(await call('ash', 'POST', '/child/sync', { meta: { ...meta, extra: { friends: [10], acorns: 1 } } }));
state = await ok(await call('ash', 'GET', '/child/state'));
assert.equal(state.extra.acorns, 1);
assert.equal(state.extra.acornGift, 2, 'kept although the device left it out');
await ok(await call('ash', 'POST', '/child/sync', { meta: { ...meta, extra: { acorns: 1, acornGift: 99 } } }));
assert.equal((await ok(await call('ash', 'GET', '/child/state'))).extra.acornGift, 2, "a device can't set the gift");

const { children } = await ok(await call('p', 'GET', '/parent/children'));
assert.equal(children.find(c => c.name === 'Ash').acorns, 3, 'grown-up sees earned plus gift');
assert.equal(children.find(c => c.name === 'Bo').acorns, 2, 'a pupil with unreadable extra gets the gift too');
console.log('PASS acorns: gift of 2, kept through device syncs, shown to grown-ups');
