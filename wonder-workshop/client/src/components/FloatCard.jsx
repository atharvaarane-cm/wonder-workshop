import { useRef, useEffect } from 'react'

export default function FloatCard({ id, num, title, width = 520, pos, onDrag, onClick, active, children }) {
  const dragging = useRef(false)
  const origin = useRef(null)

  useEffect(() => {
    function onMove(e) {
      if (!dragging.current) return
      onDrag(id, {
        x: e.clientX - origin.current.dx,
        y: e.clientY - origin.current.dy,
      })
    }
    function onUp() { dragging.current = false }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [id, onDrag])

  function onHeaderMouseDown(e) {
    e.stopPropagation()
    dragging.current = true
    origin.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y }
  }

  return (
    <div
      className={`float-card${active ? ' active' : ''}`}
      style={{ left: pos.x, top: pos.y, width }}
      onClick={onClick}
    >
      <div className="float-card-header" onMouseDown={onHeaderMouseDown}>
        <span className="sec-num">{num}</span>
        <span className="float-card-title">{title}</span>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="drag-icon">
          <circle cx="5" cy="4" r="1.2" fill="currentColor"/><circle cx="11" cy="4" r="1.2" fill="currentColor"/>
          <circle cx="5" cy="8" r="1.2" fill="currentColor"/><circle cx="11" cy="8" r="1.2" fill="currentColor"/>
          <circle cx="5" cy="12" r="1.2" fill="currentColor"/><circle cx="11" cy="12" r="1.2" fill="currentColor"/>
        </svg>
      </div>
      <div className="float-card-body">
        {children}
      </div>
    </div>
  )
}
