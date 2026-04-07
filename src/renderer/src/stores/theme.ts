import { create } from 'zustand'
import type { ThemeMode } from '../types'

interface ThemeStore {
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
}

function applyTheme(mode: ThemeMode): void {
  const isDark =
    mode === 'dark' ||
    (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', isDark)
}

export const useThemeStore = create<ThemeStore>((set) => ({
  mode: 'system',
  setMode: async (mode) => {
    await window.api.setSetting('theme', mode)
    applyTheme(mode)
    set({ mode })
  },
}))

export async function initTheme(): Promise<void> {
  const saved = ((await window.api.getSetting('theme')) as ThemeMode) ?? 'system'
  applyTheme(saved)
  useThemeStore.setState({ mode: saved })

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (useThemeStore.getState().mode === 'system') applyTheme('system')
  })
}
