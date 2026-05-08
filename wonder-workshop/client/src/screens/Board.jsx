import { useState, useRef, useEffect } from 'react'
import AgentPanel from '../components/AgentPanel.jsx'
import SectionCard from '../components/SectionCard.jsx'
import CreativeDirection from '../components/sections/CreativeDirection.jsx'
import BrandInfo from '../components/sections/BrandInfo.jsx'
import LightingMood from '../components/sections/LightingMood.jsx'
import MoodBoard from '../components/sections/MoodBoard.jsx'
import LocationsSetDesign from '../components/sections/LocationsSetDesign.jsx'
import CharRef from '../components/sections/CharRef.jsx'
import ClothingProps from '../components/sections/ClothingProps.jsx'
import Character from '../components/sections/Character.jsx'
import Story from '../components/sections/Story.jsx'
import ShotList from '../components/sections/ShotList.jsx'

function setIn(obj, keys, value) {
  if (keys.length === 1) return { ...obj, [keys[0]]: value }
  return { ...obj, [keys[0]]: setIn(obj[keys[0]] || {}, keys.slice(1), value) }
}

const ROWS = [
  [{ id: 'cd',  num: '1',  title: 'Creative Direction' }],
  [{ id: 'bi',  num: '2',  title: 'Brand Info' }, { id: 'lm', num: '3', title: 'Lighting & Mood' }],
  [{ id: 'mb',  num: '4',  title: 'Mood Board / Style Ref' }, { id: 'loc', num: '5', title: 'Locations / Set Design' }],
  [{ id: 'cr',  num: '6',  title: 'Char Ref' }, { id: 'cp', num: '7', title: 'Clothing / Props' }],
  [{ id: 'ch',  num: '8',  title: 'Character — Full Body' }, { id: 'chu', num: '9', title: 'Character — Close Up' }],
  [{ id: 'st',  num: '10', title: 'Story' }],
  [{ id: 'sl',  num: '11', title: 'Shot List' }],
]

export default function Board({ brief: initialBrief, onBack, theme, toggleTheme }) {
  const [brief, setBrief] = useState(initialBrief)
  const [activeId, setActiveId] = useState('cd')
const [toast, setToast] = useState(null)
  const rowRefs = useRef({})
  const toastTimer = useRef(null)

  useEffect(() => {
    function onToast(e) {
      clearTimeout(toastTimer.current)
      setToast(e.detail)
      toastTimer.current = setTimeout(() => setToast(null), 3000)
    }
    window.addEventListener('ww-toast', onToast)
    return () => window.removeEventListener('ww-toast', onToast)
  }, [])

  function update(path, value) {
    setBrief(prev => setIn(prev, path.split('.'), value))
  }
  function updateShot(i, field, value) {
    setBrief(prev => ({ ...prev, shotList: prev.shotList.map((s, idx) => idx === i ? { ...s, [field]: value } : s) }))
  }
  function updateMood(i, field, value) {
    setBrief(prev => ({ ...prev, lightingMood: prev.lightingMood.map((m, idx) => idx === i ? { ...m, [field]: value } : m) }))
  }
  function updateBeat(i, field, value) {
    setBrief(prev => ({ ...prev, story: { ...prev.story, beats: (prev.story?.beats || []).map((b, idx) => idx === i ? { ...b, [field]: value } : b) } }))
  }

  function scrollToRow(rowIdx) {
    const firstId = ROWS[rowIdx][0].id
    rowRefs.current[rowIdx]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setActiveId(firstId)
  }

  const activeTitle = ROWS.flat().find(s => s.id === activeId)?.title ?? 'Brief'
  const activeRowIdx = ROWS.findIndex(row => row.some(s => s.id === activeId))

  function renderContent(id) {
    switch (id) {
      case 'cd':  return <CreativeDirection data={brief.creativeDirection} update={update} />
      case 'bi':  return <BrandInfo data={brief.brandInfo} update={update} />
      case 'lm':  return <LightingMood data={brief.lightingMood} imagePrompts={brief.imagePrompts} updateMood={updateMood} />
      case 'mb':  return <MoodBoard data={brief.creativeDirection} />
      case 'loc': return <LocationsSetDesign data={brief.environment} />
      case 'cr':  return <CharRef data={brief.character} />
      case 'cp':  return <ClothingProps data={brief.character} />
      case 'ch':  return <Character data={brief.character} update={update} mode="fullbody" />
      case 'chu': return <Character data={brief.character} update={update} mode="closeup" />
      case 'st':  return <Story data={brief.story} update={update} updateBeat={updateBeat} />
      case 'sl':  return <ShotList data={brief.shotList} updateShot={updateShot} />
      default:    return null
    }
  }

  return (
    <div className="board-screen">
      {toast && (
        <div className={`ww-toast ww-toast-${toast.type}`}>
          {toast.type === 'success'
            ? <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M2 7l4 4 6-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
            : <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M7 4v4M7 10v.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
          }
          {toast.msg}
        </div>
      )}

      <div className="topbar">
        <span className="topbar-back" onClick={onBack}>← Back</span>
        <span className="topbar-brand">WONDER WORKSHOP</span>
        <span className="topbar-sep">|</span>
        <span className="topbar-meta">{brief.creativeDirection?.brand ?? brief.title}</span>
        <button className="topbar-desc-btn">
          Description
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
        </button>
        <div className="topbar-right">
          <button className="theme-toggle-btn" onClick={toggleTheme} title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}>
            {theme === 'dark'
              ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.7"/><path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
              : <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
            }
          </button>
          <button className="btn-outline">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4"/><path d="M8 5v3.5M8 10.5v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
            Share
          </button>
          <button className="btn-dark">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M8 2v8M5 7l3 3 3-3" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/><path d="M3 13h10" stroke="#fff" strokeWidth="1.4" strokeLinecap="round"/></svg>
            Export PDF
          </button>
        </div>
      </div>


      <div className="board-body">
        <div className="board-content">
          <div className="board-scroll">
            <div className="board-cards">
              {ROWS.map((row, ri) => (
                <div
                  key={ri}
                  ref={el => rowRefs.current[ri] = el}
                  className={row.length === 1 ? 'board-full-row' : 'board-pair-row'}
                >
                  {row.map(sec => (
                    <SectionCard
                      key={sec.id}
                      num={sec.num}
                      name={sec.title}
                      active={activeId === sec.id}
                      onClick={() => setActiveId(sec.id)}
                    >
                      {renderContent(sec.id)}
                    </SectionCard>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="board-nav-dots">
            {ROWS.map((row, ri) => (
              <button
                key={ri}
                className={`board-dot${ri === activeRowIdx ? ' active' : ''}`}
                onClick={() => scrollToRow(ri)}
              />
            ))}
          </div>
        </div>

        <AgentPanel activeSection={activeTitle} brief={brief} />
      </div>
    </div>
  )
}
