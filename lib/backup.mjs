// Consistent copies of the progress database (VACUUM INTO is safe while the server runs).
import { mkdirSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

export function backup(db, dir, keep = 14) {
  mkdirSync(dir, { recursive: true })
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')
  const file = join(dir, `practice-${stamp}.sqlite`)
  db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`)
  const old = readdirSync(dir).filter(f => /^practice-.*\.sqlite$/.test(f)).sort().reverse().slice(keep)
  for (const f of old) rmSync(join(dir, f), { force: true })
  return file
}

export function scheduleBackups(db, dir, everyHours = 24) {
  const run = () => { try { console.log('Backup written to', backup(db, dir)) } catch (e) { console.error('Backup failed:', e.message) } }
  setTimeout(run, 60_000).unref()
  setInterval(run, everyHours * 3600_000).unref()
}
