// End-to-end test against a running dev server (npm run dev).
// Usage: BASE=http://localhost:8788 node tests/e2e.mjs
import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const BASE = process.env.BASE || 'http://localhost:8788';
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const errors = [];
const watch = pg => {
  pg.on('pageerror', e => errors.push(e.message));
  pg.on('response', r => { if (r.status() >= 500) errors.push(`${r.status()} ${r.url()}`); });
};
const step = (name) => console.log('•', name);

// --- parent signs up and adds a child ---
const parentCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const pp = await parentCtx.newPage(); watch(pp);
await pp.goto(BASE);
step('parent sign-up');
await pp.click('text=I\'m a grown-up');
await pp.click('[data-mode=signup]');
const email = `p${Date.now()}@example.com`;
await pp.fill('input[name=email]', email);
await pp.fill('input[name=password]', 'short');
await pp.check('input[name=consent]');
await pp.click('form .cta');
await pp.waitForSelector('.err');
assert.match(await pp.textContent('.err'), /10 characters/);
await pp.fill('input[name=password]', 'a-long-enough-pass');
await pp.click('form .cta');
await pp.waitForSelector('text=Your children');

step('add child and read the Forest Pass');
await pp.fill('#nm', 'Ava');
await pp.click('form.add button');
await pp.waitForSelector('#pass');
const cred = await pp.$$eval('#pass dd.cred', els => els.map(e => e.textContent));
const [username, password, recovery] = cred;
assert.match(username, /^[A-Z][a-z]+[A-Z][a-z]+\d\d$/);
assert.match(password, /^[a-z]+-[a-z]+-[a-z]+$/);
assert.match(recovery, /^\d{4}-\d{4}$/);
assert.equal(await pp.isDisabled('#cardDone'), true, 'Done needs the written-down tick');
await pp.check('#wrote');
await pp.click('#cardDone');
await pp.waitForSelector('.kid');
assert.match(await pp.textContent('.kid'), /Starting check not done yet/);

// --- child logs in on another device ---
const kidCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const kp = await kidCtx.newPage(); watch(kp);
await kp.goto(BASE);
step('child login: wrong password rejected');
await kp.click('text=I\'m playing');
await kp.fill('input[name=username]', username);
await kp.fill('input[name=password]', 'wrong-words-here');
await kp.click('form .cta');
await kp.waitForSelector('.err');
step('child login: forgiving input (lower case, spaces)');
await kp.fill('input[name=username]', username.toLowerCase());
await kp.fill('input[name=password]', password.toUpperCase().replace(/-/g, ' '));
await kp.click('form .cta');
await kp.waitForSelector('text=Which times tables do you already know?');

step('starting check: claim 2, 5 and 7; know 2 and 5, not 7');
for (const t of [2, 5, 7]) await kp.click(`[data-t="${t}"]`);
const label = await kp.textContent('[data-act=assess-start]');
const planned = +label.match(/\((\d+) questions\)/)[1];
await kp.click('[data-act=assess-start]');
let asked = 0;
while (await kp.$('.q')) {
  const [a, b] = (await kp.textContent('.q')).split('×').map(s => +s.trim());
  const ans = (a === 7 || b === 7) ? a * b + 1 : a * b;   // gets every 7s fact wrong
  for (const d of String(ans)) await kp.keyboard.press(d);
  await kp.keyboard.press('Enter');
  asked++;
  await kp.waitForTimeout(450);
}
assert.equal(asked, planned, 'question count matches the label');
await kp.waitForSelector('text=Starting check done');
const rows = await kp.$$eval('.results li', els => els.map(e => e.textContent.replace(/\s+/g, ' ').trim()));
console.log('  results:', rows);
assert.ok(rows.find(r => r.startsWith('2s')).includes('You know these'));
assert.ok(rows.find(r => r.startsWith('5s')).includes('You know these'));
assert.ok(rows.find(r => r.startsWith('7s')).includes("We'll grow these"));
await kp.click('text=Go to my forest');
await kp.waitForSelector('.forest');
const tablesText = await kp.textContent('.tables');
console.log('  ', tablesText);
assert.match(tablesText, /Planted: the 2, 5, 10 times tables/, '2 and 5 passed, 10 unlocked next');
await kp.waitForTimeout(800);

step('progress survives a reload (stored in D1)');
await kp.reload();
await kp.waitForSelector('.forest');
assert.match(await kp.textContent('.tables'), /2, 5, 10/);

step('play a round');
await kp.click('[data-act=play]');
for (let n = 0; n < 80 && !(await kp.$('.done')); n++) {
  if (await kp.$('[data-act=gotit]')) { await kp.keyboard.press('Enter'); continue; }
  const [a, b] = (await kp.textContent('.q')).split('×').map(s => +s.trim());
  for (const d of String(a * b)) await kp.keyboard.press(d);
  await kp.keyboard.press('Enter');
  await kp.waitForTimeout(700);
}
console.log('  ', (await kp.textContent('.stats')).replace(/\s+/g, ' '));
await kp.waitForTimeout(800);

step('parent sees progress');
await pp.reload();
await pp.waitForSelector('.kid');
const kidRow = await pp.textContent('.kid');
assert.match(kidRow, /\d+ of 66 planted/);
assert.match(kidRow, /last played today/);

step('recovery code issues a new password and the old one stops working');
const kp2 = await (await browser.newContext()).newPage(); watch(kp2);
await kp2.goto(BASE);
await kp2.click('text=I\'m playing');
await kp2.click('text=Lost your password?');
await kp2.fill('input[name=username]', username);
await kp2.fill('input[name=code]', recovery.replace('-', ''));
await kp2.click('form .cta');
await kp2.waitForSelector('#pass');
const newPw = (await kp2.$$eval('#pass dd.cred', els => els.map(e => e.textContent)))[1];
assert.notEqual(newPw, password);
await kp.reload();
await kp.waitForSelector('text=I\'m playing');   // recovery logged out the old session

step('rate limit after 10 wrong passwords');
const r = await (await browser.newContext()).request;
let last;
for (let i = 0; i < 11; i++) last = await r.post(BASE + '/api/child/login', { data: { username, password: 'nope-nope-nope' } });
assert.equal(last.status(), 429);

step('API rejects cross-origin writes and unauthenticated reads');
assert.equal((await r.post(BASE + '/api/child/sync', { data: {}, headers: { origin: 'https://evil.example' } })).status(), 403);
assert.equal((await r.get(BASE + '/api/child/state')).status(), 401);

assert.deepEqual(errors, []);
console.log('PASS');
await browser.close();
