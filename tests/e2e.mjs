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
await pp.waitForFunction(() => cardFile && cardFile.type === 'image/png' && cardFile.size > 10000);   // card image for share/print
await pp.check('#wrote');
await pp.click('#cardDone');
await pp.waitForSelector('.kid');
assert.match(await pp.textContent('.kid'), /Starting check not done yet/);

// --- child logs in on another device ---
const kidCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
// stand-in for the Screen Wake Lock API so the test can see when the screen is held on
await kidCtx.addInitScript(() => {
  window.__wake = { held: 0, requests: 0 };
  Object.defineProperty(navigator, 'wakeLock', { value: { request: async () => {
    window.__wake.requests++; window.__wake.held++;
    const l = new EventTarget(); let done = false;
    l.release = async () => { if (!done) { done = true; window.__wake.held--; l.dispatchEvent(new Event('release')); } };
    return l;
  } } });
});
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

step('play a round (screen kept awake, released after)');
await kp.click('[data-act=play]');
await kp.waitForFunction(() => window.__wake.held === 1);
// gets questions 3 and 6 wrong (then types the correction) to check the total never changes
const totals = new Set(), counts = [];
let roundAsked = 0;
for (let n = 0; n < 80 && !(await kp.$('.done')); n++) {
  const c = (await kp.textContent('.count')).split('/'); totals.add(c[1]); counts.push(+c[0]);
  if (await kp.$('[data-act=gotit]')) { await kp.keyboard.press('Enter'); continue; }
  const [a, b] = (await kp.textContent('.q')).split('×').map(s => +s.trim());
  const wrong = ++roundAsked === 3 || roundAsked === 6;
  for (const d of String(wrong ? a * b + 1 : a * b)) await kp.keyboard.press(d);
  await kp.keyboard.press('Enter');
  if (wrong) {
    await kp.waitForSelector('.fix');
    for (const d of String(a * b)) await kp.keyboard.press(d);
    await kp.keyboard.press('Enter');
  }
  await kp.waitForTimeout(700);
}
console.log('  ', (await kp.textContent('.stats')).replace(/\s+/g, ' '), '| counter:', counts.join(','), '/', [...totals].join(','));
assert.equal(totals.size, 1, 'round total never changes');
assert.equal(Math.max(...counts), +[...totals][0], 'counter reaches the total');
assert.ok(counts.every((c, i) => i === 0 || c >= counts[i - 1]), 'counter never goes backwards');
await kp.waitForFunction(() => window.__wake.held === 0);
console.log('   wake lock requests this session:', await kp.evaluate(() => window.__wake.requests));
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
for (let i = 0; i < 11; i++) last = await r.post(BASE + '/api/child/login', { data: { username: 'SomeoneElse99', password: 'nope-nope-nope' } });
assert.equal(last.status(), 429);

step('API rejects cross-origin writes and unauthenticated reads');
assert.equal((await r.post(BASE + '/api/child/sync', { data: {}, headers: { origin: 'https://evil.example' } })).status(), 403);
assert.equal((await r.get(BASE + '/api/child/state')).status(), 401);

step('settings menu: child picks a season, and it is saved');
await kp.goto(BASE);
await kp.click("text=I'm playing");
await kp.fill('input[name=username]', username);
await kp.fill('input[name=password]', newPw);
await kp.click('form .cta');
await kp.waitForSelector('.forest');
await kp.click('[data-act=settings]');
await kp.click('.sheet [data-s=winter]');
assert.equal(await kp.evaluate(() => document.documentElement.dataset.season), 'winter');
assert.equal(await kp.getAttribute('.sheet [data-s=winter]', 'aria-pressed'), 'true');
await kp.click('.sheet .menu-row');                       // How the method works
await kp.waitForSelector('.sheet h2:text("How the method works")');
await kp.click('.sheet [data-act=close]');
await kp.waitForTimeout(800);
await kp.reload();
await kp.waitForSelector('.forest');
assert.equal(await kp.evaluate(() => document.documentElement.dataset.season), 'winter');
await kp.click('[data-act=settings]');
assert.equal(await kp.getAttribute('.sheet [data-s=winter]', 'aria-pressed'), 'true');
step('log out from settings, then back in');
await kp.click('.sheet [data-act=logout]');
await kp.waitForSelector("text=I'm playing");
await kp.click("text=I'm playing");
await kp.fill('input[name=username]', username);
await kp.fill('input[name=password]', newPw);
await kp.click('form .cta');
await kp.waitForSelector('.forest');

step('install banner shows when the browser offers install, and hides for 14 days');
await kp.evaluate(() => { const e = new Event('beforeinstallprompt'); e.prompt = () => {}; e.userChoice = Promise.resolve({}); window.dispatchEvent(e); });
await kp.waitForSelector('.install');
await kp.click('.install .x');
assert.equal(await kp.$('.install'), null);

step('PWA: manifest and service worker');
const manifest = await (await r.get(BASE + '/manifest.webmanifest')).json();
assert.equal(manifest.display, 'standalone');
for (const i of manifest.icons) assert.equal((await r.get(BASE + i.src)).status(), 200, i.src);
const swVersion = async page => page.evaluate(async () => {
  const reg = await navigator.serviceWorker.ready;
  return (await caches.keys()).find(k => k.startsWith('ttf-'));
});
console.log('  cache:', await swVersion(pp));

if (process.env.REBUILD) {
  step('publishing a new version updates the open app');
  await pp.goto(BASE);
  await pp.waitForSelector('.ver');
  const before = await pp.textContent('.ver');
  const { execSync } = await import('node:child_process');
  execSync(process.env.REBUILD, { stdio: 'inherit' });
  await pp.waitForTimeout(1500);
  await pp.evaluate(() => navigator.serviceWorker.getRegistration().then(r => r.update())).catch(() => {}); // may already be reloading
  await pp.waitForFunction(b => document.querySelector('.ver') && document.querySelector('.ver').textContent !== b, before, { timeout: 20000 });
  const after = await pp.textContent('.ver');
  console.log(`  ${before} → ${after}; caches:`, await pp.evaluate(() => caches.keys()));
  assert.equal((await pp.evaluate(() => caches.keys())).filter(k => k.startsWith('ttf-')).length, 1, 'old cache deleted');
}

assert.deepEqual(errors, []);
console.log('PASS');
await browser.close();
