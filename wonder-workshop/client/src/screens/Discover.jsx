import { useState, useRef, useEffect } from 'react'
import { generateBrief, chatWithTools } from '../hooks/useBrief.js'
import { extractFileText } from '../utils/extractFileText.js'

const QUICK_START_PROMPTS = [
  {
    id: 'fashion-shoot',
    label: 'Fashion Shoot',
    prompt: 'Fashion shoot for a modern editorial campaign with bold styling, expressive talent direction, cinematic lighting, and a polished shot list.',
  },
  {
    id: 'product-ad',
    label: 'Product Ad',
    prompt: 'Product ad campaign with premium hero product imagery, lifestyle cutaways, tactile details, and clean brand-forward compositions.',
  },
  {
    id: 'lifestyle-campaign',
    label: 'Lifestyle Campaign',
    prompt: 'Lifestyle campaign with natural performances, warm environments, authentic brand moments, and a flexible mix of stills and video shots.',
  },
  {
    id: 'social-launch',
    label: 'Social Launch',
    prompt: 'Social launch package with scroll-stopping opening frames, vertical cutdowns, creator-style details, and modular image prompts.',
  },
]

const RATIOS = [
  { id: '16:9',   label: '16 : 9', sub: 'Widescreen',   w: 34, h: 20 },
  { id: '9:16',   label: '9 : 16', sub: 'Portrait',     w: 18, h: 30 },
  { id: '1:1',    label: '1 : 1',  sub: 'Square',       w: 26, h: 26 },
  { id: '4:5',    label: '4 : 5',  sub: 'Portrait 4:5', w: 22, h: 28 },
  { id: '4:3',    label: '4 : 3',  sub: 'Classic',      w: 30, h: 22 },
  { id: '2:1',    label: '2 : 1',  sub: 'Anamorphic',   w: 34, h: 17 },
]

const RESOLUTIONS = ['1K', '2K', '4K']

