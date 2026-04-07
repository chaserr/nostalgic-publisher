# 怀旧老歌自动发布工具 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一款本地 Mac 桌面应用，AI 自动生成怀旧老歌故事文章，经人工审查后定时发布到微信公众号和今日头条。

**Architecture:** Electron 主进程负责 SQLite 数据库、Claude API、平台 API 和 node-cron 调度；React 渲染进程通过 contextBridge IPC 调用主进程能力；所有状态通过 Zustand 管理，UI 跟随系统深浅色切换。

**Tech Stack:** electron-vite · React 18 · TypeScript · Tailwind CSS v3 · better-sqlite3 · node-cron · @anthropic-ai/sdk · Zustand · Vitest · electron-builder

---

## 文件结构

```
nostalgic-publisher/
├── src/
│   ├── main/
│   │   ├── index.ts          # Electron 主进程入口，窗口创建
│   │   ├── db/
│   │   │   ├── database.ts   # SQLite 连接 + 迁移
│   │   │   ├── articles.ts   # 文章 CRUD
│   │   │   ├── platforms.ts  # 平台 Token CRUD
│   │   │   ├── records.ts    # 发布记录 CRUD
│   │   │   └── settings.ts   # 配置 CRUD
│   │   ├── services/
│   │   │   ├── generator.ts  # Claude API 内容生成
│   │   │   ├── wechat.ts     # 微信公众号 API
│   │   │   └── toutiao.ts    # 今日头条 API
│   │   ├── scheduler.ts      # node-cron：自动生成 + 自动发布
│   │   └── ipc.ts            # 所有 ipcMain.handle 注册
│   ├── preload/
│   │   └── index.ts          # contextBridge API 暴露
│   └── renderer/
│       ├── src/
│       │   ├── main.tsx       # React 入口
│       │   ├── App.tsx        # 根组件，路由，主题 Provider
│       │   ├── components/
│       │   │   ├── Sidebar.tsx
│       │   │   ├── ThemeToggle.tsx
│       │   │   └── ArticleCard.tsx
│       │   ├── pages/
│       │   │   ├── Dashboard.tsx
│       │   │   ├── Queue.tsx
│       │   │   ├── Editor.tsx
│       │   │   ├── History.tsx
│       │   │   └── Settings.tsx
│       │   ├── stores/
│       │   │   ├── articles.ts   # Zustand 文章状态
│       │   │   └── theme.ts      # Zustand 主题状态
│       │   └── types.ts          # 共享 TypeScript 类型
│       └── index.html
├── tests/
│   ├── main/db/
│   │   ├── articles.test.ts
│   │   ├── platforms.test.ts
│   │   └── settings.test.ts
│   └── main/services/
│       ├── generator.test.ts
│       ├── wechat.test.ts
│       └── toutiao.test.ts
├── electron.vite.config.ts
├── electron-builder.yml
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── vitest.config.ts
```

---

## Phase 1: Foundation

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`, `electron.vite.config.ts`, `tailwind.config.ts`, `tsconfig.json`, `vitest.config.ts`

- [ ] **Step 1: 初始化项目**

```bash
cd /Users/tongxing
npm create @quick-start/electron@latest nostalgic-publisher -- --template react-ts
cd nostalgic-publisher
```

- [ ] **Step 2: 安装依赖**

```bash
npm install better-sqlite3 node-cron @anthropic-ai/sdk zustand react-router-dom
npm install -D tailwindcss autoprefixer postcss @types/better-sqlite3 @types/node-cron vitest @vitejs/plugin-react @electron/rebuild
npx tailwindcss init -p
```

- [ ] **Step 3: 配置 Tailwind**

替换 `tailwind.config.ts` 内容：

```typescript
import type { Config } from 'tailwindcss'

export default {
  content: ['./src/renderer/src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {},
  },
  plugins: [],
} satisfies Config
```

- [ ] **Step 4: 配置 Vitest**

创建 `vitest.config.ts`：

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
```

- [ ] **Step 5: 在 renderer 入口引入 Tailwind**

在 `src/renderer/src/main.tsx` 顶部添加：

```typescript
import './assets/tailwind.css'
```

创建 `src/renderer/src/assets/tailwind.css`：

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 6: 配置 native 模块重建**

在 `package.json` 的 scripts 中添加：

```json
"postinstall": "electron-rebuild -f -w better-sqlite3"
```

运行：

```bash
npm run postinstall
```

- [ ] **Step 7: 验证项目启动**

```bash
npm run dev
```

预期：Electron 窗口打开，显示默认 React 页面，无报错。

- [ ] **Step 8: Commit**

```bash
git add .
git commit -m "feat: scaffold electron-vite project with tailwind and vitest"
```

---

### Task 2: 共享类型 + 数据库层

**Files:**
- Create: `src/renderer/src/types.ts`
- Create: `src/main/db/database.ts`
- Create: `src/main/db/articles.ts`
- Create: `src/main/db/platforms.ts`
- Create: `src/main/db/records.ts`
- Create: `src/main/db/settings.ts`
- Create: `tests/main/db/articles.test.ts`
- Create: `tests/main/db/settings.test.ts`

- [ ] **Step 1: 定义共享类型**

创建 `src/renderer/src/types.ts`（主进程也会 import 这个文件）：

```typescript
export type ArticleStatus = 'pending' | 'approved' | 'published' | 'rejected'
export type Platform = 'wechat' | 'toutiao'
export type ThemeMode = 'system' | 'light' | 'dark'

export interface Article {
  id: number
  song_name: string
  year: number
  title: string
  content: string
  status: ArticleStatus
  tags: string[]
  scheduled_at: string | null
  created_at: string
  published_at: string | null
}

export interface PlatformRecord {
  id: number
  name: Platform
  access_token: string
  refresh_token: string | null
  expires_at: string | null
  enabled: number
}

export interface PublishRecord {
  id: number
  article_id: number
  platform: Platform
  status: 'success' | 'failed'
  platform_id: string | null
  published_at: string
  error: string | null
}

export interface ApproveOptions {
  platforms: Platform[]
  scheduled_at: string | null
  tags: string[]
}

export interface PublishResult {
  platform: Platform
  success: boolean
  platform_id?: string
  error?: string
}
```

- [ ] **Step 2: 写数据库迁移测试（红）**

创建 `tests/main/db/articles.test.ts`：

```typescript
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
    const id = articleDB.create({ song_name: '同桌的你', year: 1994, title: '《同桌的你》1994', content: '测试正文' })
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
    articleDB.approve(id, { scheduled_at: '2026-04-10T20:30:00', tags: ['暗恋'] })
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
    articleDB.approve(id, { scheduled_at: '2020-01-01T00:00:00', tags: [] })
    const due = articleDB.findDue()
    expect(due).toHaveLength(1)
  })
})
```

- [ ] **Step 3: 运行测试确认失败**

```bash
npx vitest run tests/main/db/articles.test.ts
```

预期：FAIL — `Cannot find module '../../../src/main/db/database'`

- [ ] **Step 4: 实现数据库模块**

创建 `src/main/db/database.ts`：

```typescript
import Database from 'better-sqlite3'
import path from 'path'
import { app } from 'electron'

export function createDatabase(filePath?: string): Database.Database {
  const dbPath = filePath ?? path.join(app.getPath('userData'), 'nostalgic.db')
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
```

