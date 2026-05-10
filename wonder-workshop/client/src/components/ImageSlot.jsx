import { useContext, useEffect, useRef, useState } from 'react'
import { ProjectContext } from '../hooks/useProject.js'

function toast(msg, type = 'success') {
  window.dispatchEvent(new CustomEvent('ww-toast', { detail: { msg, type } }))
}

export default function ImageSlot({ label, prompt, style, className }) {
  const project = useContext(ProjectContext)
  const slotKey = prompt || null
  const initial = slotKey && project?.images?.[slotKey]

  const [versions, setVersions] = useState(() => initial?.versions || [])
  const [activeVersion, setActiveVersion] = useState(() => initial?.activeVersion ?? 0)
  const [editablePrompt, setEditablePrompt] = useState(prompt || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [editingPrompt, setEditingPrompt] = useState(false)
  const [isActive, setIsActive] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [dropActive, setDropActive] = useState(false)
  const inputRef = useRef()
  const slotRef = useRef()
  const activeImage = versions[activeVersion] || null

  // Reflect agent-panel selection: outline whichever slot the chat is targeting.
  useEffect(() => {
    function onTarget(e) {
      setIsActive(!!e.detail?.prompt && e.detail.prompt === editablePrompt)
    }
    window.addEventListener('ww-active-image-target', onTarget)
    return () => window.removeEventListener('ww-active-image-target', onTarget)
  }, [editablePrompt])

  // Lightbox: lock body scroll + Esc to close.
  useEffect(() => {
    if (!lightboxOpen) return
    function onKey(e) { if (e.key === 'Escape') setLightboxOpen(false) }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [lightboxOpen])

  // Notify Board so it can turn the section-card dot amber while any image
  // in that section is generating. Cleanup decrements on unmount or when
  // loading flips back to false.
  useEffect(() => {
    if (!loading) return
    const sectionTitle = slotRef.current?.closest('[data-section-title]')?.dataset.sectionTitle
    if (!sectionTitle) return
    window.dispatchEvent(new CustomEvent('ww-loading-change', { detail: { sectionTitle, delta: 1 } }))
    return () => {
      window.dispatchEvent(new CustomEvent('ww-loading-change', { detail: { sectionTitle, delta: -1 } }))
    }
  }, [loading])

  useEffect(() => {
    if (!versions.length) setEditablePrompt(prompt || '')
  }, [prompt, versions.length])

  // Re-hydrate when this slot's saved data changes externally — e.g. when
  // the user opens a different project, or when another slot dragged a
  // version *into* this slot. We compare structurally to avoid the loop
  // between this effect and the save-on-change effect below: if our local
  // state already matches what's in the store, do nothing.
  useEffect(() => {
    if (!slotKey || !project?.images) return
    const saved = project.images[slotKey]
    const savedVersions = saved?.versions || []
    const savedActive = saved?.activeVersion ?? 0
    const sameLength = savedVersions.length === versions.length
    const sameOrder = sameLength && savedVersions.every((v, i) =>
      v.src === versions[i]?.src && v.createdAt === versions[i]?.createdAt,
    )
    const sameActive = savedActive === activeVersion
    if (sameOrder && sameActive) return
    setVersions(savedVersions)
    setActiveVersion(savedActive)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id, project?.images?.[slotKey]])

  // Persist generated versions to the project store. Uploaded blob URLs
  // would not survive a refresh, so they're filtered out.
  useEffect(() => {
    if (!slotKey || !project?.saveImage) return
    const persistable = versions.filter(v => v.source !== 'upload')
    if (!persistable.length && !project.images?.[slotKey]) return
    project.saveImage(slotKey, { versions: persistable, activeVersion })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versions, activeVersion])

  function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    const next = {
      src: URL.createObjectURL(file),
      prompt: editablePrompt,
      source: 'upload',
      createdAt: new Date().toISOString(),
    }
    setVersions(prev => {
      const updated = [...prev, next]
      setActiveVersion(updated.length - 1)
      return updated
    })
    setError(null)
    setMenuOpen(false)
  }

  async function generate(e) {
    e?.stopPropagation()
    const text = editablePrompt.trim()
    if (!text) return
    setLoading(true)
    setMenuOpen(false)
    setError(null)
    try {
      const res = await fetch('/api/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: text }),
      })
      const data = await res.json()
      if (data.image) {
        const next = {
          src: data.image,
          prompt: text,
          source: 'generated',
          createdAt: new Date().toISOString(),
        }
        setVersions(prev => {
          const updated = [...prev, next]
          setActiveVersion(updated.length - 1)
          return updated
        })
        setEditingPrompt(false)
        toast(versions.length ? 'New image version created' : 'Image generated')
      }
      else { setError(data.error || 'Failed'); toast(data.error || 'Generation failed', 'error') }
    } catch {
      setError('SD not running')
      toast('Generation failed', 'error')
    } finally {
      setLoading(false)
    }
  }

  function deleteImage(e) {
    e.stopPropagation()
    setVersions(prev => {
      const updated = prev.filter((_, idx) => idx !== activeVersion)
      setActiveVersion(Math.max(0, Math.min(activeVersion, updated.length - 1)))
      return updated
    })
    setEditingPrompt(false)
    toast('Image deleted')
  }

  function upscale(e) {
    e.stopPropagation()
    toast('Upscale queued')
  }

  function activateChatTarget(e) {
    const sectionEl = e.currentTarget.closest('[data-section-title]')
    const sectionTitle = sectionEl?.dataset.sectionTitle || ''
    let slotNumber = 1
    if (sectionEl) {
      const peers = Array.from(sectionEl.querySelectorAll('.img-slot'))
      const idx = peers.indexOf(e.currentTarget)
      if (idx >= 0) slotNumber = idx + 1
    }
    window.dispatchEvent(new CustomEvent('ww-active-image-target', {
      detail: {
        label: label || `Image ${slotNumber}`,
        prompt: editablePrompt,
        sectionTitle,
        slotNumber,
      },
    }))
  }

  function openLightbox(e) {
    e?.stopPropagation()
    setLightboxOpen(true)
  }

  function prevVersion(e) {
    e?.stopPropagation()
    if (versions.length < 2) return
    setActiveVersion(v => (v - 1 + versions.length) % versions.length)
  }
  function nextVersion(e) {
    e?.stopPropagation()
    if (versions.length < 2) return
    setActiveVersion(v => (v + 1) % versions.length)
  }

  // Drag the currently-active version onto another slot to move it there.
  function onImgDragStart(e) {
    if (!activeImage || !slotKey) return
    const payload = { fromSlotKey: slotKey, version: activeImage }
    e.dataTransfer.setData('application/x-ww-version', JSON.stringify(payload))
    e.dataTransfer.effectAllowed = 'move'
  }
  function onSlotDragOver(e) {
    if (!e.dataTransfer.types.includes('application/x-ww-version')) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDropActive(true)
  }
  function onSlotDragLeave() { setDropActive(false) }
  function onSlotDrop(e) {
    setDropActive(false)
    const raw = e.dataTransfer.getData('application/x-ww-version')
    if (!raw || !slotKey) return
    e.preventDefault()
    let payload
    try { payload = JSON.parse(raw) } catch { return }
    if (!payload?.version || !payload.fromSlotKey || payload.fromSlotKey === slotKey) return
    project?.moveImage?.(payload.fromSlotKey, slotKey, payload.version)
    toast('Image moved')
  }

  return (
    <>
    <div
      ref={slotRef}
      className={`img-slot${isActive ? ' active' : ''}${dropActive ? ' drop-target' : ''} ${className || ''}`}
      style={style}
      onMouseDownCapture={activateChatTarget}
      onDragOver={onSlotDragOver}
      onDragLeave={onSlotDragLeave}
      onDrop={onSlotDrop}
    >
      {activeImage
        ? <>
            <img
              src={activeImage.src}
              alt={label}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', cursor: 'zoom-in' }}
              onClick={openLightbox}
              draggable={!!slotKey}
              onDragStart={onImgDragStart}
            />
            <div className="img-version-badge">
              {versions.length > 1 && (
                <button
                  className="img-version-arrow"
                  onClick={prevVersion}
                  title="Previous version"
                  aria-label="Previous version"
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M6.5 2L3 5l3.5 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              )}
              <span>{activeVersion + 1} of {versions.length}</span>
              {versions.length > 1 && (
                <button
                  className="img-version-arrow"
                  onClick={nextVersion}
                  title="Next version"
                  aria-label="Next version"
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M3.5 2L7 5l-3.5 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              )}
            </div>
            <button
              className="img-magnify-btn"
              title="View larger"
              onClick={openLightbox}
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.6"/>
                <path d="M10.5 10.5l3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                <path d="M7 5v4M5 7h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
            </button>
            <div className="img-slot-overlay">
              <button className="img-slot-action" onClick={generate} disabled={loading}>{loading ? '…' : 'Refresh'}</button>
              <button className="img-slot-action" onClick={e => { e.stopPropagation(); setEditingPrompt(v => !v) }}>Edit Prompt</button>
              <button className="img-slot-action" onClick={deleteImage}>Delete</button>
              <button className="img-slot-action" onClick={upscale}>Upscale</button>
            </div>
            {editingPrompt && (
              <div className="img-prompt-editor" onClick={e => e.stopPropagation()}>
                <textarea
                  value={editablePrompt}
                  onChange={e => setEditablePrompt(e.target.value)}
                  placeholder="Edit this image prompt..."
                />
                <button onClick={generate} disabled={loading || !editablePrompt.trim()}>
                  {loading ? '…' : 'Regenerate'}
                </button>
              </div>
            )}
          </>
        : <div
            className={`img-slot-empty${menuOpen ? ' menu-open' : ''}`}
            onClick={e => { e.stopPropagation(); if (!loading) setMenuOpen(o => !o) }}
          >
            {loading
              ? <div className="img-slot-loading">
                  <div className="loading-dots" aria-hidden="true">
                    <span /><span /><span />
                  </div>
                  <span className="loading-label">Generating…</span>
                </div>
              : menuOpen
                ? <div className="img-slot-actions" onClick={e => e.stopPropagation()}>
                    <button className="img-slot-btn" onClick={e => { e.stopPropagation(); inputRef.current.click() }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      Upload
                    </button>
                    {editablePrompt && (
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
            {menuOpen && (
              <textarea
                className="empty-prompt-editor"
                value={editablePrompt}
                onChange={e => setEditablePrompt(e.target.value)}
                onClick={e => e.stopPropagation()}
                placeholder="Edit prompt before generating..."
              />
            )}
            {error && <span className="img-slot-error">{error}</span>}
          </div>
      }
      <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
    </div>

    {lightboxOpen && activeImage && (
      <div className="img-lightbox" onClick={() => setLightboxOpen(false)}>
        <div className="img-lightbox-content" onClick={e => e.stopPropagation()}>
          <img src={activeImage.src} alt={label} />
          {(label || activeImage.prompt) && (
            <div className="img-lightbox-caption">
              {label && <strong>{label}</strong>}
              {activeImage.prompt && <span>{activeImage.prompt}</span>}
            </div>
          )}
        </div>
        <button
          className="img-lightbox-close-btn"
          onClick={() => setLightboxOpen(false)}
          title="Close (Esc)"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
    )}
    </>
  )
}
