import { useState } from 'react'
import Discover from './screens/Discover.jsx'
import Board from './screens/Board.jsx'

export default function App() {
  const [brief, setBrief] = useState(null)

  if (!brief) return <Discover onGenerate={setBrief} />
  return <Board brief={brief} onBack={() => setBrief(null)} />
}
