import { migrate } from './schema.js';
import { configure, hashSecret, verifySecret, needsRehash, newToken, sha256 } from './auth.js';
import { newUsername, newPassword, newRecoveryCode, normUsername, normPassword, normRecovery } from './words.js';

const DAY = 864e5;
const PARENT_TTL = 30 * DAY, CHILD_TTL = 180 * DAY, CLASS_CHILD_TTL = 8 * 3600e3, DEVICE_TTL = 365 * DAY;
const DEVICE_COOKIE = 'tf_class';
const PIC_COUNT = 12, PIC_FAIL_LIMIT = 5, MAX_CLASSES = 10, MAX_PUPILS = 40;
const FAIL_WINDOW = 15 * 60e3, FAIL_LIMIT = 10, IP_FAIL_LIMIT = 50;
const MAX_CHILDREN = 10;
const COOKIE = 'tf_session';
const ORDER = [10, 2, 5, 11, 3, 4, 9, 6, 8, 12, 7];
const KINDS = new Set(['assess', 'new', 'reask', 'review', 'retry', 'practice', 'mock']);
const SHAPES = new Set(['mul', 'missing', 'div']);
const THEMES = ['auto', 'spring', 'summer', 'autumn', 'winter'];

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers },
});

export async function handle(request, env) {
  try {
    // DATA is the database. DB is the old binding: while both are bound, DB's data is copied into DATA once.
    const db = env.DATA;
    if (!db) throw new HttpError(500, 'The database is not connected.');
    configure(env);
    await migrate(db, env.DB);
    const url = new URL(request.url);
    if (request.method !== 'GET') {
      // Cross-site requests can't send JSON without a preflight; together with
      // SameSite cookies and the Origin check this blocks CSRF.
      const origin = request.headers.get('origin');
      if (origin && origin !== url.origin) throw new HttpError(403, 'Bad origin');
      if (!(request.headers.get('content-type') || '').startsWith('application/json')) throw new HttpError(415, 'Send JSON');
    }
    const path = url.pathname.replace(/^\/api/, '').replace(/\/$/, '');
    const ctx = { request, env, db, ip: request.headers.get('cf-connecting-ip') || 'local' };
    for (const [method, re, fn] of ROUTES) {
      if (method !== request.method) continue;
      const m = path.match(re);
      if (m) return await fn(ctx, ...m.slice(1));
    }
    throw new HttpError(404, 'Not found');
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: 'Something went wrong. Try again.' }, 500);
  }
}

/* helpers */

async function body(ctx) {
  try { return (await ctx.request.json()) || {}; } catch { throw new HttpError(400, 'Bad request'); }
}

function cookie(request, name) {
  const m = (request.headers.get('cookie') || '').match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? m[1] : null;
}

async function currentSession(ctx) {
  const tok = cookie(ctx.request, COOKIE);
  if (!tok) return null;
  const row = await ctx.db.prepare('SELECT role, user_id FROM sessions WHERE token_hash = ? AND expires_at > ?')
    .bind(await sha256(tok), Date.now()).first();
  return row || null;
}

async function need(ctx, role) {
  const s = await currentSession(ctx);
  if (!s || s.role !== role) throw new HttpError(401, 'Please log in.');
  return s.user_id;
}

async function startSession(ctx, role, id, ttl = role === 'parent' ? PARENT_TTL : CHILD_TTL) {
  const tok = newToken(), now = Date.now();
  await ctx.db.batch([
    ctx.db.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(now),
    ctx.db.prepare('INSERT INTO sessions(token_hash, role, user_id, expires_at) VALUES (?, ?, ?, ?)')
      .bind(await sha256(tok), role, id, now + ttl),
  ]);
  return { 'set-cookie': `${COOKIE}=${tok}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${ttl / 1000}` };
}

// A device a teacher has signed in to a class (long-lived cookie). Looked up once per request.
async function classDevice(ctx) {
  if (ctx.device !== undefined) return ctx.device;
  const tok = cookie(ctx.request, DEVICE_COOKIE);
  ctx.device = tok ? await ctx.db.prepare(`SELECT d.token_hash, c.id, c.name, c.owner_id FROM class_devices d JOIN classes c ON c.id = d.class_id
    WHERE d.token_hash = ? AND d.created_at > ?`).bind(await sha256(tok), Date.now() - DEVICE_TTL).first() : null;
  return ctx.device;
}

