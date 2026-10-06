// End-to-end test for classes and picture login on a shared class device.
// Usage (dev server running): BASE=http://localhost:8788 node tests/classes-e2e.mjs
import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const BASE = process.env.BASE || 'http://localhost:8788';
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const errors = [];
const step = name => console.log('•', name);
const ctx = await browser.newContext({ viewport: { width: 820, height: 1180 } });   // a class iPad
const p = await ctx.newPage();
p.on('pageerror', e => errors.push(e.message));
const email = `t${Date.now()}@school.test`;

step('teacher makes a class and adds pupils from a list');
await p.goto(BASE);
await p.click("text=I'm a grown-up");
await p.click('[data-mode=signup]');
await p.fill('input[name=email]', email);
await p.fill('input[name=password]', 'a-long-enough-pass');
await p.check('input[name=consent]');
await p.click('form .cta');
await p.fill('#cn', 'Oak class');
await p.click('form[data-form=addClass] button');
await p.waitForSelector('text=Add the class\'s first names below.');
await p.fill('textarea[name=names]', 'Ava\nBen\n\nCara');
await p.click('form[data-form=addPupils] .cta');

step('login cards: name, three pictures and a QR code each');
await p.waitForSelector('.lcard');
assert.equal((await p.$$('.lcard')).length, 3);
await p.waitForFunction(() => document.querySelectorAll('.lcard-qr svg').length === 3);
assert.equal((await p.$$('.lcard .pics-row .pic')).length, 9);
await p.click('[data-act=go][data-to=classAdmin]');
await p.waitForSelector('.kid');
const ben = await p.evaluate(() => kids.find(k => k.name === 'Ben'));
assert.equal(ben.pics.length, 3);

step('teacher sets this device up for the class: signed out, name tiles shown');
await p.click('[data-act=class-device]');
await p.click('[data-act=class-device]');
await p.waitForSelector('.name-tile');
assert.deepEqual(await p.$$eval('.name-tile', els => els.map(e => e.textContent)), ['Ava', 'Ben', 'Cara']);
assert.match(await p.textContent('.brand h1'), /Oak class/);
await p.reload();
await p.waitForSelector('.name-tile');   // still a class device after a reload

step('a pupil taps their name and pictures; wrong order says try again');
await p.click('.name-tile >> text=Ben');
await p.waitForSelector('.pic-grid');
const tap = async i => p.click(`.pic-key[data-i="${i}"]`);
for (const i of [ben.pics[1], ben.pics[0], ben.pics[2]]) await tap(i);
await p.waitForSelector('text=Not quite. Try again.');
assert.equal(await p.$$eval('.slot', els => els.filter(e => e.textContent).length), 0, 'slots cleared');
await tap(ben.pics[0]); await tap(5 === ben.pics[0] ? 6 : 5);
await p.click('[data-act=pic-undo]');
for (const i of ben.pics.slice(1)) await tap(i);
await p.waitForSelector('text=Which times tables do you already know?');

step("\"I'm done\" goes back to the name tiles");
await p.click('[data-act=assess-skip]');
await p.click('text=Go to my forest');
await p.waitForSelector('.forest');
await p.click("[data-act=logout] >> text=I'm done");
await p.waitForSelector('.name-tile');

step('a grown-up can stop using the device for the class');
await p.click('[data-act=go][data-to=grownup]');
await p.fill('input[name=email]', email);
await p.fill('input[name=password]', 'a-long-enough-pass');
await p.click('form .cta');
await p.waitForSelector('text=This device is set up for Oak class.');
await p.click('[data-act=leave-device]');
await p.waitForFunction(() => !document.body.textContent.includes('This device is set up for'));
await p.click('[data-act=logout]');
await p.waitForSelector("text=I'm playing");   // ordinary welcome screen again

assert.deepEqual(errors, []);
console.log('PASS');
await browser.close();
