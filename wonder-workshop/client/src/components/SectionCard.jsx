import { useState, useEffect } from 'react'

function Skeleton() {
  return (
    <div>
      {[100, 80, 60, 90, 40].map((w, i) => (
        <div key={i} className="skeleton-line" style={{ width: `${w}%` }} />
      ))}
    </div>
  )
}

export default function SectionCard({ name, loading, children, active, onClick, imageResolution, imageLoading, canAutoGenerate, onAutoGenerate, onDelete, defaultCollapsed = false }) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  // Two-click delete: first click arms it, second confirms. Auto-disarms
  // after a few seconds so a stray click doesn't leave it primed.
  const [confirmDelete, setConfirmDelete] = useState(false)
  useEffect(() => {
    if (!confirmDelete) return
    const t = setTimeout(() => setConfirmDelete(false), 3500)
    return () => clearTimeout(t)
  }, [confirmDelete])

  const dotState = loading || imageLoading ? 'amber' : 'green'

  return (
    <div
      className={`section-card${active ? ' active' : ''}${collapsed ? ' collapsed' : ''}`}
      data-section-title={name}
      onClick={onClick}
    >
      <div className="section-header">
        <div className="section-name">{name}</div>
        <div className={`status-dot ${dotState}${imageLoading ? ' pulse' : ''}`} title={imageLoading ? 'Generating images…' : undefined} />
        {imageResolution && <div className="section-resolution-badge">{imageResolution}</div>}
        {canAutoGenerate && (
          <button
            className="section-autogen-btn"
            onClick={e => { e.stopPropagation(); onAutoGenerate?.() }}
            disabled={imageLoading}
            title="Generate images for every empty slot in this section"
          >
            <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
              <path d="M9.585.52a.5.5 0 0 1 .226.589L8.144 5.5h3.356a.5.5 0 0 1 .429.756l-5.5 9a.5.5 0 0 1-.846-.522L6.864 10.5H3.5a.5.5 0 0 1-.429-.756l5.5-9a.5.5 0 0 1 .614-.224z"/>
            </svg>
            <span>AUTO-GENERATE</span>
          </button>
        )}
        {onDelete && (
          confirmDelete ? (
            <button
              className="section-delete-btn confirm"
              onClick={e => { e.stopPropagation(); setConfirmDelete(false); onDelete() }}
            >
              Delete?
            </button>
          ) : (
            <button
              className="section-delete-btn"
              onClick={e => { e.stopPropagation(); setConfirmDelete(true) }}
              title="Delete this section's content"
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <path d="M3 4h10M6.5 4V2.5h3V4M5 4l.5 9h5l.5-9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )
        )}
        <button
          className={`section-collapse-btn${collapsed ? ' collapsed' : ''}`}
          onClick={e => { e.stopPropagation(); setCollapsed(c => !c) }}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
            <path d="M2 4.5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
      {!collapsed && (
        <div className="section-body">
          {loading ? <Skeleton /> : children}
        </div>
      )}
    </div>
  )
}
