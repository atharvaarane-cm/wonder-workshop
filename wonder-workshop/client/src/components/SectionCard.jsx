import { useState } from 'react'

function Skeleton() {
  return (
    <div>
      {[100, 80, 60, 90, 40].map((w, i) => (
        <div key={i} className="skeleton-line" style={{ width: `${w}%` }} />
      ))}
    </div>
  )
}

export default function SectionCard({ name, loading, children, active, onClick, imageResolution, imageLoading, canAutoGenerate, onAutoGenerate, defaultCollapsed = false }) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)

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
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
              <path d="M8 1.5l1.6 4.9H14.7l-4.1 3 1.6 4.9L8 11.3l-4.2 3 1.6-5L1.3 6.4h5.1z" fill="currentColor"/>
            </svg>
            <span>AUTO-GENERATE</span>
          </button>
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
