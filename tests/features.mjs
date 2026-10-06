// End-to-end tests for: question shapes, forest friends, streak rest day,
// personal bests, practice check, tricky facts, hidden reminder setting and offline play.
// Usage (dev server running): BASE=http://localhost:8788 node tests/features.mjs
import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const BASE = process.env.BASE || 'http://localhost:8788';
const ORDER = [10, 2, 5, 11, 3, 4, 9, 6, 8, 12, 7];
const browser = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), });
const errors = [];
const step = name => console.log('•', name);

// --- a parent, and a child whose whole forest is grown and due today ---
const parent = await browser.newContext();
await parent.request.post(BASE + '/api/parent/signup', { data: { email: `f${Date.now()}@example.com`, password: 'a-long-enough-pass', consent: true } });
const { card } = await (await parent.request.post(BASE + '/api/parent/children', { data: { name: 'Ava' } })).json();

const kidCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
// a stand-in push service
await kidCtx.addInitScript(() => {
  window.Notification = { permission: 'default', requestPermission: async () => 'granted' };
  window.PushManager = function () {};
  const sub = { endpoint: 'https://push.example.com/abc', toJSON: () => ({ endpoint: 'https://push.example.com/abc', keys: { p256dh: 'BPk', auth: 'au' } }), unsubscribe: async () => true };
  if (navigator.serviceWorker) {
    const real = navigator.serviceWorker;
    Object.defineProperty(navigator.serviceWorker, 'ready', { get: () => real.getRegistration().then(reg => {
      Object.defineProperty(reg, 'pushManager', { value: { subscribe: async () => sub, getSubscription: async () => (window.__unsub ? null : sub) }, configurable: true });
      return reg;
    }) });
  }
});
const kr = kidCtx.request;
assert.equal((await kr.post(BASE + '/api/child/login', { data: { username: card.username, password: card.password } })).status(), 200);
const all = []; for (let a = 2; a <= 12; a++) for (let b = a; b <= 12; b++) all.push(`${a}x${b}`);
const twoDaysAgo = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - 2); return d.getTime(); })();
assert.equal((await kr.post(BASE + '/api/child/sync', { data: {
  facts: Object.fromEntries(all.map(k => [k, { box: 4, due: Date.now() - 1000 }])),
  meta: { tables: ORDER, streak: 5, lastDay: twoDaysAgo, assessedAt: Date.now(), theme: 'auto', extra: { intros: ORDER, friends: [] } },
} })).status(), 200);

const kp = await kidCtx.newPage();
kp.on('pageerror', e => errors.push(e.message));
await kp.goto(BASE + '/app/');
await kp.click('[data-act=mod-tables]');   // module picker after login
await kp.waitForSelector('.forest');
await kp.waitForFunction(() => navigator.serviceWorker.controller);   // service worker in charge, for offline later

step('practice check is offered once the forest is grown');
assert.ok(await kp.$('[data-act=mock-intro]'));
assert.match(await kp.textContent('.streak'), /5 days in a row/);

step('settings has no read aloud');
await kp.click('[data-act=settings]');
assert.equal(await kp.locator('.sheet h3', { hasText: /read aloud/i }).count(), 0);
await kp.click('.sheet [data-act=close]');

const type = async v => { for (const d of String(v)) await kp.keyboard.press(d); await kp.keyboard.press('Enter'); };
const solve = q => {
  let m;
  if ((m = /^(\d+) × \? = (\d+)$/.exec(q))) return +m[2] / +m[1];
  if ((m = /^(\d+) ÷ (\d+)$/.exec(q))) return +m[1] / +m[2];
  if ((m = /^(\d+) × (\d+)$/.exec(q))) return +m[1] * +m[2];
  throw new Error('unknown question ' + q);
};
const solveStep = q => {
  let m;
  if ((m = /^(\d+) tens$/.exec(q))) return +m[1] * 10;
  if ((m = /^double (\d+)$/.exec(q))) return +m[1] * 2;
  if ((m = /^half of (\d+)$/.exec(q))) return +m[1] / 2;
  if ((m = /^write (\d+) twice$/.exec(q))) return +m[1] * 11;
  if ((m = /^(\d+) × (\d+)$/.exec(q))) return +m[1] * +m[2];
  if ((m = /^(\d+) \+ (\d+)$/.exec(q))) return +m[1] + +m[2];
  if ((m = /^(\d+) − (\d+)$/.exec(q))) return +m[1] - +m[2];
  throw new Error('unknown step ' + q);
};

