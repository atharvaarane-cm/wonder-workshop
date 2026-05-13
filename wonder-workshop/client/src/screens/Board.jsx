import { useState, useRef, useEffect, useContext } from 'react'
import AgentPanel from '../components/AgentPanel.jsx'
import SectionCard from '../components/SectionCard.jsx'
import CreativeDirection from '../components/sections/CreativeDirection.jsx'
import BrandInfo from '../components/sections/BrandInfo.jsx'
import MoodBoard from '../components/sections/MoodBoard.jsx'
import LocationsSetDesign from '../components/sections/LocationsSetDesign.jsx'
import CharacterDesign from '../components/sections/CharacterDesign.jsx'
import ClothingProps from '../components/sections/ClothingProps.jsx'
import ShotList from '../components/sections/ShotList.jsx'
import ShareModal from '../components/ShareModal.jsx'
import ExportDropdown from '../components/ExportDropdown.jsx'
import OnePager from '../components/OnePager.jsx'
import { ProjectContext } from '../hooks/useProject.js'
import { generateBrief } from '../hooks/useBrief.js'

function setIn(obj, keys, value) {
  if (keys.length === 1) return { ...obj, [keys[0]]: value }
  return { ...obj, [keys[0]]: setIn(obj[keys[0]] || {}, keys.slice(1), value) }
}

const ROWS = [
  [{ id: 'cd',  title: 'Creative Direction' }],
  [{ id: 'bi',  title: 'Brand Info' }],
  [{ id: 'mb',  title: 'Mood Board / Style References' }],
  [{ id: 'loc', title: 'Locations / Set Design' }],
  [{ id: 'cp',  title: 'Product / Elements' }],
  [{ id: 'char', title: 'Character Design' }],
  [{ id: 'sl',  title: 'Storyboard' }],
]

const IMAGE_SECTION_IDS = new Set(['cd', 'bi', 'mb', 'loc', 'cp', 'char', 'sl'])

