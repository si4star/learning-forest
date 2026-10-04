// Schema migrations, applied in order on the first request each isolate handles.
// Append new migrations; never edit one that has shipped.
const MIGRATIONS = [
  [
    `CREATE TABLE IF NOT EXISTS parents(
      id INTEGER PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      pw_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS children(
      id INTEGER PRIMARY KEY,
      parent_id INTEGER NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      username TEXT NOT NULL UNIQUE,
      display_username TEXT NOT NULL,
      pw_hash TEXT NOT NULL,
      recovery_hash TEXT NOT NULL,
      tables TEXT NOT NULL DEFAULT '[]',
      assessed_at INTEGER,
      streak INTEGER NOT NULL DEFAULT 0,
      last_day INTEGER NOT NULL DEFAULT 0,
      last_played INTEGER,
      created_at INTEGER NOT NULL)`,
    `CREATE INDEX IF NOT EXISTS children_parent ON children(parent_id)`,
    `CREATE TABLE IF NOT EXISTS facts(
      child_id INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
      fact TEXT NOT NULL,
      box INTEGER NOT NULL,
      due INTEGER NOT NULL,
      PRIMARY KEY(child_id, fact))`,
    `CREATE TABLE IF NOT EXISTS answers(
      id INTEGER PRIMARY KEY,
      child_id INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
      fact TEXT NOT NULL,
      a INTEGER NOT NULL,
      b INTEGER NOT NULL,
      given INTEGER,
      correct INTEGER NOT NULL,
      ms INTEGER NOT NULL,
      kind TEXT NOT NULL,
      at INTEGER NOT NULL)`,
    `CREATE INDEX IF NOT EXISTS answers_child ON answers(child_id, at)`,
    `CREATE TABLE IF NOT EXISTS sessions(
      token_hash TEXT PRIMARY KEY,
      role TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      expires_at INTEGER NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS login_failures(k TEXT NOT NULL, at INTEGER NOT NULL)`,
    `CREATE INDEX IF NOT EXISTS login_failures_k ON login_failures(k, at)`,
  ],
];

let ready = null;

export function migrate(db) {
  return (ready ??= run(db).catch(e => { ready = null; throw e; }));
}

async function run(db) {
  await db.prepare('CREATE TABLE IF NOT EXISTS schema_version(v INTEGER NOT NULL)').run();
  const row = await db.prepare('SELECT MAX(v) AS v FROM schema_version').first();
  for (let v = row?.v ?? 0; v < MIGRATIONS.length; v++) {
    await db.batch([
      ...MIGRATIONS[v].map(s => db.prepare(s)),
      db.prepare('INSERT INTO schema_version(v) VALUES (?)').bind(v + 1),
    ]);
  }
}
