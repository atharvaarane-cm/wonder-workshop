import { useState, useRef, useEffect, useContext } from 'react'
import AgentPanel from '../components/AgentPanel.jsx'
import SectionCard from '../components/SectionCard.jsx'
import EditableText from '../components/EditableText.jsx'
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
import GenerationLogModal from '../components/GenerationLogModal.jsx'
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

// Sections that fire image generation on a "Generate" run, in the
// order they should run. Per Ed's feedback: storyboard is intentionally
// excluded — it gets auto-fired only after the user has had a round or
// two to refine location / products / characters. Until then, the
// storyboard cards stay empty and the user hits AUTO-GENERATE on the
// Storyboard section header when they're happy with upstream. Stops
// wasting tokens on boards that get invalidated by the first edit.
const AUTO_GENERATE_ORDER = ['loc', 'cp', 'char']

// Aspect ratios the project can switch to post-creation — mirrors the
// options on the Discover screen's ratio picker.
const RATIO_OPTIONS = ['16:9', '9:16', '1:1', '4:5', '4:3', '2:1']

// Sections start collapsed when the brief has no relevant content for
// them — matches the mockup's tighter feel (empty sections show only
// the header). User can manually expand any section via the chevron.
function sectionIsEmpty(sectionId, brief) {
  if (!brief) return true
  switch (sectionId) {
    case 'cd':   return !brief.creativeDirection?.description
    case 'bi':   return !brief.brandInfo?.rules
                        && !(brief.brandInfo?.colors?.length)
                        && !brief.brandInfo?.logoUrl
                        && !brief.brandInfo?.sourceUrl
    case 'mb':   return !brief.creativeDirection?.description
    case 'loc':  return !brief.environment?.heroEnvironment && !brief.environment?.heroName
    case 'cp':   return !(brief.productElements?.length) && !brief.character?.wardrobe
    case 'char': return !brief.character?.description
                        && !brief.character?.wardrobe
                        && !brief.character?.name
    case 'sl':   return !(brief.shotList?.length)
    default:     return false
  }
}