export default function Board({ brief: initialBrief, onBack, theme, toggleTheme, onSaveBrief, readOnly = false }) {
  const [brief, setBrief] = useState(initialBrief)
  const [activeId, setActiveId] = useState('cd')
  const [activeImageTarget, setActiveImageTarget] = useState(null)
  const [loadingBySection, setLoadingBySection] = useState({})
  const [toast, setToast] = useState(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [onePagerOpen, setOnePagerOpen] = useState(false)
  const [agentPanelOpen, setAgentPanelOpen] = useState(true)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [descOpen, setDescOpen] = useState(false)
  const [descPrompt, setDescPrompt] = useState('')
  const [descRegenerating, setDescRegenerating] = useState(false)
  const project = useContext(ProjectContext)
  const rowRefs = useRef({})
  const scrollContainerRef = useRef(null)
  const isProgrammaticScroll = useRef(false)
  const toastTimer = useRef(null)
  const saveBriefRef = useRef(onSaveBrief)
  saveBriefRef.current = onSaveBrief
  const isInitialBrief = useRef(true)

  // Debounced auto-save of brief edits.
  useEffect(() => {
    if (isInitialBrief.current) { isInitialBrief.current = false; return }
    const t = setTimeout(() => saveBriefRef.current?.(brief), 400)
    return () => clearTimeout(t)
  }, [brief])

  useEffect(() => {
    function onToast(e) {
      clearTimeout(toastTimer.current)
      setToast(e.detail)
      toastTimer.current = setTimeout(() => setToast(null), 3000)
    }
    window.addEventListener('ww-toast', onToast)
    return () => window.removeEventListener('ww-toast', onToast)
  }, [])

  useEffect(() => {
    function onActiveImage(e) {
      const target = e.detail
      if (!target?.label) return
      setActiveImageTarget(target)
      const match = ROWS.flat().find(section => section.title === target.sectionTitle)
      if (match) setActiveId(match.id)
    }
    window.addEventListener('ww-active-image-target', onActiveImage)
    return () => window.removeEventListener('ww-active-image-target', onActiveImage)
  }, [])

  // Track how many ImageSlots in each section are currently generating, so
  // section cards can flip their status dot to amber while work is in flight.
  useEffect(() => {
    function onLoadingChange(e) {
      const { sectionTitle, delta } = e.detail || {}
      if (!sectionTitle || !delta) return
      setLoadingBySection(prev => {
        const next = Math.max(0, (prev[sectionTitle] || 0) + delta)
        return { ...prev, [sectionTitle]: next }
      })
    }
    window.addEventListener('ww-loading-change', onLoadingChange)
    return () => window.removeEventListener('ww-loading-change', onLoadingChange)
  }, [])

  function update(path, value) {
    setBrief(prev => setIn(prev, path.split('.'), value))
  }
  function updateShot(i, field, value) {
    setBrief(prev => ({ ...prev, shotList: prev.shotList.map((s, idx) => idx === i ? { ...s, [field]: value } : s) }))
  }

  // Chat-driven regeneration: AgentPanel calls this when the model returns
  // a regenerate_active_image function call. We just rebroadcast as a
  // window event that the targeted ImageSlot is already listening for.
  function regenerateActiveImage(newPrompt) {
    if (!activeImageTarget?.slotKey || !newPrompt) return false
    window.dispatchEvent(new CustomEvent('ww-regenerate-image', {
      detail: { slotKey: activeImageTarget.slotKey, newPrompt },
    }))
    return true
  }

  // Sync nav dots to scroll position
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return
    function handleScroll() {
      if (isProgrammaticScroll.current) return
      const containerTop = container.getBoundingClientRect().top
      let closestIdx = 0
      let closestDist = Infinity
      Object.entries(rowRefs.current).forEach(([idx, el]) => {
        if (!el) return
        const dist = Math.abs(el.getBoundingClientRect().top - containerTop)
        if (dist < closestDist) { closestDist = dist; closestIdx = parseInt(idx) }
      })
      setActiveId(ROWS[closestIdx][0].id)
    }
    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => container.removeEventListener('scroll', handleScroll)
  }, [])

  function scrollToRow(rowIdx) {
    isProgrammaticScroll.current = true
    rowRefs.current[rowIdx]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setActiveId(ROWS[rowIdx][0].id)
    setTimeout(() => { isProgrammaticScroll.current = false }, 700)
  }

  const activeTitle = ROWS.flat().find(s => s.id === activeId)?.title ?? 'Brief'
  const activeChatTitle = activeImageTarget?.sectionTitle
    ? `${activeImageTarget.sectionTitle} / ${activeImageTarget.label}`
    : activeTitle
  const activeRowIdx = ROWS.findIndex(row => row.some(s => s.id === activeId))
  const imageResolution = brief.generationSettings?.resolution || '1K'

  function renderContent(id) {
    switch (id) {
      case 'cd':  return <CreativeDirection data={brief.creativeDirection} update={update} onGoToShotList={() => scrollToRow(6)} />
      case 'bi':  return <BrandInfo data={brief.brandInfo} update={update} />
      case 'mb':  return <MoodBoard data={brief.creativeDirection} />
      case 'loc': return <LocationsSetDesign data={brief.environment} />
      case 'cp':   return <ClothingProps data={brief.character} />
      case 'char': return <CharacterDesign data={brief.character} update={update} />
      case 'sl':   return <ShotList data={brief.shotList} updateShot={updateShot} />
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

      {readOnly && (
        <div className="readonly-banner">
          <span>Viewing a shared brief — read only</span>
          <button className="readonly-copy-btn" onClick={() => {
            const p = { id: `proj_${Date.now()}`, brief, images: project?.images || {}, createdAt: new Date().toISOString() }
            try {
              const all = JSON.parse(localStorage.getItem('ww_projects') || '[]')
              all.unshift(p)
              localStorage.setItem('ww_projects', JSON.stringify(all))
              window.location.hash = ''
              window.location.reload()
            } catch { alert('Could not save copy') }
          }}>
            Make a copy
          </button>
        </div>
      )}

      <div className="topbar">
        <span className="topbar-back" onClick={onBack}>← Back</span>
        <span className="topbar-brand">WONDER WORKSHOP</span>
        <span className="topbar-sep">|</span>
        <span className="topbar-meta">{brief.creativeDirection?.brand ?? brief.title}</span>
        <div style={{ position: 'relative' }}>
          <button className="topbar-desc-btn" onClick={() => {
            setDescPrompt(brief.originalPrompt || brief.creativeDirection?.description || '')
            setDescOpen(o => !o)
          }}>
            Description
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          </button>
          {descOpen && (
            <div className="topbar-desc-dropdown" onClick={e => e.stopPropagation()}>
              <div className="topbar-desc-label">Original prompt</div>
              <textarea
                className="topbar-desc-textarea"
                value={descPrompt}
                onChange={e => setDescPrompt(e.target.value)}
                rows={4}
                placeholder="Describe the shoot…"
              />
              {brief.creativeDirection?.format && (
                <div className="topbar-desc-meta">{brief.creativeDirection.format} · {brief.creativeDirection.shots} shots · {brief.creativeDirection.location}</div>
              )}
              <div className="topbar-desc-actions">
                <button className="topbar-desc-cancel" onClick={() => setDescOpen(false)}>Cancel</button>
                <button
                  className="topbar-desc-regen"
                  disabled={descRegenerating || !descPrompt.trim()}
                  onClick={async () => {
                    setDescRegenerating(true)
                    try {
                      const newBrief = await generateBrief(descPrompt.trim())
                      setBrief(newBrief)
                      onSaveBrief?.(newBrief)
                      setDescOpen(false)
                      window.dispatchEvent(new CustomEvent('ww-toast', { detail: { type: 'success', msg: 'Brief regenerated' } }))
                    } catch {
                      window.dispatchEvent(new CustomEvent('ww-toast', { detail: { type: 'error', msg: 'Regeneration failed' } }))
                    } finally {
                      setDescRegenerating(false)
                    }
                  }}
                >
                  {descRegenerating ? 'Regenerating…' : 'Regenerate brief'}
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="topbar-right">
          <button className="topbar-icon-btn" onClick={() => setAgentPanelOpen(o => !o)} title={agentPanelOpen ? 'Hide panel' : 'Show panel'}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M10.5 2.5v11" stroke="currentColor" strokeWidth="1.3"/>
            </svg>
          </button>
          <button className="topbar-icon-btn" onClick={() => setSearchOpen(o => !o)} title="Search sections">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
              <circle cx="6.5" cy="6.5" r="4" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M10 10l3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          </button>
          <div className="topbar-sep-v" />
          <button className="theme-toggle-btn" onClick={toggleTheme} title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}>
            {theme === 'dark'
              ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.7"/><path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
              : <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
            }
          </button>
          {!readOnly && (
            <button className="btn-outline" onClick={() => setShareOpen(true)}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><circle cx="12" cy="3" r="1.5" stroke="currentColor" strokeWidth="1.3"/><circle cx="12" cy="13" r="1.5" stroke="currentColor" strokeWidth="1.3"/><circle cx="4" cy="8" r="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M10.5 3.8L5.5 7.2M5.5 8.8l5 3.4" stroke="currentColor" strokeWidth="1.3"/></svg>
              Share
            </button>
          )}
          <div style={{ position: 'relative' }}>
            <button className="btn-dark" onClick={() => setExportOpen(o => !o)}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M8 2v8M5 7l3 3 3-3" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/><path d="M3 13h10" stroke="#fff" strokeWidth="1.4" strokeLinecap="round"/></svg>
              Export
              <svg width="9" height="9" viewBox="0 0 10 10" fill="none" style={{ marginLeft: 2 }}><path d="M2 3.5l3 3 3-3" stroke="#fff" strokeWidth="1.3" strokeLinecap="round"/></svg>
            </button>
            {exportOpen && (
              <ExportDropdown
                brief={brief}
                onClose={() => setExportOpen(false)}
                onOnePager={() => setOnePagerOpen(true)}
              />
            )}
          </div>
        </div>
      </div>


      {searchOpen && (
        <div className="search-overlay" onClick={() => { setSearchOpen(false); setSearchQuery('') }}>
          <div className="search-modal" onClick={e => e.stopPropagation()}>
            <div className="search-input-row">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="6.5" cy="6.5" r="4" stroke="currentColor" strokeWidth="1.3"/><path d="M10 10l3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
              <input
                autoFocus
                className="search-input"
                placeholder="Jump to section…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Escape') { setSearchOpen(false); setSearchQuery('') } }}
              />
            </div>
            <div className="search-results">
              {ROWS.flat()
                .filter(s => !searchQuery || s.title.toLowerCase().includes(searchQuery.toLowerCase()))
                .map(s => {
                  const ri = ROWS.findIndex(row => row.some(r => r.id === s.id))
                  return (
                    <button key={s.id} className="search-result-item" onClick={() => { scrollToRow(ri); setSearchOpen(false); setSearchQuery('') }}>
                      <span className="search-result-num">{s.num}</span>
                      <span className="search-result-title">{s.title}</span>
                    </button>
                  )
                })}
            </div>
          </div>
        </div>
      )}

      <div className="board-body">
        <div className="board-content">
          <div className="board-scroll" ref={scrollContainerRef}>
            <div className="project-info-panel">
              {[
                ['projectName', 'Project Name'],
                ['jobNumber', 'Job Number'],
                ['clientName', 'Client Name'],
                ['brandCampaignName', 'Brand / Campaign Name'],
              ].map(([key, label]) => (
                <label className="project-info-field" key={key}>
                  <span>{label}</span>
                  <input
                    value={brief.projectInfo?.[key] || ''}
                    onChange={e => update(`projectInfo.${key}`, e.target.value)}
                    placeholder={label}
                  />
                </label>
              ))}
            </div>
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
                      name={sec.title}
                      active={activeId === sec.id}
                      imageResolution={IMAGE_SECTION_IDS.has(sec.id) ? imageResolution : null}
                      imageLoading={(loadingBySection[sec.title] || 0) > 0}
                      onClick={() => {
                        // Tracking the active section for nav purposes doesn't
                        // require clearing the active image — that would steal
                        // the chat's focus every time the user clicked an empty
                        // part of the section card. The active image only
                        // changes when a *different* image is clicked.
                        setActiveId(sec.id)
                      }}
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

        {!readOnly && agentPanelOpen && (
          <AgentPanel
            activeSection={activeChatTitle}
            activeImageTarget={activeImageTarget}
            brief={brief}
            onUpdate={update}
            onRegenerateImage={regenerateActiveImage}
          />
        )}
      </div>

      {shareOpen && (
        <ShareModal
          brief={brief}
          images={project?.images}
          onClose={() => setShareOpen(false)}
        />
      )}
      {onePagerOpen && (
        <OnePager brief={brief} images={project?.images || {}} onClose={() => setOnePagerOpen(false)} />
      )}
    </div>
  )
}
