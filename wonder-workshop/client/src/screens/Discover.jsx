import { useState, useRef } from 'react'
import { generateBrief } from '../hooks/useBrief.js'
import heroImg from '../assets/hero.png'

const CATEGORIES = [
  {
    id: 'branding', label: 'Branding', desc: 'Visualize brand concepts', color: '#7C5CFC',
    icon: <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M10 2l1.5 5.5H17l-4.5 3.5 1.5 5.5L10 13.5 6 16.5l1.5-5.5L3 7.5h5.5L10 2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg>,
  },
  {
    id: 'production', label: 'Production', desc: 'Plan your production', color: '#F59E0B',
    icon: <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><rect x="2" y="5" width="16" height="11" rx="2" stroke="currentColor" strokeWidth="1.4"/><path d="M13 10.5l-5 3V7.5l5 3z" fill="currentColor"/></svg>,
  },
  {
    id: 'filming', label: 'Filming', desc: 'Plan shots and scenes', color: '#3B82F6',
    icon: <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><rect x="2" y="6" width="11" height="9" rx="2" stroke="currentColor" strokeWidth="1.4"/><path d="M13 9l5-2.5v7L13 11V9z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg>,
  },
  {
    id: 'marketing', label: 'Marketing', desc: 'Campaigns and promotional visuals', color: '#10B981',
    icon: <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M3 10c0-3.866 3.134-7 7-7s7 3.134 7 7-3.134 7-7 7-7-3.134-7-7z" stroke="currentColor" strokeWidth="1.4"/><path d="M7 10h6M10 7v6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>,
  },
]

const RATIOS = [
  { id: '16:9',   label: '16 : 9', sub: 'Widescreen',  w: 34, h: 20 },
  { id: '9:16',   label: '9 : 16', sub: 'Portrait',    w: 18, h: 30 },
  { id: '1:1',    label: '1 : 1',  sub: 'Square',      w: 26, h: 26 },
  { id: '4:5',    label: '4 : 5',  sub: 'Portrait 4:5',w: 22, h: 28 },
  { id: 'custom', label: 'Custom', sub: 'Set custom',  w: 28, h: 20, dashed: true },
]

const QUICK_TAGS = ['Lighting', 'Mood', 'Camera', 'Style']

const CARD_GRADIENTS = [
  'linear-gradient(135deg,#1a1a2e,#0f3460)',
  'linear-gradient(135deg,#1a0a0a,#4a1515)',
  'linear-gradient(135deg,#0a1a0a,#1a3a1a)',
  'linear-gradient(135deg,#1a1a1a,#3a3a0a)',
  'linear-gradient(135deg,#1a0a2e,#4a1580)',
  'linear-gradient(135deg,#0a1a2e,#1a4060)',
]

function SparkleIcon({ size = 18, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M12 2c0 0 1.2 4.8 4.2 6.3-1.5 0.6-3.6 1.8-4.2 4.7-0.6-2.9-2.7-4.1-4.2-4.7C10.8 6.8 12 2 12 2z"/>
      <path d="M12 13c0 0 1.2 4.8 4.2 6.3-1.5 0.6-3.6 1.8-4.2 4.7-0.6-2.9-2.7-4.1-4.2-4.7C10.8 17.8 12 13 12 13z" opacity="0.5"/>
      <path d="M5 9.5c2.9-0.6 4.1-2.7 4.7-4.2-0.6 1.5-0.6 4.2-4.7 4.2z" opacity="0.4"/>
    </svg>
  )
}

