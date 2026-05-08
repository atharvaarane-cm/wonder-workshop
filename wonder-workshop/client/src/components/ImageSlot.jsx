import { useRef, useState } from 'react'

function toast(msg, type = 'success') {
  window.dispatchEvent(new CustomEvent('ww-toast', { detail: { msg, type } }))
}

export default function ImageSlot({ label, prompt, style, className }) {
  const [src, setSrc] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const inputRef = useRef()

  function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setSrc(URL.createObjectURL(file))
    setError(null)
    setMenuOpen(false)
  }

  async function generate(e) {
    e.stopPropagation()
    if (!prompt) return
    setLoading(true)
    setMenuOpen(false)
    setError(null)
    try {
      const res = await fetch('/api/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })
      const data = await res.json()
      if (data.image) { setSrc(data.image); toast('Image generated') }
      else { setError(data.error || 'Failed'); toast(data.error || 'Generation failed', 'error') }
    } catch {
      setError('SD not running')
      toast('Generation failed', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`img-slot ${className || ''}`} style={style}>
      {src
        ? <>
            <img src={src} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            <div className="img-slot-overlay">
              <button className="img-slot-action" onClick={e => { e.stopPropagation(); inputRef.current.click() }}>↑ Replace</button>
              {prompt && <button className="img-slot-action" onClick={generate} disabled={loading}>{loading ? '…' : '✦ Regen'}</button>}
            </div>
          </>
        : <div
            className={`img-slot-empty${menuOpen ? ' menu-open' : ''}`}
            onClick={e => { e.stopPropagation(); if (!loading) setMenuOpen(o => !o) }}
          >
            {loading
              ? <div className="img-slot-spinner">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="31.4" strokeDashoffset="10"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite"/></circle></svg>
                  <span>Generating…</span>
                </div>
              : menuOpen
                ? <div className="img-slot-actions" onClick={e => e.stopPropagation()}>
                    <button className="img-slot-btn" onClick={e => { e.stopPropagation(); inputRef.current.click() }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      Upload
                    </button>
                    {prompt && (
                      <button className="img-slot-btn generate" onClick={generate}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" fill="currentColor"/></svg>
                        Generate
                      </button>
                    )}
                  </div>
                : <div className="img-slot-plus">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                  </div>
            }
            {label && !menuOpen && !loading && <span className="img-slot-label">{label}</span>}
            {error && <span className="img-slot-error">{error}</span>}
          </div>
      }
      <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
    </div>
  )
}
