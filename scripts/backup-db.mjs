// Manual backup: node scripts/backup-db.mjs [target-directory]
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'
import { backup } from '../lib/backup.mjs'

const source = process.env.PHYSICS_DB || fileURLToPath(new URL('../data/practice.sqlite', import.meta.url))
const dir = process.argv[2] || process.env.PHYSICS_BACKUP_DIR || fileURLToPath(new URL('../data/backups/', import.meta.url))
console.log('Backup written to', backup(new DatabaseSync(source), dir))