创建 `src/main/db/articles.ts`：

```typescript
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
    const rows = this.db.prepare(`SELECT * FROM articles WHERE status = ? ORDER BY created_at DESC`).all(status) as any[]
    return rows.map(this.deserialize)
  }

  findAll(): Article[] {
    const rows = this.db.prepare(`SELECT * FROM articles ORDER BY created_at DESC`).all() as any[]
    return rows.map(this.deserialize)
  }

  findDue(): Article[] {
    const rows = this.db.prepare(
      `SELECT * FROM articles WHERE status = 'approved' AND (scheduled_at IS NULL OR scheduled_at <= datetime('now'))`
    ).all() as any[]
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
      this.db.prepare(`UPDATE articles SET tags = ? WHERE id = ?`).run(JSON.stringify(fields.tags), id)
    }
  }

  approve(id: number, options: ApproveOptions): void {
    this.db.prepare(
      `UPDATE articles SET status = 'approved', scheduled_at = ?, tags = ? WHERE id = ?`
    ).run(options.scheduled_at, JSON.stringify(options.tags), id)
  }

  reject(id: number): void {
    this.db.prepare(`UPDATE articles SET status = 'rejected' WHERE id = ?`).run(id)
  }

  markPublished(id: number): void {
    this.db.prepare(
      `UPDATE articles SET status = 'published', published_at = datetime('now') WHERE id = ?`
    ).run(id)
  }

  private deserialize(row: any): Article {
    return {
      ...row,
      tags: JSON.parse(row.tags ?? '[]'),
    }
  }
}
```

- [ ] **Step 5: 实现其他 DB 模块**

创建 `src/main/db/settings.ts`：

```typescript
import Database from 'better-sqlite3'

export class SettingsDB {
  constructor(private db: Database.Database) {}

  get(key: string): string | null {
    const row = this.db.prepare(`SELECT value FROM settings WHERE key = ?`).get(key) as any
    return row?.value ?? null
  }

  set(key: string, value: string): void {
    this.db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`).run(key, value)
  }
}
```

创建 `src/main/db/platforms.ts`：

```typescript
import Database from 'better-sqlite3'
import type { PlatformRecord, Platform } from '../../renderer/src/types'

export class PlatformDB {
  constructor(private db: Database.Database) {}

  findByName(name: Platform): PlatformRecord | null {
    return (this.db.prepare(`SELECT * FROM platforms WHERE name = ?`).get(name) as PlatformRecord) ?? null
  }

  findAll(): PlatformRecord[] {
    return this.db.prepare(`SELECT * FROM platforms`).all() as PlatformRecord[]
  }

  setToken(name: Platform, accessToken: string, expiresAt: string): void {
    this.db.prepare(
      `UPDATE platforms SET access_token = ?, expires_at = ?, enabled = 1 WHERE name = ?`
    ).run(accessToken, expiresAt, name)
  }

  setEnabled(name: Platform, enabled: boolean): void {
    this.db.prepare(`UPDATE platforms SET enabled = ? WHERE name = ?`).run(enabled ? 1 : 0, name)
  }

  disable(name: Platform): void {
    this.db.prepare(
      `UPDATE platforms SET access_token = '', refresh_token = NULL, expires_at = NULL, enabled = 0 WHERE name = ?`
    ).run(name)
  }
}
```

创建 `src/main/db/records.ts`：

```typescript
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
    this.db.prepare(
      `INSERT INTO publish_records (article_id, platform, status, platform_id, error) VALUES (?, ?, ?, ?, ?)`
    ).run(params.article_id, params.platform, params.status, params.platform_id ?? null, params.error ?? null)
  }

  findByArticle(articleId: number): PublishRecord[] {
    return this.db.prepare(`SELECT * FROM publish_records WHERE article_id = ? ORDER BY published_at DESC`).all(articleId) as PublishRecord[]
  }

  findRecent(limit = 50): (PublishRecord & { article_title: string })[] {
    return this.db.prepare(`
      SELECT r.*, a.title as article_title
      FROM publish_records r
      JOIN articles a ON a.id = r.article_id
      ORDER BY r.published_at DESC
      LIMIT ?
    `).all(limit) as any[]
  }
}
```

- [ ] **Step 6: 补充 settings 测试**

创建 `tests/main/db/settings.test.ts`：

```typescript
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

afterEach(() => { db.close() })

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
```

- [ ] **Step 7: 运行所有 DB 测试**

```bash
npx vitest run tests/main/db/
```

预期：全部 PASS

- [ ] **Step 8: Commit**

```bash
git add .
git commit -m "feat: database layer with articles, platforms, records, settings"
```

---

### Task 3: IPC 桥接 + 主进程入口

**Files:**
- Create: `src/main/ipc.ts`
- Modify: `src/main/index.ts`
- Modify: `src/preload/index.ts`

- [ ] **Step 1: 实现 IPC 注册模块**

创建 `src/main/ipc.ts`：

```typescript
import { ipcMain, Notification } from 'electron'
import type { ArticleDB } from './db/articles'
import type { PlatformDB } from './db/platforms'
import type { RecordDB } from './db/records'
import type { SettingsDB } from './db/settings'
import type { GeneratorService } from './services/generator'
import type { WechatService } from './services/wechat'
import type { ToutiaoService } from './services/toutiao'
import type { ApproveOptions, Platform } from '../renderer/src/types'

interface Services {
  articleDB: ArticleDB
  platformDB: PlatformDB
  recordDB: RecordDB
  settingsDB: SettingsDB
  generator: GeneratorService
  wechat: WechatService
  toutiao: ToutiaoService
}

export function registerIpc(services: Services): void {
  const { articleDB, platformDB, recordDB, settingsDB, generator, wechat, toutiao } = services

  // Articles
  ipcMain.handle('articles:list', (_, status?) => articleDB.findByStatus(status) ?? articleDB.findAll())
  ipcMain.handle('articles:get', (_, id: number) => articleDB.findById(id))
  ipcMain.handle('articles:update', (_, id: number, fields) => articleDB.update(id, fields))
  ipcMain.handle('articles:approve', (_, id: number, options: ApproveOptions) => articleDB.approve(id, options))
  ipcMain.handle('articles:reject', (_, id: number) => articleDB.reject(id))

  // Generation
  ipcMain.handle('generate:one', async (_, songName?: string) => {
    const article = await generator.generate(songName)
    const id = articleDB.create(article)
    const created = articleDB.findById(id)
    new Notification({ title: '新文章已生成', body: created!.title }).show()
    return created
  })

  ipcMain.handle('generate:regenerate', async (_, id: number) => {
    const original = articleDB.findById(id)
    if (!original) throw new Error(`Article ${id} not found`)
    const draft = await generator.generate(original.song_name)
    articleDB.update(id, { title: draft.title, content: draft.content })
    return articleDB.findById(id)
  })

  // Publishing
  ipcMain.handle('publish:article', async (_, id: number) => {
    const article = articleDB.findById(id)
    if (!article) throw new Error(`Article ${id} not found`)
    const results = []

    const platforms = platformDB.findAll().filter(p => p.enabled)
    for (const p of platforms) {
      try {
        let platform_id: string | undefined
        if (p.name === 'wechat') platform_id = await wechat.publish(article)
        if (p.name === 'toutiao') platform_id = await toutiao.publish(article)
        recordDB.create({ article_id: id, platform: p.name as Platform, status: 'success', platform_id })
        results.push({ platform: p.name, success: true, platform_id })
      } catch (err: any) {
        recordDB.create({ article_id: id, platform: p.name as Platform, status: 'failed', error: err.message })
        results.push({ platform: p.name, success: false, error: err.message })
      }
    }
    articleDB.markPublished(id)
    return results
  })

  // Platforms
  ipcMain.handle('platforms:list', () => platformDB.findAll())
  ipcMain.handle('platforms:connect-wechat', async (_, appId: string, appSecret: string) => {
    const token = await wechat.getAccessToken(appId, appSecret)
    const expiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString()
    platformDB.setToken('wechat', token.access_token, expiresAt)
    settingsDB.set('wechat_app_id', appId)
    settingsDB.set('wechat_app_secret', appSecret)
  })
  ipcMain.handle('platforms:disconnect', (_, name: Platform) => platformDB.disable(name))

  // Settings
  ipcMain.handle('settings:get', (_, key: string) => settingsDB.get(key))
  ipcMain.handle('settings:set', (_, key: string, value: string) => settingsDB.set(key, value))

  // Records
  ipcMain.handle('records:list', (_, articleId?: number) =>
    articleId ? recordDB.findByArticle(articleId) : recordDB.findRecent()
  )
}
```

- [ ] **Step 2: 更新 preload 脚本**

替换 `src/preload/index.ts`：

```typescript
import { contextBridge, ipcRenderer } from 'electron'
import type { Article, ApproveOptions, Platform } from '../renderer/src/types'

