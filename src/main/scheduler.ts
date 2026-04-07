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
    this.tasks.push(cron.schedule('* * * * *', () => this.publishDueArticles()))

    // Auto-generate on user-configured schedule
    this.scheduleAutoGenerate()
  }

  stop(): void {
    this.tasks.forEach((t) => t.stop())
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

    this.tasks.push(cron.schedule(schedule, () => this.runAutoGenerate()))
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

    const enabledPlatforms = platformDB.findAll().filter((p) => p.enabled)

    for (const article of dueArticles) {
      let anySuccess = false

      for (const p of enabledPlatforms) {
        try {
          let platform_id: string | undefined
          if (p.name === 'wechat') platform_id = await wechat.publish(article)
          if (p.name === 'toutiao') platform_id = await toutiao.publish(article)

          recordDB.create({
            article_id: article.id,
            platform: p.name as Platform,
            status: 'success',
            platform_id,
          })
          anySuccess = true
        } catch (err: any) {
          recordDB.create({
            article_id: article.id,
            platform: p.name as Platform,
            status: 'failed',
            error: err.message,
          })
          new Notification({
            title: '发布失败',
            body: `${article.title} → ${p.name}: ${err.message}`,
          }).show()
        }
      }

      if (anySuccess) {
        articleDB.markPublished(article.id)
        new Notification({ title: '发布成功', body: article.title }).show()
      }
    }
  }
}
