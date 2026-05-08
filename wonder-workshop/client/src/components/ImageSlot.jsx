import { useContext, useEffect, useRef, useState } from 'react'
import { ratioDimensions } from '../hooks/useBrief.js'
import { ProjectContext } from '../hooks/useProject.js'

function toast(msg, type = 'success') {
  window.dispatchEvent(new CustomEvent('ww-toast', { detail: { msg, type } }))
}

export default function ImageSlot({ label, prompt, style, className, ratio }) {
  const project = useContext(ProjectContext)
  const slotKey = prompt || null
  const initial = slotKey && project?.images?.[slotKey] || null

  const [src, setSrc] = useState(initial?.src || null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [customPrompt, setCustomPrompt] = useState(initial?.customPrompt || null)
  const [usedPrompt, setUsedPrompt] = useState(initial?.usedPrompt || null)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef()
  const containerRef = useRef()
  const stateRef = useRef({ src, loading, prompt })
  const generateRef = useRef()
  const effectivePrompt = customPrompt ?? prompt
  stateRef.current = { src, loading, prompt: effectivePrompt }

  // If the project context updates this slot's saved image (e.g. user
  // switched projects), hydrate the displayed src.
  useEffect(() => {
    if (!slotKey || !project?.images) return
    const saved = project.images[slotKey]
    if (saved?.src && saved.src !== src) {
      setSrc(saved.src)
      setUsedPrompt(saved.usedPrompt || null)
      setCustomPrompt(saved.customPrompt || null)
    }
    // Intentionally only rerun on project id / slotKey change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id, slotKey])

  useEffect(() => {
    if (!lightboxOpen) return
    setEditValue(usedPrompt ?? effectivePrompt ?? '')
    function onKey(e) { if (e.key === 'Escape') setLightboxOpen(false) }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [lightboxOpen])

  useEffect(() => {
    let timer
    function onBatchGenerate(e) {
      const { src, loading, prompt } = stateRef.current
      if (src || loading || !prompt) return
      const scope = e.detail?.scope
      const force = !!e.detail?.force
      if (!force && src) return
      const sectionEl = containerRef.current?.closest('[data-section-id]')
      const ownSection = sectionEl?.dataset.sectionId
      if (scope !== 'all' && scope !== ownSection) return
      const jitter = scope === 'all' ? Math.random() * 4500 : Math.random() * 1200
      timer = setTimeout(() => generateRef.current?.(), jitter)
    }
    window.addEventListener('ww-generate', onBatchGenerate)
    return () => {
      window.removeEventListener('ww-generate', onBatchGenerate)
      if (timer) clearTimeout(timer)
    }
  }, [])

  function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setSrc(URL.createObjectURL(file))
    setError(null)
    setMenuOpen(false)
    setUsedPrompt(null)
    setCustomPrompt(null)
  }

  function generate(overridePrompt) {
    const promptToUse = typeof overridePrompt === 'string' ? overridePrompt : effectivePrompt
    if (!promptToUse) return
    setLoading(true)
    setMenuOpen(false)
    setError(null)
    const dims = ratioDimensions(ratio)
    // Load Pollinations URL directly in the browser — no Vercel timeout.
    // Pollinations rate-limits under parallel load, so retry up to 3x
    // with a fresh seed + backoff before giving up.
    const MAX_ATTEMPTS = 3
    function attempt(n) {
      const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(promptToUse)}?width=${dims.width}&height=${dims.height}&nologo=true&enhance=true&seed=${Date.now() + n * 7919}`
      const img = new Image()
      img.onload = () => {
        setSrc(url)
        setUsedPrompt(promptToUse)
        const nextCustom = typeof overridePrompt === 'string' ? overridePrompt : customPrompt
        if (typeof overridePrompt === 'string') setCustomPrompt(overridePrompt)
        setLoading(false)
        if (slotKey && project?.saveImage) {
          project.saveImage(slotKey, { src: url, usedPrompt: promptToUse, customPrompt: nextCustom || null })
        }
        toast('Image generated')
      }
      img.onerror = () => {
        if (n < MAX_ATTEMPTS) {
          const backoff = 1500 * n + Math.random() * 1500
          setTimeout(() => attempt(n + 1), backoff)
        } else {
          setError('Generation failed')
          setLoading(false)
          toast('Generation failed', 'error')
        }
      }
      img.src = url
    }
    attempt(1)
  }
  generateRef.current = generate

  function regenerateFromEdit() {
    const trimmed = editValue.trim()
    if (!trimmed) return
    setLightboxOpen(false)
    generate(trimmed)
  }

  return (
    <>
      <div ref={containerRef} className={`img-slot ${className || ''}`} style={style}>
        {src
          ? <>
              <img
                src={src}
                alt={label}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', cursor: 'zoom-in' }}
                onClick={e => { e.stopPropagation(); setLightboxOpen(true) }}
              />
              <div className="img-slot-overlay">
                <button className="img-slot-action" onClick={e => { e.stopPropagation(); inputRef.current.click() }}>↑ Replace</button>
                {effectivePrompt && <button className="img-slot-action" onClick={e => { e.stopPropagation(); generate() }} disabled={loading}>{loading ? '…' : '✦ Regen'}</button>}
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
                : error
                  ? <div className="img-slot-error-wrap" onClick={e => e.stopPropagation()}>
                      <span className="img-slot-error">{error}</span>
                      {effectivePrompt && (
                        <button className="img-slot-btn generate" onClick={() => generate()}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          Retry
                        </button>
                      )}
                    </div>
                  : menuOpen
                    ? <div className="img-slot-actions" onClick={e => e.stopPropagation()}>
                        <button className="img-slot-btn" onClick={e => { e.stopPropagation(); inputRef.current.click() }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          Upload
                        </button>
                        {effectivePrompt && (
                          <button className="img-slot-btn generate" onClick={() => generate()}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" fill="currentColor"/></svg>
                            Generate
                          </button>
                        )}
                      </div>
                    : <div className="img-slot-plus">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                      </div>
              }
              {label && !menuOpen && !loading && !error && <span className="img-slot-label">{label}</span>}
            </div>
        }
        <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
      </div>

      {lightboxOpen && src && (
        <div
          className="img-lightbox"
          onClick={() => setLightboxOpen(false)}
        >
          <div className="img-lightbox-content" onClick={e => e.stopPropagation()}>
            <img src={src} alt={label} />
            {label && <div className="img-lightbox-caption">{label}</div>}
            {usedPrompt && (
              <div className="img-lightbox-prompt">
                <div className="img-lightbox-prompt-label">Prompt</div>
                <textarea
                  className="img-lightbox-prompt-input"
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  rows={3}
                  spellCheck={false}
                />
                <div className="img-lightbox-prompt-actions">
                  <button
                    className="img-lightbox-prompt-btn"
                    onClick={regenerateFromEdit}
                    disabled={loading || !editValue.trim() || editValue.trim() === usedPrompt}
                  >
                    {loading ? 'Generating…' : '✦ Regenerate with this prompt'}
                  </button>
                  {editValue !== usedPrompt && (
                    <button
                      className="img-lightbox-prompt-reset"
                      onClick={() => setEditValue(usedPrompt)}
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="img-lightbox-close">Click outside or press Esc to close</div>
        </div>
      )}
    </>
  )
}