// Blocks guessing: 10 failures per account, or 50 per IP address, in 15 minutes.
// Class devices are trusted, so their failures don't count towards the shared school address.
async function guard(ctx, k, limit = FAIL_LIMIT) {
  const since = Date.now() - FAIL_WINDOW, trusted = !!(await classDevice(ctx));
  const q = 'SELECT COUNT(*) AS n FROM login_failures WHERE k = ? AND at > ?';
  const [a, b] = await ctx.db.batch([
    ctx.db.prepare(q).bind(k, since),
    ctx.db.prepare(q).bind('ip:' + ctx.ip, since),
  ]);
  if (a.results[0].n >= limit || (!trusted && b.results[0].n >= IP_FAIL_LIMIT))
    throw new HttpError(429, 'Too many tries. Wait 15 minutes, then try again.');
}

async function fail(ctx, k, message) {
  const now = Date.now(), ins = 'INSERT INTO login_failures(k, at) VALUES (?, ?)';
  await ctx.db.batch([
    ctx.db.prepare(ins).bind(k, now),
    ...((await classDevice(ctx)) ? [] : [ctx.db.prepare(ins).bind('ip:' + ctx.ip, now)]),
    ctx.db.prepare('DELETE FROM login_failures WHERE at < ?').bind(now - DAY),
  ]);
  throw new HttpError(401, message);
}

async function ownedChild(ctx, parentId, id) {
  const row = await ctx.db.prepare('SELECT id, name, display_username FROM children WHERE id = ? AND parent_id = ?')
    .bind(Number(id), parentId).first();
  if (!row) throw new HttpError(404, 'Child not found.');
  return row;
}

async function newCredentials() {
  const password = newPassword(), recovery = newRecoveryCode();
  return { password, recovery, pw_hash: await hashSecret(password), recovery_hash: await hashSecret(normRecovery(recovery)), ...(await newQr()) };
}

// QR login key: 32 random bytes, so a plain SHA-256 is enough to store it (no slow hash needed).
async function newQr() {
  const qr = newToken();
  return { qr, qr_hash: await sha256(qr) };
}

const card = (name, username, c) => ({ name, username, password: c.password, recovery: c.recovery, qr: c.qr });

const isFact = k => {
  const m = /^(\d{1,2})x(\d{1,2})$/.exec(k);
  return !!m && +m[1] >= 2 && +m[2] <= 12 && +m[1] <= +m[2];
};
const isInt = (n, lo, hi) => Number.isInteger(n) && n >= lo && n <= hi;
const tableList = x => Array.isArray(x) && x.length <= 11 && x.every(t => ORDER.includes(t)) && new Set(x).size === x.length;

// Only known keys are kept, each checked; anything else is dropped.
function cleanExtra(x) {
  if (!x || typeof x !== 'object' || Array.isArray(x)) throw new HttpError(400, 'Bad progress.');
  const out = {};
  for (const k of ['friends', 'intros']) if (k in x) { if (!tableList(x[k])) throw new HttpError(400, 'Bad progress.'); out[k] = x[k]; }
  if ('restDay' in x) { if (x.restDay !== null && !Number.isFinite(x.restDay)) throw new HttpError(400, 'Bad progress.'); out.restDay = x.restDay; }
  if ('mocks' in x) {
    if (!Array.isArray(x.mocks) || x.mocks.length > 10 || !x.mocks.every(m => m && Number.isFinite(m.at) && isInt(m.score, 0, 25)))
      throw new HttpError(400, 'Bad progress.');
    out.mocks = x.mocks.map(m => ({ at: m.at, score: m.score }));
  }
  return out;
}
const parseExtra = s => { try { return JSON.parse(s) || {}; } catch { return {}; } };
const DAY_MS = 864e5;

/* routes */

async function parentSignup(ctx) {
  const b = await body(ctx);
  const email = String(b.email || '').trim().toLowerCase(), password = String(b.password || '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new HttpError(400, 'Enter a valid email address.');
  if (password.length < 10 || password.length > 200) throw new HttpError(400, 'Use a password of at least 10 characters.');
  if (b.consent !== true) throw new HttpError(400, 'Please confirm you are the parent or carer.');
  if (await ctx.db.prepare('SELECT 1 FROM parents WHERE email = ?').bind(email).first())
    throw new HttpError(409, 'There is already an account for that email. Log in instead.');
  const row = await ctx.db.prepare('INSERT INTO parents(email, pw_hash, created_at) VALUES (?, ?, ?) RETURNING id')
    .bind(email, await hashSecret(password), Date.now()).first();
  return json({ role: 'parent' }, 200, await startSession(ctx, 'parent', row.id));
}

async function parentLogin(ctx) {
  const b = await body(ctx);
  const email = String(b.email || '').trim().toLowerCase();
  await guard(ctx, 'p:' + email);
  const row = await ctx.db.prepare('SELECT id, pw_hash FROM parents WHERE email = ?').bind(email).first();
  if (!(await verifySecret(String(b.password || ''), row?.pw_hash))) await fail(ctx, 'p:' + email, 'Email or password not right.');
  if (needsRehash(row.pw_hash))
    await ctx.db.prepare('UPDATE parents SET pw_hash = ? WHERE id = ?').bind(await hashSecret(String(b.password)), row.id).run();
  return json({ role: 'parent' }, 200, await startSession(ctx, 'parent', row.id));
}

async function logout(ctx) {
  const tok = cookie(ctx.request, COOKIE);
  if (tok) await ctx.db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(tok)).run();
  return json({ ok: true }, 200, { 'set-cookie': `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0` });
}