const NAV_ITEMS = [
  { id: 'home',        label: 'Home',       icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 12L12 4l9 8v8a1 1 0 01-1 1H5a1 1 0 01-1-1v-8z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/><path d="M9 21V12h6v9" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg> },
  { id: 'projects',    label: 'Projects',   icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6"/><path d="M3 9h18" stroke="currentColor" strokeWidth="1.6"/></svg> },
  { id: 'inspiration', label: 'Inspiration',icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M9 21h6M12 21v-3M12 4v1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/><path d="M9 18h6a5 5 0 10-6 0z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg> },
]

const INSPIRATION_ITEMS = [
  { title: 'Golden Hour Campaign',   tags: ['Lifestyle','Warm'],       prompt: 'Golden hour lifestyle campaign, warm amber light, outdoor locations, natural performances, cinematic depth of field, rich textures' },
  { title: 'Dark Studio Editorial',  tags: ['Fashion','Editorial'],    prompt: 'High fashion dark studio editorial, dramatic chiaroscuro lighting, bold wardrobe, expressive poses, medium format aesthetic' },
  { title: 'Urban Street Story',     tags: ['Street','Documentary'],   prompt: 'Urban street photography campaign, candid moments, city textures, dynamic compositions, authentic talent, natural light' },
  { title: 'Product Hero Shots',     tags: ['Product','Luxury'],       prompt: 'Luxury product hero campaign, macro detail shots, premium materials, controlled studio lighting, clean backgrounds, tactile focus' },
  { title: 'Athlete in Motion',      tags: ['Sport','Dynamic'],        prompt: 'Athletic performance campaign, high-speed action, motion blur, powerful compositions, outdoor stadium, peak performance moments' },
  { title: 'Minimalist Beauty',      tags: ['Beauty','Clean'],         prompt: 'Minimalist beauty campaign, soft diffused light, clean white environments, close-up skin textures, serene expressions, editorial precision' },
  { title: 'Neon Night City',        tags: ['Night','Moody'],          prompt: 'Neon-lit night city campaign, wet reflections, bold colour contrast, mysterious atmosphere, street-level angles, cinematic noir mood' },
  { title: 'Nature & Wellness',      tags: ['Wellness','Organic'],     prompt: 'Nature wellness campaign, lush green environments, soft morning light, breathable fabrics, meditative atmosphere, earthy tones' },
  { title: 'Social Vertical Launch', tags: ['Social','Vertical'],      prompt: 'Social media vertical launch campaign, scroll-stopping hero frames, creator-style lighting, bold typography moments, 9:16 ratio, energetic pacing' },
]

const CARD_GRADIENTS = [
  'linear-gradient(135deg,#1a1a2e,#0f3460)',
  'linear-gradient(135deg,#1a0a0a,#4a1515)',
  'linear-gradient(135deg,#0a1a0a,#1a3a1a)',
  'linear-gradient(135deg,#1a1a1a,#3a3a0a)',
  'linear-gradient(135deg,#1a0a2e,#4a1580)',
  'linear-gradient(135deg,#0a1a2e,#1a4060)',
]

export default function Discover({ onGenerate, onStartBlank, projects = [], folders: folderList = [], onOpenProject, onDeleteProject, onRenameProject, onMoveProjectToFolder, onDuplicateProject, onCreateFolder, onDeleteFolder, onRenameFolder, theme, toggleTheme }) {
  const [activePage, setActivePage] = useState('home')
  // Drilled-in folder name (string) or null for the folder list view.
  // Reset to null whenever the user navigates away from the Projects page
  // so coming back lands on the folder grid rather than the last folder.
  const [viewingFolder, setViewingFolder] = useState(null)
  // Inline "New folder" creation states.
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  // Rename target for folder headers.
  const [renamingFolder, setRenamingFolder] = useState(null)
  const [folderRenameValue, setFolderRenameValue] = useState('')
  // Per-card move-to-folder popover { projectId, anchorRect }
  const [movePopover, setMovePopover] = useState(null)
  // Folder tile receiving a drag-over highlight.
  const [dragOverFolder, setDragOverFolder] = useState(null)
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const [sidebarExpanded, setSidebarExpanded] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(220)
  const [discoverSearch, setDiscoverSearch] = useState('')
  const [discoverSearchOpen, setDiscoverSearchOpen] = useState(false)
  const isDragging = useRef(false)
  const dragStartX = useRef(0)
  const dragStartWidth = useRef(220)
  const sidebarRef = useRef(null)
  const [renamingId, setRenamingId] = useState(null)
  const [menuOpenId, setMenuOpenId] = useState(null)
  const [collapsedFolders, setCollapsedFolders] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('ww_collapsed_folders') || '[]')) } catch { return new Set() }
  })

  function toggleFolder(name) {
    setCollapsedFolders(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name); else next.add(name)
      try { localStorage.setItem('ww_collapsed_folders', JSON.stringify([...next])) } catch {}
      return next
    })
  }

  // Group projects by folder. Projects without a folder land in 'Projects'.
  // Folder order is "Projects" first, then alphabetical for any custom ones.
  const folders = (() => {
    const buckets = new Map()
    for (const p of projects) {
      const folder = p.folder || 'Projects'
      if (!buckets.has(folder)) buckets.set(folder, [])
      buckets.get(folder).push(p)
    }
    const entries = [...buckets.entries()]
    entries.sort((a, b) => {
      if (a[0] === 'Projects') return -1
      if (b[0] === 'Projects') return 1
      return a[0].localeCompare(b[0])
    })
    return entries
  })()

  // Close any open action menu when the user clicks outside the sidebar.
  useEffect(() => {
    if (menuOpenId == null) return
    function onDocClick(e) {
      if (!e.target.closest('.sidebar-recent-menu') && !e.target.closest('.sidebar-recent-more')) {
        setMenuOpenId(null)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [menuOpenId])

  // Open the move-to-folder popover anchored to the triggering button.
  // Replaces the old window.prompt — lets users pick from existing folders
  // or create a new one inline.
  function openMovePopover(p, event) {
    setMenuOpenId(null)
    const target = event?.currentTarget || event?.target
    const rect = target?.getBoundingClientRect?.() || { left: 0, top: 0, bottom: 0, right: 0 }
    setMovePopover({
      projectId: p.id,
      currentFolder: p.folder || null,
      anchor: { left: rect.left, top: rect.bottom + 6, right: rect.right },
    })
  }
  function closeMovePopover() { setMovePopover(null); setNewFolderName('') }

  function commitNewFolder() {
    const cleaned = (newFolderName || '').trim()
    if (!cleaned) { setCreatingFolder(false); setNewFolderName(''); return }
    onCreateFolder?.(cleaned)
    setCreatingFolder(false)
    setNewFolderName('')
  }
  function commitFolderRename() {
    const from = renamingFolder
    const to = (folderRenameValue || '').trim()
    if (from && to && from !== to) onRenameFolder?.(from, to)
    setRenamingFolder(null)
    setFolderRenameValue('')
  }
  function handleDeleteFolder(name) {
    if (!window.confirm(`Delete folder "${name}"? Projects inside will move to Unfiled.`)) return
    onDeleteFolder?.(name)
    if (viewingFolder === name) setViewingFolder(null)
  }

  // Close the move popover on outside click / escape.
  useEffect(() => {
    if (!movePopover) return
    function onDocClick(e) {
      if (!e.target.closest('.move-popover')) closeMovePopover()
    }
    function onKey(e) { if (e.key === 'Escape') closeMovePopover() }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [movePopover])

  function onDragHandleMouseDown(e) {
    e.preventDefault()
    isDragging.current = true
    dragStartX.current = e.clientX
    dragStartWidth.current = sidebarWidth
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    function onMouseMove(e) {
      if (!isDragging.current) return
      const delta = e.clientX - dragStartX.current
      const next = Math.min(380, Math.max(180, dragStartWidth.current + delta))
      setSidebarWidth(next)
      setSidebarExpanded(next > 160)
    }
    function onMouseUp() {
      isDragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }
  const [renameValue, setRenameValue] = useState('')
  const renameInputRef = useRef(null)

  useEffect(() => {
    if (renamingId != null) renameInputRef.current?.select()
  }, [renamingId])

  function startRename(p, e) {
    e?.stopPropagation()
    setRenamingId(p.id)
    setRenameValue(p.name || '')
  }
  function commitRename() {
    if (renamingId == null) return
    onRenameProject?.(renamingId, renameValue)
    setRenamingId(null)
  }
  function cancelRename() {
    setRenamingId(null)
  }

  const [prompt, setPrompt]         = useState('')
  const [loading, setLoading]       = useState(false)
  const [improving, setImproving]   = useState(false)
  const [error, setError]           = useState(null)
  const [ratio, setRatio]           = useState('16:9')
  const [resolution, setResolution] = useState('1K')
  const [ratioOpen, setRatioOpen]   = useState(false)
  const [resolutionOpen, setResolutionOpen] = useState(false)
  const [quickStart, setQuickStart] = useState(null)
  const [inputFocused, setInputFocused] = useState(false)
  // Attached files (treatments, briefs, scripts) whose text gets folded
  // into the brief-generation prompt as extra context.
  const [attachments, setAttachments] = useState([])
  const [attaching, setAttaching] = useState(false)
  const textRef = useRef(null)
  const ratioRef = useRef(null)
  const resolutionRef = useRef(null)
  const inputCardRef = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (ratioRef.current && !ratioRef.current.contains(e.target)) setRatioOpen(false)
      if (resolutionRef.current && !resolutionRef.current.contains(e.target)) setResolutionOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Keep the textarea grown to fit its content whenever the prompt
  // changes (Improve-with-AI rewrites, quick-start chips, etc.).
  useEffect(() => {
    const el = textRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 480) + 'px'
  }, [prompt])

  // Read each picked file, extract its text, and add to attachments. Skips
  // anything we can't read and surfaces a friendly error inline.
  async function handleAttachFiles(files) {
    const list = Array.from(files || []).filter(Boolean)
    if (!list.length) return
    setAttaching(true); setError(null)
    const next = []
    for (const file of list) {
      try {
        const content = await extractFileText(file)
        next.push({ name: file.name, size: file.size, content, addedAt: Date.now() })
      } catch (e) {
        setError(`Couldn't read "${file.name}": ${e?.message || e}`)
      }
    }
    if (next.length) setAttachments(prev => [...prev, ...next])
    setAttaching(false)
  }
  function removeAttachment(idx) {
    setAttachments(prev => prev.filter((_, i) => i !== idx))
  }
  function openFilePicker() {
    fileInputRef.current?.click()
  }

  async function handleSend() {
    const text = prompt.trim()
    if (!text || loading) return
    setLoading(true); setError(null)
    try {
      // Fold attachment contents into the user prompt as extra context.
      // Each file is bracketed so the model knows where one ends and the
      // next begins. Caps individual files at ~20k chars so a huge PDF
      // doesn't blow out the token budget.
      const attachmentBlock = attachments.length
        ? '\n\n=== Attached files (use as context for the brief) ===\n' +
          attachments.map(a => `--- ${a.name} ---\n${(a.content || '').slice(0, 20000)}`).join('\n\n') +
          '\n=== End attached files ===\n'
        : ''
      const full = `${text}${attachmentBlock} (aspect ratio: ${ratio}) (resolution: ${resolution})${quickStart ? ` (quick start: ${quickStart})` : ''}`
      const brief = await generateBrief(full)
      onGenerate({
        ...brief,
        generationSettings: {
          ...(brief.generationSettings || {}),
          ratio,
          resolution,
        },
      })
    } catch (e) {
      const msg = e?.message || String(e)
      setError(/\b429\b/.test(msg)
        ? 'Gemini rate limit hit (5 requests / min). Wait ~60 seconds and click Generate again — your prompt is preserved.'
        : msg)
      setLoading(false)
    }
  }

  // Expand the user's rough idea into a richer creative brief covering
  // location, mood, key elements, and characters. Mirrors the modal
  // "Improve with AI" pattern in ImageSlot.jsx — same /api/chat path,
  // different system prompt tuned for a discovery-phase brief.
  async function improvePrompt() {
    const text = prompt.trim()
    if (!text || improving || loading) return
    setImproving(true); setError(null)
    try {
      const messages = [
        { role: 'system', content: [
          'You are a senior creative director EXPANDING a rough idea into a detailed campaign brief.',
          'Your output MUST be LONGER and MORE SPECIFIC than the input — never a summary, never a paraphrase.',
          '',
          'PRESERVE EVERYTHING from the input — every character, every prop, every action, every brand name must appear in the output. Then ADD concrete sensory detail on each of:',
          '',
          '- LOCATION: exact setting, time of day, weather, era. Name the kind of architecture, street furniture, vegetation, signage.',
          '- MOOD: lighting setup (key, fill, rim, ambient, practical), color palette (specific hues, not "warm"), atmosphere, music feel, pacing.',
          '- ELEMENTS: specific props by name (Starbucks white cup with green logo, vintage Levi\'s, leather crossbody, etc.), set pieces, textures, focal objects, wardrobe pieces with color/fabric.',
          '- CHARACTERS: keep the exact COUNT and identity (one woman + one man + one woman → keep all three). For each, add age range, ethnicity option, hair, wardrobe details, demeanor, body language, and role in the scene.',
          '- CAMERA / RENDER: shot type (wide / medium / close), lens feel (35mm, 50mm, 85mm), depth of field, film stock or digital look.',
          '',
          'BANNED WORDS: "vibrant", "lively", "carefree", "bustling", "beautiful", "great" — replace these with specific concrete imagery.',
          '',
          'FORMAT:',
          '- ONE flowing paragraph, 100-180 words',
          '- No headings, no bullets, no labels, no quotes, no preamble',
          '- Return ONLY the expanded brief paragraph, ready to drop into a generation tool',
        ].join('\n') },
        { role: 'user', content: `Rough idea to expand (preserve every character and detail, then add specifics):\n\n${text}` },
      ]
      const { text: improved } = await chatWithTools(messages, [])
      const cleaned = (improved || '').trim().replace(/^["'`]+|["'`]+$/g, '')
      if (cleaned) setPrompt(cleaned)
      else setError('AI returned no text')
    } catch (e) {
      const msg = e?.message || String(e)
      setError(/\b429\b/.test(msg) ? 'Gemini rate limit hit. Try again in a minute.' : `Improve failed: ${msg}`)
    } finally {
      setImproving(false)
    }
  }

  function onKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  function pickQuickStart(item) {
    setQuickStart(item.id)
    setPrompt(item.prompt)
    textRef.current?.focus()
  }

  return (
    <div className="discover-layout">
      {/* ── Sidebar ───────────────────────────────────────────── */}
      <aside ref={sidebarRef} className={`sidebar${sidebarExpanded ? ' sidebar-expanded' : ''}${!sidebarVisible ? ' sidebar-hidden' : ''}`} style={sidebarVisible ? { width: sidebarWidth } : {}}>
        <div className="sidebar-logo">
          <img src="/brand-assets/wonder-w-mark-transparent.png" alt="W" className="sidebar-w-mark" />
          <div className="sidebar-logo-icons">
            <button className={`sidebar-icon-btn${!sidebarVisible ? ' active' : ''}`} onClick={() => setSidebarVisible(v => !v)} title={sidebarVisible ? 'Hide sidebar' : 'Show sidebar'}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M5.5 2.5v11" stroke="currentColor" strokeWidth="1.3"/>
              </svg>
            </button>
            <button className={`sidebar-icon-btn${discoverSearchOpen ? ' active' : ''}`} onClick={() => { setDiscoverSearchOpen(v => !v); setDiscoverSearch('') }} title="Search projects">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <circle cx="6.5" cy="6.5" r="4" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M10 10l3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map(item => (
            <div
              key={item.id}
              className={`nav-item${activePage === item.id ? ' active' : ''}`}
              onClick={() => { setActivePage(item.id); setViewingFolder(null) }}
            >
              {item.icon}
              <span>{item.label}</span>
            </div>
          ))}
        </nav>

        <div className="sidebar-recents">
          <div className="sidebar-recents-label">Projects</div>
          {discoverSearchOpen && (
            <div className="sidebar-search-row">
              <input
                autoFocus
                className="sidebar-search-input"
                placeholder="Search…"
                value={discoverSearch}
                onChange={e => setDiscoverSearch(e.target.value)}
                onKeyDown={e => { if (e.key === 'Escape') { setDiscoverSearchOpen(false); setDiscoverSearch('') } }}
              />
            </div>
          )}
          {projects.length === 0 && (
            <div className="sidebar-recent-empty">No projects yet</div>
          )}
          {folders.map(([folderName, folderProjects], folderIdx) => {
            // Drop the folder header when there's only the default "Projects"
            // bucket — no need to clutter the sidebar in the common case.
            const showHeader = folders.length > 1
            const filtered = folderProjects.filter(p => !discoverSearch
              || p.name?.toLowerCase().includes(discoverSearch.toLowerCase())
              || p.brief?.creativeDirection?.brand?.toLowerCase().includes(discoverSearch.toLowerCase()))
            if (!filtered.length && discoverSearch) return null
            const isCollapsed = collapsedFolders.has(folderName)
            return (
              <div className="sidebar-folder" key={folderName}>
                {showHeader && (
                  <button
                    className={`sidebar-folder-header${isCollapsed ? ' collapsed' : ''}`}
                    onClick={() => toggleFolder(folderName)}
                  >
                    <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
                      <path d="M3 2l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>{folderName}</span>
                    <span className="sidebar-folder-count">{filtered.length}</span>
                  </button>
                )}
                {(!showHeader || !isCollapsed) && filtered.map((p, i) => {
                  const dotColor = ['#2D9A4E','#0891B2','#D97706','#9CA3AF','#7C5CFC'][(folderIdx * 7 + i) % 5]
                  const isMenuOpen = menuOpenId === p.id
                  return (
                    <div key={p.id} className="sidebar-recent-item" onClick={() => renamingId === p.id ? null : onOpenProject(p)}>
                      <span className="sidebar-recent-dot" style={{ background: dotColor }} />
                      {renamingId === p.id ? (
                        <input
                          ref={renameInputRef}
                          className="sidebar-recent-rename-input"
                          value={renameValue}
                          onChange={e => setRenameValue(e.target.value)}
                          onClick={e => e.stopPropagation()}
                          onBlur={commitRename}
                          onKeyDown={e => {
                            if (e.key === 'Enter') { e.preventDefault(); commitRename() }
                            if (e.key === 'Escape') { e.preventDefault(); cancelRename() }
                          }}
                        />
                      ) : (
                        <span
                          className="sidebar-recent-name"
                          title="Double-click to rename"
                          onDoubleClick={e => startRename(p, e)}
                        >
                          {p.name}
                        </span>
                      )}
                      {renamingId !== p.id && (
                        <div className="sidebar-recent-more-wrap">
                          <button
                            className="sidebar-recent-more"
                            title="More actions"
                            onClick={e => { e.stopPropagation(); setMenuOpenId(isMenuOpen ? null : p.id) }}
                          >
                            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                              <circle cx="3" cy="7" r="1.2" fill="currentColor"/>
                              <circle cx="7" cy="7" r="1.2" fill="currentColor"/>
                              <circle cx="11" cy="7" r="1.2" fill="currentColor"/>
                            </svg>
                          </button>
                          {isMenuOpen && (
                            <div className="sidebar-recent-menu" onClick={e => e.stopPropagation()}>
                              <button onClick={e => { setMenuOpenId(null); startRename(p, e) }}>Rename</button>
                              <button onClick={() => { setMenuOpenId(null); onDuplicateProject?.(p.id) }}>Duplicate</button>
                              <button onClick={e => openMovePopover(p, e)}>Move to folder…</button>
                              <button
                                className="sidebar-recent-menu-danger"
                                onClick={() => { setMenuOpenId(null); onDeleteProject?.(p.id) }}
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>

        <div className="sidebar-user">
          <div className="user-avatar">A</div>
          <span className="user-name">Creative<br/>Director</span>
        </div>

        <div className="sidebar-drag-handle" onMouseDown={onDragHandleMouseDown} title="Drag to resize" />
      </aside>

      {/* ── Right area ────────────────────────────────────────── */}
      <div className="discover-right">

        {/* Topbar */}
        <header className="discover-topbar">
          {!sidebarVisible && (
            <button className="topbar-icon-btn topbar-show-sidebar" onClick={() => setSidebarVisible(true)} title="Show sidebar">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M5.5 2.5v11" stroke="currentColor" strokeWidth="1.3"/>
              </svg>
            </button>
          )}
          <div className="discover-topbar-right">
            <button className="theme-toggle-btn" onClick={toggleTheme} title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}>
              {theme === 'dark'
                ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.7"/><path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
              }
            </button>
          </div>
        </header>

        {/* ── Projects page ── */}
        {activePage === 'projects' && (
          <main className="discover-page">
            {(() => {
              // Search filter applies in both modes (folder grid + drilled-in).
              const q = discoverSearch.trim().toLowerCase()
              const matchesQuery = p => !q
                || p.name?.toLowerCase().includes(q)
                || p.brief?.creativeDirection?.brand?.toLowerCase().includes(q)

              // Unfiled = projects with no folder, drilled-in folder = projects in that folder.
              const visibleProjects = projects.filter(matchesQuery)
              const unfiledProjects = visibleProjects.filter(p => !p.folder)
              const inFolderProjects = viewingFolder
                ? visibleProjects.filter(p => p.folder === viewingFolder)
                : []

              // Card renderer — shared between folder view and Unfiled section.
              function renderCard(p, i) {
                return (
                  <div
                    key={p.id}
                    className="project-card"
                    draggable
                    onDragStart={e => {
                      e.dataTransfer.setData('text/ww-project-id', String(p.id))
                      e.dataTransfer.effectAllowed = 'move'
                    }}
                    onClick={() => onOpenProject(p)}
                  >
                    <div className="project-card-bg" style={{ background: CARD_GRADIENTS[i % CARD_GRADIENTS.length] }}>
                      <span className="project-card-brand">{p.brief?.creativeDirection?.brand || p.name}</span>
                    </div>
                    <div className="project-card-body">
                      <div className="project-card-name">{p.name}</div>
                      <div className="project-card-meta">
                        {p.brief?.creativeDirection?.format && <span>{p.brief.creativeDirection.format}</span>}
                        {p.brief?.creativeDirection?.shots && <span>{p.brief.creativeDirection.shots} shots</span>}
                        {p.createdAt && <span>{new Date(p.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                      </div>
                    </div>
                    <div className="project-card-actions" onClick={e => e.stopPropagation()}>
                      <button onClick={e => { e.stopPropagation(); startRename(p, e) }} title="Rename">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 8.5V10h1.5l5-5L7 3.5l-5 5zM7.7 2.8l1.5 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </button>
                      <button onClick={e => { e.stopPropagation(); openMovePopover(p, e) }} title="Move to folder…">
                        <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M2 4a1 1 0 011-1h3l1 1h4a1 1 0 011 1v6a1 1 0 01-1 1H3a1 1 0 01-1-1V4z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>
                      </button>
                      <button onClick={e => { e.stopPropagation(); onDeleteProject?.(p.id) }} title="Delete">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                      </button>
                    </div>
                  </div>
                )
              }

              // Drilled-in folder view: breadcrumb back + folder name +
              // grid of just that folder's projects.
              if (viewingFolder) {
                return (
                  <>
                    <div className="folder-breadcrumb">
                      <button className="folder-breadcrumb-back" onClick={() => setViewingFolder(null)}>
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                          <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        Projects
                      </button>
                      <span className="folder-breadcrumb-sep">/</span>
                      {renamingFolder === viewingFolder ? (
                        <input
                          autoFocus
                          className="folder-rename-input"
                          value={folderRenameValue}
                          onChange={e => setFolderRenameValue(e.target.value)}
                          onBlur={commitFolderRename}
                          onKeyDown={e => {
                            if (e.key === 'Enter') { e.preventDefault(); commitFolderRename() }
                            if (e.key === 'Escape') { e.preventDefault(); setRenamingFolder(null) }
                          }}
                        />
                      ) : (
                        <span
                          className="folder-breadcrumb-name"
                          title="Double-click to rename"
                          onDoubleClick={() => { setRenamingFolder(viewingFolder); setFolderRenameValue(viewingFolder) }}
                        >
                          {viewingFolder}
                        </span>
                      )}
                      <span className="folder-breadcrumb-count">{inFolderProjects.length}</span>
                      <div className="folder-breadcrumb-actions">
                        <button onClick={() => { setRenamingFolder(viewingFolder); setFolderRenameValue(viewingFolder) }} title="Rename folder">
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 8.5V10h1.5l5-5L7 3.5l-5 5zM7.7 2.8l1.5 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </button>
                        <button className="folder-breadcrumb-delete" onClick={() => handleDeleteFolder(viewingFolder)} title="Delete folder">
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                        </button>
                      </div>
                    </div>
                    {inFolderProjects.length === 0 ? (
                      <div className="page-empty">
                        <p>No projects in this folder yet. Drag a project tile here from <button className="link-btn" onClick={() => setViewingFolder(null)}>Projects</button>.</p>
                      </div>
                    ) : (
                      <div className="projects-grid">
                        {inFolderProjects.map(renderCard)}
                      </div>
                    )}
                  </>
                )
              }

              // Folder grid view: folder tiles on top + Unfiled below.
              if (projects.length === 0 && folderList.length === 0) {
                return (
                  <>
                    <div className="page-header">
                      <h2 className="page-title">Projects</h2>
                      <span className="page-count">0 briefs</span>
                    </div>
                    <div className="page-empty">
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.3"/><path d="M3 9h18" stroke="currentColor" strokeWidth="1.3"/></svg>
                      <p>No projects yet. Generate your first brief from Home.</p>
                      <button className="page-empty-btn" onClick={() => setActivePage('home')}>Go to Home</button>
                    </div>
                  </>
                )
              }

              return (
                <>
                  <div className="page-header">
                    <h2 className="page-title">Projects</h2>
                    <span className="page-count">{projects.length} brief{projects.length !== 1 ? 's' : ''}</span>
                  </div>

                  {/* Folder tiles row */}
                  <div className="folders-section">
                    <div className="folders-section-header">
                      <span className="folders-section-label">FOLDERS</span>
                      <button
                        className="folders-new-btn"
                        onClick={() => { setCreatingFolder(true); setNewFolderName('') }}
                      >
                        <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                          <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                        </svg>
                        New folder
                      </button>
                    </div>
                    <div className="folders-grid">
                      {creatingFolder && (
                        <div className="folder-tile folder-tile-new">
                          <div className="folder-tile-icon">
                            <svg width="34" height="28" viewBox="0 0 34 28" fill="none">
                              <path d="M2 6a2 2 0 012-2h8l3 3h15a2 2 0 012 2v15a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                            </svg>
                          </div>
                          <input
                            autoFocus
                            className="folder-tile-rename"
                            placeholder="Folder name…"
                            value={newFolderName}
                            onChange={e => setNewFolderName(e.target.value)}
                            onBlur={commitNewFolder}
                            onKeyDown={e => {
                              if (e.key === 'Enter') { e.preventDefault(); commitNewFolder() }
                              if (e.key === 'Escape') { e.preventDefault(); setCreatingFolder(false); setNewFolderName('') }
                            }}
                          />
                        </div>
                      )}
                      {folderList.map(f => {
                        const isOver = dragOverFolder === f.name
                        return (
                          <div
                            key={f.name}
                            className={`folder-tile${isOver ? ' folder-tile-drag-over' : ''}`}
                            onClick={() => setViewingFolder(f.name)}
                            onDragOver={e => {
                              if (e.dataTransfer.types.includes('text/ww-project-id')) {
                                e.preventDefault()
                                e.dataTransfer.dropEffect = 'move'
                                if (dragOverFolder !== f.name) setDragOverFolder(f.name)
                              }
                            }}
                            onDragLeave={() => { if (dragOverFolder === f.name) setDragOverFolder(null) }}
                            onDrop={e => {
                              e.preventDefault()
                              const id = Number(e.dataTransfer.getData('text/ww-project-id'))
                              if (id) onMoveProjectToFolder?.(id, f.name)
                              setDragOverFolder(null)
                            }}
                          >
                            <div className="folder-tile-icon">
                              <svg width="34" height="28" viewBox="0 0 34 28" fill="none">
                                <path d="M2 6a2 2 0 012-2h8l3 3h15a2 2 0 012 2v15a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                              </svg>
                            </div>
                            {renamingFolder === f.name ? (
                              <input
                                autoFocus
                                className="folder-tile-rename"
                                value={folderRenameValue}
                                onChange={e => setFolderRenameValue(e.target.value)}
                                onBlur={commitFolderRename}
                                onClick={e => e.stopPropagation()}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') { e.preventDefault(); commitFolderRename() }
                                  if (e.key === 'Escape') { e.preventDefault(); setRenamingFolder(null) }
                                }}
                              />
                            ) : (
                              <span className="folder-tile-name" onDoubleClick={e => { e.stopPropagation(); setRenamingFolder(f.name); setFolderRenameValue(f.name) }}>
                                {f.name}
                              </span>
                            )}
                            <span className="folder-tile-count">{f.count}</span>
                            <div className="folder-tile-actions" onClick={e => e.stopPropagation()}>
                              <button onClick={() => { setRenamingFolder(f.name); setFolderRenameValue(f.name) }} title="Rename">
                                <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2 8.5V10h1.5l5-5L7 3.5l-5 5zM7.7 2.8l1.5 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                              </button>
                              <button onClick={() => handleDeleteFolder(f.name)} title="Delete folder">
                                <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                              </button>
                            </div>
                          </div>
                        )
                      })}
                      {folderList.length === 0 && !creatingFolder && (
                        <div className="folders-empty-hint">No folders yet. Use “New folder” to create one — then drag projects in.</div>
                      )}
                    </div>
                  </div>

                  {/* Unfiled section */}
                  <div className="folders-unfiled">
                    <div className="folders-section-header">
                      <span className="folders-section-label">UNFILED</span>
                      <span className="folders-section-count">{unfiledProjects.length}</span>
                    </div>
                    {unfiledProjects.length === 0 ? (
                      <div className="folders-empty-hint">All projects are filed into folders.</div>
                    ) : (
                      <div className="projects-grid">
                        {unfiledProjects.map(renderCard)}
                      </div>
                    )}
                  </div>
                </>
              )
            })()}

            {/* Move-to-folder popover, anchored to the triggering button. */}
            {movePopover && (
              <div
                className="move-popover"
                style={{ position: 'fixed', left: movePopover.anchor.left, top: movePopover.anchor.top, zIndex: 400 }}
                onClick={e => e.stopPropagation()}
              >
                <div className="move-popover-label">Move to folder</div>
                <div className="move-popover-list">
                  <button
                    className={`move-popover-item${!movePopover.currentFolder ? ' active' : ''}`}
                    onClick={() => { onMoveProjectToFolder?.(movePopover.projectId, ''); closeMovePopover() }}
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                    Unfiled
                  </button>
                  {folderList.map(f => (
                    <button
                      key={f.name}
                      className={`move-popover-item${movePopover.currentFolder === f.name ? ' active' : ''}`}
                      onClick={() => { onMoveProjectToFolder?.(movePopover.projectId, f.name); closeMovePopover() }}
                    >
                      <svg width="13" height="11" viewBox="0 0 14 11" fill="none"><path d="M1 3a1 1 0 011-1h3.5l1 1H12a1 1 0 011 1v5a1 1 0 01-1 1H2a1 1 0 01-1-1V3z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>
                      {f.name}
                    </button>
                  ))}
                </div>
                <div className="move-popover-divider" />
                <div className="move-popover-new">
                  <input
                    className="move-popover-new-input"
                    placeholder="New folder…"
                    value={newFolderName}
                    onChange={e => setNewFolderName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        const cleaned = (newFolderName || '').trim()
                        if (!cleaned) return
                        onCreateFolder?.(cleaned)
                        onMoveProjectToFolder?.(movePopover.projectId, cleaned)
                        closeMovePopover()
                      }
                    }}
                  />
                </div>
              </div>
            )}
          </main>
        )}

        {/* ── Inspiration page ── */}
        {activePage === 'inspiration' && (
          <main className="discover-page">
            <div className="page-header">
              <h2 className="page-title">Inspiration</h2>
              <span className="page-count">Click any card to use as a starting prompt</span>
            </div>
            <div className="inspiration-grid">
              {INSPIRATION_ITEMS.map((item, i) => (
                <div
                  key={item.title}
                  className="inspiration-card"
                  style={{ background: CARD_GRADIENTS[i % CARD_GRADIENTS.length] }}
                  onClick={() => {
                    setActivePage('home')
                    setPrompt(item.prompt)
                    setQuickStart(null)
                    setTimeout(() => textRef.current?.focus(), 100)
                  }}
                >
                  <div className="inspiration-card-tags">
                    {item.tags.map(t => <span key={t} className="inspiration-tag">{t}</span>)}
                  </div>
                  <div className="inspiration-card-title">{item.title}</div>
                  <div className="inspiration-card-prompt">{item.prompt.slice(0, 80)}…</div>
                  <div className="inspiration-card-cta">Use prompt →</div>
                </div>
              ))}
            </div>
          </main>
        )}

        {/* ── Boards page ── */}
        {activePage === 'boards' && (
          <main className="discover-page">
            <div className="page-header">
              <h2 className="page-title">Boards</h2>
              <span className="page-count">{projects.length} board{projects.length !== 1 ? 's' : ''}</span>
            </div>
            {projects.length === 0 ? (
              <div className="page-empty">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3"/></svg>
                <p>No boards yet. Generate your first brief from Home.</p>
                <button className="page-empty-btn" onClick={() => setActivePage('home')}>Go to Home</button>
              </div>
            ) : (
              <div className="boards-grid">
                {projects.map((p, i) => (
                  <div key={p.id} className="board-tile" onClick={() => onOpenProject(p)}>
                    <div className="board-tile-hero" style={{ background: CARD_GRADIENTS[i % CARD_GRADIENTS.length] }}>
                      <span className="board-tile-brand">{p.brief?.creativeDirection?.brand || '—'}</span>
                      <div className="board-tile-sections">
                        {['Creative Direction','Brand Info','Lighting & Mood','Shot List'].map(s => (
                          <span key={s} className="board-tile-section">{s}</span>
                        ))}
                      </div>
                    </div>
                    <div className="board-tile-foot">
                      <span className="board-tile-name">{p.name}</span>
                      <span className="board-tile-date">
                        {p.createdAt ? new Date(p.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </main>
        )}

        {/* ── Home / Generate form ── */}
        {activePage === 'home' && <main className="discover-form">

          {error && <div className="discover-error">{error}</div>}

          {/* Greeting */}
          <div className="discover-greeting">
            <span className="greeting-hi">Hi Atharvaa,</span>
            <span className="greeting-sub">what do you want to create?</span>
          </div>

          {/* Quick starts */}
          <div className="form-section">
            <h3 className="form-section-label">Quick start prompts</h3>
            <div className="quick-start-row">
              {QUICK_START_PROMPTS.map(item => (
                <button
                  key={item.id}
                  className={`quick-start-chip${quickStart === item.id ? ' active' : ''}`}
                  onClick={() => pickQuickStart(item)}
                  type="button"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Input card */}
          {inputFocused && (
            <div className="input-overlay" onClick={() => setInputFocused(false)} />
          )}
          <div
            ref={inputCardRef}
            className={`input-card${inputFocused ? ' input-card-focused' : ''}`}
            onClick={() => !inputFocused && setInputFocused(true)}
          >
            <textarea
              ref={textRef}
              className="input-card-text"
              placeholder="Describe the scene, shot, mood, characters, styling, location…"
              value={prompt}
              onChange={e => {
                setPrompt(e.target.value)
                // Auto-grow the textarea up to a sensible max so long
                // attached briefs / pasted creative documents render
                // in full instead of being squeezed into 4 cramped lines.
                const el = e.target
                el.style.height = 'auto'
                el.style.height = Math.min(el.scrollHeight, 480) + 'px'
              }}
              onKeyDown={onKey}
              disabled={loading || improving}
              autoFocus
              rows={4}
              style={{ maxHeight: 480, overflowY: 'auto' }}
            />
            {attachments.length > 0 && (
              <div className="input-card-attachments">
                {attachments.map((a, i) => (
                  <span key={i} className="input-attachment-chip" title={`${a.name} — ${Math.round((a.content || '').length / 100) / 10}k chars`}>
                    <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                      <path d="M4 2h6l3 3v9a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
                      <path d="M10 2v3h3" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
                    </svg>
                    <span className="input-attachment-name">{a.name}</span>
                    <button
                      className="input-attachment-remove"
                      onClick={() => removeAttachment(i)}
                      title="Remove this attachment"
                      type="button"
                    >
                      <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
                        <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                      </svg>
                    </button>
                  </span>
                ))}
                {attaching && <span className="input-attachment-loading">Reading file…</span>}
              </div>
            )}
            <div className="input-card-footer">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt,.md,.json,.csv,.rtf,application/pdf,text/*"
                multiple
                style={{ display: 'none' }}
                onChange={e => { handleAttachFiles(e.target.files); e.target.value = '' }}
              />
              <button className="attach-pill" title="Attach a brief, treatment, or notes" onClick={openFilePicker} type="button">
                <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
                  <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
              <div className="ratio-dropdown" ref={ratioRef}>
                <button className="ratio-pill" onClick={() => setRatioOpen(o => !o)} title="Aspect Ratio">
                  {(() => {
                    const active = RATIOS.find(r => r.id === ratio) || RATIOS[0]
                    return (
                      <span
                        className="ratio-pill-icon"
                        style={{
                          width: active.w * 0.42,
                          height: active.h * 0.42,
                          border: '1.3px solid currentColor',
                          borderRadius: 2,
                          display: 'inline-block',
                          flexShrink: 0,
                        }}
                      />
                    )
                  })()}
                  <span className="ratio-pill-label">Aspect Ratio</span>
                  <span className="ratio-pill-value">{ratio}</span>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                  </svg>
                </button>
                {ratioOpen && (
                  <div className="ratio-dropdown-menu">
                    {RATIOS.map(r => (
                      <button
                        key={r.id}
                        className={`ratio-dropdown-item${ratio === r.id ? ' active' : ''}`}
                        onClick={() => { setRatio(r.id); setRatioOpen(false) }}
                      >
                        <div
                          className="ratio-dropdown-icon"
                          style={{
                            width: r.w * 0.55, height: r.h * 0.55,
                            border: r.dashed ? '1.4px dashed currentColor' : '1.4px solid currentColor',
                            borderRadius: 2, flexShrink: 0,
                          }}
                        />
                        <span className="ratio-dropdown-label">{r.label}</span>
                        <span className="ratio-dropdown-sub">{r.sub}</span>
                        {ratio === r.id && (
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{marginLeft:'auto'}}>
                            <path d="M2 6l3 3 5-5" stroke="#7C5CFC" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="resolution-dropdown" ref={resolutionRef}>
                <button className="resolution-pill" type="button" onClick={() => setResolutionOpen(o => !o)} title="Resolution">
                  <span className="resolution-pill-label">Resolution</span>
                  <span className="resolution-pill-value">{resolution}</span>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                  </svg>
                </button>
                {resolutionOpen && (
                  <div className="resolution-dropdown-menu">
                    {RESOLUTIONS.map(option => (
                      <button
                        key={option}
                        type="button"
                        className={`resolution-dropdown-item${resolution === option ? ' active' : ''}`}
                        onClick={() => { setResolution(option); setResolutionOpen(false) }}
                      >
                        <span>{option}</span>
                        {resolution === option && (
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{marginLeft:'auto'}}>
                            <path d="M2 6l3 3 5-5" stroke="#7C5CFC" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                className="discover-improve-btn"
                onClick={improvePrompt}
                disabled={!prompt.trim() || improving || loading}
                title="Expand this prompt into a richer brief — location, mood, elements, characters"
                type="button"
              >
                <svg width="13" height="13" viewBox="0 0 18 18" fill="none">
                  <path d="M10.5 3.5l2 2L6 12l-2.5.5L4 10l6.5-6.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
                  <path d="M13.5 1l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7L13.5 1z" fill="currentColor"/>
                </svg>
                {improving ? 'Improving…' : 'Improve with AI'}
              </button>
              <button
                className="start-blank-btn"
                onClick={() => onStartBlank?.({ ratio, resolution })}
                disabled={loading || improving}
                title="Start from a blank board — skip AI autofill"
              >
                Start blank
              </button>
              <button className="generate-btn" onClick={handleSend} disabled={!prompt.trim() || loading || improving}>
                {loading
                  ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#fff" strokeWidth="2.5" strokeDasharray="28" strokeDashoffset="8"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.75s" repeatCount="indefinite"/></circle></svg>
                  : <>Generate <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M2 14L14 8 2 2v4.5l8 1.5-8 1.5V14z" fill="#fff"/></svg></>
                }
              </button>
            </div>
          </div>


        </main>}

      </div>
    </div>
  )
}
