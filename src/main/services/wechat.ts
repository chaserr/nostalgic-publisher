import type { PlatformDB } from '../db/platforms'
import type { SettingsDB } from '../db/settings'
import type { Article } from '../../renderer/src/types'

interface WechatToken {
  access_token: string
  expires_in: number
}

export class WechatService {
  constructor(
    private platformDB: PlatformDB,
    private settingsDB: SettingsDB
  ) {}

  async getAccessToken(appId: string, appSecret: string): Promise<WechatToken> {
    const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appId}&secret=${appSecret}`
    const res = await fetch(url)
    const data = (await res.json()) as any
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
    const draftRes = await fetch(
      `https://api.weixin.qq.com/cgi-bin/draft/add?access_token=${accessToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articles: [
            {
              title: article.title,
              content: article.content.replace(/\n/g, '<br/>'),
              author: '',
              digest: article.content.slice(0, 120),
              show_cover_pic: 0,
            },
          ],
        }),
      }
    )
    const draftData = (await draftRes.json()) as any
    if (draftData.errcode) throw new Error(`创建草稿失败: ${draftData.errmsg}`)

    // Step 2: Publish
    const pubRes = await fetch(
      `https://api.weixin.qq.com/cgi-bin/freepublish/submit?access_token=${accessToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ media_id: draftData.media_id }),
      }
    )
    const pubData = (await pubRes.json()) as any
    if (pubData.errcode) throw new Error(`发布失败: ${pubData.errmsg}`)
    return pubData.publish_id as string
  }
}
