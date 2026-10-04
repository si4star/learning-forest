import { migrate } from './schema.js';
import { configure, hashSecret, verifySecret, needsRehash, newToken, sha256 } from './auth.js';
import { newUsername, newPassword, newRecoveryCode, normUsername, normPassword, normRecovery } from './words.js';

const DAY = 864e5;
const PARENT_TTL = 30 * DAY, CHILD_TTL = 180 * DAY;
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
    if (!env.DB) throw new HttpError(500, 'The database is not connected.');
    configure(env);
    await migrate(env.DB);
    const url = new URL(request.url);
    if (request.method !== 'GET') {
      // Cross-site requests can't send JSON without a preflight; together with
      // SameSite cookies and the Origin check this blocks CSRF.
      const origin = request.headers.get('origin');
      if (origin && origin !== url.origin) throw new HttpError(403, 'Bad origin');
      if (!(request.headers.get('content-type') || '').startsWith('application/json')) throw new HttpError(415, 'Send JSON');
    }
    const path = url.pathname.replace(/^\/api/, '').replace(/\/$/, '');
    const ctx = { request, db: env.DB, ip: request.headers.get('cf-connecting-ip') || 'local' };
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

async function startSession(ctx, role, id) {
  const tok = newToken(), ttl = role === 'parent' ? PARENT_TTL : CHILD_TTL, now = Date.now();
  await ctx.db.batch([
    ctx.db.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(now),
    ctx.db.prepare('INSERT INTO sessions(token_hash, role, user_id, expires_at) VALUES (?, ?, ?, ?)')
      .bind(await sha256(tok), role, id, now + ttl),
  ]);
  return { 'set-cookie': `${COOKIE}=${tok}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${ttl / 1000}` };
}

// Blocks guessing: 10 failures per account, or 50 per IP address, in 15 minutes.
async function guard(ctx, k) {
  const since = Date.now() - FAIL_WINDOW;
  const q = 'SELECT COUNT(*) AS n FROM login_failures WHERE k = ? AND at > ?';
  const [a, b] = await ctx.db.batch([
    ctx.db.prepare(q).bind(k, since),
    ctx.db.prepare(q).bind('ip:' + ctx.ip, since),
  ]);
  if (a.results[0].n >= FAIL_LIMIT || b.results[0].n >= IP_FAIL_LIMIT)
    throw new HttpError(429, 'Too many tries. Wait 15 minutes, then try again.');
}

async function fail(ctx, k, message) {
  const now = Date.now(), ins = 'INSERT INTO login_failures(k, at) VALUES (?, ?)';
  await ctx.db.batch([
    ctx.db.prepare(ins).bind(k, now),
    ctx.db.prepare(ins).bind('ip:' + ctx.ip, now),
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
  return { password, recovery, pw_hash: await hashSecret(password), recovery_hash: await hashSecret(normRecovery(recovery)) };
}

const card = (name, username, c) => ({ name, username, password: c.password, recovery: c.recovery });

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
  if ('readAloud' in x) { if (typeof x.readAloud !== 'boolean') throw new HttpError(400, 'Bad progress.'); out.readAloud = x.readAloud; }
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
  if (!s) return json({ role: null });
  if (s.role === 'parent') {
    const p = await ctx.db.prepare('SELECT email FROM parents WHERE id = ?').bind(s.user_id).first();
    return p ? json({ role: 'parent', email: p.email }) : json({ role: null });
  }
  const c = await ctx.db.prepare('SELECT name FROM children WHERE id = ?').bind(s.user_id).first();
  return c ? json({ role: 'child', name: c.name }) : json({ role: null });
}

async function listChildren(ctx) {
  const pid = await need(ctx, 'parent');
  const { results } = await ctx.db.prepare(`
    SELECT c.id, c.name, c.display_username AS username, c.last_played AS lastPlayed, c.assessed_at AS assessedAt,
      (SELECT COUNT(*) FROM facts f WHERE f.child_id = c.id AND f.box > 0) AS planted
    FROM children c WHERE c.parent_id = ? ORDER BY c.created_at`).bind(pid).all();
  return json({ children: results });
}

async function addChild(ctx) {
  const pid = await need(ctx, 'parent');
  const name = String((await body(ctx)).name || '').trim().replace(/\s+/g, ' ');
  if (!name || name.length > 20) throw new HttpError(400, 'Enter a first name or nickname (up to 20 letters).');
  const { n } = await ctx.db.prepare('SELECT COUNT(*) AS n FROM children WHERE parent_id = ?').bind(pid).first();
  if (n >= MAX_CHILDREN) throw new HttpError(400, `You can add up to ${MAX_CHILDREN} children.`);
  let username;
  for (let i = 0; i < 20 && !username; i++) {
    const u = newUsername();
    if (!(await ctx.db.prepare('SELECT 1 FROM children WHERE username = ?').bind(normUsername(u)).first())) username = u;
  }
  if (!username) throw new HttpError(500, 'Could not make a username. Try again.');
  const c = await newCredentials();
  const row = await ctx.db.prepare(`INSERT INTO children(parent_id, name, username, display_username, pw_hash, recovery_hash, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`)
    .bind(pid, name, normUsername(username), username, c.pw_hash, c.recovery_hash, Date.now()).first();
  return json({ id: row.id, card: card(name, username, c) });
}

async function resetChild(ctx, id) {
  const pid = await need(ctx, 'parent');
  const child = await ownedChild(ctx, pid, id);
  const c = await newCredentials();
  await ctx.db.batch([
    ctx.db.prepare('UPDATE children SET pw_hash = ?, recovery_hash = ? WHERE id = ?').bind(c.pw_hash, c.recovery_hash, child.id),
    ctx.db.prepare("DELETE FROM sessions WHERE role = 'child' AND user_id = ?").bind(child.id),
  ]);
  return json({ card: card(child.name, child.display_username, c) });
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
    ctx.db.prepare('UPDATE children SET pw_hash = ?, recovery_hash = ? WHERE id = ?').bind(c.pw_hash, c.recovery_hash, row.id),
    ctx.db.prepare("DELETE FROM sessions WHERE role = 'child' AND user_id = ?").bind(row.id),
  ]);
  return json({ card: card(row.name, row.display_username, c) }, 200, await startSession(ctx, 'child', row.id));
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
  ['GET', /^\/child\/state$/, childState],
  ['POST', /^\/child\/sync$/, childSync],
  ['GET', /^\/child\/stats$/, childStats],
  ['GET', /^\/parent\/children\/(\d+)\/tricky$/, childTricky],
  ['POST', /^\/child\/reminder$/, reminderOn],
  ['POST', /^\/child\/reminder\/off$/, reminderOff],
];
