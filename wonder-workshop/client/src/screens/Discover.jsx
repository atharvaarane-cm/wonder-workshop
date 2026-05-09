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
  { id: '2:1',    label: '2 : 1',  sub: 'Wide banner',  w: 34, h: 17 },
]

const RESOLUTIONS = ['1K', '2K', '4K']

const NAV_ITEMS = [
  { label: 'Home', active: true, icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 12L12 4l9 8v8a1 1 0 01-1 1H5a1 1 0 01-1-1v-8z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/><path d="M9 21V12h6v9" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg> },
  { label: 'Projects', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6"/><path d="M3 9h18" stroke="currentColor" strokeWidth="1.6"/></svg> },
  { label: 'Inspiration', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M9 21h6M12 21v-3M12 4v1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/><path d="M9 18h6a5 5 0 10-6 0z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg> },
  { label: 'Boards', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6"/><rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6"/><rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6"/><rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6"/></svg> },
]

const CARD_GRADIENTS = [
  'linear-gradient(135deg,#1a1a2e,#0f3460)',
  'linear-gradient(135deg,#1a0a0a,#4a1515)',
  'linear-gradient(135deg,#0a1a0a,#1a3a1a)',
  'linear-gradient(135deg,#1a1a1a,#3a3a0a)',
  'linear-gradient(135deg,#1a0a2e,#4a1580)',
  'linear-gradient(135deg,#0a1a2e,#1a4060)',
]

export default function Discover({ onGenerate, recents = [], onOpenBrief, theme, toggleTheme }) {
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
      <aside className="sidebar">
        <div className="sidebar-logo">
          <img className="sidebar-w-mark" src="/brand-assets/wonder-w-mark-transparent.png" alt="Wonder" />
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map(item => (
            <div key={item.label} className={`nav-item${item.active ? ' active' : ''}`}>
              {item.icon}
              <span>{item.label}</span>
            </div>
          ))}
        </nav>

        <div className="sidebar-recents">
          <div className="sidebar-recents-label">Recent Briefs</div>
          {recents.length === 0 && (
            <div className="sidebar-recent-empty">No briefs yet</div>
          )}
          {recents.slice(0, 5).map((r, i) => (
            <div key={r.id} className="sidebar-recent-item" onClick={() => onOpenBrief(r.brief)}>
              <span className="sidebar-recent-dot" style={{ background: ['#2D9A4E','#0891B2','#D97706','#9CA3AF','#7C5CFC'][i % 5] }} />
              <span className="sidebar-recent-name">{r.name}</span>
            </div>
          ))}
        </div>

        <div className="sidebar-user">
          <div className="user-avatar">A</div>
          <span className="user-name">Creative<br/>Director</span>
        </div>
      </aside>

      {/* ── Right area ────────────────────────────────────────── */}
      <div className="discover-right">

        {/* Topbar */}
        <header className="discover-topbar">
          <div className="discover-topbar-right">
            <button className="new-brief-btn">
              + New brief
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            </button>
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

        {/* ── Single-column form ───────────────────────────────── */}
        <main className="discover-form">

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
                <button className="ratio-pill" onClick={() => setRatioOpen(o => !o)}>
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                    <rect x="1.5" y="3" width="13" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
                    <path d="M1.5 6h13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                  </svg>
                  Aspect Ratio
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
                <button className="resolution-pill" type="button" onClick={() => setResolutionOpen(o => !o)}>
                  Resolution
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


        </main>
      </div>
    </div>
  )
}
