// One asynchronous database API over two engines:
//   - Neon Postgres (when DATABASE_URL is set), its own database in the maths platform's Neon project; every physics table is
//     prefixed physics_ so the two subjects never mix in the same database;
//   - SQLite (otherwise), for local development and the end-to-end tests.
// Queries use ? placeholders and portable SQL (ON CONFLICT upserts, quoted camelCase aliases,
// CAST(count(*) AS INTEGER)); `db.seq` names the insertion-order column of physics_mocks.
import { DatabaseSync } from 'node:sqlite'

export async function openDatabase({ url = process.env.DATABASE_URL, sqlitePath } = {}) {
  return url ? openNeon(url) : openSqlite(sqlitePath)
}

async function openNeon(url) {
  const { neon, types } = await import('@neondatabase/serverless')
  // bigint (int8) and numeric come back as strings by default; this app only stores values that fit a JS number
  const parsers = { getTypeParser: (oid, format) => (oid === 20 || oid === 1700) ? (v => v === null ? null : Number(v)) : types.getTypeParser(oid, format) }
  const sql = neon(url, { types: parsers, fullResults: true })
  const toPg = text => { let i = 0; return text.replace(/\?/g, () => '$' + (++i)) }
  const query = (text, params) => sql.query(toPg(text), params)
  const db = {
    kind: 'pg',
    seq: 'seq',
    prepare(text) {
      return {
        get: async (...p) => (await query(text, p)).rows[0],
        all: async (...p) => (await query(text, p)).rows,
        run: async (...p) => ({ changes: (await query(text, p)).rowCount }),
      }
    },
    async exec(text) { for (const s of text.split(';').map(s => s.trim()).filter(Boolean)) await query(s, []) },
  }
  await createSchema(db)
  return db
}

async function openSqlite(path) {
  const raw = new DatabaseSync(path)
  raw.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;')
  const db = {
    kind: 'sqlite',
    seq: 'rowid',
    raw,
    prepare(text) {
      const st = raw.prepare(text)
      return {
        get: async (...p) => st.get(...p),
        all: async (...p) => st.all(...p),
        run: async (...p) => ({ changes: st.run(...p).changes }),
      }
    },
    async exec(text) { raw.exec(text) },
  }
  await createSchema(db)
  return db
}

// ------------------------------------------------------------ schema (all physics tables carry the physics_ prefix)
const PG = `
CREATE TABLE IF NOT EXISTS physics_profiles(student TEXT PRIMARY KEY, name TEXT NOT NULL, started TEXT NOT NULL, school TEXT NOT NULL DEFAULT '', code TEXT, pin TEXT, class_code TEXT);
CREATE UNIQUE INDEX IF NOT EXISTS physics_profiles_code ON physics_profiles(code) WHERE code IS NOT NULL;
CREATE TABLE IF NOT EXISTS physics_progress(student TEXT, question TEXT, response TEXT, checked INTEGER, PRIMARY KEY(student, question));
CREATE TABLE IF NOT EXISTS physics_mocks(seq BIGSERIAL, id TEXT PRIMARY KEY, student TEXT, grade INTEGER, ids TEXT, answers TEXT, deadline DOUBLE PRECISION, done INTEGER, test_id TEXT, title TEXT, logged INTEGER);
CREATE INDEX IF NOT EXISTS physics_mocks_student ON physics_mocks(student, seq);
CREATE TABLE IF NOT EXISTS physics_visits(student TEXT PRIMARY KEY, expires DOUBLE PRECISION NOT NULL);
CREATE TABLE IF NOT EXISTS physics_study_views(student TEXT, question TEXT, PRIMARY KEY(student, question));
CREATE TABLE IF NOT EXISTS physics_classes(code TEXT PRIMARY KEY, name TEXT NOT NULL, grade INTEGER, leaderboard INTEGER NOT NULL DEFAULT 0, created DOUBLE PRECISION NOT NULL);
CREATE TABLE IF NOT EXISTS physics_teacher_sessions(token TEXT PRIMARY KEY, expires DOUBLE PRECISION NOT NULL);
CREATE TABLE IF NOT EXISTS physics_attempts(student TEXT NOT NULL, question TEXT NOT NULL, lo TEXT, score DOUBLE PRECISION NOT NULL, at DOUBLE PRECISION NOT NULL);
CREATE INDEX IF NOT EXISTS physics_attempts_student ON physics_attempts(student, at);
CREATE TABLE IF NOT EXISTS physics_mistakes(student TEXT NOT NULL, question TEXT NOT NULL, box INTEGER NOT NULL, due DOUBLE PRECISION NOT NULL, PRIMARY KEY(student, question));
CREATE TABLE IF NOT EXISTS physics_grade_overrides(student TEXT NOT NULL, question TEXT NOT NULL, score DOUBLE PRECISION NOT NULL, total DOUBLE PRECISION NOT NULL, note TEXT, updated DOUBLE PRECISION NOT NULL, PRIMARY KEY(student, question));
CREATE TABLE IF NOT EXISTS physics_rubrics(question TEXT PRIMARY KEY, json TEXT NOT NULL, updated DOUBLE PRECISION NOT NULL);
CREATE TABLE IF NOT EXISTS physics_notebook(id TEXT PRIMARY KEY, student TEXT NOT NULL, question TEXT, title TEXT, background TEXT, strokes TEXT NOT NULL, version INTEGER NOT NULL, status TEXT NOT NULL, created DOUBLE PRECISION NOT NULL, updated DOUBLE PRECISION NOT NULL, submitted DOUBLE PRECISION);
CREATE INDEX IF NOT EXISTS physics_notebook_student ON physics_notebook(student);
CREATE TABLE IF NOT EXISTS physics_notebook_reviews(page TEXT PRIMARY KEY, annotations TEXT NOT NULL, score TEXT, updated DOUBLE PRECISION NOT NULL);
CREATE TABLE IF NOT EXISTS physics_messages(id BIGSERIAL PRIMARY KEY, kind TEXT NOT NULL, thread BIGINT, student TEXT NOT NULL, question TEXT, page TEXT, author TEXT NOT NULL, body TEXT NOT NULL, created DOUBLE PRECISION NOT NULL, seen INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS physics_tests(id TEXT PRIMARY KEY, title TEXT NOT NULL, grade INTEGER NOT NULL, ids TEXT NOT NULL, class_code TEXT, deadline DOUBLE PRECISION, created DOUBLE PRECISION NOT NULL);
CREATE TABLE IF NOT EXISTS physics_progress_archive(student TEXT NOT NULL, question TEXT NOT NULL, response TEXT, checked INTEGER, reset_at DOUBLE PRECISION NOT NULL)`