const api = {
  // Articles
  listArticles: (status?: string) => ipcRenderer.invoke('articles:list', status),
  getArticle: (id: number) => ipcRenderer.invoke('articles:get', id),
  updateArticle: (id: number, fields: Partial<Article>) => ipcRenderer.invoke('articles:update', id, fields),
  approveArticle: (id: number, options: ApproveOptions) => ipcRenderer.invoke('articles:approve', id, options),
  rejectArticle: (id: number) => ipcRenderer.invoke('articles:reject', id),

  // Generation
  generateArticle: (songName?: string) => ipcRenderer.invoke('generate:one', songName),
  regenerateArticle: (id: number) => ipcRenderer.invoke('generate:regenerate', id),

  // Publishing
  publishArticle: (id: number) => ipcRenderer.invoke('publish:article', id),

  // Platforms
  listPlatforms: () => ipcRenderer.invoke('platforms:list'),
  connectWechat: (appId: string, appSecret: string) => ipcRenderer.invoke('platforms:connect-wechat', appId, appSecret),
  disconnectPlatform: (name: Platform) => ipcRenderer.invoke('platforms:disconnect', name),

  // Settings
  getSetting: (key: string) => ipcRenderer.invoke('settings:get', key),
  setSetting: (key: string, value: string) => ipcRenderer.invoke('settings:set', key, value),

  // Records
  listRecords: (articleId?: number) => ipcRenderer.invoke('records:list', articleId),
}

contextBridge.exposeInMainWorld('api', api)

export type ElectronAPI = typeof api
```

- [ ] **Step 3: 更新主进程入口**

修改 `src/main/index.ts`（保留原有窗口创建逻辑，添加服务初始化）：

```typescript
import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { createDatabase } from './db/database'
import { ArticleDB } from './db/articles'
import { PlatformDB } from './db/platforms'
import { RecordDB } from './db/records'
import { SettingsDB } from './db/settings'
import { GeneratorService } from './services/generator'
import { WechatService } from './services/wechat'
import { ToutiaoService } from './services/toutiao'
import { registerIpc } from './ipc'
import { Scheduler } from './scheduler'

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
    },
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

