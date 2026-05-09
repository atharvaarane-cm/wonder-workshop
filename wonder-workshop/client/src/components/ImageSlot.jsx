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
  const inputRef = useRef()
  const activeImage = versions[activeVersion] || null

  useEffect(() => {
    if (!versions.length) setEditablePrompt(prompt || '')
  }, [prompt, versions.length])

  // Re-hydrate when the active project changes (e.g. user opened a different
  // project from the sidebar without unmounting).
  useEffect(() => {
    if (!slotKey || !project?.images) return
    const saved = project.images[slotKey]
    setVersions(saved?.versions || [])
    setActiveVersion(saved?.activeVersion ?? 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id])

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
    const sectionTitle = e.currentTarget.closest('[data-section-title]')?.dataset.sectionTitle || ''
    window.dispatchEvent(new CustomEvent('ww-active-image-target', {
      detail: {
        label: label || 'Image',
        prompt: editablePrompt,
        sectionTitle,
      },
    }))
  }

  return (
    <div className={`img-slot ${className || ''}`} style={style} onMouseDownCapture={activateChatTarget}>
      {activeImage
        ? <>
            <img src={activeImage.src} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            <div className="img-version-badge">{activeVersion + 1} of {versions.length}</div>
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
  )
}
