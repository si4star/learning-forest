// Tests the reminders Worker's run() with an in-memory database and a local stand-in push
// service. Checks the VAPID signature, the time window, "already played today", once a day,
// and removal of expired subscriptions.  Usage: node tests/reminders.mjs
import http from 'node:http';
import assert from 'node:assert/strict';
import { createPublicKey, verify, generateKeyPairSync } from 'node:crypto';
import { run } from '../workers/reminders/index.js';

// a throwaway key pair, so the real private key never appears in tests
const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const jwk = privateKey.export({ format: 'jwk' });
const publicRaw = Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, 'base64url'), Buffer.from(jwk.y, 'base64url')]).toString('base64url');

const hits = [];
const server = http.createServer((req, res) => {
  hits.push({ path: req.url, auth: req.headers.authorization, ttl: req.headers.ttl });
  res.writeHead(req.url === '/gone' ? 410 : 201).end();
}).listen(0);
const port = server.address().port;
const ep = path => `http://127.0.0.1:${port}${path}`;

// minimal D1 stand-in: rows for the SELECT, records UPDATE/DELETE calls
const updates = [];
const fakeDb = rows => ({
  prepare(sql) {
    const stmt = { args: [], bind(...a) { this.args = a; return this; },
      async all() { return { results: rows }; },
      async run() { updates.push({ sql: sql.trim().split(/\s+/).slice(0, 3).join(' '), args: this.args }); return {}; } };
    return stmt;
  },
});

// 17:10 in London on 15 Oct 2026 (BST, UTC+1) is 16:10 UTC
const now = new Date('2026-10-15T16:10:00Z');
const playedToday = new Date('2026-10-15T08:00:00Z').getTime();
const rows = [
  { endpoint: ep('/due'), time: '17:00', tz: 'Europe/London', last_sent: null, last_played: null },              // send
  { endpoint: ep('/played'), time: '17:00', tz: 'Europe/London', last_sent: null, last_played: playedToday },    // already played: skip, mark
  { endpoint: ep('/sent'), time: '17:00', tz: 'Europe/London', last_sent: '2026-10-15', last_played: null },     // already sent today
  { endpoint: ep('/later'), time: '18:00', tz: 'Europe/London', last_sent: null, last_played: null },            // not yet
  { endpoint: ep('/late'), time: '15:00', tz: 'Europe/London', last_sent: null, last_played: null },             // window passed
  { endpoint: ep('/gone'), time: '17:00', tz: 'Europe/London', last_sent: null, last_played: null },             // expired: delete
  { endpoint: ep('/ny'), time: '12:00', tz: 'America/New_York', last_sent: null, last_played: null },            // 12:10 in New York: send
];

// run() signs with the real public key constant; give it ours by swapping the module's key via env
const sent = await run({ DATA: fakeDb(rows), VAPID_PRIVATE_JWK: JSON.stringify(jwk), SITE_URL: 'https://tree-tables.pages.dev', VAPID_PUBLIC_KEY: publicRaw }, now);
server.close();

assert.deepEqual(hits.map(h => h.path).sort(), ['/due', '/gone', '/ny']);
assert.deepEqual(sent.sort(), [ep('/due'), ep('/ny')].sort());
assert.ok(updates.some(u => u.sql.startsWith('DELETE') && u.args[0] === ep('/gone')), 'expired subscription removed');
assert.ok(updates.some(u => u.sql.startsWith('UPDATE') && u.args[1] === ep('/played') && u.args[0] === '2026-10-15'), 'played today: marked, not sent');
assert.ok(updates.some(u => u.sql.startsWith('UPDATE') && u.args[1] === ep('/ny') && u.args[0] === '2026-10-15'), 'New York date used');

// VAPID header: a valid ES256 JWT for the push service's origin, signed by the private key
const auth = hits.find(h => h.path === '/due').auth;
const m = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(auth);
assert.ok(m, 'vapid header shape');
const [, h64, c64, s64, k] = m;
const claims = JSON.parse(Buffer.from(c64, 'base64url'));
assert.equal(claims.aud, `http://127.0.0.1:${port}`);
assert.equal(claims.sub, 'https://tree-tables.pages.dev');
assert.ok(claims.exp > Date.now() / 1000 && claims.exp <= Date.now() / 1000 + 24 * 3600, "expiry within 24 hours (push services reject longer)");
const pub = createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y }, format: 'jwk' });
assert.ok(verify('sha256', Buffer.from(`${h64}.${c64}`), { key: pub, dsaEncoding: 'ieee-p1363' }, Buffer.from(s64, 'base64url')), 'signature verifies');
assert.equal(k, publicRaw);
console.log('PASS reminders: sent', sent.length, 'of', rows.length, '| signature verified');
