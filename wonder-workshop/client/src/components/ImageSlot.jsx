import { useContext, useEffect, useRef, useState } from 'react'
import { ProjectContext } from '../hooks/useProject.js'
import { enqueue } from '../utils/generationQueue.js'
import MentionInput from './MentionInput.jsx'

function toast(msg, type = 'success') {
  window.dispatchEvent(new CustomEvent('ww-toast', { detail: { msg, type } }))
}

const VIEW_COLORS = {
  'FRONT': '#0891B2',
  '3/4':   '#D97706',
  'SIDE':  '#7C5CFC',
}

const RATIO_DIMS = {
  '16:9': { width: 896, height: 504 },
  '9:16': { width: 504, height: 896 },
  '1:1':  { width: 768, height: 768 },
  '4:5':  { width: 640, height: 800 },
  '3:4':  { width: 624, height: 832 },
  '4:3':  { width: 896, height: 672 },
  '2:1':  { width: 896, height: 448 },
}

const RATIO_CSS = {
  '16:9': '16/9',
  '9:16': '9/16',
  '1:1':  '1/1',
  '4:5':  '4/5',
  '3:4':  '3/4',
  '4:3':  '4/3',
  '2:1':  '2/1',
}

export default function ImageSlot({ label, prompt, style, className, view, seed, ratio }) {
  const project = useContext(ProjectContext)
  const slotKey = prompt || null
  const initial = slotKey && project?.images?.[slotKey]

  const [versions, setVersions] = useState(() => initial?.versions || [])
  const [activeVersion, setActiveVersion] = useState(() => initial?.activeVersion ?? 0)
  const [editablePrompt, setEditablePrompt] = useState(prompt || '')
  const [loading, setLoading] = useState(false)
  const [queued, setQueued] = useState(false)
  const [error, setError] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [moreMenuOpen, setMoreMenuOpen] = useState(false)
  const [editingPrompt, setEditingPrompt] = useState(false)
  const [isActive, setIsActive] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [dropActive, setDropActive] = useState(false)
  const [brokenSrc, setBrokenSrc] = useState(null)
  const [pendingUndo, setPendingUndo] = useState(null)
  const [copyState, setCopyState] = useState(null)
  const inputRef = useRef()
  const slotRef = useRef()
  const pendingRef = useRef(0) // in-flight generations (for Variations)
  const undoTimerRef = useRef(null)
  const activeImage = versions[activeVersion] || null

  // Loading is true while ANY generation is in flight. The counter lets
  // Variations launch 3 parallel generations and still show the correct
  // loading state until the last one finishes.
  function bumpLoading(delta) {
    pendingRef.current = Math.max(0, pendingRef.current + delta)
    setLoading(pendingRef.current > 0)
  }

  // Reflect agent-panel selection: outline whichever slot the chat is targeting.
  useEffect(() => {
    function onTarget(e) {
      setIsActive(!!e.detail?.prompt && e.detail.prompt === editablePrompt)
    }
    window.addEventListener('ww-active-image-target', onTarget)
    return () => window.removeEventListener('ww-active-image-target', onTarget)
  }, [editablePrompt])

  // Chat-driven regeneration: the agent panel can ask a specific slot to
  // regenerate with a new prompt. Match on slotKey (original prompt prop)
  // so user-edited prompts don't break targeting.
  useEffect(() => {
    function onRegenerate(e) {
      const { slotKey: targetKey, newPrompt } = e.detail || {}
      if (!targetKey || !slotKey || targetKey !== slotKey) return
      if (!newPrompt) return
      setEditablePrompt(newPrompt)
      // generate uses opts.promptOverride if passed; this lets us regen
      // without waiting for the editablePrompt setState to flush.
      generate(null, { promptOverride: newPrompt })
    }
    window.addEventListener('ww-regenerate-image', onRegenerate)
    return () => window.removeEventListener('ww-regenerate-image', onRegenerate)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotKey])

  // Section-level auto-generate: fire generate() if this slot is empty and
  // belongs to the section the event targets. The image queue (used by
  // generate) handles fan-out across many slots without hammering Pollinations.
  useEffect(() => {
    function onSectionGenerate(e) {
      const targetSection = e.detail?.sectionTitle
      if (!targetSection) return
      if (activeImage) return // already has a generated/uploaded version
      if (!editablePrompt) return
      const sectionEl = slotRef.current?.closest('[data-section-title]')
      if (sectionEl?.dataset.sectionTitle !== targetSection) return
      generate(null, { silent: true })
    }
    window.addEventListener('ww-generate-section', onSectionGenerate)
    return () => window.removeEventListener('ww-generate-section', onSectionGenerate)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeImage, editablePrompt])

  // Chat panel can swap the active version by clicking a thumbnail.
  // It fires ww-set-active-version with our slotKey + the desired index.
  useEffect(() => {
    function onSetActiveVersion(e) {
      const { slotKey: targetKey, versionIndex } = e.detail || {}
      if (!targetKey || !slotKey || targetKey !== slotKey) return
      if (typeof versionIndex !== 'number') return
      if (versionIndex < 0 || versionIndex >= versions.length) return
      setActiveVersion(versionIndex)
    }
    window.addEventListener('ww-set-active-version', onSetActiveVersion)
    return () => window.removeEventListener('ww-set-active-version', onSetActiveVersion)
  }, [slotKey, versions.length])

  // Close the ··· more-menu when the user clicks anywhere outside it.
  useEffect(() => {
    if (!moreMenuOpen) return
    function onDocClick(e) {
      if (e.target.closest('.img-slot-more-wrap')) return
      setMoreMenuOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [moreMenuOpen])

  // Lightbox + prompt-edit modal: lock body scroll + Esc to close.
  useEffect(() => {
    if (!lightboxOpen && !editingPrompt) return
    function onKey(e) {
      if (e.key !== 'Escape') return
      if (lightboxOpen) setLightboxOpen(false)
      else if (editingPrompt) setEditingPrompt(false)
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [lightboxOpen, editingPrompt])

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

  async function generate(e, opts = {}) {
    e?.stopPropagation?.()
    const text = (opts.promptOverride ?? editablePrompt).trim()
    if (!text) return
    setQueued(true)
    setMenuOpen(false)
    setError(null)

    await enqueue(async () => {
      setQueued(false)
      bumpLoading(+1)

      // Per-section override beats the project-level ratio. Section
      // ingredients (character refs, mood-board tiles) shouldn't be forced
      // to the final-output aspect — only the Storyboard cares about that.
      const effectiveRatio = ratio || project?.ratio
      const dims = RATIO_DIMS[effectiveRatio] || RATIO_DIMS['16:9']
      const wasFirst = versions.length === 0

      // One attempt: ask /api/image for a fresh Pollinations URL, then
      // preload it. The URL comes back instantly; the actual generation
      // happens when the browser requests it (~60-90s). Resolves to the
      // loaded URL on success, or null on any failure.
      async function attemptOnce() {
        let res
        try {
          res = await fetch('/api/image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: text, ...dims, ...(seed != null ? { seed } : {}) }),
          })
        } catch {
          return null
        }
        const data = await res.json().catch(() => ({}))
        if (!data.image) return null
        return new Promise(resolve => {
          const probe = new Image()
          probe.onload = () => resolve(data.image)
          probe.onerror = () => resolve(null)
          probe.src = data.image
        })
      }

      // Retry up to 3x with growing backoff — Pollinations rate-limits an
      // IP under sustained load (e.g. the auto-generate burst), returning
      // 5xx for a stretch. A single transient failure shouldn't kill the
      // slot permanently.
      const MAX_ATTEMPTS = 3
      let loadedUrl = null
      for (let attempt = 1; attempt <= MAX_ATTEMPTS && !loadedUrl; attempt++) {
        loadedUrl = await attemptOnce()
        if (!loadedUrl && attempt < MAX_ATTEMPTS) {
          await new Promise(r => setTimeout(r, 2500 * attempt))
        }
      }

      if (loadedUrl) {
        const next = {
          src: loadedUrl,
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
        bumpLoading(-1)
        if (!opts.silent) toast(wasFirst ? 'Image generated' : 'New image version created')
      } else {
        setError('Image generator unreachable')
        bumpLoading(-1)
        if (!opts.silent) toast('Generation failed', 'error')
      }
    })
  }

  // Generate 3 parallel variations of the active prompt. Staggered slightly
  // to avoid hammering Pollinations all at once.
  function generateVariations(e) {
    e?.stopPropagation?.()
    if (!editablePrompt.trim()) return
    toast('Generating 3 variations…')
    for (let i = 0; i < 3; i++) {
      setTimeout(() => generate(null, { silent: true }), i * 600)
    }
  }

  async function downloadImage(e) {
    e?.stopPropagation?.()
    if (!activeImage) return
    const url = activeImage.src
    const safeLabel = (label || 'image').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    const filename = `wonder-${safeLabel || 'image'}-${Date.now()}.jpg`
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error('fetch failed')
      const blob = await res.blob()
      const objUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(objUrl)
      toast('Image downloaded')
    } catch {
      // CORS/network — fall back to opening in a new tab so the user can save manually
      window.open(url, '_blank', 'noopener')
      toast('Opened in new tab — right-click to save', 'success')
    }
  }

  function deleteImage(e) {
    e?.stopPropagation?.()
    if (!activeImage) return
    const removed = activeImage
    const removedIndex = activeVersion
    setVersions(prev => {
      const updated = prev.filter((_, idx) => idx !== removedIndex)
      setActiveVersion(Math.max(0, Math.min(removedIndex, updated.length - 1)))
      return updated
    })
    setEditingPrompt(false)
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    undoTimerRef.current = setTimeout(() => {
      setPendingUndo(null)
      undoTimerRef.current = null
    }, 5000)
    setPendingUndo({ version: removed, index: removedIndex })
  }

  function undoDelete(e) {
    e?.stopPropagation?.()
    if (!pendingUndo) return
    const { version, index } = pendingUndo
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    undoTimerRef.current = null
    setVersions(prev => {
      const updated = [...prev]
      const insertAt = Math.min(Math.max(index, 0), updated.length)
      updated.splice(insertAt, 0, version)
      setActiveVersion(insertAt)
      return updated
    })
    setPendingUndo(null)
    toast('Restored')
  }

  function upscale(e) {
    e.stopPropagation()
    toast('Upscale queued')
  }

  async function copyPromptToClipboard(e) {
    e?.stopPropagation?.()
    const text = (activeImage?.prompt || editablePrompt || '').trim()
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopyState('copied')
      setTimeout(() => setCopyState(null), 1500)
    } catch {
      setCopyState('failed')
      setTimeout(() => setCopyState(null), 1500)
    }
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
        slotKey: slotKey || editablePrompt, // stable identifier for chat-driven regen
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
      style={(() => {
        if (style?.height || style?.aspectRatio) return style
        const r = ratio || project?.ratio || '16:9'
        const css = RATIO_CSS[r] || '16/9'
        const [rw, rh] = css.split('/').map(Number)
        if (rh > rw) {
          // Portrait: cap height, derive max-width so the box stays portrait
          const maxH = 400
          const maxW = Math.round(maxH * rw / rh)
          return { ...style, aspectRatio: css, maxHeight: maxH, width: `min(100%, ${maxW}px)`, margin: '0 auto' }
        }
        if (rh === rw) {
          // Square: cap at 360px
          return { ...style, aspectRatio: css, maxHeight: 360, width: 'min(100%, 360px)', margin: '0 auto' }
        }
        // Landscape: full width, cap height so wide cards don't blow up
        return { ...style, aspectRatio: css, maxHeight: 400 }
      })()}
      onMouseDownCapture={activateChatTarget}
      onDragOver={onSlotDragOver}
      onDragLeave={onSlotDragLeave}
      onDrop={onSlotDrop}
    >
      {view && VIEW_COLORS[view] && (
        <div
          className="img-slot-view-chip"
          title={`View: ${view}`}
          style={{ background: VIEW_COLORS[view] }}
        >
          {view}
        </div>
      )}
      {activeImage
        ? <>
            <img
              src={activeImage.src}
              alt={label}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', cursor: brokenSrc === activeImage.src ? 'default' : 'zoom-in' }}
              onClick={brokenSrc === activeImage.src ? undefined : openLightbox}
              onLoad={() => brokenSrc === activeImage.src && setBrokenSrc(null)}
              onError={() => setBrokenSrc(activeImage.src)}
              draggable={!!slotKey && brokenSrc !== activeImage.src}
              onDragStart={onImgDragStart}
            />
            {brokenSrc === activeImage.src && (
              <div className="img-slot-broken" onClick={e => e.stopPropagation()}>
                <div className="img-slot-broken-label">This image didn’t load</div>
                <button
                  className="img-slot-broken-btn"
                  onClick={e => { e.stopPropagation(); deleteImage(e); generate() }}
                >
                  ✦ Regenerate
                </button>
              </div>
            )}
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
              <button className="img-slot-action" onClick={generateVariations} disabled={loading} title="Generate 3 variations of this prompt">Variations</button>
              <button className="img-slot-action" onClick={e => { e.stopPropagation(); setEditingPrompt(v => !v) }}>Edit Prompt</button>
              <div className="img-slot-more-wrap">
                <button
                  className="img-slot-action img-slot-more-btn"
                  onClick={e => { e.stopPropagation(); setMoreMenuOpen(o => !o) }}
                  title="More actions"
                >
                  ···
                </button>
                {moreMenuOpen && (
                  <div className="img-slot-more-menu" onClick={e => e.stopPropagation()}>
                    <button onClick={e => { setMoreMenuOpen(false); downloadImage(e) }}>Download</button>
                    <button onClick={e => { setMoreMenuOpen(false); upscale(e) }}>Upscale</button>
                    <button
                      className="img-slot-more-menu-danger"
                      onClick={e => { setMoreMenuOpen(false); deleteImage(e) }}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
            {pendingUndo && (
              <div className="img-slot-undo" onClick={e => e.stopPropagation()}>
                <span>Deleted</span>
                <button onClick={undoDelete}>Undo</button>
              </div>
            )}
          </>
        : <div
            className={`img-slot-empty${menuOpen ? ' menu-open' : ''}`}
            onClick={e => { e.stopPropagation(); if (!loading && !queued) setMenuOpen(o => !o) }}
          >
            {queued && !loading
              ? <div className="img-slot-loading">
                  <span className="loading-label" style={{ opacity: 0.5 }}>In queue…</span>
                </div>
              : loading
              ? <div className="img-slot-loading">
                  <div className="loading-dots" aria-hidden="true">
                    <span /><span /><span />
                  </div>
                  <span className="loading-label">Generating…</span>
                </div>
              : <>
                  {/* ✦ sparkle — the idle affordance. Fades out on hover /
                      when the menu is open. */}
                  <div className="img-slot-sparkle" title="Generate or upload an image">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                      <path d="M12 2.5l1.7 4.6 4.6 1.7-4.6 1.7L12 15.1l-1.7-4.6L5.7 8.8l4.6-1.7L12 2.5z" fill="currentColor"/>
                      <path d="M19 14l0.85 2.3L22.15 17l-2.3 0.85L19 20.15 18.15 17.85 15.85 17l2.3-0.85L19 14z" fill="currentColor" opacity="0.7"/>
                      <path d="M6 16l0.7 1.9L8.6 18.6l-1.9 0.7L6 21.2 5.3 19.3 3.4 18.6l1.9-0.7L6 16z" fill="currentColor" opacity="0.55"/>
                    </svg>
                  </div>
                  {/* Upload / Generate — always in the DOM, revealed on hover
                      (or when the slot menu is open). Zero clicks to see the
                      options; one click to act. */}
                  <div className="img-slot-actions" onClick={e => e.stopPropagation()}>
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
                </>
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

    {editingPrompt && (
      <div className="img-prompt-modal" onClick={() => setEditingPrompt(false)}>
        <div className="img-prompt-modal-content" onClick={e => e.stopPropagation()}>
          <div className="img-prompt-modal-header">
            <div className="img-prompt-modal-title">
              <span className="img-prompt-modal-eyebrow">Edit image prompt</span>
              {label && <span className="img-prompt-modal-sub">{label}</span>}
            </div>
            <button
              className="img-prompt-modal-close"
              onClick={() => setEditingPrompt(false)}
              title="Close (Esc)"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
          <MentionInput
            className="img-prompt-modal-textarea"
            value={editablePrompt}
            onChange={v => setEditablePrompt(v)}
            placeholder="Describe the image in detail — use @Sarah / @Sunset Beach to reference brief entities…"
            autoFocus
            rows={10}
            spellCheck
          />
          <div className="img-prompt-modal-actions">
            <button
              className="img-prompt-modal-cancel"
              onClick={copyPromptToClipboard}
              disabled={!editablePrompt.trim()}
              title="Copy this prompt to the clipboard"
              style={{ marginRight: 'auto' }}
            >
              {copyState === 'copied' ? '✓ Copied' : copyState === 'failed' ? 'Copy failed' : 'Copy'}
            </button>
            <button
              className="img-prompt-modal-cancel"
              onClick={() => setEditingPrompt(false)}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              className="img-prompt-modal-regen"
              onClick={() => generate()}
              disabled={loading || !editablePrompt.trim()}
            >
              {loading ? 'Generating…' : '✦ Regenerate'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
