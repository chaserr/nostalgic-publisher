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
    set((state) => ({ articles: state.articles.filter((a) => a.id !== id) }))
  },
}))
