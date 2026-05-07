import { useState, useRef } from 'react'
import { generateBrief } from '../hooks/useBrief.js'
import heroImg from '../assets/hero.png'

const CATEGORIES = [
  {
    id: 'branding', label: 'Branding', desc: 'Visualize brand concepts',
    color: '#7C5CFC',
    icon: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
        <path d="M10 2L12.5 7.5H18L13.5 11L15.5 17L10 13.5L4.5 17L6.5 11L2 7.5H7.5L10 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    id: 'production', label: 'Production', desc: 'Plan your production',
    color: '#F59E0B',
    icon: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
        <rect x="2" y="5" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M13 11l-5 3V8l5 3z" fill="currentColor"/>
        <path d="M6 2l2 3M14 2l-2 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: 'filming', label: 'Filming', desc: 'Plan shots and scenes',
    color: '#3B82F6',
    icon: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
        <rect x="2" y="6" width="12" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M14 9l4-2v6l-4-2V9z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
        <path d="M2 6V5a1 1 0 011-1h4M9 4h4a1 1 0 011 1v1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: 'marketing', label: 'Marketing', desc: 'Campaigns and promotional visuals',
    color: '#10B981',
    icon: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
        <path d="M3 10h14M3 10l4-4M3 10l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="15" cy="10" r="2" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
    ),
  },
]

const RATIOS = [
  { id: '16:9',   label: '16 : 9', sub: 'Widescreen',   w: 32, h: 18 },
  { id: '9:16',   label: '9 : 16', sub: 'Portrait',      w: 18, h: 32 },
  { id: '1:1',    label: '1 : 1',  sub: 'Square',        w: 28, h: 28 },
  { id: '4:5',    label: '4 : 5',  sub: 'Portrait 4:5',  w: 22, h: 28 },
  { id: 'custom', label: 'Custom', sub: 'Set custom',    w: 28, h: 20, dashed: true },
]

const QUICK_TAGS = ['Lighting', 'Mood', 'Camera', 'Style']

const CARD_GRADIENTS = [
  'linear-gradient(135deg,#1a1a2e,#0f3460)',
  'linear-gradient(135deg,#1a0a0a,#4a1515)',
  'linear-gradient(135deg,#0a1a0a,#1a3a1a)',
  'linear-gradient(135deg,#1a1a1a,#3a3a0a)',
  'linear-gradient(135deg,#1a0a2e,#4a1580)',
  'linear-gradient(135deg,#0a1a2e,#1a4060)',
  'linear-gradient(135deg,#2e1a0a,#603a1a)',
  'linear-gradient(135deg,#1a2e1a,#3a6040)',
]

const DOT_COLORS = ['#2D9A4E', '#2D9A4E', '#D97706', 'rgba(255,255,255,0.18)']

export default function Discover({ onGenerate, recents = [], onOpenBrief }) {
  const [prompt, setPrompt]       = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState(null)
  const [ratio, setRatio]         = useState('16:9')
  const [category, setCategory]   = useState(null)
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
    setCategory(id)
    const prefixes = {
      branding:   'Create a brand identity shoot for ',
      production: 'Plan a full production brief for ',
      filming:    'Create a detailed shot list and scene plan for ',
      marketing:  'Design a marketing campaign visual brief for ',
    }
    setPrompt(prefixes[id] || '')
    textRef.current?.focus()
  }

  return (
    <div className="discover-layout">

      {/* ── Icon sidebar ────────────────────────────────────────── */}
      <aside className="sidebar">
        <div className="sidebar-logo-icon">W</div>

        <nav className="sidebar-nav">
          {[
            { label: 'Home', active: true, icon: <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M3 9.5L10 3l7 6.5V17a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M7 18v-6h6v6" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg> },
            { label: 'Projects', icon: <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><rect x="2" y="4" width="16" height="13" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M2 8h16" stroke="currentColor" strokeWidth="1.5"/><path d="M6 4V3M14 4V3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
            { label: 'Inspiration', icon: <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M10 2v2M10 16v2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M2 10h2M16 10h2M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><circle cx="10" cy="10" r="3.5" stroke="currentColor" strokeWidth="1.5"/></svg> },
            { label: 'Boards', icon: <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><rect x="2" y="2" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><rect x="11" y="2" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><rect x="2" y="11" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><rect x="11" y="11" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/></svg> },
            { label: 'Assets', icon: <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M10 2l8 4v8l-8 4-8-4V6l8-4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M2 6l8 4m0 0l8-4m-8 4v8" stroke="currentColor" strokeWidth="1.5"/></svg> },
          ].map(item => (
            <div key={item.label} className={`nav-icon-item${item.active ? ' active' : ''}`}>
              {item.icon}
              <span>{item.label}</span>
            </div>
          ))}
        </nav>

        <div className="sidebar-user-icon">
          <div className="user-avatar">A</div>
          <span>Creative<br/>Director</span>
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────────────────────── */}
      <main className="discover-main">

        {/* Hero strip */}
        <div className="hero-strip">
          <div className="hero-text">
            <p className="hero-welcome">Welcome, Creative Director</p>
            <h1 className="hero-heading">
              Turn your <em>vision</em> into a scene.
            </h1>
            <p className="hero-sub">
              Describe your idea and we'll craft a production one-pager<br/>
              that helps you visualize every detail.
            </p>
          </div>
          <div className="hero-img-wrap">
            <img src={heroImg} alt="" className="hero-img" />
            <div className="hero-img-fade" />
          </div>
        </div>

        <div className="discover-body">

          {error && <div className="discover-error">{error}</div>}

          {/* Chat card */}
          <div className="chat-card">
            <div className="chat-card-header">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M8 1l1.5 3.5L13 6l-2.5 2.5.5 3.5L8 10.5 5 12l.5-3.5L3 6l3.5-1.5L8 1z" stroke="#7C5CFC" strokeWidth="1.3" strokeLinejoin="round" fill="rgba(124,92,252,0.15)"/>
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
              <p className="chat-sub-placeholder">
                {!prompt && 'Describe the scene, shot, mood, characters, styling, location…'}
              </p>
            </div>

            <div className="chat-card-footer">
              <button className="chat-add-btn" onClick={() => textRef.current?.focus()}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                Add details
              </button>
              {QUICK_TAGS.map(tag => (
                <button key={tag} className="chat-tag-btn" onClick={() => addTag(tag)}>{tag}</button>
              ))}
              <button className="chat-send-btn" onClick={handleSend} disabled={!prompt.trim() || loading}>
                {loading
                  ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#fff" strokeWidth="2.5" strokeDasharray="28" strokeDashoffset="8"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.75s" repeatCount="indefinite"/></circle></svg>
                  : <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 14L14 8 2 2v4.5l8 1.5-8 1.5V14z" fill="#fff"/></svg>
                }
              </button>
            </div>
          </div>

          {/* Categories + Aspect ratio */}
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
                        border: r.dashed
                          ? '1.5px dashed currentColor'
                          : `1.5px solid ${ratio === r.id ? '#7C5CFC' : 'currentColor'}`,
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

          {/* Brief cards */}
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
            <div className="briefs-section">
              <div className="brief-grid">
                <div className="brief-card new-brief-card solo" onClick={() => textRef.current?.focus()}>
                  <span className="new-brief-plus">+</span>
                  <span className="new-brief-label">New Brief</span>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  )
}
