// Moving to a new database: with the old DB still bound, the first request copies everything into DATA.
// Each case runs in its own process, as a fresh Worker isolate would (migrations run once per isolate).
// Usage: node tests/move.mjs
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { handle } from '../src/server/api.js';
import { d1 } from './d1-shim.mjs';

const [mode, file] = process.argv.slice(2);
const jar = {};
const caller = env => async (who, method, path, body) => {
  const headers = { cookie: jar[who] || '' };
  if (body) headers['content-type'] = 'application/json';
  const res = await handle(new Request('https://forest.test/api' + path, { method, headers, body: body ? JSON.stringify(body) : undefined }), env);
  const set = res.headers.get('set-cookie');
  if (set) jar[who] = set.split(';')[0];
  return res;
};

if (mode === 'seed') {
  // the old database, as the live site has it: an account, a child with progress, a class with a pupil
  const call = caller({ DATA: d1(file) });
  await call('parent', 'POST', '/parent/signup', { email: 'p@example.com', password: 'a-long-enough-pass', consent: true });
  const { card } = await (await call('parent', 'POST', '/parent/children', { name: 'Ava' })).json();
  const k = await (await call('parent', 'POST', '/parent/classes', { name: 'Oak class' })).json();
  assert.equal((await call('parent', 'POST', `/parent/classes/${k.id}/pupils`, { names: ['Ben'] })).status, 200);
  await call('kid', 'POST', '/child/login', { username: card.username, password: card.password });
  assert.equal((await call('kid', 'POST', '/child/sync', { facts: { '2x3': { box: 3, due: 1 } },
    answers: [{ fact: '2x3', a: 2, b: 3, given: 6, correct: true, ms: 1500, kind: 'review', shape: 'mul', at: Date.now() }] })).status, 200);
  console.log(JSON.stringify({ jar, card }));
} else if (mode === 'move' || mode === 'same') {
  const seed = JSON.parse(process.argv[4]);
  Object.assign(jar, seed.jar);
  const old = d1(file), data = mode === 'move' ? d1() : d1(file);
  const call = caller({ DATA: data, DB: old });
  const state = await (await call('kid', 'GET', '/child/state')).json();   // the child's login was copied too
  assert.equal(state.name, 'Ava');
  assert.equal(state.facts['2x3'].box, 3);
  const list = await (await call('parent', 'GET', '/parent/children')).json();
  assert.deepEqual(list.children.map(c => c.name).sort(), ['Ava', 'Ben']);
  assert.deepEqual(list.classes.map(c => c.name), ['Oak class']);
  assert.equal((await call('p2', 'POST', '/parent/login', { email: 'p@example.com', password: 'a-long-enough-pass' })).status, 200);
  const count = async t => (await data.prepare(`SELECT COUNT(*) AS n FROM ${t}`).first()).n;
  assert.equal(await count('answers'), 1, 'answers copied once');
  assert.equal(await count('children'), 2, 'no duplicate pupils');
  assert.equal((await data.prepare('SELECT done FROM moved').first()).done, 1);
  // new pupils get new ids after the copied ones
  const { card } = await (await call('parent', 'POST', '/parent/children', { name: 'Cal' })).json();
  assert.ok(card.username);
  assert.equal(await count('children'), 3);
  console.log(mode === 'move' ? 'copied into a new database' : 'same database: nothing copied, nothing doubled');
} else {
  const dir = mkdtempSync(join(tmpdir(), 'move-'));
  try {
    const run = (...a) => execFileSync(process.execPath, ['--no-warnings', 'tests/move.mjs', ...a], { encoding: 'utf8' }).trim();
    const seed = run('seed', join(dir, 'old.db'));
    console.log('  ' + run('move', join(dir, 'old.db'), seed));
    const seed2 = run('seed', join(dir, 'same.db'));
    console.log('  ' + run('same', join(dir, 'same.db'), seed2));
    console.log('PASS move: DB copied into a new DATA once; same database left alone');
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