app.whenReady().then(() => {
  const db = createDatabase()
  const articleDB = new ArticleDB(db)
  const platformDB = new PlatformDB(db)
  const recordDB = new RecordDB(db)
  const settingsDB = new SettingsDB(db)

  const generator = new GeneratorService(settingsDB)
  const wechat = new WechatService(platformDB, settingsDB)
  const toutiao = new ToutiaoService(platformDB)

  registerIpc({ articleDB, platformDB, recordDB, settingsDB, generator, wechat, toutiao })

  const scheduler = new Scheduler({ articleDB, platformDB, recordDB, settingsDB, generator, wechat, toutiao })
  scheduler.start()

  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
```

- [ ] **Step 4: 声明全局类型**

在 `src/renderer/src/` 下创建 `env.d.ts`：

```typescript
import type { ElectronAPI } from '../../preload'

declare global {
  interface Window {
    api: ElectronAPI
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: IPC bridge, preload API, main process wiring"
```

---

## Phase 2: Content Pipeline

### Task 4: Claude API 内容生成服务

**Files:**
- Create: `src/main/services/generator.ts`
- Create: `tests/main/services/generator.test.ts`

内置歌曲库（当用户不填歌名时随机取一首）：

- [ ] **Step 1: 写生成器测试（红）**

创建 `tests/main/services/generator.test.ts`：

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GeneratorService } from '../../../src/main/services/generator'

// Mock Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify({
          song_name: '同桌的你',
          year: 1994,
          title: '《同桌的你》1994',
          content: '高三最后一个夏天，班里有人把这首歌刻成磁带...'
        })}]
      })
    }
  }
}))

const mockSettingsDB = {
  get: vi.fn().mockReturnValue('sk-test-key'),
  set: vi.fn(),
}

describe('GeneratorService', () => {
  let generator: GeneratorService

  beforeEach(() => {
    generator = new GeneratorService(mockSettingsDB as any)
  })

  it('generates an article with song name', async () => {
    const result = await generator.generate('同桌的你')
    expect(result.song_name).toBe('同桌的你')
    expect(result.year).toBe(1994)
    expect(result.title).toBeTruthy()
    expect(result.content).toBeTruthy()
  })

  it('generates an article without song name (picks random)', async () => {
    const result = await generator.generate()
    expect(result.song_name).toBeTruthy()
  })

  it('throws when Claude API key is not set', async () => {
    mockSettingsDB.get.mockReturnValueOnce(null)
    await expect(generator.generate()).rejects.toThrow('Claude API Key 未配置')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npx vitest run tests/main/services/generator.test.ts
```

预期：FAIL — `Cannot find module`

- [ ] **Step 3: 实现生成器服务**

创建 `src/main/services/generator.ts`：

```typescript
import Anthropic from '@anthropic-ai/sdk'
import type { SettingsDB } from '../db/settings'

const SONG_LIBRARY = [
  { name: '同桌的你', year: 1994 }, { name: '朋友', year: 1997 },
  { name: '心动', year: 1999 }, { name: '执迷不悔', year: 1993 },
  { name: '童年', year: 1983 }, { name: '外面的世界', year: 1987 },
  { name: '睡在我上铺的兄弟', year: 1997 }, { name: '老鼠爱大米', year: 2004 },
  { name: '两只蝴蝶', year: 2004 }, { name: '丁香花', year: 2004 },
  { name: '漂洋过海来看你', year: 1990 }, { name: '至少还有你', year: 2000 },
  { name: '流着泪的你的脸', year: 1998 }, { name: '蜗牛', year: 2002 },
  { name: '阳光总在风雨后', year: 1999 },
]

interface GeneratedDraft {
  song_name: string
  year: number
  title: string
  content: string
}

export class GeneratorService {
  constructor(private settingsDB: SettingsDB) {}

  async generate(songName?: string): Promise<GeneratedDraft> {
    const apiKey = this.settingsDB.get('claude_api_key')
    if (!apiKey) throw new Error('Claude API Key 未配置，请在设置中填写')

    const song = songName
      ? SONG_LIBRARY.find(s => s.name === songName) ?? { name: songName, year: 2000 }
      : SONG_LIBRARY[Math.floor(Math.random() * SONG_LIBRARY.length)]

    const client = new Anthropic({ apiKey })

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `你是一个擅写青春故事的公众号创作者。
以《${song.name}》(${song.year}) 为背景音乐，写一个200字以内的青春故事。
要求：
- 聚焦一个具体场景（暗恋/毕业/旅途/网吧/绿皮车等）
- 引用歌词中一句话
- 结尾以问句与读者互动
- 不写歌手生平，主角是读者自己的记忆
- 文笔要有画面感，情感要真实

请以 JSON 格式输出，包含字段：song_name, year, title, content
title 格式：《${song.name}》${song.year}
content 是纯文本正文（包含引用歌词和结尾问句）
只输出 JSON，不要其他内容。`,
      }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Claude 返回格式异常')

    const data = JSON.parse(jsonMatch[0])
    return {
      song_name: data.song_name ?? song.name,
      year: data.year ?? song.year,
      title: data.title,
      content: data.content,
    }
  }
}
```

- [ ] **Step 4: 运行测试**

```bash
npx vitest run tests/main/services/generator.test.ts
```

预期：全部 PASS

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: Claude API content generator service"
```

---

### Task 5: 微信 + 今日头条发布服务

**Files:**
- Create: `src/main/services/wechat.ts`
- Create: `src/main/services/toutiao.ts`
- Create: `tests/main/services/wechat.test.ts`

- [ ] **Step 1: 写微信服务测试（红）**

创建 `tests/main/services/wechat.test.ts`：

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { WechatService } from '../../../src/main/services/wechat'

global.fetch = vi.fn()

const mockPlatformDB = {
  findByName: vi.fn().mockReturnValue({ access_token: 'token-123', expires_at: new Date(Date.now() + 3600000).toISOString(), enabled: 1 }),
  setToken: vi.fn(),
}
const mockSettingsDB = {
  get: vi.fn().mockImplementation((key: string) => key === 'wechat_app_id' ? 'appid-123' : 'secret-456'),
  set: vi.fn(),
}

describe('WechatService', () => {
  let service: WechatService

  beforeEach(() => {
    service = new WechatService(mockPlatformDB as any, mockSettingsDB as any)
    vi.mocked(fetch).mockReset()
  })

  it('gets access token', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ access_token: 'new-token', expires_in: 7200 }),
    } as any)

    const result = await service.getAccessToken('appid', 'secret')
    expect(result.access_token).toBe('new-token')
    expect(result.expires_in).toBe(7200)
  })

  it('publishes article via draft + submit flow', async () => {
    // Mock add draft
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true, json: () => Promise.resolve({ media_id: 'draft-001' }),
    } as any)
    // Mock freepublish
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true, json: () => Promise.resolve({ publish_id: 'pub-001' }),
    } as any)

    const article = { id: 1, title: '测试标题', content: '测试正文', song_name: '歌', year: 1994, status: 'approved', tags: [], scheduled_at: null, created_at: '', published_at: null } as any
    const id = await service.publish(article)
    expect(id).toBe('pub-001')
  })
})
```

- [ ] **Step 2: 运行确认失败**

```bash
npx vitest run tests/main/services/wechat.test.ts
```

预期：FAIL

- [ ] **Step 3: 实现微信服务**

创建 `src/main/services/wechat.ts`：

```typescript
import type { PlatformDB } from '../db/platforms'
import type { SettingsDB } from '../db/settings'
import type { Article } from '../../renderer/src/types'

interface WechatToken {
  access_token: string
  expires_in: number
}

export class WechatService {
  constructor(private platformDB: PlatformDB, private settingsDB: SettingsDB) {}

  async getAccessToken(appId: string, appSecret: string): Promise<WechatToken> {
    const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appId}&secret=${appSecret}`
    const res = await fetch(url)
    const data = await res.json() as any
    if (data.errcode) throw new Error(`微信授权失败: ${data.errmsg}`)
    return { access_token: data.access_token, expires_in: data.expires_in }
  }

  async refreshTokenIfNeeded(): Promise<string> {
    const platform = this.platformDB.findByName('wechat')
    if (!platform?.enabled) throw new Error('微信公众号未连接')

    const expiresAt = platform.expires_at ? new Date(platform.expires_at) : new Date(0)
    const tenMinutes = 10 * 60 * 1000
    if (expiresAt.getTime() - Date.now() > tenMinutes) {
      return platform.access_token
    }

    const appId = this.settingsDB.get('wechat_app_id')
    const appSecret = this.settingsDB.get('wechat_app_secret')
    if (!appId || !appSecret) throw new Error('微信 AppID/AppSecret 未配置')

    const token = await this.getAccessToken(appId, appSecret)
    const expiresAtStr = new Date(Date.now() + token.expires_in * 1000).toISOString()
    this.platformDB.setToken('wechat', token.access_token, expiresAtStr)
    return token.access_token
  }

  async publish(article: Article): Promise<string> {
    const accessToken = await this.refreshTokenIfNeeded()

    // Step 1: Add draft
    const draftRes = await fetch(`https://api.weixin.qq.com/cgi-bin/draft/add?access_token=${accessToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        articles: [{
          title: article.title,
          content: article.content.replace(/\n/g, '<br/>'),
          author: '',
          digest: article.content.slice(0, 120),
          show_cover_pic: 0,
        }],
      }),
    })
    const draftData = await draftRes.json() as any
    if (draftData.errcode) throw new Error(`创建草稿失败: ${draftData.errmsg}`)

    // Step 2: Publish
    const pubRes = await fetch(`https://api.weixin.qq.com/cgi-bin/freepublish/submit?access_token=${accessToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ media_id: draftData.media_id }),
    })
    const pubData = await pubRes.json() as any
    if (pubData.errcode) throw new Error(`发布失败: ${pubData.errmsg}`)
    return pubData.publish_id as string
  }
}
```

- [ ] **Step 4: 实现今日头条服务（占位）**

创建 `src/main/services/toutiao.ts`：

```typescript
import type { PlatformDB } from '../db/platforms'
import type { Article } from '../../renderer/src/types'

export class ToutiaoService {
  constructor(private platformDB: PlatformDB) {}

  async publish(article: Article): Promise<string> {
    const platform = this.platformDB.findByName('toutiao')
    if (!platform?.enabled) throw new Error('今日头条未连接')

    // 今日头条创作者平台 API
    const res = await fetch('https://open.douyin.com/api/news/article/publish/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access-token': platform.access_token,
      },
      body: JSON.stringify({
        title: article.title,
        content: article.content,
        article_type: 0,
      }),
    })
    const data = await res.json() as any
    if (data.message !== 'success') throw new Error(`头条发布失败: ${data.message}`)
    return data.data?.article_id as string
  }
}
```

- [ ] **Step 5: 运行微信测试**

```bash
npx vitest run tests/main/services/wechat.test.ts
```

预期：全部 PASS

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: WeChat and Toutiao publisher services"
```

