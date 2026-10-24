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
assert.equal(await kp.textContent('.status'), '66 trees are ready to check. Each round checks up to 20.', 'a big backlog takes a few rounds');
assert.equal(await kp.textContent('[data-act=play]'), 'Play a round');

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
  if ((m = /^(\d+) ÷ (\d+)$/.exec(q))) return +m[1] / +m[2];
  throw new Error('unknown step ' + q);
};

step('grown trees are asked in different shapes; a wrong division gets the walk-through, ending with the division');
await kp.click('[data-act=play]');
const shapes = { mul: 0, missing: 0, div: 0 };
let missedOne = false, missedQ, lastStep;
for (let n = 0; n < 60 && !(await kp.$('.done')); n++) {
  if (await kp.$('.walk')) {
    while (!(await kp.$('[data-act=walk-next]'))) await type(solveStep(lastStep = (await kp.textContent('.steps .now .step-eq')).replace(/=.*$/s, '').trim()));
    if (missedQ) { assert.equal(lastStep, missedQ, 'the walk-through ends with the division'); missedQ = null; }
    await kp.keyboard.press('Enter'); continue;
  }
  const q = (await kp.textContent('.q')).trim();
  const shape = q.includes('÷') ? 'div' : q.includes('?') ? 'missing' : 'mul';
  shapes[shape]++;
  if (!missedOne && shape === 'div') { missedOne = true; missedQ = q; await type(solve(q) + 1); await kp.waitForSelector('.walk'); continue; }
  await type(solve(q));
  await kp.waitForTimeout(650);
}
console.log('  shapes:', shapes);
assert.ok(shapes.missing + shapes.div > 0, 'some questions asked another way round');
assert.ok(missedOne && !missedQ);

step('forest friends move in, and the streak survives one missed day');
const summary = await kp.textContent('.done');
assert.match(summary, /has moved into your forest/);
assert.doesNotMatch(summary, /golden acorn/, 'trees still left to check, so no acorn');
await kp.click('[data-act=home]');
assert.deepEqual(await kp.locator('.dock button').evaluateAll(bs => bs.map(b => b.dataset.act)), ['friends', 'grove', 'bests'], 'bottom bar');
await kp.click('.dock [data-act=friends]');
const friendCount = (await kp.$$('.sheet .friends li:not(.to-come)')).length;
assert.equal(await kp.locator('.sheet .friends li').count(), 11, 'every animal shown, the ones to come as ?');
await kp.click('.sheet [data-act=close]');
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
// two wrong answers: one missed on purpose in a round, one left to time out in the practice check.
// They can land on the same fact ("wrong 2 of"), so count them up rather than expect "wrong 1 of".
assert.equal([...tricky.matchAll(/wrong (\d+) of/g)].reduce((n, m) => n + Number(m[1]), 0), 2);
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

step('milestones: the last seed planted, the practice check opening and a seventh golden acorn are celebrated');
{
  const { card: c2 } = await (await parent.request.post(BASE + '/api/parent/children', { data: { name: 'Bea' } })).json();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  assert.equal((await ctx.request.post(BASE + '/api/child/login', { data: { username: c2.username, password: c2.password } })).status(), 200);
  const later = Date.now() + 5 * 864e5;
  // 33 grown trees, one sapling due now, one seed not planted, the rest saplings not due yet
  const facts = Object.fromEntries(all.map((k, i) => [k, i < 33 ? { box: 4, due: later } : i === 33 ? { box: 3, due: Date.now() - 1000 } : { box: 3, due: later }]));
  delete facts[all[65]];
  assert.equal((await ctx.request.post(BASE + '/api/child/sync', { data: { facts,
    meta: { tables: ORDER, streak: 1, lastDay: twoDaysAgo, assessedAt: Date.now(), theme: 'auto', extra: { intros: ORDER, friends: [], acorns: 6, acornDay: twoDaysAgo } } } })).status(), 200);
  const bp = await ctx.newPage(); bp.on('pageerror', e => errors.push(e.message));
  await bp.goto(BASE + '/app/');
  assert.match(await bp.textContent('[data-act=mod-tables]'), /65 of 66 trees planted/);
  await bp.click('[data-act=mod-tables]');
  await bp.waitForSelector('.forest');
  assert.match(await bp.textContent('.tables'), /Only 1 seed left to plant/);
  assert.match(await bp.textContent('.goal'), /33 of 34/);
  assert.equal(await bp.locator('[data-act=mock-intro]').count(), 0);
  assert.match(await bp.textContent('.dock [data-act=grove]'), /6 of 7/);
  await bp.click('.dock [data-act=grove]');
  assert.equal(await bp.locator('.sheet .grove .acorn.gold').count(), 6);
  assert.equal(await bp.locator('.sheet .grove li').count(), 0);
  await bp.click('.sheet [data-act=close]');
  await bp.click('[data-act=play]');
  const press = async v => { for (const d of String(v)) await bp.keyboard.press(d); await bp.keyboard.press('Enter'); };
  for (let n = 0; n < 60 && !(await bp.$('.done')); n++) {
    if (await bp.$('.walk')) {
      while (!(await bp.$('[data-act=walk-next]'))) await press(solveStep((await bp.textContent('.steps .now .step-eq')).replace(/=.*$/s, '').trim()));
      await bp.keyboard.press('Enter'); continue;
    }
    await press(solve((await bp.textContent('.q')).trim()));
    await bp.waitForTimeout(650);
  }
  assert.equal(await bp.textContent('.done h1'), 'The practice check is open!');
  assert.match(await bp.textContent('.done'), /All 66 trees are in your forest/);
  assert.equal(await bp.locator('.confetti i').count(), 24);
  assert.match(await bp.textContent('.done'), /A golden acorn! Every tree is checked today/);
  assert.match(await bp.textContent('.done'), /an oak has been planted in your special grove/);
  await bp.click('.done [data-act=mock-intro]');
  await bp.waitForSelector('[data-act=mock-start]');
  await bp.goto(BASE + '/app/');
  assert.match(await bp.textContent('[data-act=mod-tables]'), /All 66 trees planted/);
  await bp.click('[data-act=mod-tables]');
  await bp.waitForSelector('.forest');
  assert.match(await bp.textContent('.tables'), /Every seed is planted/);
  assert.equal(await bp.locator('.goal').count(), 0);
  assert.equal(await bp.locator('[data-act=mock-intro]').count(), 1);
  await bp.click('.dock [data-act=grove]');
  assert.deepEqual(await bp.locator('.sheet .grove li').allTextContents(), ['Oak']);
  assert.equal(await bp.locator('.sheet .grove .acorn.gold').count(), 0);
  assert.match(await bp.textContent('.sheet .grove'), /You've earned today's golden acorn/);
  await bp.click('.sheet [data-act=close]');
  assert.match(await bp.textContent('.status'), /You've earned today's golden acorn/);
  // one acorn a day: another round today earns nothing
  await bp.click('[data-act=play]');
  for (let n = 0; n < 60 && !(await bp.$('.done')); n++) {
    if (await bp.$('.walk')) {
      while (!(await bp.$('[data-act=walk-next]'))) await press(solveStep((await bp.textContent('.steps .now .step-eq')).replace(/=.*$/s, '').trim()));
      await bp.keyboard.press('Enter'); continue;
    }
    await press(solve((await bp.textContent('.q')).trim()));
    await bp.waitForTimeout(650);
  }
  assert.doesNotMatch(await bp.textContent('.done'), /golden acorn/);
  await ctx.close();
}

assert.deepEqual(errors, []);
console.log('PASS');
await browser.close();