export default function Board({ brief: initialBrief, onBack, theme, toggleTheme, onSaveBrief, readOnly = false, autoGenerateImages = false, onAutoGenerateConsumed }) {
  const [brief, setBrief] = useState(initialBrief)
  const [activeId, setActiveId] = useState('cd')
  const [activeImageTarget, setActiveImageTarget] = useState(null)
  const [loadingBySection, setLoadingBySection] = useState({})
  const [toast, setToast] = useState(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [onePagerOpen, setOnePagerOpen] = useState(false)
  const [genLogOpen, setGenLogOpen] = useState(false)
  const [ratioMenuOpen, setRatioMenuOpen] = useState(false)
  const [pendingRatio, setPendingRatio] = useState(null)
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

  // When the project was just created via "Generate" (not "Start blank"),
  // auto-fire image generation across every image-bearing section so the
  // user lands on a fully-populated board, per Ravi's "it should
  // autogenerate the images as well." Runs once per mount — Board is
  // keyed by project id in App, so each Generate is a fresh mount.
  useEffect(() => {
    if (!autoGenerateImages) return
    // Small delay so every ImageSlot has mounted and registered its
    // ww-generate-section listener before we dispatch.
    const t = setTimeout(() => {
      // Dispatch in the exact AUTO_GENERATE_ORDER, not section-display
      // order — so Location enqueues before Product, both before
      // Character, and Storyboard last (it can reference the rest).
      const byId = Object.fromEntries(ROWS.flat().map(s => [s.id, s]))
      for (const id of AUTO_GENERATE_ORDER) {
        const sec = byId[id]
        if (!sec) continue
        window.dispatchEvent(new CustomEvent('ww-generate-section', {
          detail: { sectionTitle: sec.title },
        }))
      }
      onAutoGenerateConsumed?.()
    }, 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    function onToast(e) {
      clearTimeout(toastTimer.current)
      setToast(e.detail)
      toastTimer.current = setTimeout(() => setToast(null), 3000)
    }
    window.addEventListener('ww-toast', onToast)
    return () => window.removeEventListener('ww-toast', onToast)
  }, [])

  // Close the aspect-ratio menu on any click outside it.
  useEffect(() => {
    if (!ratioMenuOpen) return
    function onDocClick(e) {
      if (e.target.closest('.prod-ratio-wrap')) return
      setRatioMenuOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [ratioMenuOpen])

  // Click outside any image slot (and not on the agent panel) deselects
  // the active image — gives users a way to undo a slot selection.
  useEffect(() => {
    function onDocClick(e) {
      if (e.target.closest('.img-slot, .agent-panel, .img-lightbox, .img-prompt-modal, .ww-confirm-modal, .genlog-modal, .topbar')) return
      setActiveImageTarget(null)
      window.dispatchEvent(new CustomEvent('ww-active-image-target', { detail: {} }))
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
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
  function makeShotId() {
    return `shot_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  }
  function addShot() {
    setBrief(prev => {
      const list = prev.shotList || []
      const newShot = {
        id: makeShotId(),
        num: String(list.length + 1).padStart(2, '0'),
        framing: 'MS', description: '', camera: 'Handheld', duration: '3s',
      }
      return { ...prev, shotList: [...list, newShot] }
    })
  }
  function removeShot(i) {
    setBrief(prev => {
      // Renumber after removal so the storyboard stays sequential (01, 02, …).
      // shot.id is the stable identity used as the React key — never touched.
      const list = (prev.shotList || [])
        .filter((_, idx) => idx !== i)
        .map((s, idx) => ({ ...s, num: String(idx + 1).padStart(2, '0') }))
      return { ...prev, shotList: list }
    })
  }
  function reorderShots(fromIdx, toIdx) {
    setBrief(prev => {
      const list = [...(prev.shotList || [])]
      if (fromIdx < 0 || fromIdx >= list.length) return prev
      if (toIdx < 0 || toIdx >= list.length) return prev
      if (fromIdx === toIdx) return prev
      const [moved] = list.splice(fromIdx, 1)
      list.splice(toIdx, 0, moved)
      // Renumber the display label (badges stay 01, 02, …) but keep
      // each shot's stable .id so ShotList's React keys don't change —
      // otherwise ImageSlot's mount-time state stays bound to the wrong
      // shot and images appear to "stick" while text reorders.
      const renumbered = list.map((s, idx) => ({ ...s, num: String(idx + 1).padStart(2, '0') }))
      return { ...prev, shotList: renumbered }
    })
  }

  // Backfill stable ids on any shots that don't have one yet. Briefs
  // created before this change (or returned by the LLM) won't have an
  // .id field, so we lazily add them once after the brief is loaded.
  useEffect(() => {
    const list = brief?.shotList
    if (!list?.length) return
    if (list.every(s => s.id)) return
    setBrief(prev => ({
      ...prev,
      shotList: prev.shotList.map(s => s.id ? s : { ...s, id: makeShotId() }),
    }))
    // Only need to react when the list identity changes — backfill is idempotent.
  }, [brief?.shotList])
  // Clear a whole entity (character / environment) back to empty. Its
  // image slots rebuild from the now-empty data, so the old generated
  // images simply stop being referenced.
  function deleteSection(path, label) {
    update(path, {})
    window.dispatchEvent(new CustomEvent('ww-toast', { detail: { type: 'success', msg: `${label} deleted` } }))
  }

  // Multi-character helpers. brief.character stays as the primary
  // character (backward compat); additional characters live in
  // brief.characters[] so existing single-character briefs keep working.
  function addCharacter() {
    setBrief(prev => ({
      ...prev,
      characters: [...(prev.characters || []), { name: '', description: '', wardrobe: '' }],
    }))
  }
  function updateCharacterAt(idx, field, value) {
    setBrief(prev => {
      const list = [...(prev.characters || [])]
      if (!list[idx]) return prev
      list[idx] = { ...list[idx], [field]: value }
      return { ...prev, characters: list }
    })
  }
  function removeCharacterAt(idx) {
    setBrief(prev => {
      const list = (prev.characters || []).filter((_, i) => i !== idx)
      return { ...prev, characters: list }
    })
  }

  // Aspect-ratio change from the Creative-section dropdown. Updates the
  // ratio immediately, then surfaces a confirmation asking whether to
  // regenerate every existing image to match the new ratio.
  function handleAspectRatioChange(newRatio) {
    update('generationSettings.ratio', newRatio)
    setPendingRatio(newRatio)
  }
  function confirmRegenerateAll() {
    window.dispatchEvent(new CustomEvent('ww-regenerate-all'))
    window.dispatchEvent(new CustomEvent('ww-toast', { detail: { type: 'success', msg: 'Regenerating all images at the new ratio…' } }))
    setPendingRatio(null)
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

  // Click on a colored @handle in the storyboard scrolls to that
  // entity's section. character → Character Design, location →
  // Locations / Set Design, product → Product / Elements.
  function jumpToHandle(handle) {
    if (!handle?.kind) return
    const idByKind = { character: 'char', location: 'loc', product: 'cp' }
    const id = idByKind[handle.kind]
    if (!id) return
    const rowIdx = ROWS.findIndex(row => row.some(s => s.id === id))
    if (rowIdx >= 0) scrollToRow(rowIdx)
  }

  const activeTitle = ROWS.flat().find(s => s.id === activeId)?.title ?? 'Brief'
  const activeChatTitle = activeImageTarget?.sectionTitle
    ? `${activeImageTarget.sectionTitle} / ${activeImageTarget.label}`
    : activeTitle
  const activeRowIdx = ROWS.findIndex(row => row.some(s => s.id === activeId))
  const imageResolution = brief.generationSettings?.resolution || '1K'

  function renderContent(id) {
    switch (id) {
      case 'cd':  return <CreativeDirection
                            data={brief.creativeDirection}
                            update={update}
                            currentRatio={brief.generationSettings?.ratio || brief.creativeDirection?.format || '16:9'}
                            onAspectRatioChange={handleAspectRatioChange}
                          />
      case 'bi':  return <BrandInfo data={brief.brandInfo} update={update} />
      case 'mb':  return <MoodBoard data={brief.creativeDirection} />
      case 'loc': return <LocationsSetDesign data={brief.environment} update={update} />
      case 'cp':   return <ClothingProps brief={brief} update={update} />
      case 'char': return <CharacterDesign
                            primaryCharacter={brief.character}
                            additionalCharacters={brief.characters || []}
                            update={update}
                            addCharacter={addCharacter}
                            updateCharacterAt={updateCharacterAt}
                            removeCharacterAt={removeCharacterAt}
                          />
      case 'sl':   return <ShotList data={brief.shotList} updateShot={updateShot} addShot={addShot} removeShot={removeShot} reorderShots={reorderShots} brief={brief} onJumpToHandle={jumpToHandle} />
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
        <button className="topbar-back" onClick={onBack}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M10 3.5l-4.5 4.5 4.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Back
        </button>

        {/* Project-name pill — click to rename / regenerate the brief
            from a new prompt. Per the Figma mockup, this is the only
            piece of identity in the topbar besides Back + Export. */}
        <div className="topbar-project-pill-wrap">
          <button
            className="topbar-project-pill"
            onClick={() => {
              setDescPrompt(brief.originalPrompt || brief.creativeDirection?.description || '')
              setDescOpen(o => !o)
            }}
          >
            <span className="topbar-project-pill-name">{brief.projectInfo?.projectName || brief.title || 'Untitled'}</span>
            <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
              <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
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

        {/* Gradient strip with W mark in the center. */}
        <div className="topbar-gradient-wrap">
          <span className="topbar-gradient" aria-hidden="true" />
          <img className="topbar-logo-mark" src="/brand-assets/wonder-w-mark-transparent.png" alt="Wonder Workshop" />
        </div>

        {/* Pink Export button + a dedicated theme toggle on the far right.
            Share / Generation log remain inside the Export dropdown. */}
        {!readOnly && (
          <div className="topbar-export-wrap">
            <button className="topbar-export-pink" onClick={() => setExportOpen(o => !o)}>
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                <path d="M5 11L11 5M5 5h6v6" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Export
            </button>
            {exportOpen && (
              <ExportDropdown
                brief={brief}
                onClose={() => setExportOpen(false)}
                onOnePager={() => setOnePagerOpen(true)}
                onShare={() => setShareOpen(true)}
                onOpenGenLog={() => setGenLogOpen(true)}
              />
            )}
          </div>
        )}
        {toggleTheme && (
          <button
            className="topbar-theme-toggle"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.7"/>
                <path d="M12 2.5v2M12 19.5v2M4.5 4.5l1.4 1.4M18.1 18.1l1.4 1.4M2.5 12h2M19.5 12h2M4.5 19.5l1.4-1.4M18.1 5.9l1.4-1.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>
        )}
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
            {/* Project info row — TITLE eyebrow + big title on the left,
                CLIENT / PROJECT label-value blocks stacked on the right.
                Mirrors the Figma mockup directly. */}
            <div className="board-info-row">
              <div className="board-info-title-block">
                <div className="board-info-eyebrow">Title</div>
                <EditableText
                  tag="h1"
                  className="board-hero-title"
                  value={brief.projectInfo?.projectName || brief.title}
                  onChange={v => update('projectInfo.projectName', v)}
                  placeholder="Untitled project"
                />
              </div>
              <div className="board-info-meta">
                <div className="board-info-meta-item">
                  <div className="board-info-eyebrow">Client</div>
                  <EditableText
                    tag="div"
                    className="board-info-meta-value"
                    value={brief.projectInfo?.clientName || ''}
                    onChange={v => update('projectInfo.clientName', v)}
                    placeholder="Client"
                  />
                </div>
                <div className="board-info-meta-item">
                  <div className="board-info-eyebrow">Project</div>
                  <EditableText
                    tag="div"
                    className="board-info-meta-value"
                    value={brief.projectInfo?.brandCampaignName || brief.projectInfo?.jobNumber || ''}
                    onChange={v => update('projectInfo.brandCampaignName', v)}
                    placeholder="Project"
                  />
                </div>
              </div>
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
                      defaultCollapsed={sectionIsEmpty(sec.id, brief)}
                      canAutoGenerate={IMAGE_SECTION_IDS.has(sec.id)}
                      onAutoGenerate={() => {
                        window.dispatchEvent(new CustomEvent('ww-generate-section', {
                          detail: { sectionTitle: sec.title },
                        }))
                      }}
                      // Per Ed: Product / Elements specifically needs a
                      // force-regen (AUTO-GENERATE only fills empties),
                      // so the user can iterate on the product images
                      // without deleting them first.
                      canRegenerate={sec.id === 'cp'}
                      onRegenerate={() => {
                        window.dispatchEvent(new CustomEvent('ww-regenerate-section', {
                          detail: { sectionTitle: sec.title },
                        }))
                      }}
                      onDelete={
                        sec.id === 'char' ? () => deleteSection('character', 'Character')
                        : sec.id === 'loc' ? () => deleteSection('environment', 'Location')
                        : undefined
                      }
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
            onClose={() => setAgentPanelOpen(false)}
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
      {genLogOpen && (
        <GenerationLogModal onClose={() => setGenLogOpen(false)} />
      )}
      {pendingRatio && (
        <div className="ww-confirm-backdrop" onClick={() => setPendingRatio(null)}>
          <div className="ww-confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="ww-confirm-eyebrow">Aspect ratio changed</div>
            <h3 className="ww-confirm-title">Regenerate all images at {pendingRatio}?</h3>
            <p className="ww-confirm-body">
              Existing images keep their original ratio and fit into the new shape by cropping.
              Regenerating remakes every image at the new {pendingRatio} dimensions.
            </p>
            <div className="ww-confirm-actions">
              <button className="ww-confirm-cancel" onClick={() => setPendingRatio(null)}>
                Keep current images
              </button>
              <button className="ww-confirm-primary" onClick={confirmRegenerateAll}>
                Regenerate all
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
