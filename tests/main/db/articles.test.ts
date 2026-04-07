import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { createDatabase } from '../../../src/main/db/database'
import { ArticleDB } from '../../../src/main/db/articles'

let db: Database.Database
let articleDB: ArticleDB

beforeEach(() => {
  db = createDatabase(':memory:')
  articleDB = new ArticleDB(db)
})

afterEach(() => {
  db.close()
})

describe('ArticleDB', () => {
  it('creates a pending article', () => {
    const id = articleDB.create({
      song_name: '同桌的你',
      year: 1994,
      title: '《同桌的你》1994',
      content: '测试正文',
    })
    const article = articleDB.findById(id)
    expect(article).not.toBeNull()
    expect(article!.status).toBe('pending')
    expect(article!.song_name).toBe('同桌的你')
    expect(article!.tags).toEqual([])
  })

  it('finds articles by status', () => {
    articleDB.create({ song_name: '歌A', year: 1990, title: '标题A', content: '内容A' })
    articleDB.create({ song_name: '歌B', year: 1991, title: '标题B', content: '内容B' })
    const pending = articleDB.findByStatus('pending')
    expect(pending).toHaveLength(2)
  })

  it('approves an article with schedule', () => {
    const id = articleDB.create({ song_name: '歌', year: 1993, title: '标题', content: '内容' })
    articleDB.approve(id, { platforms: ['wechat'], scheduled_at: '2026-04-10T20:30:00', tags: ['暗恋'] })
    const article = articleDB.findById(id)
    expect(article!.status).toBe('approved')
    expect(article!.scheduled_at).toBe('2026-04-10T20:30:00')
    expect(article!.tags).toEqual(['暗恋'])
  })

  it('rejects an article', () => {
    const id = articleDB.create({ song_name: '歌', year: 1993, title: '标题', content: '内容' })
    articleDB.reject(id)
    const article = articleDB.findById(id)
    expect(article!.status).toBe('rejected')
  })

  it('finds due articles for publishing', () => {
    const id = articleDB.create({ song_name: '歌', year: 1993, title: '标题', content: '内容' })
    articleDB.approve(id, { platforms: ['wechat'], scheduled_at: '2020-01-01T00:00:00', tags: [] })
    const due = articleDB.findDue()
    expect(due).toHaveLength(1)
  })

  it('updates article fields', () => {
    const id = articleDB.create({ song_name: '歌', year: 1993, title: '原标题', content: '原内容' })
    articleDB.update(id, { title: '新标题', tags: ['青春'] })
    const article = articleDB.findById(id)
    expect(article!.title).toBe('新标题')
    expect(article!.tags).toEqual(['青春'])
  })

  it('marks article as published', () => {
    const id = articleDB.create({ song_name: '歌', year: 1993, title: '标题', content: '内容' })
    articleDB.markPublished(id)
    const article = articleDB.findById(id)
    expect(article!.status).toBe('published')
    expect(article!.published_at).not.toBeNull()
  })
})