step('grown trees are asked in different shapes; one wrong answer gets the walk-through');
await kp.click('[data-act=play]');
const shapes = { mul: 0, missing: 0, div: 0 };
let missedOne = false;
for (let n = 0; n < 60 && !(await kp.$('.done')); n++) {
  if (await kp.$('.walk')) {
    while (!(await kp.$('[data-act=walk-next]'))) await type(solveStep((await kp.textContent('.steps .now .step-eq')).replace(/=.*$/s, '').trim()));
    await kp.keyboard.press('Enter'); continue;
  }
  const q = (await kp.textContent('.q')).trim();
  const shape = q.includes('÷') ? 'div' : q.includes('?') ? 'missing' : 'mul';
  shapes[shape]++;
  if (!missedOne && shape !== 'mul') { missedOne = true; await type(solve(q) + 1); await kp.waitForSelector('.walk'); continue; }
  await type(solve(q));
  await kp.waitForTimeout(650);
}
console.log('  shapes:', shapes);
assert.ok(shapes.missing + shapes.div > 0, 'some questions asked another way round');
assert.ok(missedOne);

step('forest friends move in, and the streak survives one missed day');
const summary = await kp.textContent('.done');
assert.match(summary, /has moved into your forest/);
await kp.click('[data-act=home]');
const friendCount = (await kp.$$('.friends li')).length;
console.log('  friends:', friendCount);
assert.ok(friendCount >= 8 && friendCount <= 10, 'every table but the missed fact\'s');
assert.match(await kp.textContent('.streak'), /6 days in a row · rest day used this week/);

step('personal bests');
await kp.click('[data-act=bests]');
await kp.waitForSelector('.sheet .bests li');
assert.match(await kp.textContent('.sheet'), /Quickest this week/);
await kp.click('.sheet [data-act=close]');

step('practice check: 25 questions, one left to time out');
await kp.click('[data-act=mock-intro]');
await kp.click('[data-act=mock-start]');
for (let n = 0; n < 25; n++) {
  await kp.waitForSelector('.q');
  assert.ok(await kp.$('.clock'));
  if (n === 4) { await kp.waitForSelector('.pause-msg', { timeout: 9000 }); }   // no answer: the clock runs out
  else await type(solve((await kp.textContent('.q')).trim()));
  if (n < 24) await kp.waitForSelector('.pause-msg');
}
await kp.waitForSelector('text=24 out of 25', { timeout: 10000 });
assert.match(await kp.textContent('.missed'), /no answer/);
await kp.click('[data-act=home]');

step('daily reminders are hidden from the pupil\'s settings for now');
await kp.click('[data-act=settings]');
assert.equal(await kp.locator('.sheet #remTime, .sheet [data-act=reminder-on]').count(), 0);
await kp.click('.sheet [data-act=close]');

step('grown-up sees tricky facts and the practice check score');
const pp = await parent.newPage();
pp.on('pageerror', e => errors.push(e.message));
await pp.goto(BASE + '/app/');
await pp.waitForSelector('.kid');
await pp.click('[data-act=tricky]');
await pp.waitForSelector('.sheet .tricky li');
const tricky = await pp.textContent('.sheet');
assert.match(tricky, /wrong 1 of/);
assert.match(tricky, /24 \/ 25/);
console.log('  ', tricky.replace(/\s+/g, ' ').slice(0, 160), '…');

step('offline: the forest opens and a round can be played; answers save on reconnect');
const before = await (await parent.request.get(`${BASE}/api/parent/children/${(await (await parent.request.get(BASE + '/api/parent/children')).json()).children[0].id}/tricky`)).json();
await kidCtx.setOffline(true);
await kp.reload();
await kp.click('[data-act=mod-tables]');   // module picker after login
await kp.waitForSelector('.forest');
assert.match(await kp.textContent('.warn'), /offline/);
await kp.click('[data-act=play]');
for (let n = 0; n < 3; n++) {
  if (await kp.$('.walk')) break;
  await type(solve((await kp.textContent('.q')).trim()));
  await kp.waitForTimeout(700);
}
await kp.click('[data-act=quit]');
await kidCtx.setOffline(false);
await kp.waitForFunction(() => !document.querySelector('.warn'), null, { timeout: 15000 });
const childId = (await (await parent.request.get(BASE + '/api/parent/children')).json()).children[0].id;
const after = await (await parent.request.get(`${BASE}/api/parent/children/${childId}/tricky`)).json();
console.log(`   questions this week: ${before.week.asked} → ${after.week.asked}`);
assert.ok(after.week.asked >= before.week.asked + 3, 'offline answers reached the server');

assert.deepEqual(errors, []);
console.log('PASS');
await browser.close();
