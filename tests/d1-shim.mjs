// A minimal Cloudflare D1 stand-in over node:sqlite, for running the API code in Node tests.
import { DatabaseSync } from 'node:sqlite';

export function d1() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  const conv = a => a.map(v => (v === undefined ? null : typeof v === 'boolean' ? Number(v) : v));
  const reads = sql => /^\s*(SELECT|WITH)\b|\bRETURNING\b/i.test(sql);
  const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, a),
    first: async () => db.prepare(sql).get(...conv(args)) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...conv(args)) }),
    run: async () => { db.prepare(sql).run(...conv(args)); return {}; },
    exec: () => (reads(sql) ? { results: db.prepare(sql).all(...conv(args)) } : (db.prepare(sql).run(...conv(args)), { results: [] })),
  });
  return {
    prepare: sql => stmt(sql),
    async batch(list) {
      db.exec('BEGIN');
      try { const out = list.map(s => s.exec()); db.exec('COMMIT'); return out; } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
  };
}

