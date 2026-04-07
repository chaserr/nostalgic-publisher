import { useEffect, useState } from 'react'
import { useArticlesStore } from '../stores/articles'
import { ArticleCard } from '../components/ArticleCard'

export function Queue() {
  const { articles, loading, fetchByStatus, generateArticle, rejectArticle } = useArticlesStore()
  const [songInput, setSongInput] = useState('')
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    fetchByStatus('pending')
  }, [])

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
            onChange={(e) => setSongInput(e.target.value)}
            placeholder="歌曲名称（可选）"
            className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 w-40"
            onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
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
        {articles.map((article) => (
          <ArticleCard key={article.id} article={article} onReject={rejectArticle} />
        ))}
      </div>
    </div>
  )
}
