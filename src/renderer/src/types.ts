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
