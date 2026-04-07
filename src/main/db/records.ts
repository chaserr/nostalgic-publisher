import Database from 'better-sqlite3'
import type { PublishRecord, Platform } from '../../renderer/src/types'

interface CreateRecordParams {
  article_id: number
  platform: Platform
  status: 'success' | 'failed'
  platform_id?: string
  error?: string
}

export class RecordDB {
  constructor(private db: Database.Database) {}

  create(params: CreateRecordParams): void {
    this.db
      .prepare(
        `INSERT INTO publish_records (article_id, platform, status, platform_id, error) VALUES (?, ?, ?, ?, ?)`
      )
      .run(
        params.article_id,
        params.platform,
        params.status,
        params.platform_id ?? null,
        params.error ?? null
      )
  }

  findByArticle(articleId: number): PublishRecord[] {
    return this.db
      .prepare(
        `SELECT * FROM publish_records WHERE article_id = ? ORDER BY published_at DESC`
      )
      .all(articleId) as PublishRecord[]
  }

  findRecent(limit = 50): (PublishRecord & { article_title: string })[] {
    return this.db
      .prepare(
        `SELECT r.*, a.title as article_title
         FROM publish_records r
         JOIN articles a ON a.id = r.article_id
         ORDER BY r.published_at DESC
         LIMIT ?`
      )
      .all(limit) as any[]
  }
}