---

### Task 6: Scheduler（自动生成 + 自动发布）

**Files:**
- Create: `src/main/scheduler.ts`

- [ ] **Step 1: 实现调度器**

创建 `src/main/scheduler.ts`：

```typescript
import cron from 'node-cron'
import { Notification } from 'electron'
import type { ArticleDB } from './db/articles'
import type { PlatformDB } from './db/platforms'
import type { RecordDB } from './db/records'
import type { SettingsDB } from './db/settings'
import type { GeneratorService } from './services/generator'
import type { WechatService } from './services/wechat'
import type { ToutiaoService } from './services/toutiao'
import type { Platform } from '../renderer/src/types'

interface SchedulerDeps {
  articleDB: ArticleDB
  platformDB: PlatformDB
  recordDB: RecordDB
  settingsDB: SettingsDB
  generator: GeneratorService
  wechat: WechatService
  toutiao: ToutiaoService
}

export class Scheduler {
  private tasks: cron.ScheduledTask[] = []

  constructor(private deps: SchedulerDeps) {}

  start(): void {
    // Publish due articles every minute
    this.tasks.push(
      cron.schedule('* * * * *', () => this.publishDueArticles())
    )

    // Auto-generate on user-configured schedule
    this.scheduleAutoGenerate()
  }

  stop(): void {
    this.tasks.forEach(t => t.stop())
    this.tasks = []
  }

  scheduleAutoGenerate(): void {
    const { settingsDB } = this.deps
    const schedule = settingsDB.get('auto_schedule')
    if (!schedule) return

    if (!cron.validate(schedule)) {
      console.warn('Invalid cron expression:', schedule)
      return
    }

    this.tasks.push(
      cron.schedule(schedule, () => this.runAutoGenerate())
    )
  }

  private async runAutoGenerate(): Promise<void> {
    const { settingsDB, generator, articleDB } = this.deps
    const countStr = settingsDB.get('auto_generate_count') ?? '3'
    const count = Math.min(parseInt(countStr, 10), 5)

    for (let i = 0; i < count; i++) {
      try {
        const draft = await generator.generate()
        const id = articleDB.create(draft)
        const article = articleDB.findById(id)
        new Notification({ title: '新文章已生成', body: article!.title }).show()
      } catch (err: any) {
        console.error('Auto generate failed:', err.message)
      }
    }
  }

  private async publishDueArticles(): Promise<void> {
    const { articleDB, platformDB, recordDB, wechat, toutiao } = this.deps
    const dueArticles = articleDB.findDue()
    if (dueArticles.length === 0) return

    const enabledPlatforms = platformDB.findAll().filter(p => p.enabled)

    for (const article of dueArticles) {
      let anySuccess = false

      for (const p of enabledPlatforms) {
        try {
          let platform_id: string | undefined
          if (p.name === 'wechat') platform_id = await wechat.publish(article)
          if (p.name === 'toutiao') platform_id = await toutiao.publish(article)

          recordDB.create({ article_id: article.id, platform: p.name as Platform, status: 'success', platform_id })
          anySuccess = true
        } catch (err: any) {
          recordDB.create({ article_id: article.id, platform: p.name as Platform, status: 'failed', error: err.message })
          new Notification({ title: '发布失败', body: `${article.title} → ${p.name}: ${err.message}` }).show()
        }
      }

      if (anySuccess) {
        articleDB.markPublished(article.id)
        new Notification({ title: '发布成功', body: article.title }).show()
      }
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add .
git commit -m "feat: scheduler for auto-generate and auto-publish"
```

---

## Phase 3: Review UI

### Task 7: 主题系统 + App 骨架

**Files:**
- Modify: `src/renderer/src/App.tsx`
- Create: `src/renderer/src/stores/theme.ts`
- Create: `src/renderer/src/components/Sidebar.tsx`
- Create: `src/renderer/src/components/ThemeToggle.tsx`

- [ ] **Step 1: 主题 Store**

创建 `src/renderer/src/stores/theme.ts`：

```typescript
import { create } from 'zustand'
import type { ThemeMode } from '../types'

interface ThemeStore {
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
}

function applyTheme(mode: ThemeMode): void {
  const isDark =
    mode === 'dark' ||
    (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', isDark)
}

export const useThemeStore = create<ThemeStore>((set) => ({
  mode: 'system',
  setMode: async (mode) => {
    await window.api.setSetting('theme', mode)
    applyTheme(mode)
    set({ mode })
  },
}))

export async function initTheme(): Promise<void> {
  const saved = (await window.api.getSetting('theme') as ThemeMode) ?? 'system'
  applyTheme(saved)
  useThemeStore.setState({ mode: saved })

  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (useThemeStore.getState().mode === 'system') applyTheme('system')
  })
}
```

- [ ] **Step 2: 侧边栏组件**

创建 `src/renderer/src/components/Sidebar.tsx`：

```typescript
import { NavLink } from 'react-router-dom'
import { ThemeToggle } from './ThemeToggle'

const navItems = [
  { to: '/', label: '仪表盘', icon: '📊' },
  { to: '/queue', label: '待审队列', icon: '📝' },
  { to: '/history', label: '发布历史', icon: '📖' },
  { to: '/settings', label: '设置', icon: '⚙️' },
]

export function Sidebar() {
  return (
    <div className="w-48 h-full flex flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700">
      <div className="px-4 py-5">
        <h1 className="text-sm font-bold text-gray-900 dark:text-white">🎵 老歌发布</h1>
      </div>
      <nav className="flex-1 px-2">
        {navItems.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-2 rounded-lg text-sm mb-1 transition-colors ` +
              (isActive
                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800')
            }
          >
            <span>{icon}</span>
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
        <ThemeToggle />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: 主题切换组件**

创建 `src/renderer/src/components/ThemeToggle.tsx`：

```typescript
import { useThemeStore } from '../stores/theme'
import type { ThemeMode } from '../types'

const modes: { value: ThemeMode; icon: string; label: string }[] = [
  { value: 'light', icon: '☀️', label: '亮色' },
  { value: 'system', icon: '⚡', label: '自动' },
  { value: 'dark', icon: '🌙', label: '暗色' },
]

export function ThemeToggle() {
  const { mode, setMode } = useThemeStore()
  return (
    <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
      {modes.map(m => (
        <button
          key={m.value}
          onClick={() => setMode(m.value)}
          title={m.label}
          className={`flex-1 py-1 rounded text-xs transition-colors ` +
            (mode === m.value ? 'bg-white dark:bg-gray-700 shadow-sm' : 'hover:bg-gray-200 dark:hover:bg-gray-700')}
        >
          {m.icon}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: App 根组件**

替换 `src/renderer/src/App.tsx`：

```typescript
import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Sidebar } from './components/Sidebar'
import { Dashboard } from './pages/Dashboard'
import { Queue } from './pages/Queue'
import { Editor } from './pages/Editor'
import { History } from './pages/History'
import { Settings } from './pages/Settings'
import { initTheme } from './stores/theme'

