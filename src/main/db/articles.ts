import Database from 'better-sqlite3'
import type { Article, ArticleStatus, ApproveOptions } from '../../renderer/src/types'

interface CreateArticleParams {
  song_name: string
  year: number
  title: string
  content: string
}

export class ArticleDB {
  constructor(private db: Database.Database) {}

  create(params: CreateArticleParams): number {
    const stmt = this.db.prepare(
      `INSERT INTO articles (song_name, year, title, content) VALUES (?, ?, ?, ?)`
    )
    const result = stmt.run(params.song_name, params.year, params.title, params.content)
    return result.lastInsertRowid as number
  }

  findById(id: number): Article | null {
    const row = this.db.prepare(`SELECT * FROM articles WHERE id = ?`).get(id) as any
    return row ? this.deserialize(row) : null
  }

  findByStatus(status: ArticleStatus): Article[] {
    const rows = this.db
      .prepare(`SELECT * FROM articles WHERE status = ? ORDER BY created_at DESC`)
      .all(status) as any[]
    return rows.map(this.deserialize)
  }

  findAll(): Article[] {
    const rows = this.db
      .prepare(`SELECT * FROM articles ORDER BY created_at DESC`)
      .all() as any[]
    return rows.map(this.deserialize)
  }

  findDue(): Article[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM articles WHERE status = 'approved' AND (scheduled_at IS NULL OR scheduled_at <= datetime('now'))`
      )
      .all() as any[]
    return rows.map(this.deserialize)
  }

  update(id: number, fields: Partial<Pick<Article, 'title' | 'content' | 'tags'>>): void {
    if (fields.title !== undefined) {
      this.db.prepare(`UPDATE articles SET title = ? WHERE id = ?`).run(fields.title, id)
    }
    if (fields.content !== undefined) {
      this.db.prepare(`UPDATE articles SET content = ? WHERE id = ?`).run(fields.content, id)
    }
    if (fields.tags !== undefined) {
      this.db
        .prepare(`UPDATE articles SET tags = ? WHERE id = ?`)
        .run(JSON.stringify(fields.tags), id)
    }
  }

  approve(id: number, options: ApproveOptions): void {
    this.db
      .prepare(`UPDATE articles SET status = 'approved', scheduled_at = ?, tags = ? WHERE id = ?`)
      .run(options.scheduled_at, JSON.stringify(options.tags), id)
  }

  reject(id: number): void {
    this.db.prepare(`UPDATE articles SET status = 'rejected' WHERE id = ?`).run(id)
  }

  markPublished(id: number): void {
    this.db
      .prepare(
        `UPDATE articles SET status = 'published', published_at = datetime('now') WHERE id = ?`
      )
      .run(id)
  }

  private deserialize(row: any): Article {
    return {
      ...row,
      tags: JSON.parse(row.tags ?? '[]'),
    }
  }
}
