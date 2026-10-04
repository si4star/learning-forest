import { migrate } from './schema.js';
import { hashSecret, verifySecret, newToken, sha256 } from './auth.js';
import { newUsername, newPassword, newRecoveryCode, normUsername, normPassword, normRecovery } from './words.js';

const DAY = 864e5;
const PARENT_TTL = 30 * DAY, CHILD_TTL = 180 * DAY;
const FAIL_WINDOW = 15 * 60e3, FAIL_LIMIT = 10, IP_FAIL_LIMIT = 50;
const MAX_CHILDREN = 10;
const COOKIE = 'tf_session';
const ORDER = [10, 2, 5, 11, 3, 4, 9, 6, 8, 12, 7];
const KINDS = new Set(['assess', 'new', 'reask', 'review', 'retry', 'practice']);

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers },
});

export async function handle(request, env) {
  try {
    if (!env.DB) throw new HttpError(500, 'The database is not connected.');
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
    ctx.db.prepare("UPDATE children SET tables = '[]', assessed_at = NULL, streak = 0, last_day = 0 WHERE id = ?").bind(child.id),
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
    ctx.db.prepare('SELECT id, name, display_username, tables, assessed_at, streak, last_day FROM children WHERE id = ?').bind(cid),
    ctx.db.prepare('SELECT fact, box, due FROM facts WHERE child_id = ?').bind(cid),
  ]);
  const row = c.results[0];
  if (!row) throw new HttpError(401, 'Please log in.');
  const facts = {};
  for (const r of f.results) facts[r.fact] = { box: r.box, due: r.due };
  return json({
    id: row.id, name: row.name, username: row.display_username, tables: JSON.parse(row.tables),
    assessedAt: row.assessed_at, streak: row.streak, lastDay: row.last_day, facts,
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
      && isInt(a.ms, 0, 36e5) && KINDS.has(a.kind) && Number.isFinite(a.at);
    if (!ok) throw new HttpError(400, 'Bad answer.');
    stmts.push(db.prepare('INSERT INTO answers(child_id, fact, a, b, given, correct, ms, kind, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(cid, a.fact, a.a, a.b, a.given, a.correct ? 1 : 0, a.ms, a.kind, a.at));
  }
  if (b.meta) {
    const m = b.meta;
    const ok = Array.isArray(m.tables) && m.tables.every(t => ORDER.includes(t)) && new Set(m.tables).size === m.tables.length
      && isInt(m.streak, 0, 100000) && Number.isFinite(m.lastDay) && (m.assessedAt === null || Number.isFinite(m.assessedAt));
    if (!ok) throw new HttpError(400, 'Bad progress.');
    stmts.push(db.prepare('UPDATE children SET tables = ?, streak = ?, last_day = ?, assessed_at = ? WHERE id = ?')
      .bind(JSON.stringify(m.tables), m.streak, m.lastDay, m.assessedAt, cid));
  }
  if (answers.length) stmts.push(db.prepare('UPDATE children SET last_played = ? WHERE id = ?').bind(Date.now(), cid));
  if (stmts.length) await db.batch(stmts);
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
];
