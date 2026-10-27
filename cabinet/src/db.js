// Слой хранения кабинета. Один и тот же код работает с SQLite (файл рядом с приложением)
// и с PostgreSQL. Выбор через CABINET_DB:
//   sqlite:./data/cabinet.db   (по умолчанию)
//   sqlite::memory:            (тесты)
//   postgres://user:pass@host:5432/db
// Запросы пишутся с плейсхолдерами ?, для PostgreSQL они переводятся в $1, $2, ...
// Идентификаторы генерирует приложение (UUID), время хранится строкой ISO 8601 в UTC.

const SCHEMA = [
 `CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('client','staff','admin')),
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  must_change_password INTEGER NOT NULL DEFAULT 0,
  consent_at TEXT,
  consent_version TEXT,
  marketing INTEGER NOT NULL DEFAULT 0,
  disabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  last_login_at TEXT
 )`,
 `CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
 )`,
 `CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bin TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('pending','active','archived')),
  requested_at TEXT NOT NULL,
  contract_number TEXT NOT NULL DEFAULT '',
  contract_date TEXT NOT NULL DEFAULT '',
  whatsapp_url TEXT NOT NULL DEFAULT '',
  activated_at TEXT,
  activated_by TEXT REFERENCES users(id),
  UNIQUE (owner_id, bin)
 )`,
 `CREATE TABLE IF NOT EXISTS processes (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('planned','in_progress','waiting_client','done')),
  period TEXT NOT NULL DEFAULT '',
  due_date TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
 )`,
 `CREATE TABLE IF NOT EXISTS updates (
  id TEXT PRIMARY KEY,
  process_id TEXT NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
  author_id TEXT REFERENCES users(id),
  kind TEXT NOT NULL CHECK (kind IN ('staff_note','status_change','client_feedback')),
  body TEXT NOT NULL DEFAULT '',
  reaction TEXT NOT NULL DEFAULT '',
  read_by_staff INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
 )`,
 `CREATE TABLE IF NOT EXISTS offer_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comment TEXT NOT NULL DEFAULT '',
  handled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
 )`,
 'CREATE INDEX IF NOT EXISTS companies_status ON companies (status)',
 'CREATE INDEX IF NOT EXISTS processes_company ON processes (company_id)',
 'CREATE INDEX IF NOT EXISTS updates_process ON updates (process_id)',
 'CREATE INDEX IF NOT EXISTS sessions_user ON sessions (user_id)'
];

async function sqlite(location) {
 const { DatabaseSync } = await import('node:sqlite');
 if (location !== ':memory:') {
  const { mkdirSync } = await import('node:fs');
  const { dirname } = await import('node:path');
  mkdirSync(dirname(location), { recursive: true });
 }
 const db = new DatabaseSync(location);
 db.exec('PRAGMA foreign_keys = ON');
 if (location !== ':memory:') db.exec('PRAGMA journal_mode = WAL');
 const api = {
  kind: 'sqlite',
  async all(sql, params = []) { return db.prepare(sql).all(...params); },
  async get(sql, params = []) { return db.prepare(sql).get(...params); },
  async run(sql, params = []) { return db.prepare(sql).run(...params).changes; },
  async transaction(fn) {
   db.exec('BEGIN');
   try { const result = await fn(api); db.exec('COMMIT'); return result; }
   catch (error) { db.exec('ROLLBACK'); throw error; }
  },
  async close() { db.close(); }
 };
 return api;
}

async function postgres(url) {
 let pg;
 try { pg = (await import('pg')).default; }
 catch { throw Error('Для PostgreSQL установите зависимость: npm install pg (в папке cabinet).'); }
 const pool = new pg.Pool({ connectionString: url, max: 10 });
 const numbered = sql => { let i = 0; return sql.replace(/\?/g, () => `$${++i}`); };
 const make = client => ({
  kind: 'postgres',
  async all(sql, params = []) { return (await client.query(numbered(sql), params)).rows; },
  async get(sql, params = []) { return (await client.query(numbered(sql), params)).rows[0]; },
  async run(sql, params = []) { return (await client.query(numbered(sql), params)).rowCount; }
 });
 const api = {
  ...make(pool),
  async transaction(fn) {
   const client = await pool.connect();
   try {
    await client.query('BEGIN');
    const result = await fn({ ...make(client), transaction: f => f(make(client)) });
    await client.query('COMMIT');
    return result;
   } catch (error) { await client.query('ROLLBACK'); throw error; }
   finally { client.release(); }
  },
  async close() { await pool.end(); }
 };
 return api;
}

export async function openDatabase(spec = process.env.CABINET_DB || 'sqlite:./data/cabinet.db') {
 const db = spec.startsWith('postgres://') || spec.startsWith('postgresql://')
  ? await postgres(spec)
  : spec.startsWith('sqlite:') ? await sqlite(spec.slice('sqlite:'.length)) : null;
 if (!db) throw Error('CABINET_DB должен начинаться с sqlite: или postgres://');
 for (const statement of SCHEMA) await db.run(statement);
 return db;
}
