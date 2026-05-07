import { useState, useRef } from 'react'
import { generateBrief } from '../hooks/useBrief.js'

const CATEGORIES = [
  {
    id: 'branding', label: 'Branding', desc: 'Brand concepts', color: '#7C5CFC',
    icon: <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M10 2l1.5 5.5H17l-4.5 3.5 1.5 5.5L10 13.5 6 16.5l1.5-5.5L3 7.5h5.5L10 2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg>,
  },
  {
    id: 'production', label: 'Production', desc: 'Plan production', color: '#F59E0B',
    icon: <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><rect x="2" y="5" width="16" height="11" rx="2" stroke="currentColor" strokeWidth="1.4"/><path d="M13 10.5l-5 3V7.5l5 3z" fill="currentColor"/></svg>,
  },
  {
    id: 'filming', label: 'Filming', desc: 'Shot planning', color: '#3B82F6',
    icon: <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><rect x="2" y="6" width="11" height="9" rx="2" stroke="currentColor" strokeWidth="1.4"/><path d="M13 9l5-2.5v7L13 11V9z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg>,
  },
  {
    id: 'marketing', label: 'Marketing', desc: 'Campaign visuals', color: '#10B981',
    icon: <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M3 10c0-3.866 3.134-7 7-7s7 3.134 7 7-3.134 7-7 7-7-3.134-7-7z" stroke="currentColor" strokeWidth="1.4"/><path d="M7 10h6M10 7v6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>,
  },
]

const RATIOS = [
  { id: '16:9',   label: '16:9',  sub: 'Widescreen',   w: 34, h: 20 },
  { id: '9:16',   label: '9:16',  sub: 'Portrait',     w: 18, h: 30 },
  { id: '1:1',    label: '1:1',   sub: 'Square',       w: 26, h: 26 },
  { id: '4:5',    label: '4:5',   sub: 'Portrait 4:5', w: 22, h: 28 },
  { id: 'custom', label: 'Custom', sub: 'Set custom',  w: 28, h: 20, dashed: true },
]

