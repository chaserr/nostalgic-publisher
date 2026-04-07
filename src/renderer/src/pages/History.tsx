import { useEffect, useState } from 'react'
import type { PublishRecord } from '../types'

interface RecordWithTitle extends PublishRecord {
  article_title: string
}

export function History() {
  const [records, setRecords] = useState<RecordWithTitle[]>([])

  useEffect(() => {
    window.api.listRecords().then((r) => setRecords(r as RecordWithTitle[]))
  }, [])

  return (
    <div className="p-6 max-w-3xl">
      <h2 className="text-xl font-bold mb-6">发布历史</h2>
      {records.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-16">暂无发布记录</p>
      ) : (
        <div className="space-y-2">
          {records.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3"
            >
              <span className="text-lg">{r.status === 'success' ? '✅' : '❌'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                  {r.article_title}
                </p>
                <p className="text-xs text-gray-400">
                  {r.platform === 'wechat' ? '微信公众号' : '今日头条'}
                  {r.error && ` · ${r.error}`}
                </p>
              </div>
              <span className="text-xs text-gray-400 whitespace-nowrap">
                {new Date(r.published_at).toLocaleString('zh-CN')}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
