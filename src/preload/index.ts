import { contextBridge, ipcRenderer } from 'electron'
import type { Article, ApproveOptions, Platform } from '../renderer/src/types'

const api = {
  // Articles
  listArticles: (status?: string) => ipcRenderer.invoke('articles:list', status),
  getArticle: (id: number) => ipcRenderer.invoke('articles:get', id),
  updateArticle: (id: number, fields: Partial<Article>) =>
    ipcRenderer.invoke('articles:update', id, fields),
  approveArticle: (id: number, options: ApproveOptions) =>
    ipcRenderer.invoke('articles:approve', id, options),
  rejectArticle: (id: number) => ipcRenderer.invoke('articles:reject', id),

  // Generation
  generateArticle: (songName?: string) => ipcRenderer.invoke('generate:one', songName),
  regenerateArticle: (id: number) => ipcRenderer.invoke('generate:regenerate', id),

  // Publishing
  publishArticle: (id: number) => ipcRenderer.invoke('publish:article', id),

  // Platforms
  listPlatforms: () => ipcRenderer.invoke('platforms:list'),
  connectWechat: (appId: string, appSecret: string) =>
    ipcRenderer.invoke('platforms:connect-wechat', appId, appSecret),
  disconnectPlatform: (name: Platform) => ipcRenderer.invoke('platforms:disconnect', name),

  // Settings
  getSetting: (key: string) => ipcRenderer.invoke('settings:get', key),
  setSetting: (key: string, value: string) => ipcRenderer.invoke('settings:set', key, value),

  // Records
  listRecords: (articleId?: number) => ipcRenderer.invoke('records:list', articleId),
}

contextBridge.exposeInMainWorld('api', api)

export type ElectronAPI = typeof api
