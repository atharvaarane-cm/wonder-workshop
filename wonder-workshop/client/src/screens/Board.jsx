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
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import { ProjectContext } from '../hooks/useProject.js'

// Immutable deep-set. Preserves array-vs-object identity at every level
// (the old version spread `{ ...arr }` which converted brief.characters
// into a plain object with "0"/"1"/... keys — every later .map() call on
// it crashed with "s.map is not a function"). When walking into a missing
// intermediate, the next path segment decides: a numeric next-key creates
// an array, anything else creates an object.
function setIn(obj, keys, value) {
  const head = keys[0]
  const rest = keys.slice(1)
  if (rest.length === 0) {
    if (Array.isArray(obj)) {
      const next = obj.slice()
      next[Number(head)] = value
      return next
    }
    return { ...(obj || {}), [head]: value }
  }
  let currentChild = obj != null ? obj[head] : undefined
  if (currentChild == null) {
    const nextKeyIsNumeric = /^\d+$/.test(String(rest[0]))
    currentChild = nextKeyIsNumeric ? [] : {}
  }
  const newChild = setIn(currentChild, rest, value)
  if (Array.isArray(obj)) {
    const next = obj.slice()
    next[Number(head)] = newChild
    return next
  }
  return { ...(obj || {}), [head]: newChild }
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

// Drives the AUTO-GENERATE ↔ REGENERATE label toggle on each section's
// header button. Looks at project.images keys whose stable-ID prefix
// matches this section. Returns true the moment any slot in the section
// has at least one saved version.
function sectionHasImages(sectionId, brief) {
  const images = brief?.images
  if (!images) return false
  // Char section: only references count for the label toggle, since the
  // section button only regens references. Headshots / Full Body grids
  // have their own Populate/Repopulate buttons and don't influence this.
  const matchPrefix = {
    char: /^char\.[^.]+\.reference$/,
    loc: /^env\./,
    cp: /^product\./,
    mb: /^mood\./,
    bi: /^brand-asset:/,
    sl: /^shot[._-]/,
  }[sectionId]
  if (matchPrefix) {
    for (const key of Object.keys(images)) {
      if (!matchPrefix.test(key)) continue
      if (images[key]?.versions?.length) return true
    }
  }
  // Fallback to brief-level signals for sections without slotted images.
  if (sectionId === 'bi') return !!brief?.brandInfo?.logoUrl
  return false
}

export default function Board({ brief: initialBrief, onBack, theme, toggleTheme, onSaveBrief, readOnly = false, autoGenerateImages = false, onAutoGenerateConsumed, projectId, projectName, projectFolder, folders = [], onDeleteProject, onDuplicateProject, onRenameProject, onMoveProjectToFolder }) {
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
  // Project-menu state. Lives inside the title dropdown so Duplicate /
  // Move to folder / Rename / Delete are reachable without leaving the
  // Board screen. Delete uses ConfirmDialog because losing a project is
  // unrecoverable from this UI.
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [confirmDeleteProject, setConfirmDeleteProject] = useState(false)
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
      // Stagger section dispatches by 3s so we don't trip Gemini's per-
      // minute image quota with a burst of 8-15 simultaneous requests.
      // Each ImageSlot inside a section still fires in parallel within
      // its own section.
      AUTO_GENERATE_ORDER.forEach((id, idx) => {
        const sec = byId[id]
        if (!sec) return
        setTimeout(() => {
          // primaryOnly: in Character Design, only fire the REFERENCE
          // image so the user can review + approve the face before we
          // burn tokens generating 8 Headshots/Full Body views. User
          // hits the section's AUTO-GENERATE button when ready.
          window.dispatchEvent(new CustomEvent('ww-generate-section', {
            detail: { sectionTitle: sec.title, primaryOnly: id === 'char' },
          }))
        }, idx * 3000)
      })
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

  // Per-slot lock toggle — fired by the lock button on each image's
  // hover toolbar. brief.slotLocks[slotKey] = true|undefined.
  useEffect(() => {
    function onToggle(e) {
      const slotKey = e.detail?.slotKey
      if (!slotKey) return
      setBrief(prev => {
        const current = prev?.slotLocks || {}
        const next = { ...current }
        if (next[slotKey]) delete next[slotKey]
        else next[slotKey] = true
        return { ...prev, slotLocks: next }
      })
    }
    window.addEventListener('ww-toggle-slot-lock', onToggle)
    return () => window.removeEventListener('ww-toggle-slot-lock', onToggle)
  }, [])

  // Per-character lock toggle — fired by the lock pill in each
  // CharacterBlock header. brief.characterLocks[characterIndex] =
  // true|undefined. characterIndex is "primary" (brief.character) or a
  // numeric string ("0", "1", ...) into brief.characters.
  useEffect(() => {
    function onToggle(e) {
      const characterIndex = e.detail?.characterIndex
      if (characterIndex == null) return
      const key = String(characterIndex)
      setBrief(prev => {
        const current = prev?.characterLocks || {}
        const next = { ...current }
        if (next[key]) delete next[key]
        else next[key] = true
        return { ...prev, characterLocks: next }
      })
    }
    window.addEventListener('ww-toggle-character-lock', onToggle)
    return () => window.removeEventListener('ww-toggle-character-lock', onToggle)
  }, [])

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
  // If the primary slot is still empty (no name/description/wardrobe)
  // AND no additional characters exist, initialize the primary first
  // so the user sees one block to fill in. Otherwise append to the
  // additional list.
  function addCharacter() {
    setBrief(prev => {
      const c = prev.character || {}
      const primaryEmpty = !c.name && !c.description && !c.wardrobe
      const noAdditional = !(prev.characters || []).length
      if (primaryEmpty && noAdditional) {
        return { ...prev, character: { name: '', description: '', wardrobe: '', views: ['FRONT', '3/4', 'SIDE'] } }
      }
      return {
        ...prev,
        characters: [...(prev.characters || []), { name: '', description: '', wardrobe: '' }],
      }
    })
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

  // Mirror of the character pattern for locations. brief.environment is
  // the primary location (backward compat); additional locations live
  // in brief.environments[] so existing single-location briefs keep
  // working. Each location has heroEnvironment + heroName at minimum.
  function addLocation() {
    setBrief(prev => ({
      ...prev,
      environments: [...(prev.environments || []), { heroEnvironment: '', heroName: '' }],
    }))
  }
  function updateLocationAt(idx, field, value) {
    setBrief(prev => {
      const list = [...(prev.environments || [])]
      if (!list[idx]) return prev
      list[idx] = { ...list[idx], [field]: value }
      return { ...prev, environments: list }
    })
  }
  function removeLocationAt(idx) {
    setBrief(prev => {
      const list = (prev.environments || []).filter((_, i) => i !== idx)
      return { ...prev, environments: list }
    })
  }

  // Mood Board items — each has a stable id (for slot persistence) and
  // a free-text caption that doubles as the generation prompt seed.
  function makeMoodId() {
    return `mood_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
  }
  function addMoodItem() {
    setBrief(prev => ({
      ...prev,
      moodBoard: [...(prev.moodBoard || []), { id: makeMoodId(), caption: '' }],
    }))
  }
  function updateMoodItemAt(idx, field, value) {
    setBrief(prev => {
      const list = [...(prev.moodBoard || [])]
      if (!list[idx]) return prev
      list[idx] = { ...list[idx], [field]: value }
      return { ...prev, moodBoard: list }
    })
  }
  function removeMoodItemAt(idx) {
    setBrief(prev => {
      const list = (prev.moodBoard || []).filter((_, i) => i !== idx)
      return { ...prev, moodBoard: list }
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
  // Returns { ok, requestId, slotKey, sectionTitle, label } so the chat
  // panel can correlate the resulting ww-image-generated event back to
  // the specific message.
  function regenerateActiveImage(newPrompt, opts = {}) {
    if (!activeImageTarget?.slotKey || !newPrompt) return { ok: false }
    const requestId = `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
    window.dispatchEvent(new CustomEvent('ww-regenerate-image', {
      detail: {
        slotKey: activeImageTarget.slotKey,
        newPrompt,
        requestId,
        // Pass-through reference images attached to the chat message.
        // ImageSlot merges these with its own slot-level refs (e.g. the
        // character REFERENCE image) before sending to Gemini.
        attachedReferences: Array.isArray(opts.referenceImages) ? opts.referenceImages : [],
      },
    }))
    return {
      ok: true,
      requestId,
      slotKey: activeImageTarget.slotKey,
      sectionTitle: activeImageTarget.sectionTitle,
      label: activeImageTarget.label,
    }
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

  function renderContent(id) {
    switch (id) {
      case 'cd':  return <CreativeDirection
                            data={brief.creativeDirection}
                            update={update}
                            currentRatio={brief.generationSettings?.ratio || brief.creativeDirection?.format || '16:9'}
                            onAspectRatioChange={handleAspectRatioChange}
                          />
      case 'bi':  return <BrandInfo data={brief.brandInfo} update={update} />
      case 'mb':  return <MoodBoard
        items={brief.moodBoard || []}
        creative={brief.creativeDirection}
        addMoodItem={addMoodItem}
        updateMoodItemAt={updateMoodItemAt}
        removeMoodItemAt={removeMoodItemAt}
      />
      case 'loc': return <LocationsSetDesign
        primaryLocation={brief.environment}
        additionalLocations={brief.environments || []}
        update={update}
        addLocation={addLocation}
        updateLocationAt={updateLocationAt}
        removeLocationAt={removeLocationAt}
      />
      case 'cp':   return <ClothingProps brief={brief} update={update} />
      case 'char': return <CharacterDesign
                            primaryCharacter={brief.character}
                            additionalCharacters={brief.characters || []}
                            characterLocks={brief.characterLocks || {}}
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

        {/* Project-name pill — click to open the project menu (Rename /
            Duplicate / Move to folder / Delete). In readOnly mode (shared
            brief view) the menu is hidden so we render a flat label
            without the chevron / click affordance. */}
        <div className="topbar-project-pill-wrap">
          {(!readOnly && projectId) ? (
            <button
              className="topbar-project-pill"
              onClick={() => setDescOpen(o => !o)}
            >
              <span className="topbar-project-pill-name">{brief.projectInfo?.projectName || brief.title || 'Untitled'}</span>
              <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
                <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          ) : (
            <span className="topbar-project-pill topbar-project-pill-static">
              <span className="topbar-project-pill-name">{brief.projectInfo?.projectName || brief.title || 'Untitled'}</span>
            </span>
          )}
          {descOpen && (
            <div className="topbar-desc-dropdown" onClick={e => e.stopPropagation()}>
              {/* Project actions — Rename / Duplicate / Move / Delete.
                  Hidden in readOnly mode (shared brief view). */}
              {!readOnly && projectId && (
                <>
                  {renaming ? (
                    <div className="topbar-proj-rename">
                      <input
                        autoFocus
                        className="topbar-proj-rename-input"
                        value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            const v = renameValue.trim()
                            if (v) onRenameProject?.(projectId, v)
                            setRenaming(false)
                            setDescOpen(false)
                          }
                          if (e.key === 'Escape') { e.preventDefault(); setRenaming(false) }
                        }}
                        placeholder="Project name"
                      />
                      <button
                        className="topbar-proj-rename-save"
                        onClick={() => {
                          const v = renameValue.trim()
                          if (v) onRenameProject?.(projectId, v)
                          setRenaming(false)
                          setDescOpen(false)
                        }}
                      >Save</button>
                      <button className="topbar-proj-rename-cancel" onClick={() => setRenaming(false)}>Cancel</button>
                    </div>
                  ) : (
                    <div className="topbar-proj-menu">
                      <button
                        className="topbar-proj-menu-item"
                        onClick={() => {
                          setRenameValue(projectName || brief.projectInfo?.projectName || brief.title || '')
                          setRenaming(true)
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M11.3 2.3l2.4 2.4L5.8 12.6 3 13.4l.8-2.8 7.5-8.3z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        Rename
                      </button>
                      <button
                        className="topbar-proj-menu-item"
                        onClick={() => {
                          onDuplicateProject?.(projectId)
                          setDescOpen(false)
                          window.dispatchEvent(new CustomEvent('ww-toast', { detail: { type: 'success', msg: 'Duplicated — find the copy on your dashboard' } }))
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><rect x="4" y="4" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><path d="M3 11V3.5A1.5 1.5 0 0 1 4.5 2H11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                        Duplicate
                      </button>
                      <label className="topbar-proj-menu-item topbar-proj-menu-folder">
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M2 5.5A1.5 1.5 0 0 1 3.5 4h2.4a1.5 1.5 0 0 1 1.06.44L8 5.5h4.5A1.5 1.5 0 0 1 14 7v5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 12V5.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>
                        <span>Move to folder</span>
                        <select
                          className="topbar-proj-menu-select"
                          value={projectFolder || ''}
                          onChange={e => {
                            onMoveProjectToFolder?.(projectId, e.target.value || null)
                            setDescOpen(false)
                            window.dispatchEvent(new CustomEvent('ww-toast', { detail: { type: 'success', msg: e.target.value ? `Moved to "${e.target.value}"` : 'Removed from folder' } }))
                          }}
                        >
                          <option value="">No folder</option>
                          {folders.map(f => (
                            <option key={f.name || f} value={f.name || f}>{f.name || f}</option>
                          ))}
                        </select>
                      </label>
                      <button
                        className="topbar-proj-menu-item topbar-proj-menu-danger"
                        onClick={() => setConfirmDeleteProject(true)}
                      >
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M3 4h10M6.5 4V2.5h3V4M5 4l.5 9h5l.5-9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        Delete project…
                      </button>
                    </div>
                  )}
                </>
              )}
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
                      imageLoading={(loadingBySection[sec.title] || 0) > 0}
                      defaultCollapsed={sectionIsEmpty(sec.id, brief)}
                      canAutoGenerate={IMAGE_SECTION_IDS.has(sec.id)}
                      hasImages={sectionHasImages(sec.id, brief)}
                      onAutoGenerate={() => {
                        // Always force-regen — the listener generates empty
                        // slots and overwrites populated ones, so a single
                        // event covers both halves of the AUTO-GENERATE ↔
                        // REGENERATE label toggle. Character Design is
                        // special-cased: the section button only touches
                        // each character's REFERENCE slot. Headshots and
                        // full-body grids stay manual via per-character
                        // Populate All / Repopulate All buttons.
                        const detail = { sectionTitle: sec.title }
                        if (sec.id === 'char') detail.subgroup = 'reference'
                        window.dispatchEvent(new CustomEvent('ww-regenerate-section', { detail }))
                      }}
                      // Lock & approve — only entity / output sections.
                      // When a section is locked, AUTO-GENERATE and
                      // REGENERATE buttons disable. Storyboard's
                      // AUTO-GENERATE additionally requires every
                      // upstream entity section (loc, cp, char) to be
                      // locked first (Ed's W-01/W-02 workflow gate).
                      canLock={['bi', 'mb', 'loc', 'cp', 'char', 'sl'].includes(sec.id)}
                      locked={!!brief?.locks?.[sec.id]}
                      onToggleLock={() => {
                        update('locks', { ...(brief.locks || {}), [sec.id]: !brief?.locks?.[sec.id] })
                      }}
                      // No upstream-lock gate on storyboard auto-gen — Ed
                      // wanted it always available so he can iterate.
                      // Storyboard pulls the current state (locked or not)
                      // of all upstream sections at generation time.
                      disabledReason={null}
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
      <ConfirmDialog
        open={confirmDeleteProject}
        title="Delete this project?"
        message="The brief, all generated images, and version history will be removed. This can't be undone."
        confirmLabel="Delete project"
        onConfirm={() => {
          setConfirmDeleteProject(false)
          setDescOpen(false)
          if (projectId) onDeleteProject?.(projectId)
        }}
        onCancel={() => setConfirmDeleteProject(false)}
      />
    </div>
  )
}
