import Database from 'better-sqlite3'
import path from 'path'

let appGetPath: ((name: string) => string) | null = null

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { app } = require('electron')
  appGetPath = (name: string) => app.getPath(name)
} catch {
  // Running in test environment without Electron
}

export function createDatabase(filePath?: string): Database.Database {
  let dbPath: string
  if (filePath) {
    dbPath = filePath
  } else if (appGetPath) {
    dbPath = path.join(appGetPath('userData'), 'nostalgic.db')
  } else {
    dbPath = ':memory:'
  }

  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  migrate(db)
  return db
}

function migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      song_name TEXT NOT NULL,
      year INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      tags TEXT NOT NULL DEFAULT '[]',
      scheduled_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      published_at TEXT
    );

    CREATE TABLE IF NOT EXISTS platforms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      access_token TEXT NOT NULL DEFAULT '',
      refresh_token TEXT,
      expires_at TEXT,
      enabled INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS publish_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id INTEGER NOT NULL REFERENCES articles(id),
      platform TEXT NOT NULL,
      status TEXT NOT NULL,
      platform_id TEXT,
      published_at TEXT NOT NULL DEFAULT (datetime('now')),
      error TEXT
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    INSERT OR IGNORE INTO platforms (name) VALUES ('wechat'), ('toutiao');
  `)
}
