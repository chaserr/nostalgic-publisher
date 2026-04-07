import { NavLink } from 'react-router-dom'
import { ThemeToggle } from './ThemeToggle'

const navItems = [
  { to: '/', label: '仪表盘', icon: '📊' },
  { to: '/queue', label: '待审队列', icon: '📝' },
  { to: '/history', label: '发布历史', icon: '📖' },
  { to: '/settings', label: '设置', icon: '⚙️' },
]

export function Sidebar() {
  return (
    <div className="w-48 h-full flex flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700">
      <div className="px-4 py-5">
        <h1 className="text-sm font-bold text-gray-900 dark:text-white">🎵 老歌发布</h1>
      </div>
      <nav className="flex-1 px-2">
        {navItems.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-2 rounded-lg text-sm mb-1 transition-colors ` +
              (isActive
                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800')
            }
          >
            <span>{icon}</span>
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
        <ThemeToggle />
      </div>
    </div>
  )
}
