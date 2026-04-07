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
    const data = (await res.json()) as any
    if (data.message !== 'success') throw new Error(`头条发布失败: ${data.message}`)
    return data.data?.article_id as string
  }
}
