import { describe, it, expect, vi, beforeEach } from 'vitest'
import { WechatService } from '../../../src/main/services/wechat'

global.fetch = vi.fn()

const mockPlatformDB = {
  findByName: vi.fn().mockReturnValue({
    access_token: 'token-123',
    expires_at: new Date(Date.now() + 3600000).toISOString(),
    enabled: 1,
  }),
  setToken: vi.fn(),
}
const mockSettingsDB = {
  get: vi.fn().mockImplementation((key: string) =>
    key === 'wechat_app_id' ? 'appid-123' : 'secret-456'
  ),
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
      ok: true,
      json: () => Promise.resolve({ media_id: 'draft-001' }),
    } as any)
    // Mock freepublish
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ publish_id: 'pub-001' }),
    } as any)

    const article = {
      id: 1,
      title: '测试标题',
      content: '测试正文',
      song_name: '歌',
      year: 1994,
      status: 'approved',
      tags: [],
      scheduled_at: null,
      created_at: '',
      published_at: null,
    } as any
    const id = await service.publish(article)
    expect(id).toBe('pub-001')
  })
})
