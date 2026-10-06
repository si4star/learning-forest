// Tests QR login on the server with the real API code and an in-memory database.
// Usage: node tests/qr.mjs
import assert from 'node:assert/strict';
import { handle } from '../src/server/api.js';
import { d1 } from './d1-shim.mjs';

const env = { DB: d1() };
const jar = {};
async function call(who, method, path, body) {
  const headers = { cookie: jar[who] || '' };
  if (body) headers['content-type'] = 'application/json';
  const res = await handle(new Request('https://forest.test/api' + path, { method, headers, body: body ? JSON.stringify(body) : undefined }), env);
  const set = res.headers.get('set-cookie');
  if (set) jar[who] = set.split(';')[0];
  return res;
}

await call('parent', 'POST', '/parent/signup', { email: 'p@example.com', password: 'a-long-enough-pass', consent: true });
const added = await (await call('parent', 'POST', '/parent/children', { name: 'Ava' })).json();
const first = added.card.qr;
assert.match(first, /^[A-Za-z0-9_-]{40,}$/, 'every new Forest Pass has a QR key');

// the QR key logs the child in
let res = await call('kid', 'POST', '/child/qr', { key: first });
assert.equal(res.status, 200);
assert.equal((await (await call('kid', 'GET', '/child/state')).json()).name, 'Ava');

// wrong or malformed keys don't
assert.equal((await call('x', 'POST', '/child/qr', { key: first.slice(0, -2) + 'AA' })).status, 401);
assert.equal((await call('x', 'POST', '/child/qr', { key: '../../etc' })).status, 401);

// a new QR card replaces the old key, keeps the password, and doesn't log the child out
const qrCard = (await (await call('parent', 'POST', `/parent/children/${added.id}/qr`, {})).json()).card;
assert.equal(qrCard.password, undefined, 'password unchanged and not shown');
assert.notEqual(qrCard.qr, first);
assert.equal((await call('y', 'POST', '/child/qr', { key: first })).status, 401, 'old QR stops working');
assert.equal((await call('y', 'POST', '/child/qr', { key: qrCard.qr })).status, 200);
assert.equal((await call('z', 'POST', '/child/login', { username: added.card.username, password: added.card.password })).status, 200, 'password still works');

// a full new Forest Pass also replaces the QR key; another family can't make one
const reset = (await (await call('parent', 'POST', `/parent/children/${added.id}/reset`, {})).json()).card;
assert.equal((await call('w', 'POST', '/child/qr', { key: qrCard.qr })).status, 401);
assert.equal((await call('w', 'POST', '/child/qr', { key: reset.qr })).status, 200);
await call('other', 'POST', '/parent/signup', { email: 'o@example.com', password: 'a-long-enough-pass', consent: true });
assert.equal((await call('other', 'POST', `/parent/children/${added.id}/qr`, {})).status, 404);

// guessing is rate limited (30 failures per address in 15 minutes)
let last;
for (let i = 0; i < 27; i++) last = await call('g', 'POST', '/child/qr', { key: 'A'.repeat(43) });
assert.equal(last.status, 429);

console.log('PASS qr: login by key, new QR card keeps password, old keys stop working, rate limit');
