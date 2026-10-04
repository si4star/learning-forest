// Tests the read-aloud route (/api/tts) with the real API code, an in-memory SQLite database
// standing in for D1, and a fake Workers AI binding.  Usage: node tests/tts.mjs
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { handle } from '../src/server/api.js';
import { toBytes, sniff } from '../src/server/tts.js';

// --- minimal D1 over node:sqlite ---
function d1() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  const conv = a => a.map(v => (v === undefined ? null : typeof v === 'boolean' ? Number(v) : v));
  const reads = sql => /^\s*(SELECT|WITH)\b|\bRETURNING\b/i.test(sql);
  const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, a),
    first: async () => db.prepare(sql).get(...conv(args)) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...conv(args)) }),
    run: async () => { db.prepare(sql).run(...conv(args)); return {}; },
    exec: () => (reads(sql) ? { results: db.prepare(sql).all(...conv(args)) } : (db.prepare(sql).run(...conv(args)), { results: [] })),
  });
  return {
    prepare: sql => stmt(sql),
    async batch(list) {
      db.exec('BEGIN');
      try { const out = list.map(s => s.exec()); db.exec('COMMIT'); return out; } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
  };
}

// --- fake Workers AI: returns a short WAV, counts calls ---
const wav = Uint8Array.from([...Buffer.from('RIFF'), ...new Array(200).fill(1)]);
let calls = [];
const AI = { run: async (model, input) => { calls.push({ model, input }); return new ReadableStream({ start(c) { c.enqueue(wav); c.close(); } }); } };

const env = { DB: d1(), AI };
const B = 'https://forest.test';
let cookie = '';
async function call(method, path, body, e = env) {
  const headers = { cookie };
  if (body) headers['content-type'] = 'application/json';
  const res = await handle(new Request(B + '/api' + path, { method, headers, body: body ? JSON.stringify(body) : undefined }), e);
  const set = res.headers.get('set-cookie');
  if (set) cookie = set.split(';')[0];
  return res;
}

// a parent, a child, and the child logged in
assert.equal((await call('POST', '/parent/signup', { email: 'p@example.com', password: 'a-long-enough-pass', consent: true })).status, 200);
const { card } = await (await call('POST', '/parent/children', { name: 'Ava' })).json();
cookie = '';
assert.equal((await call('GET', '/tts?t=hello')).status, 401, 'logged-out users get no audio');
assert.equal((await call('POST', '/child/login', { username: card.username, password: card.password })).status, 200);

// first request generates with the British default voice; the second comes from the cache
let res = await call('GET', '/tts?t=' + encodeURIComponent('6 times what equals 42?'));
assert.equal(res.status, 200);
assert.equal(res.headers.get('content-type'), 'audio/wav');
assert.deepEqual(new Uint8Array(await res.arrayBuffer()), wav);
assert.deepEqual(calls[0], { model: '@cf/deepgram/aura-1', input: { text: '6 times what equals 42?', speaker: 'athena' } });
res = await call('GET', '/tts?t=' + encodeURIComponent('  6 times   what equals 42? '));
assert.equal(res.status, 200);
assert.equal(calls.length, 1, 'same phrase (after tidying spaces) is served from the database');

// only plain phrases
assert.equal((await call('GET', '/tts?t=' + encodeURIComponent('<script>'))).status, 400);
assert.equal((await call('GET', '/tts?t=' + 'a'.repeat(201))).status, 400);

// fallback model when the first fails
calls = [];
const flaky = { run: async (model, input) => { calls.push(model); if (model.includes('aura')) throw new Error('down'); return { audio: Buffer.from(wav).toString('base64') }; } };
res = await call('GET', '/tts?t=fallback%20please', null, { ...env, AI: flaky });
assert.equal(res.status, 200);
assert.deepEqual(calls, ['@cf/deepgram/aura-1', '@cf/myshell-ai/melotts']);

// no AI binding: cached phrases still play, new ones get 503 (the app then uses the device voice)
assert.equal((await call('GET', '/tts?t=' + encodeURIComponent('6 times what equals 42?'), null, { DB: env.DB })).status, 200);
assert.equal((await call('GET', '/tts?t=brand%20new', null, { DB: env.DB })).status, 503);

// daily cap
calls = [];
const capped = { ...env, TTS_DAILY_CAP: '3' };   // 2 generations already today
assert.equal((await call('GET', '/tts?t=third', null, capped)).status, 200);
assert.equal((await call('GET', '/tts?t=fourth', null, capped)).status, 429);
assert.equal(calls.length, 1);

// output shapes
assert.equal(sniff(Uint8Array.from([0xff, 0xfb, 0, 0])), 'audio/mpeg');
assert.equal((await toBytes(new Uint8Array([1, 2, 3]).buffer)).length, 3);
assert.equal(await toBytes({}), null);

console.log('PASS tts: generate once, cache, fallback model, 503 without AI, caps, text checks');