async function me(ctx) {
  const s = await currentSession(ctx);
  if (!s) { const dev = await classDevice(ctx); return json({ role: null, device: dev ? { classId: dev.id, className: dev.name } : null }); }
  const dev = await classDevice(ctx), device = dev ? { classId: dev.id, className: dev.name } : null;
  if (s.role === 'parent') {
    const p = await ctx.db.prepare('SELECT email FROM parents WHERE id = ?').bind(s.user_id).first();
    return p ? json({ role: 'parent', email: p.email, device }) : json({ role: null, device });
  }
  const c = await ctx.db.prepare('SELECT name FROM children WHERE id = ?').bind(s.user_id).first();
  return c ? json({ role: 'child', name: c.name, device }) : json({ role: null, device });
}

async function listChildren(ctx) {
  const pid = await need(ctx, 'parent');
  const { results } = await ctx.db.prepare(`
    SELECT c.id, c.name, c.display_username AS username, c.last_played AS lastPlayed, c.assessed_at AS assessedAt,
      (SELECT COUNT(*) FROM facts f WHERE f.child_id = c.id AND f.box > 0) AS planted, c.class_id AS classId, c.pics
    FROM children c WHERE c.parent_id = ? ORDER BY c.name COLLATE NOCASE`).bind(pid).all();
  const classes = (await ctx.db.prepare(`SELECT k.id, k.name, (SELECT COUNT(*) FROM class_devices d WHERE d.class_id = k.id) AS devices
    FROM classes k WHERE k.owner_id = ? ORDER BY k.created_at`).bind(pid).all()).results;
  return json({ children: results.map(c => ({ ...c, pics: c.pics ? c.pics.split(',').map(Number) : null })), classes });
}

async function addChild(ctx) {
  const pid = await need(ctx, 'parent');
  const name = String((await body(ctx)).name || '').trim().replace(/\s+/g, ' ');
  if (!name || name.length > 20) throw new HttpError(400, 'Enter a first name or nickname (up to 20 letters).');
  const { n } = await ctx.db.prepare('SELECT COUNT(*) AS n FROM children WHERE parent_id = ? AND class_id IS NULL').bind(pid).first();
  if (n >= MAX_CHILDREN) throw new HttpError(400, `You can add up to ${MAX_CHILDREN} children.`);
  let username;
  for (let i = 0; i < 20 && !username; i++) {
    const u = newUsername();
    if (!(await ctx.db.prepare('SELECT 1 FROM children WHERE username = ?').bind(normUsername(u)).first())) username = u;
  }
  if (!username) throw new HttpError(500, 'Could not make a username. Try again.');
  const c = await newCredentials();
  const row = await ctx.db.prepare(`INSERT INTO children(parent_id, name, username, display_username, pw_hash, recovery_hash, qr_hash, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`)
    .bind(pid, name, normUsername(username), username, c.pw_hash, c.recovery_hash, c.qr_hash, Date.now()).first();
  return json({ id: row.id, card: card(name, username, c) });
}

async function resetChild(ctx, id) {
  const pid = await need(ctx, 'parent');
  const child = await ownedChild(ctx, pid, id);
  const c = await newCredentials();
  await ctx.db.batch([
    ctx.db.prepare('UPDATE children SET pw_hash = ?, recovery_hash = ?, qr_hash = ? WHERE id = ?').bind(c.pw_hash, c.recovery_hash, c.qr_hash, child.id),
    ctx.db.prepare("DELETE FROM sessions WHERE role = 'child' AND user_id = ?").bind(child.id),
  ]);
  return json({ card: card(child.name, child.display_username, c) });
}

// A new QR login code only: the password stays the same, the old QR code stops working.
async function newChildQr(ctx, id) {
  const pid = await need(ctx, 'parent');
  const child = await ownedChild(ctx, pid, id);
  const q = await newQr();
  await ctx.db.prepare('UPDATE children SET qr_hash = ? WHERE id = ?').bind(q.qr_hash, child.id).run();
  return json({ card: { name: child.name, username: child.display_username, qr: q.qr } });
}

