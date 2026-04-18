import * as path from 'path'
import * as fs from 'fs'
import { app } from 'electron'
// SQLite disabled - now using Supabase
// import Database from 'better-sqlite3'
import { runMigrations } from './migrations'

let db: any = null

export function getDb(): any {
  if (!db) {
    throw new Error('Local SQLite is disabled. Please check Supabase connectivity.')
  }
  return db
}

export function initDatabase() {
  console.log('[DB] Local SQLite initialization skipped (Cloud Mode active)')
  /*
  const userDataPath = app.getPath('userData')
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true })
  }

  const dbPath = path.join(userDataPath, 'checklist.db')
  console.log('[DB] Opening database at:', dbPath)

  db = new Database(dbPath)
  
  // Performance flags for local usage
  db.pragma('journal_mode = WAL')
  db.pragma('synchronous = NORMAL')
  db.pragma('foreign_keys = ON')

  // Run schema migrations and seeds
  runMigrations(db)
  
  console.log('[DB] Database initialized successfully')

  process.on('exit', () => {
    if (db) db.close()
  })
  */
}

export function saveAfterWrite<T>(fn: () => T): T {
  return fn()
}

export function closeDatabase() {
  if (db) {
    // db.close()
    db = null
  }
}
