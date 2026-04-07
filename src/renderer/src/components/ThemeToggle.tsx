import { useThemeStore } from '../stores/theme'
import type { ThemeMode } from '../types'

const modes: { value: ThemeMode; icon: string; label: string }[] = [
  { value: 'light', icon: '☀️', label: '亮色' },
  { value: 'system', icon: '⚡', label: '自动' },
  { value: 'dark', icon: '🌙', label: '暗色' },
]

export function ThemeToggle() {
  const { mode, setMode } = useThemeStore()
  return (
    <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
      {modes.map((m) => (
        <button
          key={m.value}
          onClick={() => setMode(m.value)}
          title={m.label}
          className={
            `flex-1 py-1 rounded text-xs transition-colors ` +
            (mode === m.value
              ? 'bg-white dark:bg-gray-700 shadow-sm'
              : 'hover:bg-gray-200 dark:hover:bg-gray-700')
          }
        >
          {m.icon}
        </button>
      ))}
    </div>
  )
}
