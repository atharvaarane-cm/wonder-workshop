import { useState, useRef, useEffect } from 'react'
import { generateBrief } from '../hooks/useBrief.js'

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

export default function Discover({ onGenerate, projects = [], onOpenProject, onDeleteProject, onRenameProject, theme, toggleTheme }) {
  const [activePage, setActivePage] = useState('home')
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
  const [error, setError]           = useState(null)
  const [ratio, setRatio]           = useState('16:9')
  const [resolution, setResolution] = useState('1K')
  const [ratioOpen, setRatioOpen]   = useState(false)
  const [resolutionOpen, setResolutionOpen] = useState(false)
  const [quickStart, setQuickStart] = useState(null)
  const [inputFocused, setInputFocused] = useState(false)
  const textRef = useRef(null)
  const ratioRef = useRef(null)
  const resolutionRef = useRef(null)
  const inputCardRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (ratioRef.current && !ratioRef.current.contains(e.target)) setRatioOpen(false)
      if (resolutionRef.current && !resolutionRef.current.contains(e.target)) setResolutionOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function handleSend() {
    const text = prompt.trim()
    if (!text || loading) return
    setLoading(true); setError(null)
    try {
      const full = `${text} (aspect ratio: ${ratio}) (resolution: ${resolution})${quickStart ? ` (quick start: ${quickStart})` : ''}`
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
      setError(e.message)
      setLoading(false)
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
              onClick={() => setActivePage(item.id)}
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
          {projects.filter(p => !discoverSearch || p.name?.toLowerCase().includes(discoverSearch.toLowerCase()) || p.brief?.creativeDirection?.brand?.toLowerCase().includes(discoverSearch.toLowerCase())).slice(0, 8).map((p, i) => (
            <div key={p.id} className="sidebar-recent-item" onClick={() => renamingId === p.id ? null : onOpenProject(p)}>
              <span className="sidebar-recent-dot" style={{ background: ['#2D9A4E','#0891B2','#D97706','#9CA3AF','#7C5CFC'][i % 5] }} />
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
                <>
                  <button
                    className="sidebar-recent-rename"
                    title="Rename project"
                    onClick={e => startRename(p, e)}
                  >
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                      <path d="M2 8.5V10h1.5l5-5L7 3.5l-5 5zM7.7 2.8l1.5 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  <button
                    className="sidebar-recent-delete"
                    title="Delete project"
                    onClick={e => { e.stopPropagation(); onDeleteProject?.(p.id) }}
                  >
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                      <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </button>
                </>
              )}
            </div>
          ))}
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
            <button className="bell-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </header>

        {/* ── Projects page ── */}
        {activePage === 'projects' && (
          <main className="discover-page">
            <div className="page-header">
              <h2 className="page-title">Projects</h2>
              <span className="page-count">{projects.length} brief{projects.length !== 1 ? 's' : ''}</span>
            </div>
            {projects.length === 0 ? (
              <div className="page-empty">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.3"/><path d="M3 9h18" stroke="currentColor" strokeWidth="1.3"/></svg>
                <p>No projects yet. Generate your first brief from Home.</p>
                <button className="page-empty-btn" onClick={() => setActivePage('home')}>Go to Home</button>
              </div>
            ) : (
              <div className="projects-grid">
                {projects.filter(p => !discoverSearch || p.name?.toLowerCase().includes(discoverSearch.toLowerCase()) || p.brief?.creativeDirection?.brand?.toLowerCase().includes(discoverSearch.toLowerCase())).map((p, i) => (
                  <div key={p.id} className="project-card" onClick={() => onOpenProject(p)}>
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
                      <button onClick={e => { e.stopPropagation(); onDeleteProject?.(p.id) }} title="Delete">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                      </button>
                    </div>
                  </div>
                ))}
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
            <span className="greeting-sub">what's on your mind?</span>
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
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={onKey}
              disabled={loading}
              autoFocus
              rows={4}
            />
            <div className="input-card-footer">
              <button className="attach-pill" title="Attach file">
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
              <button className="generate-btn" onClick={handleSend} disabled={!prompt.trim() || loading}>
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
