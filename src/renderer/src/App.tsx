import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Sidebar } from './components/Sidebar'
import { Dashboard } from './pages/Dashboard'
import { Queue } from './pages/Queue'
import { Editor } from './pages/Editor'
import { History } from './pages/History'
import { Settings } from './pages/Settings'
import { initTheme } from './stores/theme'

export default function App() {
  useEffect(() => {
    initTheme()
  }, [])

  return (
    <BrowserRouter>
      <div className="flex h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/queue" element={<Queue />} />
            <Route path="/editor/:id" element={<Editor />} />
            <Route path="/history" element={<History />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
