import { useState, useRef } from 'react'
import { generateBrief } from '../hooks/useBrief.js'

const FILTERS = ['All', '16:9', '9:16', '1:1', 'Filmmaking', 'Branding', 'Character & Identity', 'Social Media']
const DOT_COLORS = ['#2D9A4E', '#2D9A4E', '#D97706', 'rgba(255,255,255,0.18)']

const CARD_GRADIENTS = [
  'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
  'linear-gradient(135deg, #1a0a0a 0%, #2d1515 50%, #4a1515 100%)',
  'linear-gradient(135deg, #0a1a0a 0%, #102810 50%, #1a3a1a 100%)',
  'linear-gradient(135deg, #1a1a1a 0%, #2a2a1a 50%, #3a3a0a 100%)',
  'linear-gradient(135deg, #1a0a2e 0%, #2d1560 50%, #4a1580 100%)',
  'linear-gradient(135deg, #0a1a2e 0%, #152d4a 50%, #1a4060 100%)',
  'linear-gradient(135deg, #2e1a0a 0%, #4a2d15 50%, #603a1a 100%)',
  'linear-gradient(135deg, #1a2e1a 0%, #2d4a2d 50%, #3a6040 100%)',
]

export default function Discover({ onGenerate, recents = [], onOpenBrief }) {
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [activeFilter, setActiveFilter] = useState('All')
  const textRef = useRef(null)

  async function handleSend() {
    const text = prompt.trim()
    if (!text || loading) return
    setLoading(true)
    setError(null)
    try {
      const brief = await generateBrief(text)
      onGenerate(brief)
    } catch (e) {
      setError(e.message)
      setLoading(false)
    }
  }

  function onKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const filtered = activeFilter === 'All'
    ? recents
    : recents.filter(r => r.format === activeFilter)

  return (
    <div className="discover-layout">

      {/* ── Sidebar ───────────────────────────────────────────────── */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-mark">W</div>
          <span className="sidebar-logo-name">Wonder Workshop</span>
        </div>

        <div className="sidebar-search">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <span>Search</span>
          <kbd>⌘K</kbd>
        </div>

        <div className="sidebar-section-label">Navigation</div>
        <nav className="sidebar-nav">
          <div className="nav-item">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
              <rect x="9" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
              <rect x="1" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
              <rect x="9" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
            </svg>
            Boards
          </div>
          <div className="nav-item active">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4"/>
              <circle cx="8" cy="8" r="2" fill="currentColor"/>
            </svg>
            Discover
          </div>
          <div className="nav-item">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M8 4.5v3.75l2.5 1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            Recents
          </div>
          <div className="nav-item">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="5.5" r="3" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M2 14c0-3 2.686-4.5 6-4.5s6 1.5 6 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            Team
          </div>
        </nav>

        <div className="sidebar-section-label">Recent Briefs</div>
        <div className="sidebar-recents">
          {recents.slice(0, 6).map((r, i) => (
            <div key={r.id} className="recent-item" onClick={() => onOpenBrief(r.brief)}>
              <span className="recent-dot" style={{ background: DOT_COLORS[i % DOT_COLORS.length] }} />
              <span className="recent-name">{r.name}</span>
            </div>
          ))}
          {recents.length === 0 && (
            <div className="recent-empty">No briefs yet</div>
          )}
        </div>

        <div className="sidebar-user">
          <div className="user-avatar">A</div>
          <div className="user-info">
            <div className="user-name">Atharvaa</div>
            <div className="user-role">CM Studio</div>
          </div>
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────────────────────── */}
      <main className="discover-main">
        <div className="discover-content">
          <h1 className="discover-heading">What are you producing today?</h1>

          {error && <div className="discover-error">{error}</div>}

          <div className="prompt-box">
            <textarea
              ref={textRef}
              placeholder="Describe your brief — brand, talent, format, duration, shot count, locations…"
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={onKey}
              disabled={loading}
              autoFocus
            />
            <div className="prompt-footer">
              <div className="prompt-footer-left">
                <button className="prompt-icon-btn" title="Attach file">
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                    <path d="M13.5 7.5l-6 6a4 4 0 01-5.657-5.657l6-6a2.5 2.5 0 013.536 3.536l-6.001 6a1 1 0 01-1.414-1.414l5.5-5.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                  </svg>
                </button>
                <button className="prompt-icon-btn" title="Voice input">
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                    <rect x="5.5" y="1" width="5" height="9" rx="2.5" stroke="currentColor" strokeWidth="1.4"/>
                    <path d="M2 8.5c0 3 1.8 4.5 6 4.5s6-1.5 6-4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                    <path d="M8 13v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
              <button className="send-btn" onClick={handleSend} disabled={!prompt.trim() || loading}>
                {loading
                  ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" strokeDasharray="31.4" strokeDashoffset="10"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite"/></circle></svg>
                  : <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                }
              </button>
            </div>
          </div>

          <div className="filter-chips">
            {FILTERS.map(f => (
              <button
                key={f}
                className={`filter-chip ${activeFilter === f ? 'active' : ''}`}
                onClick={() => setActiveFilter(f)}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="brief-grid">
            {filtered.map((r, i) => (
              <div key={r.id} className="brief-card" onClick={() => onOpenBrief(r.brief)}>
                <div className="brief-card-top">
                  <span className="brief-card-meta">{(r.brand || r.name.split('—')[0]).trim().toUpperCase()} · {r.format}</span>
                </div>
                <div className="brief-card-hero" style={{ background: CARD_GRADIENTS[i % CARD_GRADIENTS.length] }} />
                <div className="brief-card-footer">
                  <div className="brief-card-title">
                    {r.name}
                    <svg className="brief-card-arrow" width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <path d="M6 12l4-4-4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div className="brief-card-sub">{r.shots} shots · {r.duration} · {r.format}</div>
                </div>
              </div>
            ))}
            <div className="brief-card new-brief-card" onClick={() => { textRef.current?.focus(); textRef.current?.scrollIntoView({ behavior: 'smooth' }) }}>
              <span className="new-brief-plus">+</span>
              <span className="new-brief-label">New Brief</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
