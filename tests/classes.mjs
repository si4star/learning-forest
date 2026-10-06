// Tests classes, class devices and picture login on the server with the real API code.
// Usage: node tests/classes.mjs
import assert from 'node:assert/strict';
import { handle } from '../src/server/api.js';
import { d1 } from './d1-shim.mjs';

const env = { DB: d1() };
const jars = {};
async function call(who, method, path, body, ip = '10.0.0.1') {
  const jar = (jars[who] ??= {});
  const headers = { cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; '), 'cf-connecting-ip': ip };
  if (body) headers['content-type'] = 'application/json';
  const res = await handle(new Request('https://forest.test/api' + path, { method, headers, body: body ? JSON.stringify(body) : undefined }), env);
  for (const c of res.headers.getSetCookie()) { const [kv] = c.split(';'); const [k, v] = kv.split('='); if (v) jar[k] = v; else delete jar[k]; }
  return res;
}
const ok = async (res, status = 200) => { assert.equal(res.status, status, await res.clone().text()); return res.json(); };

// a teacher makes a class of three
await ok(await call('teacher', 'POST', '/parent/signup', { email: 't@school.test', password: 'a-long-enough-pass', consent: true }));
const k = await ok(await call('teacher', 'POST', '/parent/classes', { name: 'Oak class' }));
const { cards } = await ok(await call('teacher', 'POST', `/parent/classes/${k.id}/pupils`, { names: ['Ava', ' Ben  ', '', 'Cara'] }));
assert.deepEqual(cards.map(c => c.name), ['Ava', 'Ben', 'Cara']);
for (const c of cards) { assert.equal(c.pics.length, 3); assert.equal(new Set(c.pics).size, 3); assert.ok(c.qr && c.password); }
const list = await ok(await call('teacher', 'GET', '/parent/children'));
assert.equal(list.classes[0].name, 'Oak class');
assert.deepEqual(list.children.find(c => c.name === 'Ava').pics, cards[0].pics, 'teacher can look up pictures');

// picture login needs a class device
assert.equal((await call('anyone', 'POST', '/class/login', { child: cards[0].id, pics: cards[0].pics })).status, 403);
assert.deepEqual(await ok(await call('anyone', 'GET', '/class')), { device: null });

// the teacher sets up the class iPad: teacher signed out of it, class tiles shown
await call('ipad', 'POST', '/parent/login', { email: 't@school.test', password: 'a-long-enough-pass' });
const dev = await ok(await call('ipad', 'POST', `/parent/classes/${k.id}/device`, {}));
assert.equal(dev.device.className, 'Oak class');
assert.equal((await ok(await call('ipad', 'GET', '/me'))).role, null, 'teacher signed out of the device');
const tiles = await ok(await call('ipad', 'GET', '/class'));
assert.deepEqual(tiles.pupils.map(p => p.name), ['Ava', 'Ben', 'Cara']);
assert.equal(tiles.pupils[0].pics, undefined, 'pictures are not sent to the device');

// a pupil logs in with their pictures; wrong order fails
const wrong = [cards[1].pics[1], cards[1].pics[0], cards[1].pics[2]];
assert.equal((await call('ipad', 'POST', '/class/login', { child: cards[1].id, pics: wrong })).status, 401);
await ok(await call('ipad', 'POST', '/class/login', { child: cards[1].id, pics: cards[1].pics }));
const meBen = await ok(await call('ipad', 'GET', '/me'));
assert.equal(meBen.name, 'Ben');
assert.equal(meBen.device.className, 'Oak class');
await call('ipad', 'POST', '/logout', {});

// 5 wrong tries lock that pupil only, and don't count towards the shared school address
for (let i = 0; i < 5; i++) await call('ipad', 'POST', '/class/login', { child: cards[2].id, pics: wrong });
assert.equal((await call('ipad', 'POST', '/class/login', { child: cards[2].id, pics: cards[2].pics })).status, 429, 'Cara locked');
await ok(await call('ipad', 'POST', '/class/login', { child: cards[0].id, pics: cards[0].pics }));   // Ava fine
for (let i = 0; i < 60; i++) await call('ipad', 'POST', '/child/login', { username: 'nobody', password: 'x-y-z' });
assert.equal((await call('laptop', 'POST', '/child/login', { username: cards[0].username, password: cards[0].password })).status, 200,
  'school address not locked by class-device failures');

// a pupil of another class can't log in on this device
const k2 = await ok(await call('teacher', 'POST', '/parent/classes', { name: 'Ash class' }));
const [other] = (await ok(await call('teacher', 'POST', `/parent/classes/${k2.id}/pupils`, { names: ['Dev'] }))).cards;
assert.equal((await call('ipad', 'POST', '/class/login', { child: other.id, pics: other.pics })).status, 401);

// new pictures replace the old; sign out all devices; class pupils don't use the family limit
const fresh = (await ok(await call('teacher', 'POST', `/parent/children/${cards[0].id}/pics`, {}))).pics;
assert.equal(fresh.length, 3);
await ok(await call('teacher', 'POST', `/parent/classes/${k.id}/devices/signout`, {}));
assert.deepEqual(await ok(await call('ipad', 'GET', '/class')), { device: null });
await ok(await call('teacher', 'POST', `/parent/classes/${k.id}/pupils`, { names: Array.from({ length: 12 }, (_, i) => 'P' + i) }));

// same names: refused in the pasted list and against the class; rename to tell them apart
const dup = await call('teacher', 'POST', `/parent/classes/${k.id}/pupils`, { names: ['ben'] });
assert.equal(dup.status, 400);
assert.match((await dup.json()).error, /already a "ben".*"ben A" and "ben B"/);
assert.equal((await call('teacher', 'POST', `/parent/classes/${k.id}/pupils`, { names: ['Zac', 'zac'] })).status, 400, 'twice in one list');
await ok(await call('teacher', 'POST', `/parent/children/${cards[1].id}/name`, { name: 'Ben A' }));
await ok(await call('teacher', 'POST', `/parent/classes/${k.id}/pupils`, { names: ['Ben B'] }));
assert.equal((await call('teacher', 'POST', `/parent/children/${cards[0].id}/name`, { name: 'ben b' })).status, 400, 'rename clash');
assert.ok((await ok(await call('teacher', 'GET', '/parent/children'))).children.some(c => c.name === 'Ben A'));

// another teacher can't touch the class
await call('other', 'POST', '/parent/signup', { email: 'o@school.test', password: 'a-long-enough-pass', consent: true });
assert.equal((await call('other', 'POST', `/parent/classes/${k.id}/pupils`, { names: ['X'] })).status, 404);
assert.equal((await call('other', 'POST', `/parent/classes/${k.id}/device`, {})).status, 404);

// removing a class keeps the pupils on the account, without pictures
await ok(await call('teacher', 'DELETE', `/parent/classes/${k2.id}`, {}));
const after = await ok(await call('teacher', 'GET', '/parent/children'));
assert.equal(after.children.find(c => c.name === 'Dev').classId, null);
console.log('PASS classes: class devices, picture login, lockouts, school address, ownership');
