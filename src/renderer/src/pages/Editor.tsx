import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { Article, ApproveOptions, Platform } from '../types'

const PLATFORMS: { id: Platform; label: string }[] = [
  { id: 'wechat', label: '微信公众号' },
  { id: 'toutiao', label: '今日头条' },
]

export function Editor() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [article, setArticle] = useState<Article | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(['wechat', 'toutiao'])
  const [scheduleMode, setScheduleMode] = useState<'now' | 'scheduled'>('scheduled')
  const [scheduledAt, setScheduledAt] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [regenerating, setRegenerating] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!id) return
    window.api.getArticle(parseInt(id)).then((a) => {
      if (!a) return
      setArticle(a)
      setTitle(a.title)
      setContent(a.content)
      setTags(a.tags)
    })
  }, [id])

  async function handleRegenerate() {
    if (!article) return
    setRegenerating(true)
    try {
      const updated = await window.api.regenerateArticle(article.id)
      if (updated) {
        setTitle(updated.title)
        setContent(updated.content)
        setArticle(updated)
      }
    } finally {
      setRegenerating(false)
    }
  }

  async function handleApprove() {
    if (!article) return
    setSaving(true)
    try {
      await window.api.updateArticle(article.id, { title, content, tags })
      const options: ApproveOptions = {
        platforms: selectedPlatforms,
        scheduled_at: scheduleMode === 'scheduled' ? scheduledAt || null : null,
        tags,
      }
      await window.api.approveArticle(article.id, options)
      navigate('/queue')
    } finally {
      setSaving(false)
    }
  }

  async function handleReject() {
    if (!article) return
    await window.api.rejectArticle(article.id)
    navigate('/queue')
  }

  function addTag() {
    const tag = tagInput.trim()
    if (tag && !tags.includes(tag)) setTags([...tags, tag])
    setTagInput('')
  }

  if (!article) return <div className="p-6 text-gray-400">加载中…</div>

  const wordCount = content.replace(/\s/g, '').length

  return (
    <div className="flex h-full">
      {/* Left: Editor */}
      <div className="flex-1 flex flex-col border-r border-gray-200 dark:border-gray-700">
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <button
            onClick={() => navigate(-1)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-sm"
          >
            ← 返回
          </button>
          <span className="flex-1 text-sm font-medium text-gray-700 dark:text-gray-300">
            ✍️ 内容编辑
          </span>
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="px-3 py-1.5 text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 disabled:opacity-50 transition-colors"
          >
            {regenerating ? '生成中…' : '🔄 重新生成'}
          </button>
        </div>

        {/* Title */}
        <div className="px-5 pt-4 pb-2">
          <label className="text-xs text-gray-400 mb-1 block">标题</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Content */}
        <div className="px-5 flex-1 flex flex-col pb-2">
          <label className="text-xs text-gray-400 mb-1 block">正文</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="flex-1 w-full px-3 py-3 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Word count */}
        <div className="px-5 py-2 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-400">
          字数：{wordCount} 字
        </div>
      </div>

      {/* Right: Publish config */}
      <div className="w-56 flex flex-col bg-white dark:bg-gray-900">
        {/* Platforms */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3">发布平台</p>
          {PLATFORMS.map((p) => (
            <label key={p.id} className="flex items-center gap-2 mb-2 cursor-pointer">
              <div
                onClick={() =>
                  setSelectedPlatforms((prev) =>
                    prev.includes(p.id) ? prev.filter((x) => x !== p.id) : [...prev, p.id]
                  )
                }
                className={
                  `w-9 h-5 rounded-full transition-colors cursor-pointer flex items-center px-0.5 ` +
                  (selectedPlatforms.includes(p.id)
                    ? 'bg-green-500'
                    : 'bg-gray-300 dark:bg-gray-600')
                }
              >
                <div
                  className={
                    `w-4 h-4 bg-white rounded-full shadow transition-transform ` +
                    (selectedPlatforms.includes(p.id) ? 'translate-x-4' : 'translate-x-0')
                  }
                />
              </div>
              <span className="text-sm text-gray-700 dark:text-gray-300">{p.label}</span>
            </label>
          ))}
        </div>

        {/* Schedule */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3">发布时间</p>
          <div className="flex gap-1 mb-3">
            {(['scheduled', 'now'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setScheduleMode(m)}
                className={
                  `flex-1 py-1 text-xs rounded-md transition-colors ` +
                  (scheduleMode === m
                    ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 font-medium'
                    : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800')
                }
              >
                {m === 'scheduled' ? '定时' : '立即'}
              </button>
            ))}
          </div>
          {scheduleMode === 'scheduled' && (
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full px-2 py-1.5 text-xs bg-gray-100 dark:bg-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}
        </div>

        {/* Tags */}
        <div className="p-4 flex-1">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">标签</p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {tags.map((tag) => (
              <span
                key={tag}
                onClick={() => setTags(tags.filter((t) => t !== tag))}
                className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-xs rounded-full cursor-pointer hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 transition-colors"
              >
                {tag} ×
              </span>
            ))}
          </div>
          <div className="flex gap-1">
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTag()}
              placeholder="添加标签"
              className="flex-1 px-2 py-1 text-xs bg-gray-100 dark:bg-gray-800 rounded-lg focus:outline-none min-w-0"
            />
            <button onClick={addTag} className="px-2 text-xs text-gray-400 hover:text-gray-600">
              +
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex flex-col gap-2">
          <button
            onClick={handleApprove}
            disabled={saving || selectedPlatforms.length === 0}
            className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {saving ? '保存中…' : '✓ 通过并排期'}
          </button>
          <button
            onClick={handleReject}
            className="w-full py-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm rounded-lg transition-colors"
          >
            ✕ 拒绝
          </button>
        </div>
      </div>
    </div>
  )
}
