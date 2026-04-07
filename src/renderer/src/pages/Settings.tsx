import { useEffect, useState } from 'react'

export function Settings() {
  const [claudeKey, setClaudeKey] = useState('')
  const [wechatAppId, setWechatAppId] = useState('')
  const [wechatSecret, setWechatSecret] = useState('')
  const [autoSchedule, setAutoSchedule] = useState('0 7 * * *')
  const [autoCount, setAutoCount] = useState('3')
  const [saved, setSaved] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [wechatStatus, setWechatStatus] = useState<'connected' | 'disconnected'>('disconnected')

  useEffect(() => {
    Promise.all([
      window.api.getSetting('claude_api_key'),
      window.api.getSetting('wechat_app_id'),
      window.api.getSetting('auto_schedule'),
      window.api.getSetting('auto_generate_count'),
      window.api.listPlatforms(),
    ]).then(([key, appId, schedule, count, platforms]) => {
      if (key) setClaudeKey(key)
      if (appId) setWechatAppId(appId)
      if (schedule) setAutoSchedule(schedule)
      if (count) setAutoCount(count)
      const wechat = (platforms as any[]).find((p) => p.name === 'wechat')
      if (wechat?.enabled) setWechatStatus('connected')
    })
  }, [])

  async function saveGeneral() {
    await window.api.setSetting('claude_api_key', claudeKey)
    await window.api.setSetting('auto_schedule', autoSchedule)
    await window.api.setSetting('auto_generate_count', autoCount)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function connectWechat() {
    setConnecting(true)
    try {
      await window.api.connectWechat(wechatAppId, wechatSecret)
      setWechatStatus('connected')
      setWechatSecret('')
    } catch (err: any) {
      alert(`连接失败: ${err.message}`)
    } finally {
      setConnecting(false)
    }
  }

  async function disconnectWechat() {
    await window.api.disconnectPlatform('wechat')
    setWechatStatus('disconnected')
  }

  return (
    <div className="p-6 max-w-2xl space-y-8">
      <h2 className="text-xl font-bold">设置</h2>

      {/* Claude API */}
      <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
        <h3 className="font-semibold mb-4">AI 内容生成</h3>
        <label className="block mb-4">
          <span className="text-xs text-gray-500 block mb-1">Claude API Key</span>
          <input
            type="password"
            value={claudeKey}
            onChange={(e) => setClaudeKey(e.target.value)}
            placeholder="sk-ant-..."
            className="w-full px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <label>
            <span className="text-xs text-gray-500 block mb-1">自动生成计划 (cron)</span>
            <input
              value={autoSchedule}
              onChange={(e) => setAutoSchedule(e.target.value)}
              placeholder="0 7 * * *"
              className="w-full px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-xs text-gray-400 mt-1 block">示例：每天07:00 = 0 7 * * *</span>
          </label>
          <label>
            <span className="text-xs text-gray-500 block mb-1">每次生成数量（最多5）</span>
            <input
              type="number"
              min={1}
              max={5}
              value={autoCount}
              onChange={(e) => setAutoCount(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
        </div>
        <button
          onClick={saveGeneral}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium transition-colors"
        >
          {saved ? '已保存 ✓' : '保存'}
        </button>
      </section>

      {/* WeChat */}
      <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">微信公众号</h3>
          <span
            className={
              `text-xs px-2 py-0.5 rounded-full ` +
              (wechatStatus === 'connected'
                ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-gray-100 text-gray-500 dark:bg-gray-700')
            }
          >
            {wechatStatus === 'connected' ? '已连接' : '未连接'}
          </span>
        </div>
        {wechatStatus === 'connected' ? (
          <button onClick={disconnectWechat} className="text-sm text-red-500 hover:underline">
            断开连接
          </button>
        ) : (
          <>
            <p className="text-xs text-gray-400 mb-3">
              在<strong>微信公众平台</strong> → 设置 → 开发设置中获取 AppID 和 AppSecret
              （仅服务号支持自动发布）
            </p>
            <div className="space-y-3">
              <input
                value={wechatAppId}
                onChange={(e) => setWechatAppId(e.target.value)}
                placeholder="AppID"
                className="w-full px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="password"
                value={wechatSecret}
                onChange={(e) => setWechatSecret(e.target.value)}
                placeholder="AppSecret"
                className="w-full px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={connectWechat}
                disabled={connecting || !wechatAppId || !wechatSecret}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm rounded-lg font-medium transition-colors"
              >
                {connecting ? '连接中…' : '连接'}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