export default function App() {
  useEffect(() => { initTheme() }, [])

  return (
    <BrowserRouter>
      <div className="flex h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/queue" element={<Queue />} />
            <Route path="/editor/:id" element={<Editor />} />
            <Route path="/history" element={<History />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
```

- [ ] **Step 5: 创建页面占位文件**

创建以下文件（后续 Task 填充内容）：

`src/renderer/src/pages/Dashboard.tsx`:
```typescript
export function Dashboard() { return <div className="p-6"><h2 className="text-xl font-bold">仪表盘</h2></div> }
```

`src/renderer/src/pages/Queue.tsx`:
```typescript
export function Queue() { return <div className="p-6"><h2 className="text-xl font-bold">待审队列</h2></div> }
```

`src/renderer/src/pages/Editor.tsx`:
```typescript
export function Editor() { return <div className="p-6"><h2 className="text-xl font-bold">编辑器</h2></div> }
```

`src/renderer/src/pages/History.tsx`:
```typescript
export function History() { return <div className="p-6"><h2 className="text-xl font-bold">发布历史</h2></div> }
```

`src/renderer/src/pages/Settings.tsx`:
```typescript
export function Settings() { return <div className="p-6"><h2 className="text-xl font-bold">设置</h2></div> }
```

- [ ] **Step 6: 启动验证**

```bash
npm run dev
```

预期：侧边栏可见，导航可切换页面，主题切换按钮有效，跟随系统深浅色。

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "feat: theme system, sidebar navigation, app skeleton"
```

---

### Task 8: 待审队列页面

**Files:**
- Modify: `src/renderer/src/pages/Queue.tsx`
- Create: `src/renderer/src/stores/articles.ts`
- Create: `src/renderer/src/components/ArticleCard.tsx`

- [ ] **Step 1: 文章 Store**

创建 `src/renderer/src/stores/articles.ts`：

```typescript
import { create } from 'zustand'
import type { Article, ArticleStatus } from '../types'

interface ArticlesStore {
  articles: Article[]
  loading: boolean
  fetchByStatus: (status: ArticleStatus) => Promise<void>
  fetchAll: () => Promise<void>
  generateArticle: (songName?: string) => Promise<Article>
  rejectArticle: (id: number) => Promise<void>
}

export const useArticlesStore = create<ArticlesStore>((set, get) => ({
  articles: [],
  loading: false,

  fetchByStatus: async (status) => {
    set({ loading: true })
    const articles = await window.api.listArticles(status)
    set({ articles, loading: false })
  },

  fetchAll: async () => {
    set({ loading: true })
    const articles = await window.api.listArticles()
    set({ articles, loading: false })
  },

  generateArticle: async (songName?) => {
    const article = await window.api.generateArticle(songName)
    await get().fetchByStatus('pending')
    return article
  },

  rejectArticle: async (id) => {
    await window.api.rejectArticle(id)
    set(state => ({ articles: state.articles.filter(a => a.id !== id) }))
  },
}))
```

- [ ] **Step 2: 文章卡片组件**

创建 `src/renderer/src/components/ArticleCard.tsx`：

```typescript
import { useNavigate } from 'react-router-dom'
import type { Article } from '../types'

interface Props {
  article: Article
  onReject: (id: number) => void
}

export function ArticleCard({ article, onReject }: Props) {
  const navigate = useNavigate()
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{article.title}</h3>
        <span className="text-xs text-gray-400 dark:text-gray-500 ml-2 whitespace-nowrap">
          {new Date(article.created_at).toLocaleDateString('zh-CN')}
        </span>
      </div>
      <p className="text-gray-500 dark:text-gray-400 text-xs line-clamp-3 mb-3">{article.content}</p>
      <div className="flex gap-2">
        <button
          onClick={() => navigate(`/editor/${article.id}`)}
          className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg font-medium transition-colors"
        >
          审查 →
        </button>
        <button
          onClick={() => onReject(article.id)}
          className="px-3 py-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 text-xs rounded-lg transition-colors"
        >
          拒绝
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: 待审队列页面**

替换 `src/renderer/src/pages/Queue.tsx`：

```typescript
import { useEffect, useState } from 'react'
import { useArticlesStore } from '../stores/articles'
import { ArticleCard } from '../components/ArticleCard'

export function Queue() {
  const { articles, loading, fetchByStatus, generateArticle, rejectArticle } = useArticlesStore()
  const [songInput, setSongInput] = useState('')
  const [generating, setGenerating] = useState(false)

  useEffect(() => { fetchByStatus('pending') }, [])

  async function handleGenerate() {
    setGenerating(true)
    try {
      await generateArticle(songInput.trim() || undefined)
      setSongInput('')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">待审队列</h2>
        <div className="flex gap-2">
          <input
            value={songInput}
            onChange={e => setSongInput(e.target.value)}
            placeholder="歌曲名称（可选）"
            className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 w-40"
            onKeyDown={e => e.key === 'Enter' && handleGenerate()}
          />
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm rounded-lg font-medium transition-colors"
          >
            {generating ? '生成中…' : '生成新内容'}
          </button>
        </div>
      </div>

      {loading && <p className="text-gray-400 text-sm">加载中…</p>}

      {!loading && articles.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">🎵</p>
          <p>暂无待审内容，点击「生成新内容」开始</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {articles.map(article => (
          <ArticleCard key={article.id} article={article} onReject={rejectArticle} />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat: pending queue page with article cards and generate trigger"
```

---

### Task 9: 内容编辑器页面

**Files:**
- Modify: `src/renderer/src/pages/Editor.tsx`

- [ ] **Step 1: 实现编辑器**

替换 `src/renderer/src/pages/Editor.tsx`：

```typescript
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { Article, ApproveOptions, Platform } from '../types'

const PLATFORMS: { id: Platform; label: string }[] = [
  { id: 'wechat', label: '微信公众号' },
  { id: 'toutiao', label: '今日头条' },
]

export function Editor() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [article, setArticle] = useState<Article | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(['wechat', 'toutiao'])
  const [scheduleMode, setScheduleMode] = useState<'now' | 'scheduled'>('scheduled')
  const [scheduledAt, setScheduledAt] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [regenerating, setRegenerating] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!id) return
    window.api.getArticle(parseInt(id)).then(a => {
      if (!a) return
      setArticle(a)
      setTitle(a.title)
      setContent(a.content)
      setTags(a.tags)
    })
  }, [id])

  async function handleRegenerate() {
    if (!article) return
    setRegenerating(true)
    try {
      const updated = await window.api.regenerateArticle(article.id)
      if (updated) {
        setTitle(updated.title)
        setContent(updated.content)
        setArticle(updated)
      }
    } finally {
      setRegenerating(false)
    }
  }

  async function handleApprove() {
    if (!article) return
    setSaving(true)
    try {
      await window.api.updateArticle(article.id, { title, content, tags })
      const options: ApproveOptions = {
        platforms: selectedPlatforms,
        scheduled_at: scheduleMode === 'scheduled' ? scheduledAt || null : null,
        tags,
      }
      await window.api.approveArticle(article.id, options)
      navigate('/queue')
    } finally {
      setSaving(false)
    }
  }

  async function handleReject() {
    if (!article) return
    await window.api.rejectArticle(article.id)
    navigate('/queue')
  }

  function addTag() {
    const tag = tagInput.trim()
    if (tag && !tags.includes(tag)) setTags([...tags, tag])
    setTagInput('')
  }

  if (!article) return <div className="p-6 text-gray-400">加载中…</div>

  const wordCount = content.replace(/\s/g, '').length

  return (
    <div className="flex h-full">
      {/* Left: Editor */}
      <div className="flex-1 flex flex-col border-r border-gray-200 dark:border-gray-700">
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-sm">← 返回</button>
          <span className="flex-1 text-sm font-medium text-gray-700 dark:text-gray-300">✍️ 内容编辑</span>
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="px-3 py-1.5 text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 disabled:opacity-50 transition-colors"
          >
            {regenerating ? '生成中…' : '🔄 重新生成'}
          </button>
        </div>

        {/* Title */}
        <div className="px-5 pt-4 pb-2">
          <label className="text-xs text-gray-400 mb-1 block">标题</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Content */}
        <div className="px-5 flex-1 flex flex-col pb-2">
          <label className="text-xs text-gray-400 mb-1 block">正文</label>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            className="flex-1 w-full px-3 py-3 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Word count */}
        <div className="px-5 py-2 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-400">
          字数：{wordCount} 字
        </div>
      </div>

      {/* Right: Publish config */}
      <div className="w-56 flex flex-col bg-white dark:bg-gray-900">
        {/* Platforms */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3">发布平台</p>
          {PLATFORMS.map(p => (
            <label key={p.id} className="flex items-center gap-2 mb-2 cursor-pointer">
              <div
                onClick={() => setSelectedPlatforms(prev =>
                  prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id]
                )}
                className={`w-9 h-5 rounded-full transition-colors cursor-pointer flex items-center px-0.5 ` +
                  (selectedPlatforms.includes(p.id) ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600')}
              >
                <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ` +
                  (selectedPlatforms.includes(p.id) ? 'translate-x-4' : 'translate-x-0')} />
              </div>
              <span className="text-sm text-gray-700 dark:text-gray-300">{p.label}</span>
            </label>
          ))}
        </div>

        {/* Schedule */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3">发布时间</p>
          <div className="flex gap-1 mb-3">
            {(['scheduled', 'now'] as const).map(m => (
              <button
                key={m}
                onClick={() => setScheduleMode(m)}
                className={`flex-1 py-1 text-xs rounded-md transition-colors ` +
                  (scheduleMode === m
                    ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 font-medium'
                    : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800')}
              >
                {m === 'scheduled' ? '定时' : '立即'}
              </button>
            ))}
          </div>
          {scheduleMode === 'scheduled' && (
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={e => setScheduledAt(e.target.value)}
              className="w-full px-2 py-1.5 text-xs bg-gray-100 dark:bg-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}
        </div>

        {/* Tags */}
        <div className="p-4 flex-1">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">标签</p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {tags.map(tag => (
              <span
                key={tag}
                onClick={() => setTags(tags.filter(t => t !== tag))}
                className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-xs rounded-full cursor-pointer hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 transition-colors"
              >
                {tag} ×
              </span>
            ))}
          </div>
          <div className="flex gap-1">
            <input
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTag()}
              placeholder="添加标签"
              className="flex-1 px-2 py-1 text-xs bg-gray-100 dark:bg-gray-800 rounded-lg focus:outline-none min-w-0"
            />
            <button onClick={addTag} className="px-2 text-xs text-gray-400 hover:text-gray-600">+</button>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex flex-col gap-2">
          <button
            onClick={handleApprove}
            disabled={saving || selectedPlatforms.length === 0}
            className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {saving ? '保存中…' : '✓ 通过并排期'}
          </button>
          <button
            onClick={handleReject}
            className="w-full py-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm rounded-lg transition-colors"
          >
            ✕ 拒绝
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add .
git commit -m "feat: editor page with content editing, platform selection, and scheduling"
```

---

## Phase 4: Pages & Polish

### Task 10: 仪表盘页面

**Files:**
- Modify: `src/renderer/src/pages/Dashboard.tsx`

- [ ] **Step 1: 实现仪表盘**

替换 `src/renderer/src/pages/Dashboard.tsx`：

```typescript
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Article } from '../types'

export function Dashboard() {
  const navigate = useNavigate()
  const [pending, setPending] = useState<Article[]>([])
  const [approved, setApproved] = useState<Article[]>([])
  const [published, setPublished] = useState<Article[]>([])
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    window.api.listArticles('pending').then(setPending)
    window.api.listArticles('approved').then(setApproved)
    window.api.listArticles('published').then(setPublished)
  }, [])

  async function handleGenerate() {
    setGenerating(true)
    try {
      await window.api.generateArticle()
      const updated = await window.api.listArticles('pending')
      setPending(updated)
    } finally {
      setGenerating(false)
    }
  }

  const upcoming = approved.filter(a => a.scheduled_at).sort((a, b) =>
    new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime()
  ).slice(0, 5)

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">仪表盘</h2>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm rounded-lg font-medium transition-colors"
        >
          {generating ? '生成中…' : '+ 生成新内容'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: '待审', count: pending.length, color: 'blue', action: () => navigate('/queue') },
          { label: '已排期', count: approved.length, color: 'purple', action: () => navigate('/queue') },
          { label: '已发布', count: published.length, color: 'green', action: () => navigate('/history') },
        ].map(({ label, count, color, action }) => (
          <button
            key={label}
            onClick={action}
            className={`bg-${color}-50 dark:bg-${color}-900/20 border border-${color}-100 dark:border-${color}-800 rounded-xl p-4 text-left hover:shadow-md transition-shadow`}
          >
            <div className={`text-3xl font-bold text-${color}-600 dark:text-${color}-400`}>{count}</div>
            <div className={`text-sm text-${color}-500 dark:text-${color}-500 mt-1`}>{label}</div>
          </button>
        ))}
      </div>

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3">即将发布</h3>
          <div className="space-y-2">
            {upcoming.map(article => (
              <div
                key={article.id}
                onClick={() => navigate(`/editor/${article.id}`)}
                className="flex items-center gap-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3 cursor-pointer hover:shadow-sm transition-shadow"
              >
                <div className="w-2 h-2 bg-indigo-400 rounded-full flex-shrink-0" />
                <span className="flex-1 text-sm text-gray-800 dark:text-gray-200 truncate">{article.title}</span>
                <span className="text-xs text-gray-400">
                  {new Date(article.scheduled_at!).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add .
git commit -m "feat: dashboard page with stats and upcoming articles"
```

---

### Task 11: 发布历史 + 设置页面

**Files:**
- Modify: `src/renderer/src/pages/History.tsx`
- Modify: `src/renderer/src/pages/Settings.tsx`

- [ ] **Step 1: 发布历史页面**

替换 `src/renderer/src/pages/History.tsx`：

```typescript
import { useEffect, useState } from 'react'
import type { PublishRecord } from '../types'

interface RecordWithTitle extends PublishRecord {
  article_title: string
}

export function History() {
  const [records, setRecords] = useState<RecordWithTitle[]>([])

  useEffect(() => {
    window.api.listRecords().then(r => setRecords(r as RecordWithTitle[]))
  }, [])

  return (
    <div className="p-6 max-w-3xl">
      <h2 className="text-xl font-bold mb-6">发布历史</h2>
      {records.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-16">暂无发布记录</p>
      ) : (
        <div className="space-y-2">
          {records.map(r => (
            <div key={r.id} className="flex items-center gap-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3">
              <span className={`text-lg`}>{r.status === 'success' ? '✅' : '❌'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{r.article_title}</p>
                <p className="text-xs text-gray-400">
                  {r.platform === 'wechat' ? '微信公众号' : '今日头条'}
                  {r.error && ` · ${r.error}`}
                </p>
              </div>
              <span className="text-xs text-gray-400 whitespace-nowrap">
                {new Date(r.published_at).toLocaleString('zh-CN')}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: 设置页面**

替换 `src/renderer/src/pages/Settings.tsx`：

```typescript
import { useEffect, useState } from 'react'

export function Settings() {
  const [claudeKey, setClaudeKey] = useState('')
  const [wechatAppId, setWechatAppId] = useState('')
  const [wechatSecret, setWechatSecret] = useState('')
  const [autoSchedule, setAutoSchedule] = useState('0 7 * * *')
  const [autoCount, setAutoCount] = useState('3')
  const [saved, setSaved] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [wechatStatus, setWechatStatus] = useState<'connected' | 'disconnected'>('disconnected')

  useEffect(() => {
    Promise.all([
      window.api.getSetting('claude_api_key'),
      window.api.getSetting('wechat_app_id'),
      window.api.getSetting('auto_schedule'),
      window.api.getSetting('auto_generate_count'),
      window.api.listPlatforms(),
    ]).then(([key, appId, schedule, count, platforms]) => {
      if (key) setClaudeKey(key)
      if (appId) setWechatAppId(appId)
      if (schedule) setAutoSchedule(schedule)
      if (count) setAutoCount(count)
      const wechat = (platforms as any[]).find(p => p.name === 'wechat')
      if (wechat?.enabled) setWechatStatus('connected')
    })
  }, [])

  async function saveGeneral() {
    await window.api.setSetting('claude_api_key', claudeKey)
    await window.api.setSetting('auto_schedule', autoSchedule)
    await window.api.setSetting('auto_generate_count', autoCount)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function connectWechat() {
    setConnecting(true)
    try {
      await window.api.connectWechat(wechatAppId, wechatSecret)
      setWechatStatus('connected')
      setWechatSecret('')
    } catch (err: any) {
      alert(`连接失败: ${err.message}`)
    } finally {
      setConnecting(false)
    }
  }

  async function disconnectWechat() {
    await window.api.disconnectPlatform('wechat')
    setWechatStatus('disconnected')
  }

  return (
    <div className="p-6 max-w-2xl space-y-8">
      <h2 className="text-xl font-bold">设置</h2>

      {/* Claude API */}
      <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
        <h3 className="font-semibold mb-4">AI 内容生成</h3>
        <label className="block mb-4">
          <span className="text-xs text-gray-500 block mb-1">Claude API Key</span>
          <input
            type="password"
            value={claudeKey}
            onChange={e => setClaudeKey(e.target.value)}
            placeholder="sk-ant-..."
            className="w-full px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <label>
            <span className="text-xs text-gray-500 block mb-1">自动生成计划 (cron)</span>
            <input
              value={autoSchedule}
              onChange={e => setAutoSchedule(e.target.value)}
              placeholder="0 7 * * *"
              className="w-full px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-xs text-gray-400 mt-1 block">示例：每天07:00 = 0 7 * * *</span>
          </label>
          <label>
            <span className="text-xs text-gray-500 block mb-1">每次生成数量（最多5）</span>
            <input
              type="number" min={1} max={5}
              value={autoCount}
              onChange={e => setAutoCount(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
        </div>
        <button
          onClick={saveGeneral}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium transition-colors"
        >
          {saved ? '已保存 ✓' : '保存'}
        </button>
      </section>

      {/* WeChat */}
      <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">微信公众号</h3>
          <span className={`text-xs px-2 py-0.5 rounded-full ` +
            (wechatStatus === 'connected'
              ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-gray-100 text-gray-500 dark:bg-gray-700')}>
            {wechatStatus === 'connected' ? '已连接' : '未连接'}
          </span>
        </div>
        {wechatStatus === 'connected' ? (
          <button onClick={disconnectWechat} className="text-sm text-red-500 hover:underline">断开连接</button>
        ) : (
          <>
            <p className="text-xs text-gray-400 mb-3">在<strong>微信公众平台</strong> → 设置 → 开发设置中获取 AppID 和 AppSecret（仅服务号支持自动发布）</p>
            <div className="space-y-3">
              <input value={wechatAppId} onChange={e => setWechatAppId(e.target.value)}
                placeholder="AppID" className="w-full px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input type="password" value={wechatSecret} onChange={e => setWechatSecret(e.target.value)}
                placeholder="AppSecret" className="w-full px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <button onClick={connectWechat} disabled={connecting || !wechatAppId || !wechatSecret}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm rounded-lg font-medium transition-colors">
                {connecting ? '连接中…' : '连接'}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "feat: history page and settings page with platform connection"
```

---

## Phase 5: Packaging

### Task 12: electron-builder 打包配置

**Files:**
- Create: `electron-builder.yml`
- Modify: `package.json`

- [ ] **Step 1: 创建打包配置**

创建 `electron-builder.yml`：

```yaml
appId: com.nostalgic.publisher
productName: 老歌发布
copyright: Copyright © 2026

mac:
  category: public.app-category.productivity
  icon: build/icon.icns
  target:
    - target: dmg
      arch: [x64, arm64]
    - target: zip
      arch: [x64, arm64]

dmg:
  title: 老歌发布
  contents:
    - x: 410
      y: 150
      type: link
      path: /Applications
    - x: 130
      y: 150
      type: file

nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true

files:
  - dist/**/*
  - "!dist/renderer/src/**/*.ts"

directories:
  output: release
  buildResources: build
```

- [ ] **Step 2: 添加 build script**

在 `package.json` 的 `scripts` 中添加：

```json
"build:mac": "npm run build && electron-builder --mac",
"build:all": "npm run build && electron-builder --mac --x64 --arm64"
```

- [ ] **Step 3: 构建验证**

```bash
npm run build
```

预期：`dist/` 目录生成，无 TypeScript 错误。

- [ ] **Step 4: 运行完整测试套件**

```bash
npx vitest run
```

预期：全部 PASS

- [ ] **Step 5: 最终 Commit**

```bash
git add .
git commit -m "feat: electron-builder packaging config for macOS"
```

---

## 自检清单

**Spec 覆盖验证：**
- [x] Claude API 内容生成（手动 + 批量）— Task 4, 6
- [x] 待审队列与编辑器 — Task 8, 9
- [x] 定时发布调度 — Task 6
- [x] 微信公众号发布 — Task 5
- [x] 今日头条发布 — Task 5
- [x] 深色/浅色/系统主题 — Task 7
- [x] 本地 SQLite 数据持久化 — Task 2
- [x] 系统通知 — Task 3, 6
- [x] 仪表盘 — Task 10
- [x] 发布历史 — Task 11
- [x] 设置页面（平台连接 + AI 参数） — Task 11
- [x] 打包为 Mac .app — Task 12

**类型一致性：**
- `Article`, `Platform`, `ApproveOptions`, `PublishResult` 均在 `types.ts` 定义，全链路使用
- `ArticleDB.approve()` 接收 `ApproveOptions`，与 IPC handler 和编辑器页面一致
- `RecordDB.findRecent()` 返回 `PublishRecord & { article_title }` 与历史页面使用一致
