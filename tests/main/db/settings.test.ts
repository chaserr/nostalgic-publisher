import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { createDatabase } from '../../../src/main/db/database'
import { SettingsDB } from '../../../src/main/db/settings'

let db: Database.Database
let settingsDB: SettingsDB

beforeEach(() => {
  db = createDatabase(':memory:')
  settingsDB = new SettingsDB(db)
})

afterEach(() => {
  db.close()
})

describe('SettingsDB', () => {
  it('returns null for unknown key', () => {
    expect(settingsDB.get('unknown')).toBeNull()
  })

  it('sets and gets a value', () => {
    settingsDB.set('claude_api_key', 'sk-test-123')
    expect(settingsDB.get('claude_api_key')).toBe('sk-test-123')
  })

  it('overwrites existing value', () => {
    settingsDB.set('theme', 'dark')
    settingsDB.set('theme', 'light')
    expect(settingsDB.get('theme')).toBe('light')
  })
})
