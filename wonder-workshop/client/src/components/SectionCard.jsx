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

export default function SectionCard({ name, loading, children, active, onClick, imageLoading, canAutoGenerate, onAutoGenerate, canRegenerate, onRegenerate, canLock, locked, onToggleLock, disabledReason, onDelete, defaultCollapsed = false }) {
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
      className={`section-card${active ? ' active' : ''}${collapsed ? ' collapsed' : ''}${locked ? ' locked' : ''}`}
      data-section-title={name}
      onClick={onClick}
    >
      <div className="section-header">
        <div className="section-name">{name}</div>
        <div className={`status-dot ${dotState}${imageLoading ? ' pulse' : ''}`} title={imageLoading ? 'Generating images…' : undefined} />
        {locked && (
          <span className="section-lock-badge" title="Locked — unlock to make changes">
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
              <rect x="3.5" y="7.5" width="9" height="7" rx="1.2" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M5.5 7.5V5a2.5 2.5 0 0 1 5 0v2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            <span>LOCKED</span>
          </span>
        )}
        {canAutoGenerate && (
          <button
            className="section-autogen-btn"
            onClick={e => { e.stopPropagation(); onAutoGenerate?.() }}
            disabled={imageLoading || locked || !!disabledReason}
            title={
              locked ? 'Section is locked — unlock to generate'
              : disabledReason
              || 'Generate images for every empty slot in this section'
            }
          >
            <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
              <path d="M9.585.52a.5.5 0 0 1 .226.589L8.144 5.5h3.356a.5.5 0 0 1 .429.756l-5.5 9a.5.5 0 0 1-.846-.522L6.864 10.5H3.5a.5.5 0 0 1-.429-.756l5.5-9a.5.5 0 0 1 .614-.224z"/>
            </svg>
            <span>AUTO-GENERATE</span>
          </button>
        )}
        {canRegenerate && (
          <button
            className="section-regen-btn"
            onClick={e => { e.stopPropagation(); onRegenerate?.() }}
            disabled={imageLoading || locked}
            title={locked ? 'Section is locked — unlock to regenerate' : 'Force-regenerate every image in this section (uses the latest prompts)'}
          >
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
              <path d="M14 2v4h-4M2 14v-4h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M3.5 8a4.5 4.5 0 0 1 8-2.5L14 8M12.5 8a4.5 4.5 0 0 1-8 2.5L2 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>REGENERATE</span>
          </button>
        )}
        {canLock && (
          <button
            className={`section-lock-btn${locked ? ' active' : ''}`}
            onClick={e => { e.stopPropagation(); onToggleLock?.() }}
            title={locked ? 'Unlock — allow auto-gen / regen' : 'Lock — freeze this section and gate downstream auto-gen'}
          >
            {locked ? (
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <rect x="3" y="7" width="10" height="7.5" rx="1.2" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.15"/>
                <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <rect x="3" y="7" width="10" height="7.5" rx="1.2" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M5.5 7V5a2.5 2.5 0 0 1 4.6-1.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            )}
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
