// End-to-end test for QR login. Usage (dev server running): BASE=http://localhost:8788 node tests/qr-login.mjs
import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const BASE = process.env.BASE || 'http://localhost:8788';
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const errors = [];
const step = name => console.log('•', name);
const watch = p => { p.on('pageerror', e => errors.push(e.message)); return p; };

step('a new Forest Pass shows a QR code');
const parentCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const pp = watch(await parentCtx.newPage());
await pp.goto(BASE);
await pp.click("text=I'm a grown-up");
await pp.click('[data-mode=signup]');
await pp.fill('input[name=email]', `q${Date.now()}@example.com`);
await pp.fill('input[name=password]', 'a-long-enough-pass');
await pp.check('input[name=consent]');
await pp.click('form .cta');
await pp.fill('#nm', 'Ava');
await pp.click('form.add button');
await pp.waitForSelector('#passQr svg');
const key = await pp.evaluate(() => card.qr);
assert.match(key, /^[A-Za-z0-9_-]{40,}$/);

step('the QR code in the printable card image reads back as the login link');
await pp.waitForFunction(() => cardFile);
await pp.addScriptTag({ url: '/js/vendor/jsqr-1.4.0.min.js' });
const decoded = await pp.evaluate(async () => {
  const img = await createImageBitmap(cardFile);
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height);
  return jsQR(d.data, d.width, d.height)?.data;
});
assert.equal(decoded, `${BASE}/#qr=${key}`);
const qrPng = (await pp.locator('#passQr').screenshot()).toString('base64');
await pp.check('#wrote');
await pp.click('#cardDone');
await pp.waitForSelector('.kid');

step('opening the scanned link logs the child in, and the key leaves the address bar');
const linkCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const lp = watch(await linkCtx.newPage());
await lp.goto(`${BASE}/#qr=${key}`);
await lp.waitForSelector('text=Which times tables do you already know?');
assert.equal(new URL(lp.url()).hash, '');

step('in-app scanner logs in from the camera');
const camCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
// a pretend camera: a canvas showing the Forest Pass QR code
await camCtx.addInitScript(png => {
  navigator.mediaDevices.getUserMedia = async () => {
    const c = document.createElement('canvas'); c.width = 480; c.height = 640;
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 480, 640);
    const img = new Image(); img.src = 'data:image/png;base64,' + png;
    await img.decode();
    setInterval(() => g.drawImage(img, 90, 170, 300, 300), 100);
    return c.captureStream(10);
  };
}, qrPng);
const cp = watch(await camCtx.newPage());
await cp.goto(BASE);
await cp.click("text=I'm playing");
await cp.click('[data-act=scan]');
await cp.waitForSelector('text=Which times tables do you already know?', { timeout: 15000 });

step('a bad link explains what to do');
const badCtx = await browser.newContext();
const bp = watch(await badCtx.newPage());
await bp.goto(`${BASE}/#qr=${'B'.repeat(43)}`);
await bp.waitForSelector('.err');
assert.match(await bp.textContent('.err'), /didn't work/);

step('a new QR card keeps the password and the old code stops working');
await pp.click('[data-act=kid-qr]');
await pp.click('[data-act=kid-qr]');
await pp.waitForSelector('#passQr svg');
assert.match(await pp.textContent('#pass'), /Same as before/);
const newKey = await pp.evaluate(() => card.qr);
assert.notEqual(newKey, key);
const op = watch(await (await browser.newContext()).newPage());
await op.goto(`${BASE}/#qr=${key}`);
await op.waitForSelector('.err');
await op.goto(`${BASE}/#qr=${newKey}`);
await op.waitForSelector('text=Which times tables do you already know?');

assert.deepEqual(errors, []);
console.log('PASS');
await browser.close();
