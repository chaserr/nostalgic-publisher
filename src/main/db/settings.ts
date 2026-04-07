import Database from 'better-sqlite3'

export class SettingsDB {
  constructor(private db: Database.Database) {}

  get(key: string): string | null {
    const row = this.db.prepare(`SELECT value FROM settings WHERE key = ?`).get(key) as any
    return row?.value ?? null
  }

  set(key: string, value: string): void {
    this.db
      .prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`)
      .run(key, value)
  }
}
