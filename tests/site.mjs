// Website and the move of the app to /app. Usage (dev server running): BASE=http://localhost:8788 node tests/site.mjs
import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const BASE = process.env.BASE || 'http://localhost:8788';
const SHOTS = process.env.SHOTS;   // folder for screenshots, optional
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const errors = [];
const step = name => console.log('•', name);
const watch = p => {
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/status of 401/.test(m.text())) errors.push(m.text()); });   // CSP violations land here; 401 is the logged-out /api/me
  return p;
};

step('home page and school pack load without errors, with no sideways scrolling on a phone');
for (const [w, h] of [[390, 844], [1280, 900]]) {
  const p = watch(await (await browser.newContext({ viewport: { width: w, height: h } })).newPage());
  for (const path of ['/', '/school-pack/data.html', '/school-pack/privacy.html', '/school-pack/dpa.html']) {
    await p.goto(BASE + path);
    await p.evaluate(() => document.fonts.ready);
    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${path} scrolls sideways at ${w}px`);
    if (SHOTS) await p.screenshot({ path: `${SHOTS}/${w}${path.replace(/\W+/g, '-')}.png`, fullPage: true });
  }
  await p.goto(BASE + '/');
  assert.equal(await p.locator('#grove svg').count(), 28);
}

step('an old Forest Pass link (/#qr=) opens the app');
const qp = watch(await (await browser.newContext()).newPage());
await qp.goto(`${BASE}/#qr=${'B'.repeat(43)}`);
await qp.waitForURL(/\/app\/$/);
await qp.waitForSelector('.err');

step('an old install (service worker at /) is retired and moves to the new app');
const oc = await browser.newContext();
const op = watch(await oc.newPage());
await op.goto(BASE + '/app/');
await op.evaluate(async () => {
  await caches.open('ttf-old').then(c => c.put('/x', new Response('x')));
  await navigator.serviceWorker.register('/sw.js', { scope: '/' });
});
await op.waitForFunction(async () => !(await caches.keys()).includes('ttf-old'));
await op.waitForFunction(async () => (await navigator.serviceWorker.getRegistrations()).every(r => new URL(r.scope).pathname !== '/'));

step('the app registers its service worker at /app/');
await op.goto(BASE + '/app/');
await op.waitForFunction(async () => (await navigator.serviceWorker.getRegistrations()).some(r => new URL(r.scope).pathname === '/app/'));

assert.deepEqual(errors, []);
console.log('PASS');
await browser.close();