export default function Discover({ onGenerate, recents = [], onOpenBrief }) {
  const [prompt, setPrompt]     = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)
  const [ratio, setRatio]       = useState('16:9')
  const [category, setCategory] = useState(null)
  const textRef = useRef(null)

  async function handleSend() {
    const text = prompt.trim()
    if (!text || loading) return
    setLoading(true); setError(null)
    try {
      const full = `${text}${ratio !== 'custom' ? ` (aspect ratio: ${ratio})` : ''}${category ? ` (category: ${category})` : ''}`
      const brief = await generateBrief(full)
      onGenerate(brief)
    } catch (e) {
      setError(e.message)
      setLoading(false)
    }
  }

  function onKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  function addTag(tag) {
    setPrompt(p => p ? `${p}, ${tag.toLowerCase()}: ` : `${tag.toLowerCase()}: `)
    textRef.current?.focus()
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

      {/* ── Sidebar ───────────────────────────────────────────────── */}
      <aside className="sidebar">
        <div className="sidebar-sparkle">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="#7C5CFC">
            <path d="M12 2L14 9.5H22L15.5 14L18 22L12 17.5L6 22L8.5 14L2 9.5H10L12 2Z"/>
          </svg>
        </div>

        <nav className="sidebar-nav">
          {[
            { label: 'Home', active: true, icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M3 12L12 4l9 8v8a1 1 0 01-1 1H5a1 1 0 01-1-1v-8z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/><path d="M9 21V12h6v9" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg> },
            { label: 'Projects', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6"/><path d="M3 9h18" stroke="currentColor" strokeWidth="1.6"/><path d="M8 4V2M16 4V2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg> },
            { label: 'Inspiration', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M9 21h6M12 21v-3M12 3v1M5.6 5.6l.7.7M3 12h1M20 12h1M18.4 5.6l-.7.7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/><path d="M9 18h6a5 5 0 10-6 0z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg> },
            { label: 'Boards', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6"/><rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6"/><rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6"/><rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6"/></svg> },
            { label: 'Assets', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 2l9 5v10l-9 5-9-5V7l9-5z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/><path d="M3 7l9 5m0 0l9-5m-9 5v10" stroke="currentColor" strokeWidth="1.6"/></svg> },
          ].map(item => (
            <div key={item.label} className={`nav-icon-item${item.active ? ' active' : ''}`}>
              {item.icon}
              <span>{item.label}</span>
            </div>
          ))}
        </nav>

        <div className="sidebar-user-icon">
          <div className="user-avatar">A</div>
          <span>Creative<br/>Director
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ display: 'inline', marginLeft: 2 }}>
              <path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          </span>
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────────────────────── */}
      <main className="discover-main">

        {/* Hero */}
        <div className="hero-strip">
          <div className="hero-content">
            <div className="brand-lockup">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#1A1A1A">
                <path d="M12 2L14 9.5H22L15.5 14L18 22L12 17.5L6 22L8.5 14L2 9.5H10L12 2Z"/>
              </svg>
              <div>
                <div className="brand-name">VISIONARY</div>
                <div className="brand-sub">AI CREATIVE STUDIO</div>
              </div>
            </div>

            <p className="hero-welcome">Welcome, Creative Director</p>
            <h1 className="hero-heading">
              Turn your <em>vision</em> into a scene.
            </h1>
            <p className="hero-sub">
              Describe your idea and we'll craft a production one-pager<br/>
              that helps you visualize every detail.
            </p>

            {error && <div className="discover-error">{error}</div>}

            {/* Chat card */}
            <div className="chat-card">
              <div className="chat-card-header">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="#7C5CFC">
                  <path d="M12 2L14 9.5H22L15.5 14L18 22L12 17.5L6 22L8.5 14L2 9.5H10L12 2Z"/>
                </svg>
                <span>Chatbot Interface</span>
              </div>
              <div className="chat-card-body">
                <textarea
                  ref={textRef}
                  className="chat-input"
                  placeholder="What's on your mind?"
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  onKeyDown={onKey}
                  disabled={loading}
                  autoFocus
                />
                {!prompt && <p className="chat-sub-placeholder">Describe the scene, shot, mood, characters, styling, location…</p>}
              </div>
              <div className="chat-card-footer">
                <button className="chat-add-btn" onClick={() => textRef.current?.focus()}>
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
                  Add details
                </button>
                {QUICK_TAGS.map(tag => (
                  <button key={tag} className="chat-tag-btn" onClick={() => addTag(tag)}>{tag}</button>
                ))}
                <button className="chat-send-btn" onClick={handleSend} disabled={!prompt.trim() || loading}>
                  {loading
                    ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#fff" strokeWidth="2.5" strokeDasharray="28" strokeDashoffset="8"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.75s" repeatCount="indefinite"/></circle></svg>
                    : <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M2 14L14 8 2 2v4.5l8 1.5-8 1.5V14z" fill="#fff"/></svg>
                  }
                </button>
              </div>
            </div>
          </div>

          <div className="hero-img-wrap">
            <img src={heroImg} alt="" className="hero-img" />
            <div className="hero-img-fade" />
          </div>
        </div>

        {/* Body */}
        <div className="discover-body">

          {/* Categories + Ratio */}
          <div className="bottom-row">
            <div className="section-block flex-2">
              <h3 className="section-label">Start with a category</h3>
              <div className="category-grid">
                {CATEGORIES.map(cat => (
                  <div
                    key={cat.id}
                    className={`category-card${category === cat.id ? ' active' : ''}`}
                    onClick={() => pickCategory(cat.id)}
                    style={{ '--cat-color': cat.color }}
                  >
                    <span className="cat-icon" style={{ color: cat.color }}>{cat.icon}</span>
                    <span className="cat-label">{cat.label}</span>
                    <span className="cat-desc">{cat.desc}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="section-block flex-3">
              <h3 className="section-label">Choose aspect ratio</h3>
              <div className="ratio-grid">
                {RATIOS.map(r => (
                  <button
                    key={r.id}
                    className={`ratio-card${ratio === r.id ? ' active' : ''}`}
                    onClick={() => setRatio(r.id)}
                  >
                    <div
                      className="ratio-icon-box"
                      style={{
                        width: r.w, height: r.h,
                        border: r.dashed ? '1.5px dashed currentColor' : '1.5px solid currentColor',
                        borderRadius: 3,
                      }}
                    />
                    <span className="ratio-label">{r.label}</span>
                    <span className="ratio-sub">{r.sub}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Recent briefs */}
          {recents.length > 0 && (
            <div className="briefs-section">
              <h3 className="section-label">Recent briefs</h3>
              <div className="brief-grid">
                {recents.map((r, i) => (
                  <div key={r.id} className="brief-card" onClick={() => onOpenBrief(r.brief)}>
                    <div className="brief-card-top">
                      <span className="brief-card-meta">{(r.brand || r.name.split('—')[0]).trim().toUpperCase()} · {r.format}</span>
                    </div>
                    <div className="brief-card-hero" style={{ background: CARD_GRADIENTS[i % CARD_GRADIENTS.length] }} />
                    <div className="brief-card-footer">
                      <div className="brief-card-title">
                        {r.name}
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                          <path d="M6 12l4-4-4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                      <div className="brief-card-sub">{r.shots} shots · {r.duration} · {r.format}</div>
                    </div>
                  </div>
                ))}
                <div className="brief-card new-brief-card" onClick={() => textRef.current?.focus()}>
                  <span className="new-brief-plus">+</span>
                  <span className="new-brief-label">New Brief</span>
                </div>
              </div>
            </div>
          )}

          {recents.length === 0 && (
            <div className="brief-grid">
              <div className="brief-card new-brief-card" onClick={() => textRef.current?.focus()}>
                <span className="new-brief-plus">+</span>
                <span className="new-brief-label">New Brief</span>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
