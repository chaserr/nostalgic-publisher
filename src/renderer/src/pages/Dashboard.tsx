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

  const upcoming = approved
    .filter((a) => a.scheduled_at)
    .sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime())
    .slice(0, 5)

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
        ].map(({ label, count, action }) => (
          <button
            key={label}
            onClick={action}
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-left hover:shadow-md transition-shadow"
          >
            <div className="text-3xl font-bold text-gray-800 dark:text-gray-100">{count}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">{label}</div>
          </button>
        ))}
      </div>

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3">即将发布</h3>
          <div className="space-y-2">
            {upcoming.map((article) => (
              <div
                key={article.id}
                onClick={() => navigate(`/editor/${article.id}`)}
                className="flex items-center gap-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3 cursor-pointer hover:shadow-sm transition-shadow"
              >
                <div className="w-2 h-2 bg-indigo-400 rounded-full flex-shrink-0" />
                <span className="flex-1 text-sm text-gray-800 dark:text-gray-200 truncate">
                  {article.title}
                </span>
                <span className="text-xs text-gray-400">
                  {new Date(article.scheduled_at!).toLocaleString('zh-CN', {
                    month: 'numeric',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
