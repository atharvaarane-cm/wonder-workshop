import { useState, useRef, useEffect } from 'react'
import { generateBrief } from '../hooks/useBrief.js'
import LiquidEther from '../components/LiquidEther.jsx'

const CATEGORIES = [
  {
    id: 'social', label: 'Social', desc: 'Content for social platforms', color: '#7C5CFC',
    icon: <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.4"/><circle cx="15.5" cy="4.5" r="1.5" stroke="currentColor" strokeWidth="1.4"/><circle cx="4.5" cy="4.5" r="1.5" stroke="currentColor" strokeWidth="1.4"/><circle cx="15.5" cy="15.5" r="1.5" stroke="currentColor" strokeWidth="1.4"/><circle cx="4.5" cy="15.5" r="1.5" stroke="currentColor" strokeWidth="1.4"/><path d="M7.3 8.5L6 6M12.7 8.5L14 6M12.7 11.5L14 14M7.3 11.5L6 14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>,
  },
  {
    id: 'production', label: 'Production', desc: 'Plan your production', color: '#F59E0B',
    icon: <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><rect x="2" y="5" width="16" height="11" rx="2" stroke="currentColor" strokeWidth="1.4"/><path d="M13 10.5l-5 3V7.5l5 3z" fill="currentColor"/></svg>,
  },
  {
    id: 'brand', label: 'Brand', desc: 'Visualize brand identity', color: '#3B82F6',
    icon: <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M10 2l1.5 5.5H17l-4.5 3.5 1.5 5.5L10 13.5 6 16.5l1.5-5.5L3 7.5h5.5L10 2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg>,
  },
  {
    id: 'stills', label: 'Stills', desc: 'Photo & still campaigns', color: '#10B981',
    icon: <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><rect x="2" y="4" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.4"/><circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.4"/><path d="M7 4l1-2h4l1 2" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>,
  },
]

const RATIOS = [
  { id: '16:9',   label: '16 : 9', sub: 'Widescreen',   w: 34, h: 20 },
  { id: '9:16',   label: '9 : 16', sub: 'Portrait',     w: 18, h: 30 },
  { id: '1:1',    label: '1 : 1',  sub: 'Square',       w: 26, h: 26 },
  { id: '4:5',    label: '4 : 5',  sub: 'Portrait 4:5', w: 22, h: 28 },
  { id: 'custom', label: 'Custom', sub: 'Set custom',   w: 28, h: 20, dashed: true },
]

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
  const [ratioOpen, setRatioOpen]   = useState(false)
  const [category, setCategory]     = useState(null)
  const [inputFocused, setInputFocused] = useState(false)
  const textRef = useRef(null)
  const ratioRef = useRef(null)
  const inputCardRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (ratioRef.current && !ratioRef.current.contains(e.target)) setRatioOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function handleSend() {
    const text = prompt.trim()
    if (!text || loading) return
    setLoading(true); setError(null)
    try {
      const full = `${text}${ratio !== 'custom' ? ` (aspect ratio: ${ratio})` : ''}${category ? ` (category: ${category})` : ''}`
      const brief = await generateBrief(full)
      onGenerate({ ...brief, ratio: ratio === 'custom' ? '16:9' : ratio })
    } catch (e) {
      setError(e.message)
      setLoading(false)
    }
  }

  function onKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  function pickCategory(id) {
    setCategory(id === category ? null : id)
    const prefixes = {
      branding:   'Brand identity shoot for ',
      production: 'Full production brief for ',
      filming:    'Detailed shot list for ',
      marketing:  'Marketing campaign for ',
    }
    if (id !== category) {
      setPrompt(prefixes[id] || '')
      textRef.current?.focus()
    }
  }

  return (
    <div className="discover-layout">
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <LiquidEther
          colors={['#5227FF', '#FF9FFC', '#B497CF']}
          mouseForce={20}
          cursorSize={100}
          resolution={0.5}
          autoDemo={true}
          autoSpeed={0.5}
          autoIntensity={2.2}
          autoResumeDelay={3000}
          autoRampDuration={0.6}
          takeoverDuration={0.25}
        />
      </div>

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

          {/* Categories */}
          <div className="form-section">
            <h3 className="form-section-label">Start with a category</h3>
            <div className="category-row">
              {CATEGORIES.map(cat => (
                <div
                  key={cat.id}
                  className={`category-card-h${category === cat.id ? ' active' : ''}`}
                  onClick={() => pickCategory(cat.id)}
                  style={{ '--cat-color': cat.color }}
                >
                  {category === cat.id && <span className="cat-check">✓</span>}
                  <span className="cat-icon" style={{ color: cat.color }}>{cat.icon}</span>
                  <span className="cat-label">{cat.label}</span>
                  <span className="cat-desc">{cat.desc}</span>
                </div>
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
