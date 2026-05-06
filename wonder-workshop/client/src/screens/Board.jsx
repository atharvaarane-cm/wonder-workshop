import { useState, useRef, useCallback, useEffect } from 'react'
import AgentPanel from '../components/AgentPanel.jsx'
import FloatCard from '../components/FloatCard.jsx'
import CreativeDirection from '../components/sections/CreativeDirection.jsx'
import BrandInfo from '../components/sections/BrandInfo.jsx'
import Character from '../components/sections/Character.jsx'
import Environment from '../components/sections/Environment.jsx'
import ShotList from '../components/sections/ShotList.jsx'
import LightingMood from '../components/sections/LightingMood.jsx'

function setIn(obj, keys, value) {
  if (keys.length === 1) return { ...obj, [keys[0]]: value }
  return { ...obj, [keys[0]]: setIn(obj[keys[0]] || {}, keys.slice(1), value) }
}

const CARDS = [
  { id: 'cd',   num: '1', title: 'Creative Direction',    width: 660, pos: { x: 40,  y: 40  } },
  { id: 'bi',   num: '2', title: 'Brand Info',            width: 400, pos: { x: 730, y: 40  } },
  { id: 'ch',   num: '3', title: 'Character',             width: 500, pos: { x: 40,  y: 460 } },
  { id: 'env',  num: '4', title: 'Environment',           width: 500, pos: { x: 570, y: 460 } },
  { id: 'sl',   num: '5', title: 'Shot List',             width: 1090, pos: { x: 40, y: 860 } },
  { id: 'lm',   num: '6', title: 'Lighting & Mood',       width: 1090, pos: { x: 40, y: 1340 } },
]

export default function Board({ brief: initialBrief, onBack }) {
  const [brief, setBrief] = useState(initialBrief)
  const [positions, setPositions] = useState(() =>
    Object.fromEntries(CARDS.map(c => [c.id, c.pos]))
  )
  const [activeCard, setActiveCard] = useState('cd')
  const [zoom, setZoom] = useState(0.72)
  const [pan, setPan] = useState({ x: 80, y: 80 })
  const isPanning = useRef(false)
  const panOrigin = useRef(null)
  const viewportRef = useRef(null)

  function update(path, value) {
    setBrief(prev => setIn(prev, path.split('.'), value))
  }
  function updateShot(i, field, value) {
    setBrief(prev => ({ ...prev, shotList: prev.shotList.map((s, idx) => idx === i ? { ...s, [field]: value } : s) }))
  }
  function updateMood(i, field, value) {
    setBrief(prev => ({ ...prev, lightingMood: prev.lightingMood.map((m, idx) => idx === i ? { ...m, [field]: value } : m) }))
  }

  const onDrag = useCallback((id, newPos) => {
    setPositions(prev => ({ ...prev, [id]: newPos }))
  }, [])

  const onMouseDown = useCallback((e) => {
    if (e.target !== viewportRef.current && !e.target.classList.contains('canvas-bg')) return
    isPanning.current = true
    panOrigin.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }
    e.currentTarget.style.cursor = 'grabbing'
  }, [pan])

  const onMouseMove = useCallback((e) => {
    if (!isPanning.current) return
    setPan({ x: e.clientX - panOrigin.current.x, y: e.clientY - panOrigin.current.y })
  }, [])

  const onMouseUp = useCallback(() => {
    isPanning.current = false
    if (viewportRef.current) viewportRef.current.style.cursor = 'grab'
  }, [])

  const onWheel = useCallback((e) => {
    e.preventDefault()
    setZoom(z => Math.min(2, Math.max(0.2, z * (e.deltaY < 0 ? 1.08 : 0.93))))
  }, [])

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [onWheel])

  const activeTitle = CARDS.find(c => c.id === activeCard)?.title ?? 'Brief'

  return (
    <div className="board-screen">
      <div className="topbar">
        <span className="topbar-back" onClick={onBack}>← Back</span>
        <span className="topbar-title">{brief.title}</span>
        <span className="topbar-meta">{brief.meta}</span>
        <div className="topbar-right">
          <div className="zoom-controls">
            <button className="zoom-btn" onClick={() => setZoom(z => Math.max(0.2, +(z - 0.1).toFixed(2)))}>−</button>
            <span className="zoom-label">{Math.round(zoom * 100)}%</span>
            <button className="zoom-btn" onClick={() => setZoom(z => Math.min(2, +(z + 0.1).toFixed(2)))}>+</button>
          </div>
          <button className="btn-outline">Share</button>
          <button className="btn-dark">Export PDF</button>
        </div>
      </div>

      <div className="board-body">
        <div
          ref={viewportRef}
          className="canvas-viewport"
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          style={{ cursor: 'grab' }}
        >
          <div className="canvas-bg" />
          <div className="canvas-layer" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0' }}>

            <FloatCard {...CARDS[0]} pos={positions.cd} onDrag={onDrag} active={activeCard === 'cd'} onClick={() => setActiveCard('cd')}>
              <CreativeDirection data={brief.creativeDirection} update={update} />
            </FloatCard>

            <FloatCard {...CARDS[1]} pos={positions.bi} onDrag={onDrag} active={activeCard === 'bi'} onClick={() => setActiveCard('bi')}>
              <BrandInfo data={brief.brandInfo} update={update} />
            </FloatCard>

            <FloatCard {...CARDS[2]} pos={positions.ch} onDrag={onDrag} active={activeCard === 'ch'} onClick={() => setActiveCard('ch')}>
              <Character data={brief.character} update={update} />
            </FloatCard>

            <FloatCard {...CARDS[3]} pos={positions.env} onDrag={onDrag} active={activeCard === 'env'} onClick={() => setActiveCard('env')}>
              <Environment data={brief.environment} update={update} />
            </FloatCard>

            <FloatCard {...CARDS[4]} pos={positions.sl} onDrag={onDrag} active={activeCard === 'sl'} onClick={() => setActiveCard('sl')}>
              <ShotList data={brief.shotList} updateShot={updateShot} />
            </FloatCard>

            <FloatCard {...CARDS[5]} pos={positions.lm} onDrag={onDrag} active={activeCard === 'lm'} onClick={() => setActiveCard('lm')}>
              <LightingMood data={brief.lightingMood} imagePrompts={brief.imagePrompts} updateMood={updateMood} />
            </FloatCard>

          </div>
        </div>

        <AgentPanel activeSection={activeTitle} brief={brief} />
      </div>
    </div>
  )
}
