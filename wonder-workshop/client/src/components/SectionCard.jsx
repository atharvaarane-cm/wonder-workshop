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

export default function SectionCard({ num, name, loading, children, active, onClick, sectionId, hasImages }) {
  const [collapsed, setCollapsed] = useState(false)

  function generateImages(e) {
    e.stopPropagation()
    window.dispatchEvent(new CustomEvent('ww-generate', { detail: { scope: sectionId } }))
    window.dispatchEvent(new CustomEvent('ww-toast', { detail: { msg: `Generating ${name} images…`, type: 'success' } }))
  }

  return (
    <div className={`section-card${active ? ' active' : ''}${collapsed ? ' collapsed' : ''}`} onClick={onClick}>
      <div className="section-header">
        <div className="section-num">{num}</div>
        <div className="section-name">{name}</div>
        {hasImages && (
          <button
            className="section-gen-images"
            onClick={generateImages}
            title="Generate images for this section"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
              <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" fill="currentColor"/>
            </svg>
            Images
          </button>
        )}
        <button
          className="section-refresh"
          onClick={e => e.stopPropagation()}
          title="Refresh section"
        >
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
            <path d="M13.5 8A5.5 5.5 0 112.8 4.8M2.5 2v3h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div className={`status-dot ${loading ? 'amber' : 'green'}`} />
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
        <div className="section-body" data-section-id={sectionId}>
          {loading ? <Skeleton /> : children}
        </div>
      )}
    </div>
  )
}
