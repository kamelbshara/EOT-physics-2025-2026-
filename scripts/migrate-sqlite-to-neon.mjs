// Copy every physics_* table from an old SQLite file (for example a backup of the Railway volume) into Neon.
// Rows that already exist in Neon are kept as they are (ON CONFLICT DO NOTHING), so the copy can be re-run safely.
//   DATABASE_URL=postgres://... node scripts/migrate-sqlite-to-neon.mjs path/to/practice.sqlite
import { DatabaseSync } from 'node:sqlite'
import { openDatabase } from '../lib/db.mjs'

const file = process.argv[2]
if (!file || !process.env.DATABASE_URL) {
  console.error('Usage: DATABASE_URL=postgres://... node scripts/migrate-sqlite-to-neon.mjs practice.sqlite')
  process.exit(1)
}
const src = new DatabaseSync(file, { readOnly: true })
const db = await openDatabase()   // creates the physics_ tables in Neon when they are missing
const tables = src.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'physics_%' ORDER BY name").all().map(r => r.name)
for (const table of tables) {
  const target = new Set((await db.prepare('SELECT column_name FROM information_schema.columns WHERE table_name=?').all(table)).map(r => r.column_name))
  // physics_messages keeps its ids so reply threads still point at their questions; physics_mocks gets a fresh seq in rowid order
  const order = table === 'physics_mocks' ? ' ORDER BY rowid' : ''
  const rows = src.prepare(`SELECT * FROM ${table}${order}`).all()
  let copied = 0
  for (const row of rows) {
    const cols = Object.keys(row).filter(c => target.has(c))
    const res = await db.prepare(`INSERT INTO ${table}(${cols.join(',')}) VALUES(${cols.map(() => '?').join(',')}) ON CONFLICT DO NOTHING`).run(...cols.map(c => row[c]))
    copied += res.changes
  }
  console.log(`${table}: ${copied} of ${rows.length} rows copied`)
}
if (tables.includes('physics_messages')) {
  await db.prepare("SELECT setval(pg_get_serial_sequence('physics_messages','id'), GREATEST((SELECT max(id) FROM physics_messages), 1))").get()
}
