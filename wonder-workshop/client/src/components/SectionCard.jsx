function Skeleton() {
  return (
    <div>
      {[100, 80, 60, 90, 40].map((w, i) => (
        <div key={i} className="skeleton-line" style={{ width: `${w}%` }} />
      ))}
    </div>
  )
}

export default function SectionCard({ num, name, loading, children, full, active, onClick }) {
  return (
    <div className={`section-card${full ? ' full' : ''}${active ? ' active' : ''}`} onClick={onClick}>
      <div className="section-header">
        <div className="section-num">{num}</div>
        <div className="section-name">{name}</div>
        <div className={`status-dot ${loading ? 'amber' : 'green'}`} />
      </div>
      <div className="section-body">
        {loading ? <Skeleton /> : children}
      </div>
    </div>
  )
}
