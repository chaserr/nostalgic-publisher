import { useNavigate } from 'react-router-dom'
import type { Article } from '../types'

interface Props {
  article: Article
  onReject: (id: number) => void
}

export function ArticleCard({ article, onReject }: Props) {
  const navigate = useNavigate()
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{article.title}</h3>
        <span className="text-xs text-gray-400 dark:text-gray-500 ml-2 whitespace-nowrap">
          {new Date(article.created_at).toLocaleDateString('zh-CN')}
        </span>
      </div>
      <p className="text-gray-500 dark:text-gray-400 text-xs line-clamp-3 mb-3">
        {article.content}
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => navigate(`/editor/${article.id}`)}
          className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg font-medium transition-colors"
        >
          审查 →
        </button>
        <button
          onClick={() => onReject(article.id)}
          className="px-3 py-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 text-xs rounded-lg transition-colors"
        >
          拒绝
        </button>
      </div>
    </div>
  )
}
