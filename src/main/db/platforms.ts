import Database from 'better-sqlite3'
import type { PlatformRecord, Platform } from '../../renderer/src/types'

export class PlatformDB {
  constructor(private db: Database.Database) {}

  findByName(name: Platform): PlatformRecord | null {
    return (
      (this.db
        .prepare(`SELECT * FROM platforms WHERE name = ?`)
        .get(name) as PlatformRecord) ?? null
    )
  }

  findAll(): PlatformRecord[] {
    return this.db.prepare(`SELECT * FROM platforms`).all() as PlatformRecord[]
  }

  setToken(name: Platform, accessToken: string, expiresAt: string): void {
    this.db
      .prepare(
        `UPDATE platforms SET access_token = ?, expires_at = ?, enabled = 1 WHERE name = ?`
      )
      .run(accessToken, expiresAt, name)
  }

  setEnabled(name: Platform, enabled: boolean): void {
    this.db
      .prepare(`UPDATE platforms SET enabled = ? WHERE name = ?`)
      .run(enabled ? 1 : 0, name)
  }

  disable(name: Platform): void {
    this.db
      .prepare(
        `UPDATE platforms SET access_token = '', refresh_token = NULL, expires_at = NULL, enabled = 0 WHERE name = ?`
      )
      .run(name)
  }
}
