import { useState, useEffect } from 'react'
import Discover from './screens/Discover.jsx'
import Board from './screens/Board.jsx'

export default function App() {
  const [brief, setBrief] = useState(null)
  const [theme, setTheme] = useState(() => localStorage.getItem('ww_theme') || 'light')
  const [recents, setRecents] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ww_recents') || '[]') } catch { return [] }
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('ww_theme', theme)
  }, [theme])

  function toggleTheme() {
    setTheme(t => t === 'light' ? 'dark' : 'light')
  }

  function handleGenerate(b) {
    const entry = {
      id: Date.now(),
      brief: b,
      name: b.title ?? `${b.creativeDirection?.brand ?? 'Brief'}`,
      format: b.creativeDirection?.format ?? '16:9',
      shots: b.creativeDirection?.shots ?? b.shotList?.length ?? 0,
      duration: b.creativeDirection?.duration ?? '30s',
      brand: b.creativeDirection?.brand ?? '',
    }
    const updated = [entry, ...recents].slice(0, 8)
    setRecents(updated)
    localStorage.setItem('ww_recents', JSON.stringify(updated))
    setBrief(b)
  }

  if (brief) return <Board brief={brief} onBack={() => setBrief(null)} theme={theme} toggleTheme={toggleTheme} />

  return (
    <Discover
      onGenerate={handleGenerate}
      recents={recents}
      onOpenBrief={b => setBrief(b)}
      latestBrief={recents[0]?.brief ?? null}
      theme={theme}
      toggleTheme={toggleTheme}
    />
  )
}