async function reassessChild(ctx, id) {
  const pid = await need(ctx, 'parent');
  const child = await ownedChild(ctx, pid, id);
  await ctx.db.batch([
    ctx.db.prepare('DELETE FROM facts WHERE child_id = ?').bind(child.id),
    ctx.db.prepare("UPDATE children SET tables = '[]', assessed_at = NULL, streak = 0, last_day = 0, extra = json_remove(extra, '$.friends', '$.intros', '$.restDay') WHERE id = ?").bind(child.id),
  ]);
  return json({ ok: true });
}

async function removeChild(ctx, id) {
  const pid = await need(ctx, 'parent');
  const child = await ownedChild(ctx, pid, id);
  await ctx.db.batch([
    ctx.db.prepare("DELETE FROM sessions WHERE role = 'child' AND user_id = ?").bind(child.id),
    ctx.db.prepare('DELETE FROM children WHERE id = ?').bind(child.id),
  ]);
  return json({ ok: true });
}

async function childLogin(ctx) {
  const b = await body(ctx);
  const u = normUsername(b.username);
  await guard(ctx, 'c:' + u);
  const row = await ctx.db.prepare('SELECT id, pw_hash FROM children WHERE username = ?').bind(u).first();
  if (!(await verifySecret(normPassword(b.password), row?.pw_hash))) await fail(ctx, 'c:' + u, 'Username or password not right. Check your Forest Pass.');
  if (needsRehash(row.pw_hash))
    await ctx.db.prepare('UPDATE children SET pw_hash = ? WHERE id = ?').bind(await hashSecret(normPassword(b.password)), row.id).run();
  return json({ role: 'child' }, 200, await startSession(ctx, 'child', row.id));
}

async function childRecover(ctx) {
  const b = await body(ctx);
  const u = normUsername(b.username);
  await guard(ctx, 'r:' + u);
  const row = await ctx.db.prepare('SELECT id, name, display_username, recovery_hash FROM children WHERE username = ?').bind(u).first();
  if (!(await verifySecret(normRecovery(b.code), row?.recovery_hash))) await fail(ctx, 'r:' + u, 'Username or recovery code not right.');
  const c = await newCredentials();
  await ctx.db.batch([
    ctx.db.prepare('UPDATE children SET pw_hash = ?, recovery_hash = ?, qr_hash = ? WHERE id = ?').bind(c.pw_hash, c.recovery_hash, c.qr_hash, row.id),
    ctx.db.prepare("DELETE FROM sessions WHERE role = 'child' AND user_id = ?").bind(row.id),
  ]);
  return json({ card: card(row.name, row.display_username, c) }, 200, await startSession(ctx, 'child', row.id));
}

async function childQrLogin(ctx) {
  const key = String((await body(ctx)).key || '');
  // keys are 256-bit, so this only stops hammering; it's higher than password limits because
  // a whole school shares one internet address and old cards will get scanned by mistake
  await guard(ctx, 'q:' + ctx.ip, 30);
  const row = /^[A-Za-z0-9_-]{30,60}$/.test(key)
    ? await ctx.db.prepare('SELECT id FROM children WHERE qr_hash = ?').bind(await sha256(key)).first() : null;
  if (!row) await fail(ctx, 'q:' + ctx.ip, "That QR code didn't work. Ask a grown-up for a new Forest Pass.");
  return json({ role: 'child' }, 200, await startSession(ctx, 'child', row.id));
}

async function childState(ctx) {
  const cid = await need(ctx, 'child');
  const [c, f] = await ctx.db.batch([
    ctx.db.prepare('SELECT id, name, display_username, tables, assessed_at, streak, last_day, theme, extra FROM children WHERE id = ?').bind(cid),
    ctx.db.prepare('SELECT fact, box, due FROM facts WHERE child_id = ?').bind(cid),
  ]);
  const row = c.results[0];
  if (!row) throw new HttpError(401, 'Please log in.');
  const facts = {};
  for (const r of f.results) facts[r.fact] = { box: r.box, due: r.due };
  return json({
    id: row.id, name: row.name, username: row.display_username, tables: JSON.parse(row.tables),
    assessedAt: row.assessed_at, streak: row.streak, lastDay: row.last_day, theme: row.theme, extra: parseExtra(row.extra), facts,
  });
}