const NAV_ITEMS = [
  { label: 'Home', active: true, icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 12L12 4l9 8v8a1 1 0 01-1 1H5a1 1 0 01-1-1v-8z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/><path d="M9 21V12h6v9" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg> },
  { label: 'Projects', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6"/><path d="M3 9h18" stroke="currentColor" strokeWidth="1.6"/></svg> },
  { label: 'Inspiration', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M9 21h6M12 21v-3M12 4v1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/><path d="M9 18h6a5 5 0 10-6 0z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg> },
  { label: 'Boards', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6"/><rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6"/><rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6"/><rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6"/></svg> },
  { label: 'Assets', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 2l9 5v10l-9 5-9-5V7l9-5z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg> },
]

const CARD_GRADIENTS = [
  'linear-gradient(135deg,#1a1a2e,#0f3460)',
  'linear-gradient(135deg,#1a0a0a,#4a1515)',
  'linear-gradient(135deg,#0a1a0a,#1a3a1a)',
  'linear-gradient(135deg,#1a1a1a,#3a3a0a)',
]

function EmptyPreview({ onFocus }) {
  return (
    <div className="preview-empty">
      <div className="preview-empty-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="4" width="18" height="16" rx="3" stroke="#1A1A1A" strokeWidth="1.4"/>
          <path d="M7 9h10M7 13h6" stroke="#1A1A1A" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
      </div>
      <p className="preview-empty-title">Your brief will appear here</p>
      <p className="preview-empty-sub">Generate a brief to see a live preview of your creative direction, shots, palette, and more.</p>
      <button className="preview-empty-cta" onClick={onFocus}>Start describing →</button>
    </div>
  )
}

function BriefPreview({ brief, recents, onOpenBrief }) {
  const cd = brief.creativeDirection ?? {}
  const bi = brief.brandInfo ?? {}
  const shots = brief.shotList ?? []
  const moods = brief.lightingMood ?? []
  const colors = bi.colors ?? []

  const moodTags = moods.flatMap(m => m.tags ?? []).slice(0, 5)
  const deliverables = [
    cd.format && `${cd.format}`,
    cd.shots && `${cd.shots} shots`,
    cd.duration && cd.duration,
  ].filter(Boolean)

  return (
    <div className="preview-body">
      <div className="preview-brief-card">
        <div className="preview-card-top">
          <div className="preview-card-meta">{cd.brand?.toUpperCase()} {cd.format ? `· ${cd.format}` : ''}</div>
          <div className="preview-card-title">{brief.title ?? cd.concept ?? 'Creative Brief'}</div>

          {moodTags.length > 0 && (
            <div className="preview-mood-tags">
              {moodTags.map((t, i) => <span key={i} className="preview-mood-tag">{t}</span>)}
            </div>
          )}
        </div>

        {shots.length > 0 && (
          <div className="preview-shots">
            {shots.slice(0, 3).map((s, i) => (
              <div key={i} className="preview-shot-row">
                <span className="preview-shot-num">{i + 1}</span>
                <span className="preview-shot-desc">{s.framing} — {(s.description ?? '').substring(0, 55)}{(s.description ?? '').length > 55 ? '…' : ''}</span>
              </div>
            ))}
          </div>
        )}

        <div className="preview-scenes-grid">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="preview-scene" style={{ background: CARD_GRADIENTS[i % CARD_GRADIENTS.length] }} />
          ))}
        </div>

        {colors.length > 0 && (
          <div className="preview-palette">
            <span className="preview-palette-label">Palette</span>
            <div className="preview-swatches">
              {colors.map((c, i) => (
                <div key={i} className="preview-swatch" style={{ background: c.hex ?? '#ccc' }} title={c.name ?? c.hex} />
              ))}
            </div>
          </div>
        )}

        {deliverables.length > 0 && (
          <div className="preview-deliverables">
            <div className="preview-deliv-label">Deliverables</div>
            <div className="preview-deliv-items">
              {deliverables.map((d, i) => <span key={i} className="preview-deliv-item">{d}</span>)}
            </div>
          </div>
        )}
      </div>

      {recents.length > 1 && (
        <div className="preview-recents">
          <div className="preview-recents-label">Recent briefs</div>
          {recents.slice(1, 3).map((r, i) => (
            <div key={r.id} className="preview-recent-card" onClick={() => onOpenBrief(r.brief)}>
              <div className="preview-recent-icon" style={{ background: CARD_GRADIENTS[i % CARD_GRADIENTS.length] }}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="10" rx="2" stroke="rgba(255,255,255,0.6)" strokeWidth="1.3"/></svg>
              </div>
              <div className="preview-recent-info">
                <div className="preview-recent-name">{r.name}</div>
                <div className="preview-recent-meta">{r.shots} shots · {r.format}</div>
              </div>
              <svg className="preview-recent-arrow" width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M6 12l4-4-4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Discover({ onGenerate, recents = [], onOpenBrief, latestBrief }) {
  const [prompt, setPrompt]         = useState('')
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState(null)
  const [ratio, setRatio]           = useState('16:9')
  const [category, setCategory]     = useState(null)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const textRef = useRef(null)

  const previewBrief = latestBrief ?? recents[0]?.brief ?? null

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

      {/* ── Sidebar ───────────────────────────────────────────── */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#7C5CFC">
            <path d="M12 2L14 9.5H22L15.5 14L18 22L12 17.5L6 22L8.5 14L2 9.5H10L12 2Z"/>
          </svg>
          <span className="sidebar-logo-text">WW</span>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map(item => (
            <div key={item.label} className={`nav-item${item.active ? ' active' : ''}`}>
              {item.icon}
              <span>{item.label}</span>
            </div>
          ))}
        </nav>

        <div className="sidebar-user">
          <div className="user-avatar">A</div>
          <span className="user-name">Creative<br/>Director</span>
        </div>
      </aside>

      {/* ── Right area ────────────────────────────────────────── */}
      <div className="discover-right">

        {/* Topbar */}
        <header className="discover-topbar">
          <span className="topbar-ww-brand">wonder workshop</span>
          <div className="discover-topbar-right">
            <button className="new-brief-btn">
              + New brief
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            </button>
            <button className="bell-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </header>

        {/* Two columns */}
        <div className="discover-cols">

          {/* ── Form column ─────────────────────────────────── */}
          <main className="discover-form">
            <div className="form-heading">
              <p className="form-welcome">Welcome, Creative Director</p>
              <h1 className="form-title">
                Turn your <em className="wonder-em">wonder workshop</em> into a scene.
              </h1>
              <p className="form-sub">
                Describe your idea and we'll craft a production one-pager that helps you visualize every detail.
              </p>
            </div>

            {error && <div className="discover-error">{error}</div>}

            {/* Input card */}
            <div className="input-card">
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
                <button className="input-icon-btn" title="Attach file">
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                    <path d="M13.5 7.5l-5.5 5.5a3.5 3.5 0 01-4.95-4.95l5.5-5.5a2 2 0 012.83 2.83L5.88 11.4a.5.5 0 01-.71-.71L10.5 5.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <button className="input-icon-btn" title="Options">
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                    <path d="M2 4h12M4 8h8M6 12h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                  </svg>
                </button>
                <button className="input-icon-btn input-sparkle-btn" title="Enhance with AI">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="#7C5CFC">
                    <path d="M12 2L14 9.5H22L15.5 14L18 22L12 17.5L6 22L8.5 14L2 9.5H10L12 2Z"/>
                  </svg>
                </button>
                <button className="generate-btn" onClick={handleSend} disabled={!prompt.trim() || loading}>
                  {loading
                    ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#fff" strokeWidth="2.5" strokeDasharray="28" strokeDashoffset="8"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.75s" repeatCount="indefinite"/></circle></svg>
                    : 'Generate →'
                  }
                </button>
              </div>
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

            {/* Aspect ratio */}
            <div className="form-section">
              <h3 className="form-section-label">Choose aspect ratio</h3>
              <div className="ratio-row">
                {RATIOS.map(r => (
                  <button
                    key={r.id}
                    className={`ratio-card-h${ratio === r.id ? ' active' : ''}`}
                    onClick={() => setRatio(r.id)}
                  >
                    {ratio === r.id && <span className="ratio-check">✓</span>}
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

            {/* Advanced options */}
            <div className="advanced-section">
              <button className="advanced-toggle" onClick={() => setAdvancedOpen(!advancedOpen)}>
                Advanced options
                <svg
                  width="12" height="12" viewBox="0 0 12 12" fill="none"
                  style={{ transform: advancedOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                >
                  <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
              </button>
              {advancedOpen && (
                <div className="advanced-content">
                  <p className="advanced-placeholder">Additional generation options coming soon.</p>
                </div>
              )}
            </div>
          </main>

          {/* ── Preview panel ────────────────────────────────── */}
          <div className="discover-preview">
            <div className="preview-header">
              <span className="preview-title">Preview</span>
              <span className="preview-ratio-tag">{ratio}</span>
            </div>
            {previewBrief
              ? <BriefPreview brief={previewBrief} recents={recents} onOpenBrief={onOpenBrief} />
              : <EmptyPreview onFocus={() => textRef.current?.focus()} />
            }
          </div>

        </div>
      </div>
    </div>
  )
}
