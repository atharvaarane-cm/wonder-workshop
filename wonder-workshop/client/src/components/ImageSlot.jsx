import { useContext, useEffect, useRef, useState } from 'react'
import { ProjectContext, appendImageVersion } from '../hooks/useProject.js'
import { enqueue } from '../utils/generationQueue.js'
import { logGeneration } from '../utils/generationLog.js'
import MentionInput from './MentionInput.jsx'

function toast(msg, type = 'success') {
  window.dispatchEvent(new CustomEvent('ww-toast', { detail: { msg, type } }))
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

export default function ImageSlot({ label, prompt, style, className, seed, ratio, slimWhenEmpty = false, disableImageDrag = false, referenceImages = [] }) {
  const project = useContext(ProjectContext)
  const slotKey = prompt || null
  const initial = slotKey && project?.images?.[slotKey]

  const [versions, setVersions] = useState(() => initial?.versions || [])
  const [activeVersion, setActiveVersion] = useState(() => initial?.activeVersion ?? 0)
  const [editablePrompt, setEditablePrompt] = useState(prompt || '')
  const [loading, setLoading] = useState(false)
  const [queued, setQueued] = useState(false)
  const [error, setError] = useState(null)
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

  // Section-level FORCE regen — unlike ww-generate-section above
  // (empty-only), this fires for slots that already hold an image.
  // Used after the agent updates an entity field (character /
  // environment / productElements) so every view in that section
  // re-fires with the new field value baked into the prompt.
  //
  // IMPORTANT: pass the latest `prompt` prop via promptOverride. The
  // internal editablePrompt state only re-syncs when versions is empty,
  // so on a slot that already has an image it still holds the OLD prompt
  // — calling generate() without the override would silently regen with
  // the stale text and the user would see "nothing changed."
  useEffect(() => {
    function onSectionRegen(e) {
      const targetSection = e.detail?.sectionTitle
      if (!targetSection) return
      if (loading || queued) return
      if (!prompt) return
      const sectionEl = slotRef.current?.closest('[data-section-title]')
      if (sectionEl?.dataset.sectionTitle !== targetSection) return
      setEditablePrompt(prompt)
      generate(null, { silent: true, promptOverride: prompt })
    }
    window.addEventListener('ww-regenerate-section', onSectionRegen)
    return () => window.removeEventListener('ww-regenerate-section', onSectionRegen)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt, loading, queued])

  // "Regenerate all" — fired from the Creative-section aspect-ratio
  // dropdown when the user confirms they want every existing image
  // remade at the new ratio. Only slots that already hold an image
  // (and aren't currently generating) re-queue themselves.
  useEffect(() => {
    function onRegenAll() {
      if (!activeImage) return
      if (loading || queued) return
      if (!prompt) return
      // Same staleness fix as ww-regenerate-section above — pass the
      // latest prop directly so we don't regenerate with stale text.
      setEditablePrompt(prompt)
      generate(null, { silent: true, promptOverride: prompt })
    }
    window.addEventListener('ww-regenerate-all', onRegenAll)
    return () => window.removeEventListener('ww-regenerate-all', onRegenAll)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeImage, prompt, loading, queued])

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
  //
  // IMPORTANT: never auto-persist an empty versions list. The re-hydrate
  // effect above sets versions to project.images[slotKey]?.versions || [],
  // so any time slotKey transiently points at a key with no saved data,
  // versions becomes []. If we then wrote that back, we'd wipe whatever
  // is saved at slotKey (or, worse, at a key that just had data loaded
  // into it from a card swap). Explicit deletion paths (removeVersion,
  // clear) handle their own saves, so silent skip-when-empty is safe.
  useEffect(() => {
    if (!slotKey || !project?.saveImage) return
    const persistable = versions.filter(v => v.source !== 'upload')
    if (!persistable.length) return
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
  }

  async function generate(e, opts = {}) {
    e?.stopPropagation?.()
    const text = (opts.promptOverride ?? editablePrompt).trim()
    if (!text) return
    setQueued(true)
    setError(null)

    // Capture identifiers up-front so the task can persist its result
    // even if the user navigates away and the component unmounts before
    // the queue catches up. The queue lives in module memory and keeps
    // running; appendImageVersion writes to localStorage directly.
    const persistProjectId = project?.id
    const persistSlotKey = slotKey || text

    await enqueue(async () => {
      setQueued(false)
      bumpLoading(+1)

      // Per-section override beats the project-level ratio. Section
      // ingredients (character refs, mood-board tiles) shouldn't be forced
      // to the final-output aspect — only the Storyboard cares about that.
      const effectiveRatio = ratio || project?.ratio
      const dims = RATIO_DIMS[effectiveRatio] || RATIO_DIMS['16:9']
      const wasFirst = versions.length === 0
      const sectionTitle = slotRef.current?.closest('[data-section-title]')?.dataset.sectionTitle || ''

      // One attempt: ask /api/image for a fresh Pollinations URL, then
      // preload it. The URL comes back instantly; the actual generation
      // happens when the browser requests it (~60-90s). Returns a result
      // object recording exactly which stage succeeded or failed, so the
      // generation log can tell network errors / bad HTTP / missing URL /
      // failed image loads apart.
      // VITE_IMAGE_PROVIDER picks the generator at build time. Default
       // is 'pollinations'; set to 'gemini' in .env.local (locally) or
       // Vercel env vars (prod) to route every generation through Nano
       // Banana Pro via /api/image-gemini. Endpoint contract is the
       // same — both return { image: <url-or-data-url> }.
      const provider = (import.meta.env.VITE_IMAGE_PROVIDER || 'pollinations').toLowerCase()
      const endpoint = provider === 'gemini' ? '/api/image-gemini' : '/api/image'
      const payload = provider === 'gemini'
        ? {
            prompt: text,
            ratio: effectiveRatio,
            // Identity preservation: callers pass the character's
            // reference image (or other ground-truth refs) here. Gemini
            // accepts up to 4 inline image inputs. Pollinations doesn't
            // support image conditioning so this is just dropped there.
            ...(referenceImages?.length ? { referenceImages } : {}),
          }
        : { prompt: text, ...dims, ...(seed != null ? { seed } : {}) }

      async function attemptOnce() {
        const started = performance.now()
        const ms = () => Math.round(performance.now() - started)
        let res
        try {
          res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        } catch (err) {
          return { url: null, stage: 'fetch-threw', detail: String(err?.message || err), ms: ms() }
        }
        if (!res.ok) {
          const body = await res.text().catch(() => '')
          return { url: null, stage: 'http-error', status: res.status, detail: body.slice(0, 200), ms: ms() }
        }
        const data = await res.json().catch(() => ({}))
        if (!data.image) {
          return { url: null, stage: 'no-image-field', status: res.status, detail: JSON.stringify(data).slice(0, 200), ms: ms() }
        }
        return new Promise(resolve => {
          const probe = new Image()
          probe.onload = () => resolve({ url: data.image, stage: 'ok', status: res.status, imageUrl: data.image, ms: ms() })
          probe.onerror = () => resolve({ url: null, stage: 'probe-failed', status: res.status, imageUrl: data.image, detail: `${provider} image URL failed to load in the browser`, ms: ms() })
          probe.src = data.image
        })
      }

      // Retry up to 3x with growing backoff — Pollinations rate-limits an
      // IP under sustained load (e.g. the auto-generate burst), returning
      // 5xx for a stretch. A single transient failure shouldn't kill the
      // slot permanently. Every attempt is logged for diagnosis.
      const MAX_ATTEMPTS = 3
      let loadedUrl = null
      for (let attempt = 1; attempt <= MAX_ATTEMPTS && !loadedUrl; attempt++) {
        const r = await attemptOnce()
        logGeneration({
          label: label || 'Image',
          section: sectionTitle,
          prompt: text,
          attempt,
          maxAttempts: MAX_ATTEMPTS,
          stage: r.stage,
          status: r.status,
          detail: r.detail,
          imageUrl: r.imageUrl,
          ms: r.ms,
        })
        if (r.url) { loadedUrl = r.url; break }
        if (attempt < MAX_ATTEMPTS) {
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
        // Persist FIRST (synchronous localStorage write) so the result
        // is durable even if the component is already unmounted — the
        // setVersions below is a no-op in that case. When mounted, the
        // existing save-on-state-change useEffect also runs; both writes
        // are idempotent (saveImage replaces the full slot).
        appendImageVersion(persistProjectId, persistSlotKey, next)
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
      const nextActive = Math.max(0, Math.min(removedIndex, updated.length - 1))
      setActiveVersion(nextActive)
      // The auto-persist effect skips empty lists (to avoid wiping data
      // during reorder-driven re-hydration). When the user genuinely
      // deletes the last version, persist the empty state explicitly.
      if (!updated.length && slotKey && project?.saveImage) {
        project.saveImage(slotKey, { versions: [], activeVersion: 0 })
      }
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
        // Optional sections (Mood Board / Locations / Elements) stay slim
        // and collapsed-looking until an image exists — per Ravi. Once a
        // version lands, the slot expands to its real size.
        if (slimWhenEmpty && !activeImage) {
          const { aspectRatio, height, maxHeight, ...rest } = style || {}
          return { ...rest, height: 66 }
        }
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
      {activeImage
        ? <>
            {/* Clicking the image selects the slot (so the chat panel
                targets it) — the slot's onMouseDownCapture handles that.
                The lightbox is opened only via the Expand hover-nav button,
                so a click no longer covers the slot before the selection
                glow is visible. */}
            <img
              src={activeImage.src}
              alt={label}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', cursor: brokenSrc === activeImage.src ? 'default' : 'pointer' }}
              onLoad={() => brokenSrc === activeImage.src && setBrokenSrc(null)}
              onError={() => setBrokenSrc(activeImage.src)}
              draggable={!disableImageDrag && !!slotKey && brokenSrc !== activeImage.src}
              onDragStart={disableImageDrag ? undefined : onImgDragStart}
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
            {/* Blue floating hover-nav — Ravi's "hover nav" pill from the
                Figma canvas. Appears above the image on hover (or while the
                slot is the chat's active target). */}
            <div className="img-hover-nav" onClick={e => e.stopPropagation()}>
              <button className="ihn-btn" onClick={openLightbox} data-tip="Expand">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M6 2H2v4M10 2h4v4M14 10v4h-4M2 10v4h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <button className="ihn-btn" onClick={downloadImage} data-tip="Download">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 2v8M5 7l3 3 3-3M3 13h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <button className="ihn-btn" onClick={e => { e.stopPropagation(); inputRef.current.click() }} data-tip="Replace with an upload">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 14V6M5 9l3-3 3 3M3 3h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <button className="ihn-edit" onClick={e => { e.stopPropagation(); setEditingPrompt(true) }}>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M11.3 2.3l2.4 2.4L5.8 12.6 3 13.4l.8-2.8 7.5-8.3z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Edit with prompt
              </button>
              <span className="ihn-sep" />
              <button className="ihn-btn" onClick={generate} disabled={loading} data-tip="Regenerate">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2.5V5h-2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <button className="ihn-btn" onClick={generateVariations} disabled={loading} data-tip="Generate 3 variations">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 3l1.8 4.9L18.7 9.7l-4.9 1.8L12 16.4l-1.8-4.9L5.3 9.7l4.9-1.8L12 3z" fill="currentColor"/></svg>
              </button>
              <button className="ihn-btn ihn-btn-danger" onClick={deleteImage} data-tip="Delete">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 4h10M6.5 4V2.5h3V4M5 4l.5 9h5l.5-9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>
            {pendingUndo && (
              <div className="img-slot-undo" onClick={e => e.stopPropagation()}>
                <span>Deleted</span>
                <button onClick={undoDelete}>Undo</button>
              </div>
            )}
          </>
        : <div className="img-slot-empty">
            {/* Simple + icon — the idle affordance per the Figma mockup.
                Fades out on hover so the Upload / Generate buttons take
                center stage. */}
            <div className="img-slot-sparkle" title="Generate or upload an image">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              </svg>
            </div>
            {/* Upload / Generate — revealed on hover. Zero clicks to see
                the options; one click to act. */}
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
            {label && !loading && !queued && <span className="img-slot-label">{label}</span>}
            {error && <span className="img-slot-error">{error}</span>}
          </div>
      }
      {/* Generating shimmer — always rendered on top while a generation
          is queued or in flight, regardless of whether the slot is empty
          or already holds an image (e.g. Variations on an existing one). */}
      {(loading || queued) && (
        <div className="img-slot-generating" aria-hidden="true">
          <span className="img-slot-generating-label">
            {queued && !loading ? 'In queue…' : 'Generating…'}
          </span>
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
    </div>

    {lightboxOpen && activeImage && (
      <div className="img-lightbox" onClick={() => setLightboxOpen(false)}>
        <div className="img-lightbox-content" onClick={e => e.stopPropagation()}>
          {/* Same blue pill of options above the image, persistent in the
              lightbox so they're reachable while inspecting fullsize. */}
          <div className="img-lightbox-nav">
            <button className="ihn-btn" onClick={downloadImage} data-tip="Download">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 2v8M5 7l3 3 3-3M3 13h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <button className="ihn-btn" onClick={e => { e.stopPropagation(); inputRef.current.click() }} data-tip="Replace with an upload">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 14V6M5 9l3-3 3 3M3 3h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <button className="ihn-edit" onClick={() => { setLightboxOpen(false); setEditingPrompt(true) }}>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M11.3 2.3l2.4 2.4L5.8 12.6 3 13.4l.8-2.8 7.5-8.3z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Edit with prompt
            </button>
            <span className="ihn-sep" />
            <button className="ihn-btn" onClick={generate} disabled={loading} data-tip="Regenerate">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2.5V5h-2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <button className="ihn-btn" onClick={generateVariations} disabled={loading} data-tip="Generate 3 variations">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 3l1.8 4.9L18.7 9.7l-4.9 1.8L12 16.4l-1.8-4.9L5.3 9.7l4.9-1.8L12 3z" fill="currentColor"/></svg>
            </button>
            <button className="ihn-btn ihn-btn-danger" onClick={e => { deleteImage(e); setLightboxOpen(false) }} data-tip="Delete">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 4h10M6.5 4V2.5h3V4M5 4l.5 9h5l.5-9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>
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
