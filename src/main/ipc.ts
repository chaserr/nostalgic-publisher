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
  ipcMain.handle('articles:list', (_, status?) =>
    status ? articleDB.findByStatus(status) : articleDB.findAll()
  )
  ipcMain.handle('articles:get', (_, id: number) => articleDB.findById(id))
  ipcMain.handle('articles:update', (_, id: number, fields) => articleDB.update(id, fields))
  ipcMain.handle('articles:approve', (_, id: number, options: ApproveOptions) =>
    articleDB.approve(id, options)
  )
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

    const platforms = platformDB.findAll().filter((p) => p.enabled)
    for (const p of platforms) {
      try {
        let platform_id: string | undefined
        if (p.name === 'wechat') platform_id = await wechat.publish(article)
        if (p.name === 'toutiao') platform_id = await toutiao.publish(article)
        recordDB.create({
          article_id: id,
          platform: p.name as Platform,
          status: 'success',
          platform_id,
        })
        results.push({ platform: p.name, success: true, platform_id })
      } catch (err: any) {
        recordDB.create({
          article_id: id,
          platform: p.name as Platform,
          status: 'failed',
          error: err.message,
        })
        results.push({ platform: p.name, success: false, error: err.message })
      }
    }
    articleDB.markPublished(id)
    return results
  })

  // Platforms
  ipcMain.handle('platforms:list', () => platformDB.findAll())
  ipcMain.handle(
    'platforms:connect-wechat',
    async (_, appId: string, appSecret: string) => {
      const token = await wechat.getAccessToken(appId, appSecret)
      const expiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString()
      platformDB.setToken('wechat', token.access_token, expiresAt)
      settingsDB.set('wechat_app_id', appId)
      settingsDB.set('wechat_app_secret', appSecret)
    }
  )
  ipcMain.handle('platforms:disconnect', (_, name: Platform) => platformDB.disable(name))

  // Settings
  ipcMain.handle('settings:get', (_, key: string) => settingsDB.get(key))
  ipcMain.handle('settings:set', (_, key: string, value: string) => settingsDB.set(key, value))

  // Records
  ipcMain.handle('records:list', (_, articleId?: number) =>
    articleId ? recordDB.findByArticle(articleId) : recordDB.findRecent()
  )
}
