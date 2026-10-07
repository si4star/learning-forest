// Website, and the moves of the app (from /, then /tables/) to /app/. Usage (dev server running): BASE=http://localhost:8788 node tests/site.mjs
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
  for (const path of ['/', '/trees/', '/school-pack/data.html', '/school-pack/privacy.html', '/school-pack/dpa.html', '/school-pack/terms.html', '/404.html']) {
    await p.goto(BASE + path);
    await p.evaluate(() => document.fonts.ready);
    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${path} scrolls sideways at ${w}px`);
    assert.equal(await p.locator('.lf-top').count(), 1, `${path}: The Learning Forest header`);
    assert.equal(await p.locator('.lf-foot .lf-small').count(), 1, `${path}: The Learning Forest footer`);
    assert.equal(await p.locator('text=lf:header').count(), 0, `${path}: header marker replaced`);
    if (SHOTS) await p.screenshot({ path: `${SHOTS}/${w}${path.replace(/\W+/g, '-')}.png`, fullPage: true });
  }
  await p.goto(BASE + '/');
  assert.equal(await p.locator('#grove svg').count(), 28);
  assert.deepEqual(await p.locator('.module .mt b').allTextContents(), ['How does a tree work?', 'Grow your times tables', 'What is soil?']);
  assert.equal(await p.isVisible('text=Spaced repetition'), false, 'module details start closed');
  await p.click('#tables summary');
  assert.ok(await p.isVisible('text=Spaced repetition'), 'tapping a module shows its details');
}

step('a link to /#tables opens that module');
{
  const hp = watch(await (await browser.newContext()).newPage());
  await hp.goto(BASE + '/#tables');
  assert.ok(await hp.isVisible('text=Spaced repetition'));
}

step('How does a tree work?: works, loads nothing from other websites, stores nothing');
{
  const tc = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const tp = watch(await tc.newPage()), outside = [];
  tp.on('request', r => { if (!r.url().startsWith(BASE)) outside.push(r.url()); });
  await tp.goto(BASE + '/trees/');
  await tp.click('#go');
  assert.equal(await tp.getAttribute('#go', 'aria-pressed'), 'true');
  await tp.click('[data-act=grow]');
  assert.match(await tp.textContent('#fig-grow .cap'), /^Year 2/);
  assert.equal(await tp.getAttribute('.lf-logo', 'href'), '/');
  assert.ok(await tp.locator('.bar #nav a').count() > 5, 'the page keeps its section links');
  assert.ok(await tp.isVisible('.finish .sources'), 'book credits in the closing section');
  assert.equal(await tp.locator('#share').count(), 0, 'no share button');
  assert.equal(await tp.locator('main a[href^="http"]').count(), 0, 'no links out to other sites');
  // the site header and the page's section bar stay on top wherever you scroll
  for (const y of [1500, 15000]) {
    assert.ok(await tp.evaluate(y => { document.documentElement.style.scrollBehavior = 'auto'; scrollTo(0, y);
      return !!document.elementFromPoint(innerWidth / 2, 3).closest('.lf-stick .lf-top'); }, y), `header on top at ${y}px`);
  }
  assert.deepEqual(outside, []);
  assert.deepEqual(await tp.evaluate(() => Object.keys(localStorage)), []);
}

step('sitemap: every page in it loads and can be indexed; robots.txt points to it; the app is kept out of search');
{
  const rq = (await browser.newContext()).request;
  const robots = await (await rq.get(BASE + '/robots.txt')).text();
  assert.match(robots, /^Sitemap: https:\/\/learn\.thetreefella\.co\.uk\/sitemap\.xml$/m);
  assert.doesNotMatch(robots, /Disallow: \/app/, "the app isn't blocked, or its noindex couldn't be seen");
  const urls = [...(await (await rq.get(BASE + '/sitemap.xml')).text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  assert.ok(urls.length >= 6);
  for (const u of urls) {
    const res = await rq.get(u.replace('https://learn.thetreefella.co.uk', BASE));
    assert.equal(res.status(), 200, u);
    assert.doesNotMatch(await res.text(), /<meta name="robots" content="[^"]*noindex/, `${u} is indexable`);
    assert.ok(!(res.headers()['x-robots-tag'] || '').includes('noindex'), `${u} has no noindex header`);
  }
  assert.ok(!urls.some(u => /\/app\/|\/admin\//.test(u)), 'no app or admin pages in the sitemap');
  const app = await rq.get(BASE + '/app/');
  assert.match(app.headers()['x-robots-tag'] || '', /noindex/);
  assert.match(await app.text(), /<meta name="robots" content="noindex">/);
  const home = watch(await (await browser.newContext()).newPage());
  await home.goto(BASE + '/');
  assert.equal(await home.getAttribute('.lf-foot a:text("The Tree Fella")', 'href'), 'https://thetreefella.co.uk/');
  assert.equal(await home.locator('a[href$=".html"]').count(), 0, 'internal links use the final addresses');
}

step('an unknown address shows the not-found page');
const nf = await (await browser.newContext()).request.get(BASE + '/nope/');
assert.equal(nf.status(), 404);
assert.match(await nf.text(), /Page not found/);

for (const old of ['/', '/tables/']) {
  step(`an old Forest Pass link (${old}#qr=) opens the app at /app/`);
  const qp = watch(await (await browser.newContext()).newPage());
  await qp.goto(`${BASE}${old}#qr=${'B'.repeat(43)}`);
  await qp.waitForURL(/\/app\/$/);
  await qp.waitForSelector('.err');
}

for (const scope of ['/', '/tables/']) {
  step(`an old install (service worker at ${scope}) is retired, leaving the new app's caches alone`);
  const op = watch(await (await browser.newContext()).newPage());
  await op.goto(BASE + '/app/');
  await op.waitForFunction(async () => (await caches.keys()).some(k => k.startsWith('lf-')));
  await op.evaluate(async s => {
    await caches.open('tables-old').then(c => c.put('/x', new Response('x')));
    await navigator.serviceWorker.register(s + 'sw.js', { scope: s });
  }, scope);
  await op.waitForFunction(async () => !(await caches.keys()).includes('tables-old'));
  await op.waitForFunction(async s => (await navigator.serviceWorker.getRegistrations()).every(r => new URL(r.scope).pathname !== s), scope);
  assert.ok(await op.evaluate(async () => (await caches.keys()).some(k => k.startsWith('lf-'))), 'new app cache kept');
  assert.ok(await op.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).some(r => new URL(r.scope).pathname === '/app/')));
}

assert.deepEqual(errors, []);
console.log('PASS');
await browser.close();
