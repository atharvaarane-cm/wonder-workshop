function Skeleton() {
  return (
    <div>
      {[100, 80, 60, 90, 40].map((w, i) => (
        <div key={i} className="skeleton-line" style={{ width: `${w}%` }} />
      ))}
    </div>
  )
}

export default function SectionCard({ num, name, loading, children, active, onClick }) {
  return (
    <div className={`section-card${active ? ' active' : ''}`} onClick={onClick}>
      <div className="section-header">
        <div className="section-num">{num}</div>
        <div className="section-name">{name}</div>
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
      </div>
      <div className="section-body">
        {loading ? <Skeleton /> : children}
      </div>
    </div>
  )
}