const SQLITE = `
CREATE TABLE IF NOT EXISTS physics_profiles(student TEXT PRIMARY KEY, name TEXT NOT NULL, started TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS physics_progress(student TEXT, question TEXT, response TEXT, checked INTEGER, PRIMARY KEY(student,question));
CREATE TABLE IF NOT EXISTS physics_mocks(id TEXT PRIMARY KEY, student TEXT, grade INTEGER, ids TEXT, answers TEXT, deadline INTEGER, done INTEGER);
CREATE TABLE IF NOT EXISTS physics_visits(student TEXT PRIMARY KEY, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS physics_study_views(student TEXT, question TEXT, PRIMARY KEY(student,question));
CREATE TABLE IF NOT EXISTS physics_classes(code TEXT PRIMARY KEY, name TEXT NOT NULL, grade INTEGER, leaderboard INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS physics_teacher_sessions(token TEXT PRIMARY KEY, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS physics_attempts(student TEXT NOT NULL, question TEXT NOT NULL, lo TEXT, score REAL NOT NULL, at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS physics_attempts_student ON physics_attempts(student, at);
CREATE TABLE IF NOT EXISTS physics_mistakes(student TEXT NOT NULL, question TEXT NOT NULL, box INTEGER NOT NULL, due INTEGER NOT NULL, PRIMARY KEY(student, question));
CREATE TABLE IF NOT EXISTS physics_grade_overrides(student TEXT NOT NULL, question TEXT NOT NULL, score REAL NOT NULL, total REAL NOT NULL, note TEXT, updated INTEGER NOT NULL, PRIMARY KEY(student, question));
CREATE TABLE IF NOT EXISTS physics_rubrics(question TEXT PRIMARY KEY, json TEXT NOT NULL, updated INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS physics_notebook(id TEXT PRIMARY KEY, student TEXT NOT NULL, question TEXT, title TEXT, background TEXT, strokes TEXT NOT NULL, version INTEGER NOT NULL, status TEXT NOT NULL, created INTEGER NOT NULL, updated INTEGER NOT NULL, submitted INTEGER);
CREATE INDEX IF NOT EXISTS physics_notebook_student ON physics_notebook(student);
CREATE TABLE IF NOT EXISTS physics_notebook_reviews(page TEXT PRIMARY KEY, annotations TEXT NOT NULL, score TEXT, updated INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS physics_messages(id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, thread INTEGER, student TEXT NOT NULL, question TEXT, page TEXT, author TEXT NOT NULL, body TEXT NOT NULL, created INTEGER NOT NULL, seen INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS physics_tests(id TEXT PRIMARY KEY, title TEXT NOT NULL, grade INTEGER NOT NULL, ids TEXT NOT NULL, class_code TEXT, deadline INTEGER, created INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS physics_progress_archive(student TEXT NOT NULL, question TEXT NOT NULL, response TEXT, checked INTEGER, reset_at INTEGER NOT NULL);`

async function createSchema(db) {
  if (db.kind === 'pg') return db.exec(PG)
  db.raw.exec(SQLITE)
  // older SQLite files gain the columns added since they were created
  const add = (table, column, type) => { if (!db.raw.prepare(`PRAGMA table_info(${table})`).all().some(c => c.name === column)) db.raw.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`) }
  add('physics_profiles', 'school', "TEXT NOT NULL DEFAULT ''")
  for (const c of ['code', 'pin', 'class_code']) add('physics_profiles', c, 'TEXT')
  for (const c of ['test_id', 'title']) add('physics_mocks', c, 'TEXT')
  add('physics_mocks', 'logged', 'INTEGER')
  db.raw.exec('CREATE UNIQUE INDEX IF NOT EXISTS physics_profiles_code ON physics_profiles(code) WHERE code IS NOT NULL')
}
