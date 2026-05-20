import { useContext, useEffect, useRef, useState } from 'react'
import ConfirmDialog from './ConfirmDialog.jsx'
import { ProjectContext, appendImageVersion } from '../hooks/useProject.js'
import { enqueue } from '../utils/generationQueue.js'
import { logGeneration } from '../utils/generationLog.js'
import { getImageProvider, subscribe } from '../utils/imageProvider.js'
import MentionInput from './MentionInput.jsx'

function toast(msg, type = 'success') {
  window.dispatchEvent(new CustomEvent('ww-toast', { detail: { msg, type } }))
}

// Section identity used to gate generation against brief.locks. If a slot
// lives inside a locked section, every generation entry point bails so the
// lock is truly inviolable (Ed's "literally locked in place" requirement).
const SECTION_TITLE_TO_ID = {
  'Creative Direction': 'cd',
  'Brand Info': 'bi',
  'Mood Board / Style References': 'mb',
  'Locations / Set Design': 'loc',
  'Product / Elements': 'cp',
  'Character Design': 'char',
  'Storyboard': 'sl',
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

export default function ImageSlot({ label, prompt, style, className, seed, ratio, slimWhenEmpty = false, disableImageDrag = false, referenceImages = [], priority = 'primary' }) {
  const project = useContext(ProjectContext)
  // Freeze slotKey to the first non-empty prompt this slot ever saw.
  // Without freezing, chat-driven brief edits change `prompt` → slotKey
  // changes → new generations save under a different key than the
  // existing image, splitting version history. The frozen key means
  // versions accumulate at one stable slot identity even when the
  // generation prompt evolves.
  const slotKeyRef = useRef(null)
  if (slotKeyRef.current === null && prompt) slotKeyRef.current = prompt
  const slotKey = slotKeyRef.current
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
  const [confirmDelete, setConfirmDelete] = useState(false)
  // "Improve with AI" popover state. Lets the user type a modification
  // instruction (e.g. "more cinematic lighting") and re-runs the slot
  // through the image generator with the current image as a reference
  // input. Image-conditioned regen is Gemini-only; Pollinations falls
  // back to a text-only regen with the augmented prompt.
  const [improveOpen, setImproveOpen] = useState(false)
  const [improveText, setImproveText] = useState('')
  // "Improve prompt with AI" button inside the Edit Image Prompt modal.
  // Sends the current prompt to Gemini and asks it to rewrite as a
  // richer, more specific image prompt — then replaces the textarea.
  const [improvingPrompt, setImprovingPrompt] = useState(false)
  const [upscaleMenuOpen, setUpscaleMenuOpen] = useState(false)
  useEffect(() => {
    if (!upscaleMenuOpen) return
    function onDoc(e) {
      if (!e.target.closest('.ihn-upscale-wrap')) setUpscaleMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [upscaleMenuOpen])
  // Provider can be flipped at runtime via the toggle in the Export
  // dropdown. Default is Gemini Nano Banana Pro; flipping to
  // Pollinations is useful for demos that don't want to burn credits.
  const [provider, setProvider] = useState(() => getImageProvider())
  useEffect(() => subscribe(p => setProvider(p)), [])
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
      const { slotKey: targetKey, newPrompt, requestId, attachedReferences } = e.detail || {}
      if (!targetKey || !slotKey || targetKey !== slotKey) return
      if (!newPrompt) return
      setEditablePrompt(newPrompt)
      // generate uses opts.promptOverride if passed; this lets us regen
      // without waiting for the editablePrompt setState to flush.
      // requestId propagates to the ww-image-generated event so the
      // chat panel can match the result to the specific action.
      // attachedReferences merge with our slot-level referenceImages
      // (e.g. character REFERENCE) before going to Gemini.
      generate(null, { promptOverride: newPrompt, requestId, attachedReferences })
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
      // primaryOnly is set by Board's auto-generate-on-new-project flow
      // for sections like Character Design where we want only the
      // REFERENCE (priority=primary) to fire — the user reviews +
      // approves before triggering the Headshots / Full Body grids.
      if (e.detail?.primaryOnly && priority !== 'primary') return
      const sectionEl = slotRef.current?.closest('[data-section-title]')
      if (sectionEl?.dataset.sectionTitle !== targetSection) return
      generate(null, { silent: true })
    }
    window.addEventListener('ww-generate-section', onSectionGenerate)
    return () => window.removeEventListener('ww-generate-section', onSectionGenerate)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeImage, editablePrompt, priority])

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

  // Determine if THIS slot's section is locked by walking up to the
  // nearest [data-section-title] ancestor and looking up brief.locks.
  // Called from every generation entry point so locks are inviolable
  // regardless of how the regen was triggered (button, chat, ratio
  // change, section-regen event, etc.).
  function isSectionLocked() {
    const sectionEl = slotRef.current?.closest('[data-section-title]')
    const title = sectionEl?.dataset.sectionTitle
    const id = title && SECTION_TITLE_TO_ID[title]
    if (!id) return false
    return !!project?.brief?.locks?.[id]
  }

  async function generate(e, opts = {}) {
    e?.stopPropagation?.()
    if (isSectionLocked()) {
      // Surface why nothing happened. Stays silent for opts.silent so
      // section-wide auto-gen sweeps don't spam toasts.
      if (!opts.silent) toast('Section is locked — unlock to regenerate', 'error')
      // Tell the chat panel too so any pending card resolves as blocked.
      if (opts.requestId) {
        window.dispatchEvent(new CustomEvent('ww-image-blocked', {
          detail: { requestId: opts.requestId, reason: 'locked' },
        }))
      }
      return
    }
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
    // Total wall-clock for the request — broadcast in ww-image-generated
    // so the chat panel can show a "12s" badge on the delivery card.
    const totalStart = performance.now()
    const requestId = opts.requestId || null

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
      // provider is hoisted above (component scope) so both generate()
      // and the JSX (upscale button) can reference it.
      const endpoint = provider === 'gemini' ? '/api/image-gemini' : '/api/image'
      // Merge slot-level reference images (e.g. character REFERENCE
      // image passed as prop) with chat-attached references for this
      // specific regen request. Gemini caps at 4 inline image inputs.
      const mergedRefs = [
        ...(Array.isArray(referenceImages) ? referenceImages : []),
        ...(Array.isArray(opts.attachedReferences) ? opts.attachedReferences : []),
      ].slice(0, 4)
      const payload = provider === 'gemini'
        ? {
            prompt: text,
            ratio: effectiveRatio,
            ...(mergedRefs.length ? { referenceImages: mergedRefs } : {}),
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
      let lastFailure = null
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
        lastFailure = r
        // Back off longer on rate-limit hits so the next attempt has a
        // chance of landing in a fresh quota window.
        if (attempt < MAX_ATTEMPTS) {
          const isRateLimit = r.status === 429
          const wait = isRateLimit ? 15000 * attempt : 2500 * attempt
          await new Promise(r => setTimeout(r, wait))
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
        // Broadcast for the chat panel — lets it render a delivery card
        // with the new thumbnail + elapsed time after a chat-driven regen.
        window.dispatchEvent(new CustomEvent('ww-image-generated', {
          detail: {
            slotKey: persistSlotKey,
            requestId,
            sectionTitle,
            label: label || '',
            src: loadedUrl,
            prompt: text,
            elapsedMs: Math.round(performance.now() - totalStart),
            wasFirst,
          },
        }))
      } else {
        // Surface the actual failure mode so the user knows whether to
        // wait (rate limit), rephrase (safety refusal), or escalate
        // (config error). Was previously a generic "unreachable" message.
        const stage = lastFailure?.stage || 'unknown'
        const status = lastFailure?.status
        const detail = (lastFailure?.detail || '').trim()
        let friendly
        if (status === 429) {
          friendly = 'Rate limited — too many requests. Wait a minute, then click Regenerate.'
        } else if (status === 401 || status === 403) {
          friendly = `Auth failed (${status}). Gemini API key may be invalid or missing.`
        } else if (stage === 'no-image-field' && /safety|policy|block/i.test(detail)) {
          friendly = `Safety refusal: ${detail.slice(0, 200)}`
        } else if (status >= 500) {
          friendly = `Server error ${status}. Click Regenerate to retry.`
        } else if (status === 404) {
          friendly = 'Image endpoint not found (404). API may not be deployed.'
        } else if (stage === 'fetch-threw') {
          friendly = `Network error: ${detail.slice(0, 200)}`
        } else if (stage === 'probe-failed') {
          friendly = 'Image returned but failed to load. Try Regenerate.'
        } else if (detail) {
          friendly = `${stage} (${status || '?'}): ${detail.slice(0, 200)}`
        } else {
          friendly = `Generation failed (${stage}${status ? `, ${status}` : ''})`
        }
        setError(friendly)
        bumpLoading(-1)
        if (!opts.silent) toast(friendly, 'error')
      }
    })
  }

  // Upscale: Nano Banana Pro supports image conditioning, so "upscale"
  // here is regenerate-with-the-current-image-as-reference + an
  // explicit "enhance, preserve details, higher resolution" prompt.
  // Result is appended as a new version (doesn't overwrite the source).
  // Only fires when provider=gemini; the button is hidden otherwise.
  async function upscaleImage(targetRes = '4k') {
    if (!activeImage?.src) return
    if (isSectionLocked()) {
      toast('Section is locked — unlock to upscale', 'error')
      return
    }
    if (provider !== 'gemini') {
      toast('Upscale requires Nano Banana Pro')
      return
    }
    setUpscaleMenuOpen(false)
    setQueued(true)
    setError(null)
    await enqueue(async () => {
      setQueued(false)
      bumpLoading(+1)
      try {
        const basePrompt = (editablePrompt || prompt || 'image').trim()
        const label = targetRes.toUpperCase()
        const upscalePrompt = `${basePrompt}, upscaled to ${label} resolution, enhanced sharpness, preserve every detail and composition exactly, photorealistic high resolution`
        const effectiveRatio = ratio || project?.ratio || '1:1'
        const res = await fetch('/api/image-gemini', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: upscalePrompt,
            ratio: effectiveRatio,
            referenceImages: [activeImage.src],
          }),
        })
        if (!res.ok) {
          const body = await res.text().catch(() => '')
          setError(`Upscale failed (HTTP ${res.status})`)
          toast(`Upscale failed: ${body.slice(0, 120) || res.status}`, 'error')
          return
        }
        const data = await res.json().catch(() => ({}))
        if (!data.image) {
          setError('Upscale: no image returned')
          toast('Upscale returned no image', 'error')
          return
        }
        const newVersion = {
          src: data.image,
          prompt: upscalePrompt,
          createdAt: Date.now(),
          source: `upscale-${targetRes}`,
        }
        setVersions(prev => {
          const updated = [...prev, newVersion]
          setActiveVersion(updated.length - 1)
          return updated
        })
        toast(`Upscaled to ${label}`)
      } catch (err) {
        setError(`Upscale failed: ${err?.message || err}`)
        toast('Upscale failed — see console', 'error')
        console.error('[ImageSlot] upscale failed', err)
      } finally {
        bumpLoading(-1)
      }
    })
  }

  // "Improve with AI" — user supplies a short instruction
  // ("more cinematic", "warmer lighting", "tighter composition") and
  // we re-run the slot through the generator with that addendum.
  // When provider=gemini, the current image is passed as a reference
  // input so the result iterates on what's already there rather than
  // starting from scratch. Result lands as a new version on the slot.
  async function runImprove(instruction) {
    setImproveOpen(false)
    const tidy = (instruction || '').trim()
    if (!tidy) return
    if (!activeImage?.src) return
    if (isSectionLocked()) {
      toast('Section is locked — unlock to improve', 'error')
      return
    }
    setQueued(true)
    setError(null)
    await enqueue(async () => {
      setQueued(false)
      bumpLoading(+1)
      try {
        const basePrompt = (editablePrompt || prompt || 'image').trim()
        // Build a prompt that keeps the original subject + adds the
        // user's improvement instruction. Phrasing nudges the model
        // to apply the tweak as a refinement, not a rewrite.
        const improvedPrompt = `${basePrompt}. Refined: ${tidy}. Keep the same subject and composition; apply the refinement.`
        const effectiveRatio = ratio || project?.ratio || '16:9'
        const endpoint = provider === 'gemini' ? '/api/image-gemini' : '/api/image'
        const body = provider === 'gemini'
          ? { prompt: improvedPrompt, ratio: effectiveRatio, referenceImages: [activeImage.src] }
          : { prompt: improvedPrompt, ...(RATIO_DIMS[effectiveRatio] || RATIO_DIMS['16:9']) }
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          const text = await res.text().catch(() => '')
          setError(`Improve failed (HTTP ${res.status})`)
          toast(`Improve failed: ${text.slice(0, 120) || res.status}`, 'error')
          return
        }
        const data = await res.json().catch(() => ({}))
        if (!data.image) {
          setError('Improve: no image returned')
          toast('Improve returned no image', 'error')
          return
        }
        const newVersion = {
          src: data.image,
          prompt: improvedPrompt,
          createdAt: Date.now(),
          source: 'improve',
        }
        setVersions(prev => {
          const updated = [...prev, newVersion]
          setActiveVersion(updated.length - 1)
          return updated
        })
        setImproveText('')
        toast('Improved')
      } catch (err) {
        setError(`Improve failed: ${err?.message || err}`)
        toast('Improve failed — see console', 'error')
        console.error('[ImageSlot] improve failed', err)
      } finally {
        bumpLoading(-1)
      }
    })
  }

  // Send the editing prompt to Gemini and ask it to rewrite as a
  // richer, more specific image-generation prompt. Replaces the
  // textarea so the user can review before regenerating.
  async function improvePromptWithAI() {
    const text = (editablePrompt || '').trim()
    if (!text || improvingPrompt) return
    setImprovingPrompt(true)
    try {
      const messages = [
        { role: 'system', content: [
          'You are a senior image-prompt engineer for cinematic / editorial photography.',
          'Take the user\'s rough prompt and rewrite it as a single richer prompt that:',
          '- Keeps the same SUBJECT and INTENT (don\'t change what\'s being shown)',
          '- Adds specific visual detail: lighting, mood, composition, framing, lens, color palette, texture',
          '- Stays in one paragraph, no lists or headings',
          '- Does NOT include preamble, quotes, or explanations',
          '- Returns ONLY the improved prompt text, ready to paste into an image generator',
        ].join('\n') },
        { role: 'user', content: text },
      ]
      const { chatWithTools } = await import('../hooks/useBrief.js')
      const { text: improved } = await chatWithTools(messages, [])
      const cleaned = (improved || '').trim().replace(/^["'`]+|["'`]+$/g, '')
      if (cleaned) setEditablePrompt(cleaned)
      else toast('AI returned no text', 'error')
    } catch (e) {
      console.error('[ImageSlot] improve prompt failed', e)
      const msg = e?.message || String(e)
      if (/\b429\b/.test(msg)) toast('Gemini rate limit hit. Try again in a minute.', 'error')
      else toast(`Improve failed: ${msg.slice(0, 120)}`, 'error')
    } finally {
      setImprovingPrompt(false)
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

  function requestDeleteImage(e) {
    e?.stopPropagation?.()
    if (!activeImage) return
    // Always confirm — the only way deleteImage is reachable is when
    // there's content to lose. Skipping the confirm would be the same
    // unsafe one-click delete we just removed.
    setConfirmDelete(true)
  }
  function deleteImage() {
    setConfirmDelete(false)
    setLightboxOpen(false)
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
        // Slim collapse only while truly idle. During a generation we
        // expand to the real size so the shimmer + "Generating…" label
        // are actually visible (otherwise clicking Generate in a slim
        // product slot looks like nothing happened).
        if (slimWhenEmpty && !activeImage && !loading && !queued) {
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
              <button
                className="ihn-btn ihn-btn-improve"
                onClick={e => { e.stopPropagation(); setImproveOpen(o => !o) }}
                disabled={loading}
                data-tip="Improve with AI"
              >
                {/* Pencil + sparkle — the "AI improve" affordance */}
                <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
                  <path d="M10.5 3.5l2 2L6 12l-2.5.5L4 10l6.5-6.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
                  <path d="M13.5 1l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7L13.5 1z" fill="currentColor"/>
                </svg>
              </button>
              <button className="ihn-edit" onClick={e => { e.stopPropagation(); setEditingPrompt(true) }}>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M11.3 2.3l2.4 2.4L5.8 12.6 3 13.4l.8-2.8 7.5-8.3z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Edit prompt
              </button>
              <span className="ihn-sep" />
              <button className="ihn-btn" onClick={generate} disabled={loading} data-tip="Regenerate">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2.5V5h-2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              {provider === 'gemini' && (
                <div className="ihn-upscale-wrap">
                  <button
                    className="ihn-btn"
                    onClick={e => { e.stopPropagation(); setUpscaleMenuOpen(o => !o) }}
                    disabled={loading}
                    data-tip="Upscale"
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <path d="M3 6V3h3M13 10v3h-3M3 13l4-4M13 3l-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  {upscaleMenuOpen && (
                    <div className="ihn-upscale-menu" onClick={e => e.stopPropagation()}>
                      <button onClick={() => upscaleImage('2k')}>2K</button>
                      <button onClick={() => upscaleImage('4k')}>4K</button>
                    </div>
                  )}
                </div>
              )}
              <button className="ihn-btn ihn-btn-danger" onClick={requestDeleteImage} data-tip="Delete">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 4h10M6.5 4V2.5h3V4M5 4l.5 9h5l.5-9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>
            {improveOpen && (
              <div className="img-improve-popover" onClick={e => e.stopPropagation()}>
                <div className="img-improve-label">Improve with AI</div>
                <input
                  autoFocus
                  className="img-improve-input"
                  placeholder="e.g. more cinematic lighting / tighter composition / cleaner background"
                  value={improveText}
                  onChange={e => setImproveText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); runImprove(improveText) }
                    if (e.key === 'Escape') { e.preventDefault(); setImproveOpen(false) }
                  }}
                />
                <div className="img-improve-actions">
                  <button className="img-improve-cancel" onClick={() => setImproveOpen(false)}>Cancel</button>
                  <button className="img-improve-go" disabled={!improveText.trim()} onClick={() => runImprove(improveText)}>
                    Improve
                  </button>
                </div>
              </div>
            )}
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
            {/* Upload / Edit prompt / Generate — revealed on hover. The
                "Edit prompt" button opens the same modal used for existing
                images so the user can write or refine a custom prompt
                (with Improve with AI) before firing the first generation. */}
            <div className="img-slot-actions" onClick={e => e.stopPropagation()}>
              <button className="img-slot-btn" onClick={e => { e.stopPropagation(); inputRef.current.click() }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Upload
              </button>
              <button className="img-slot-btn" onClick={e => { e.stopPropagation(); setEditingPrompt(true) }}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M11.3 2.3l2.4 2.4L5.8 12.6 3 13.4l.8-2.8 7.5-8.3z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Edit prompt
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
              Edit prompt
            </button>
            <span className="ihn-sep" />
            <button className="ihn-btn" onClick={generate} disabled={loading} data-tip="Regenerate">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2.5V5h-2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <button className="ihn-btn ihn-btn-danger" onClick={requestDeleteImage} data-tip="Delete">
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
              className="img-prompt-modal-improve"
              onClick={improvePromptWithAI}
              disabled={improvingPrompt || loading || !editablePrompt.trim()}
              title="Rewrite this prompt with more detail (lighting, mood, composition)"
            >
              <svg width="13" height="13" viewBox="0 0 18 18" fill="none">
                <path d="M10.5 3.5l2 2L6 12l-2.5.5L4 10l6.5-6.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
                <path d="M13.5 1l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7L13.5 1z" fill="currentColor"/>
              </svg>
              {improvingPrompt ? 'Improving…' : 'Improve with AI'}
            </button>
            <button
              className="img-prompt-modal-regen"
              onClick={() => generate()}
              disabled={loading || !editablePrompt.trim()}
            >
              {loading ? 'Generating…' : (versions.length === 0 ? '✦ Generate' : '✦ Regenerate')}
            </button>
          </div>
        </div>
      </div>
    )}
    <ConfirmDialog
      open={confirmDelete}
      title="Delete this image?"
      message="This will remove the current version. You'll have a 5-second undo window after deleting."
      confirmLabel="Delete image"
      onConfirm={deleteImage}
      onCancel={() => setConfirmDelete(false)}
    />
    </>
  )
}
