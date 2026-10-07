// Admin dashboard in the browser. The dev server must have ADMIN_EMAILS=admin@example.com (npm run dev does).
// Usage (dev server running): BASE=http://localhost:8788 node tests/admin-e2e.mjs
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:8788';
const SHOTS = process.env.SHOTS;
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const errors = [];
const step = name => console.log('•', name);
// 400: the deliberately wrong confirmation email; 401/403: the logged-out and non-admin checks
const watch = p => { p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/status of 40[013]/.test(m.text())) errors.push(m.text()); }); return p; };
const stamp = Date.now();

step('logged out: told to log in; a normal grown-up: told they are not an admin');
const anon = watch(await (await browser.newContext()).newPage());
await anon.goto(BASE + '/admin/');
await anon.waitForSelector('#gate:not([hidden])');
assert.match(await anon.textContent('#gate-msg'), /Log in/);
const tctx = await browser.newContext();
const teacherEmail = `t${stamp}@school.test`;
await tctx.request.post(BASE + '/api/parent/signup', { data: { email: teacherEmail, password: 'a-long-enough-pass', consent: true } });
const k = await (await tctx.request.post(BASE + '/api/parent/classes', { data: { name: 'Oak class' } })).json();
const { cards } = await (await tctx.request.post(BASE + `/api/parent/classes/${k.id}/pupils`, { data: { names: ['Ava', 'Ben'] } })).json();
const tp = watch(await tctx.newPage());
await tp.goto(BASE + '/admin/');
await tp.waitForSelector('#gate:not([hidden])');
assert.match(await tp.textContent('#gate-msg'), /not an admin/);

step('the admin sees the overview and the log');
const actx = await browser.newContext({ viewport: { width: 1100, height: 900 }, acceptDownloads: true });
const signup = await actx.request.post(BASE + '/api/parent/signup', { data: { email: 'admin@example.com', password: 'a-long-enough-pass', consent: true } });
if (signup.status() !== 200) await actx.request.post(BASE + '/api/parent/login', { data: { email: 'admin@example.com', password: 'a-long-enough-pass' } });
const ap = watch(await actx.newPage());
await ap.goto(BASE + '/admin/');
await ap.waitForSelector('#dash:not([hidden]) .tile');
assert.ok(await ap.locator('.tile').count() >= 10);
assert.equal(await ap.locator('#weeks tbody tr').count(), 8);
assert.match(await ap.textContent('#who'), /admin@example.com/);
if (SHOTS) await ap.screenshot({ path: SHOTS + '/admin-overview.png', fullPage: true });

step('find the teacher, export their data as a file');
await ap.fill('#acc-q', teacherEmail);
await ap.click('#acc-form button');
await ap.waitForSelector('#acc-table:not([hidden]) tbody tr');
const [download] = await Promise.all([ap.waitForEvent('download'), ap.click('#acc-table tbody tr button:text("Export data")')]);
const exported = JSON.parse(readFileSync(await download.path(), 'utf8'));
assert.equal(exported.account.email, teacherEmail);
assert.deepEqual(exported.pupils.map(p => p.name).sort(), ['Ava', 'Ben']);
assert.match(download.suggestedFilename(), /^learning-forest-account-\d+-\d{4}-\d\d-\d\d\.json$/);

step('find a pupil by Forest Pass username and delete them (two taps)');
await ap.fill('#pupil-u', cards[0].username.toLowerCase());
await ap.click('#pupil-form button');
await ap.waitForSelector('.pupil-card');
assert.match(await ap.textContent('.pupil-card'), /Ava/);
await ap.click('.pupil-card button.danger');
await ap.click('.pupil-card button.danger');
await ap.waitForSelector('#pupil-out .ok');

step('copy every grown-up email');
await actx.grantPermissions(['clipboard-read', 'clipboard-write']);
await ap.click('#emails');
await ap.waitForFunction(() => /addresses/.test(document.getElementById('emails-msg').textContent));
assert.ok((await ap.inputValue('#emails-out')).includes(teacherEmail));

step('delete the teacher account: the email has to be typed back');
await ap.click('#acc-table tbody tr button.danger');
await ap.fill('.confirm input', 'wrong@school.test');
await ap.click('.confirm button.danger');
await ap.waitForFunction(() => /email/.test(document.querySelector('#acc-table .err')?.textContent || ''));
await ap.fill('.confirm input', teacherEmail);
await ap.click('.confirm button.danger');
await ap.waitForSelector('#acc-table td.ok');
assert.equal((await tctx.request.get(BASE + '/api/parent/children')).status(), 401, 'teacher logged out');

step('the log lists what was done');
await ap.waitForFunction(() => document.querySelectorAll('#log tbody tr').length >= 4);
const actions = await ap.$$eval('#log tbody tr td:nth-child(3)', tds => tds.map(t => t.textContent));
for (const a of ['delete account', 'copy all emails', 'delete pupil', 'export account']) assert.ok(actions.includes(a), a);
if (SHOTS) await ap.screenshot({ path: SHOTS + '/admin-after.png', fullPage: true });

assert.deepEqual(errors, []);
console.log('PASS');
await browser.close();