async function childSync(ctx) {
  const cid = await need(ctx, 'child');
  const b = await body(ctx);
  const db = ctx.db, stmts = [];
  const facts = Object.entries(b.facts || {});
  const answers = Array.isArray(b.answers) ? b.answers : [];
  if (facts.length > 66 || answers.length > 200) throw new HttpError(400, 'Too much at once.');
  for (const [k, f] of facts) {
    if (!isFact(k) || !f || !isInt(f.box, 0, 5) || !Number.isFinite(f.due)) throw new HttpError(400, 'Bad fact.');
    stmts.push(db.prepare(`INSERT INTO facts(child_id, fact, box, due) VALUES (?, ?, ?, ?)
      ON CONFLICT(child_id, fact) DO UPDATE SET box = excluded.box, due = excluded.due`).bind(cid, k, f.box, f.due));
  }
  for (const a of answers) {
    const ok = a && isFact(a.fact) && isInt(a.a, 2, 12) && isInt(a.b, 2, 12)
      && `${Math.min(a.a, a.b)}x${Math.max(a.a, a.b)}` === a.fact
      && (a.given === null || isInt(a.given, 0, 999)) && typeof a.correct === 'boolean'
      && isInt(a.ms, 0, 36e5) && KINDS.has(a.kind) && Number.isFinite(a.at) && (a.shape === undefined || SHAPES.has(a.shape));
    if (!ok) throw new HttpError(400, 'Bad answer.');
    stmts.push(db.prepare('INSERT INTO answers(child_id, fact, a, b, given, correct, ms, kind, at, shape) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(cid, a.fact, a.a, a.b, a.given, a.correct ? 1 : 0, a.ms, a.kind, a.at, a.shape || 'mul'));
  }
  if (b.meta) {
    const m = b.meta;
    const ok = Array.isArray(m.tables) && m.tables.every(t => ORDER.includes(t)) && new Set(m.tables).size === m.tables.length
      && isInt(m.streak, 0, 100000) && Number.isFinite(m.lastDay) && (m.assessedAt === null || Number.isFinite(m.assessedAt))
      && THEMES.includes(m.theme);
    if (!ok) throw new HttpError(400, 'Bad progress.');
    stmts.push(db.prepare('UPDATE children SET tables = ?, streak = ?, last_day = ?, assessed_at = ?, theme = ? WHERE id = ?')
      .bind(JSON.stringify(m.tables), m.streak, m.lastDay, m.assessedAt, m.theme, cid));
    if (m.extra !== undefined)
      stmts.push(db.prepare('UPDATE children SET extra = ? WHERE id = ?').bind(JSON.stringify(cleanExtra(m.extra)), cid));
  }
  if (answers.length) stmts.push(db.prepare('UPDATE children SET last_played = ? WHERE id = ?').bind(Date.now(), cid));
  if (stmts.length) await db.batch(stmts);
  return json({ ok: true });
}

// Personal bests: quickest facts in the last 7 days, and facts whose best time beat the week before.
async function childStats(ctx) {
  const cid = await need(ctx, 'child');
  const now = Date.now();
  const { results } = await ctx.db.prepare(`SELECT fact, ms, at FROM answers
    WHERE child_id = ? AND correct = 1 AND kind != 'assess' AND at > ?`).bind(cid, now - 14 * DAY_MS).all();
  const thisWeek = {}, lastWeek = {};
  let rightThisWeek = 0;
  for (const r of results) {
    const into = r.at > now - 7 * DAY_MS ? thisWeek : lastWeek;
    if (into === thisWeek) rightThisWeek++;
    into[r.fact] = Math.min(into[r.fact] ?? Infinity, r.ms);
  }
  const quickest = Object.entries(thisWeek).sort((a, b) => a[1] - b[1]).slice(0, 5).map(([fact, ms]) => ({ fact, ms }));
  const faster = Object.entries(thisWeek).filter(([f, ms]) => lastWeek[f] && lastWeek[f] - ms >= 300)
    .map(([fact, ms]) => ({ fact, before: lastWeek[fact], after: ms }))
    .sort((a, b) => (b.before - b.after) - (a.before - a.after)).slice(0, 5);
  return json({ quickest, faster, rightThisWeek });
}

// Tricky facts for a grown-up: most often wrong, then slowest, over the last 30 days.
async function childTricky(ctx, id) {
  const pid = await need(ctx, 'parent');
  const child = await ownedChild(ctx, pid, id);
  const now = Date.now();
  const [a, f, c] = await ctx.db.batch([
    ctx.db.prepare(`SELECT fact, correct, ms, at FROM answers WHERE child_id = ? AND kind != 'assess' AND at > ?`).bind(child.id, now - 30 * DAY_MS),
    ctx.db.prepare('SELECT fact, box FROM facts WHERE child_id = ?').bind(child.id),
    ctx.db.prepare('SELECT extra FROM children WHERE id = ?').bind(child.id),
  ]);
  const per = {}, week = { asked: 0, right: 0 };
  for (const r of a.results) {
    const p = (per[r.fact] ??= { fact: r.fact, asked: 0, wrong: 0, msTotal: 0, right: 0 });
    p.asked++;
    if (r.correct) { p.right++; p.msTotal += r.ms; } else p.wrong++;
    if (r.at > now - 7 * DAY_MS) { week.asked++; if (r.correct) week.right++; }
  }
  const box = Object.fromEntries(f.results.map(r => [r.fact, r.box]));
  const facts = Object.values(per)
    .map(p => ({ fact: p.fact, asked: p.asked, wrong: p.wrong, avgMs: p.right ? Math.round(p.msTotal / p.right) : null, box: box[p.fact] ?? 0 }))
    .filter(p => p.wrong > 0 || (p.avgMs ?? 0) > 4000)
    .sort((x, y) => y.wrong / y.asked - x.wrong / x.asked || y.wrong - x.wrong || (y.avgMs ?? 0) - (x.avgMs ?? 0))
    .slice(0, 8);
  return json({ facts, week, mocks: parseExtra(c.results[0]?.extra).mocks || [] });
}

// Daily reminders: this device's push subscription, the time and its time zone.
// A scheduled Worker (workers/reminders) sends them.
async function reminderOn(ctx) {
  const cid = await need(ctx, 'child');
  const b = await body(ctx);
  const ok = typeof b.endpoint === 'string' && /^https:\/\//.test(b.endpoint) && b.endpoint.length <= 600
    && typeof b.p256dh === 'string' && b.p256dh.length <= 200 && typeof b.auth === 'string' && b.auth.length <= 100
    && /^([01]\d|2[0-3]):[0-5]\d$/.test(b.time || '') && typeof b.tz === 'string' && b.tz.length <= 64;
  if (!ok) throw new HttpError(400, 'Bad reminder.');
  try { new Intl.DateTimeFormat('en-GB', { timeZone: b.tz }); } catch { throw new HttpError(400, 'Bad time zone.'); }
  await ctx.db.prepare(`INSERT INTO push_subs(endpoint, child_id, p256dh, auth, time, tz, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(endpoint) DO UPDATE SET child_id = excluded.child_id, p256dh = excluded.p256dh, auth = excluded.auth,
      time = excluded.time, tz = excluded.tz`).bind(b.endpoint, cid, b.p256dh, b.auth, b.time, b.tz, Date.now()).run();
  return json({ ok: true });
}

async function reminderOff(ctx) {
  const cid = await need(ctx, 'child');
  const b = await body(ctx);
  await ctx.db.prepare('DELETE FROM push_subs WHERE endpoint = ? AND child_id = ?').bind(String(b.endpoint || ''), cid).run();
  return json({ ok: true });
}

/* classes */

const newPics = () => {
  const out = [];
  while (out.length < 3) { const n = crypto.getRandomValues(new Uint32Array(1))[0] % PIC_COUNT; if (!out.includes(n)) out.push(n); }
  return out;
};
const cleanName = x => String(x || '').trim().replace(/\s+/g, ' ');

async function ownedClass(ctx, pid, id) {
  const row = await ctx.db.prepare('SELECT id, name FROM classes WHERE id = ? AND owner_id = ?').bind(Number(id), pid).first();
  if (!row) throw new HttpError(404, 'Class not found.');
  return row;
}

async function addClass(ctx) {
  const pid = await need(ctx, 'parent');
  const name = cleanName((await body(ctx)).name);
  if (!name || name.length > 30) throw new HttpError(400, 'Enter a class name (up to 30 letters).');
  const { n } = await ctx.db.prepare('SELECT COUNT(*) AS n FROM classes WHERE owner_id = ?').bind(pid).first();
  if (n >= MAX_CLASSES) throw new HttpError(400, `You can have up to ${MAX_CLASSES} classes.`);
  const row = await ctx.db.prepare('INSERT INTO classes(owner_id, name, created_at) VALUES (?, ?, ?) RETURNING id').bind(pid, name, Date.now()).first();
  return json({ id: row.id, name });
}

// Adds pupils from a list of first names (or initials). Each gets a username, password and
// recovery code (for home), a QR code, and three pictures for class devices.
async function addPupils(ctx, id) {
  const pid = await need(ctx, 'parent');
  const k = await ownedClass(ctx, pid, id);
  const b = await body(ctx);
  const names = (Array.isArray(b.names) ? b.names : []).map(cleanName).filter(Boolean);
  if (!names.length || names.some(x => x.length > 20)) throw new HttpError(400, 'Enter one first name or nickname per line (up to 20 letters each).');
  const existing = (await ctx.db.prepare('SELECT name FROM children WHERE class_id = ?').bind(k.id).all()).results.map(x => x.name);
  if (existing.length + names.length > MAX_PUPILS) throw new HttpError(400, `A class can have up to ${MAX_PUPILS} pupils.`);
  const seen = new Set(existing.map(x => x.toLowerCase())), clash = [];
  for (const x of names) { if (seen.has(x.toLowerCase())) clash.push(x); seen.add(x.toLowerCase()); }
  if (clash.length) throw new HttpError(400, sameName(clash[0]));
  const cards = [];
  for (const name of names) {
    let username;
    for (let i = 0; i < 20 && !username; i++) {
      const u = newUsername();
      if (!(await ctx.db.prepare('SELECT 1 FROM children WHERE username = ?').bind(normUsername(u)).first())) username = u;
    }
    if (!username) throw new HttpError(500, 'Could not make a username. Try again.');
    const c = await newCredentials(), pics = newPics();
    const row = await ctx.db.prepare(`INSERT INTO children(parent_id, class_id, name, username, display_username, pw_hash, recovery_hash, qr_hash, pics, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`)
      .bind(pid, k.id, name, normUsername(username), username, c.pw_hash, c.recovery_hash, c.qr_hash, pics.join(','), Date.now()).first();
    cards.push({ id: row.id, ...card(name, username, c), pics });
  }
  return json({ cards });
}

// Two pupils with the same name would get identical name tiles on class devices.
const sameName = n => `There's already a "${n}" in this class. Add the first letter of a surname, like "${n} A" and "${n} B". You can rename the pupil who's already there.`;

// Rename a child (any of the grown-up's children). In a class, names must stay different.
async function renameChild(ctx, id) {
  const pid = await need(ctx, 'parent');
  const child = await ownedChild(ctx, pid, id);
  const name = cleanName((await body(ctx)).name);
  if (!name || name.length > 20) throw new HttpError(400, 'Enter a first name or nickname (up to 20 letters).');
  const row = await ctx.db.prepare('SELECT class_id FROM children WHERE id = ?').bind(child.id).first();
  if (row.class_id && await ctx.db.prepare('SELECT 1 FROM children WHERE class_id = ? AND id != ? AND lower(name) = lower(?)').bind(row.class_id, child.id, name).first())
    throw new HttpError(400, sameName(name));
  await ctx.db.prepare('UPDATE children SET name = ? WHERE id = ?').bind(name, child.id).run();
  return json({ name });
}

async function newPupilPics(ctx, id) {
  const pid = await need(ctx, 'parent');
  const child = await ownedChild(ctx, pid, id);
  const pics = newPics();
  await ctx.db.prepare('UPDATE children SET pics = ? WHERE id = ?').bind(pics.join(','), child.id).run();
  return json({ pics });
}

async function removeClass(ctx, id) {
  const pid = await need(ctx, 'parent');
  const k = await ownedClass(ctx, pid, id);
  const b = await body(ctx);
  if (b.deletePupils === true) {   // end of year: the class and every pupil's data go
    await ctx.db.batch([
      ctx.db.prepare("DELETE FROM sessions WHERE role = 'child' AND user_id IN (SELECT id FROM children WHERE class_id = ?)").bind(k.id),
      ctx.db.prepare('DELETE FROM children WHERE class_id = ?').bind(k.id),   // facts, answers, reminders follow (ON DELETE CASCADE)
      ctx.db.prepare('DELETE FROM classes WHERE id = ?').bind(k.id),
    ]);
    return json({ ok: true });
  }
  await ctx.db.batch([   // pupils stay on the account, without a class or pictures
    ctx.db.prepare('UPDATE children SET class_id = NULL, pics = NULL WHERE class_id = ?').bind(k.id),
    ctx.db.prepare('DELETE FROM classes WHERE id = ?').bind(k.id),
  ]);
  return json({ ok: true });
}

// Sets this device up for the class and signs the grown-up out of it, so pupils can't reach
// the grown-up screens.
async function useDeviceForClass(ctx, id) {
  const pid = await need(ctx, 'parent');
  const k = await ownedClass(ctx, pid, id);
  const tok = newToken(), sess = cookie(ctx.request, COOKIE);
  await ctx.db.batch([
    ctx.db.prepare('INSERT INTO class_devices(token_hash, class_id, created_at) VALUES (?, ?, ?)').bind(await sha256(tok), k.id, Date.now()),
    ctx.db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(sess)),
  ]);
  const res = json({ device: { classId: k.id, className: k.name } });
  res.headers.append('set-cookie', `${DEVICE_COOKIE}=${tok}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${DEVICE_TTL / 1000}`);
  res.headers.append('set-cookie', `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
  return res;
}

async function signOutClassDevices(ctx, id) {
  const pid = await need(ctx, 'parent');
  const k = await ownedClass(ctx, pid, id);
  await ctx.db.prepare('DELETE FROM class_devices WHERE class_id = ?').bind(k.id).run();
  return json({ ok: true });
}

// A grown-up stops using this device for its class (they must own the class).
async function leaveDevice(ctx) {
  const pid = await need(ctx, 'parent');
  const dev = await classDevice(ctx);
  if (dev && dev.owner_id === pid) await ctx.db.prepare('DELETE FROM class_devices WHERE token_hash = ?').bind(dev.token_hash).run();
  if (dev && dev.owner_id !== pid) throw new HttpError(403, 'Only the class\'s grown-up can do that.');
  return json({ ok: true }, 200, { 'set-cookie': `${DEVICE_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0` });
}

async function deviceClass(ctx) {
  const dev = await classDevice(ctx);
  if (!dev) return json({ device: null });
  await ctx.db.prepare('UPDATE class_devices SET last_used = ? WHERE token_hash = ?').bind(Date.now(), dev.token_hash).run();
  const { results } = await ctx.db.prepare('SELECT id, name FROM children WHERE class_id = ? AND pics IS NOT NULL ORDER BY name COLLATE NOCASE').bind(dev.id).all();
  return json({ device: { classId: dev.id, className: dev.name }, pupils: results });
}

async function pictureLogin(ctx) {
  const dev = await classDevice(ctx);
  if (!dev) throw new HttpError(403, 'This device isn\'t set up for a class.');
  const b = await body(ctx);
  const id = Number(b.child), pics = Array.isArray(b.pics) ? b.pics : [];
  if (pics.length !== 3 || !pics.every(p => isInt(p, 0, PIC_COUNT - 1))) throw new HttpError(400, 'Pick three pictures.');
  await guard(ctx, 'pic:' + id, PIC_FAIL_LIMIT);
  const row = await ctx.db.prepare('SELECT id, pics FROM children WHERE id = ? AND class_id = ?').bind(id, dev.id).first();
  if (!row || row.pics !== pics.join(',')) await fail(ctx, 'pic:' + id, 'Not quite. Try your pictures again.');
  return json({ role: 'child' }, 200, await startSession(ctx, 'child', row.id, CLASS_CHILD_TTL));
}

const ROUTES = [
  ['GET', /^\/me$/, me],
  ['POST', /^\/logout$/, logout],
  ['POST', /^\/parent\/signup$/, parentSignup],
  ['POST', /^\/parent\/login$/, parentLogin],
  ['GET', /^\/parent\/children$/, listChildren],
  ['POST', /^\/parent\/children$/, addChild],
  ['POST', /^\/parent\/children\/(\d+)\/reset$/, resetChild],
  ['POST', /^\/parent\/children\/(\d+)\/reassess$/, reassessChild],
  ['DELETE', /^\/parent\/children\/(\d+)$/, removeChild],
  ['POST', /^\/child\/login$/, childLogin],
  ['POST', /^\/child\/recover$/, childRecover],
  ['POST', /^\/child\/qr$/, childQrLogin],
  ['POST', /^\/parent\/children\/(\d+)\/qr$/, newChildQr],
  ['GET', /^\/child\/state$/, childState],
  ['POST', /^\/child\/sync$/, childSync],
  ['GET', /^\/child\/stats$/, childStats],
  ['GET', /^\/parent\/children\/(\d+)\/tricky$/, childTricky],
  ['POST', /^\/child\/reminder$/, reminderOn],
  ['POST', /^\/child\/reminder\/off$/, reminderOff],
  ['POST', /^\/parent\/classes$/, addClass],
  ['POST', /^\/parent\/classes\/(\d+)\/pupils$/, addPupils],
  ['POST', /^\/parent\/classes\/(\d+)\/device$/, useDeviceForClass],
  ['POST', /^\/parent\/classes\/(\d+)\/devices\/signout$/, signOutClassDevices],
  ['DELETE', /^\/parent\/classes\/(\d+)$/, removeClass],
  ['POST', /^\/parent\/children\/(\d+)\/pics$/, newPupilPics],
  ['POST', /^\/parent\/children\/(\d+)\/name$/, renameChild],
  ['POST', /^\/parent\/device\/leave$/, leaveDevice],
  ['GET', /^\/class$/, deviceClass],
  ['POST', /^\/class\/login$/, pictureLogin],
];
