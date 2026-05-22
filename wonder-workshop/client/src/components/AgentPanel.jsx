import { useState, useRef, useEffect, useContext } from 'react'
import { chatWithTools } from '../hooks/useBrief.js'
import { ProjectContext } from '../hooks/useProject.js'
import ChatResultCard from './ChatResultCard.jsx'
import MentionInput from './MentionInput.jsx'

// Picked at random per chat round so we can match a ww-image-generated
// event back to the message that triggered it.
function makeRequestId() {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

// Templated conversational closer — same vibe as Luma's "What do you
// think?" without the extra LLM call. Picked deterministically off the
// action so it doesn't repeat too quickly.
const CLOSERS = {
  regen: [
    'How does that read?',
    'Want me to push it further?',
    'Closer to what you had in mind?',
  ],
  field: [
    'Anything else to tweak?',
    'Want me to update anything tied to that?',
    'Looks good?',
  ],
}
function pickCloser(kind) {
  const list = CLOSERS[kind] || []
  if (!list.length) return ''
  return list[Math.floor(Math.random() * list.length)]
}

// Per-message timestamps were noisy and didn't match the Luma reference.
// Kept the import path simple — if we ever want them back, render again.

// Strip large/binary fields from the brief before stringifying for the
// chat system prompt. Without this, base64 data: URLs (logos, uploaded
// brand assets, accidentally-pasted screenshots) leak into the prompt
// and Gemini interprets the data as malformed inline images, returning
// "SuppliedImagesAreInvalid". Also caps long text fields so the system
// prompt stays manageable.
function sanitizeBriefForChat(brief) {
  function clean(value) {
    if (typeof value === 'string') {
      // Replace inline base64 data with a placeholder so paths stay valid
      if (/^data:[^;]+;base64,/.test(value)) return '[image data omitted]'
      // Cap very long strings — model only needs a hint, not every word
      return value.length > 2000 ? value.slice(0, 2000) + '…[truncated]' : value
    }
    if (Array.isArray(value)) return value.map(clean)
    if (value && typeof value === 'object') {
      const out = {}
      for (const [k, v] of Object.entries(value)) out[k] = clean(v)
      return out
    }
    return value
  }
  try {
    return JSON.stringify(clean(brief))
  } catch {
    return '{}'
  }
}

// Tool definitions exposed to Gemini — the model picks one when the user
// asks to change something. Schemas use Gemini's functionDeclarations format.
const TOOLS = [
  {
    name: 'update_brief_field',
    description: 'Update any text field in the brief using dot-path notation. PREFERRED for ANY change to a character / location / product entity (appearance, wardrobe, environment, etc.) — every image driven by that entity will re-fire automatically with the new value. Examples of paths: "character.description", "character.wardrobe", "characters.0.description", "environment.heroEnvironment", "environment.heroName", "productElements.0.description", "creativeDirection.brand", "brandInfo.rules". The value REPLACES the field — always provide the FULL new value (e.g. include the existing description + your modification, not just the modification).',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Dot-path to the field within the brief JSON.' },
        value: { type: 'string', description: 'The new full value as a plain string — replaces what was there before.' },
      },
      required: ['path', 'value'],
    },
  },
  {
    name: 'regenerate_active_image',
    description: 'Regenerate ONLY the currently-selected image with a new prompt. Call this ONLY for one-off image-level tweaks the user wants for THIS frame alone (different lighting, mood, framing, a stylistic variation). For changes to a character / location / product that should propagate across every image of that entity, use update_brief_field instead. Provide the FULL new prompt — describe subject, setting, lighting, framing, mood.',
    parameters: {
      type: 'object',
      properties: {
        new_prompt: { type: 'string', description: 'The complete new image prompt.' },
      },
      required: ['new_prompt'],
    },
  },
]

function describeAction(action) {
  if (action.name === 'update_brief_field') {
    const { path, value } = action.args || {}
    const shortVal = (value || '').length > 80 ? (value.slice(0, 80) + '…') : value
    return `Updated ${path} → "${shortVal}"`
  }
  if (action.name === 'regenerate_active_image') {
    return 'Regenerating the selected image with the new prompt…'
  }
  return `Ran ${action.name}`
}

export default function AgentPanel({ activeSection, activeImageTarget, brief, onUpdate, onRegenerateImage, onClose }) {
  // Pull version history for whatever image the user has selected on the
  // left. The chat panel becomes a contextual viewer: thumbnails of all
  // generated versions of the active slot, click any thumbnail to swap
  // which one shows on the left.
  const project = useContext(ProjectContext)
  const activeSlotKey = activeImageTarget?.slotKey
  const slotData = activeSlotKey ? project?.images?.[activeSlotKey] : null
  const versions = slotData?.versions || []
  const activeVersion = slotData?.activeVersion ?? 0
  function pickVersion(idx) {
    if (!activeSlotKey) return
    window.dispatchEvent(new CustomEvent('ww-set-active-version', {
      detail: { slotKey: activeSlotKey, versionIndex: idx },
    }))
  }

  // Chat history persists per-project in localStorage so navigating away
  // (or refreshing) doesn't wipe context. Keyed by project.id; the
  // shared-link / no-project case stays in-memory only.
  const chatStorageKey = project?.id ? `ww_chat_${project.id}` : null
  const [messages, setMessages] = useState(() => {
    if (chatStorageKey) {
      try {
        const stored = JSON.parse(localStorage.getItem(chatStorageKey) || 'null')
        if (Array.isArray(stored) && stored.length) {
          // Older sessions persisted duplicate Date.now() ts values that
          // React then used as keys — rehydrating those crashes the chat.
          // De-dup defensively by bumping any colliding ts forward.
          const seen = new Set()
          let bump = 0
          return stored.map(m => {
            let ts = typeof m?.ts === 'number' ? m.ts : Date.now() + (bump++)
            while (seen.has(ts)) ts += 1
            seen.add(ts)
            return ts === m?.ts ? m : { ...m, ts }
          })
        }
      } catch {}
    }
    return [{
      role: 'agent',
      text: `Here's the creative direction for the ${brief?.creativeDirection?.brand ?? ''} shoot. I've set ${brief?.creativeDirection?.shots ?? 9} shots across ${brief?.creativeDirection?.location ?? 'key locations'} with a strong hero narrative.`,
      ts: Date.now(),
    }]
  })
  useEffect(() => {
    if (!chatStorageKey) return
    // Strip attachments before persisting. Each attached image is a
    // multi-MB base64 data URL; persisting them inflates the messages
    // blob to tens of megabytes, blocks the main thread on each save,
    // and looks like the tab is crashing. Attachments stay in memory
    // for the session but don't survive reload — fair trade.
    const lean = messages.map(m => (
      m.attachments?.length ? { ...m, attachments: undefined } : m
    ))
    try { localStorage.setItem(chatStorageKey, JSON.stringify(lean)) } catch {}
  }, [chatStorageKey, messages])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [listening, setListening] = useState(false)
  // Reference images attached to the next message — Gemini accepts them
  // as inline image inputs for identity / style preservation. Each entry
  // is { src: <data URL>, name: <filename> }.
  const [attachedImages, setAttachedImages] = useState([])
  const chatFileInputRef = useRef(null)
  // Edit-in-place mode: when set, the next send REPLACES this message
  // (and everything after it in the conversation) instead of appending.
  // Lets the user retry a request with tweaked wording.
  const [editingTs, setEditingTs] = useState(null)
  function startEdit(message) {
    setEditingTs(message.ts)
    setInput(message.text || '')
    setAttachedImages(Array.isArray(message.attachments) ? message.attachments : [])
  }
  function cancelEdit() {
    setEditingTs(null)
    setInput('')
    setAttachedImages([])
  }

  // Intent picker — analogous to Luma's "Create ▾". Lets the user
  // explicitly pick what kind of work they want done, reducing the
  // model's tool-routing mistakes. 'auto' = agent decides (today's
  // behavior).
  const INTENTS = [
    { id: 'auto',   label: 'Auto',           hint: 'Let me figure out what to do' },
    { id: 'regen',  label: 'Regenerate image', hint: 'Replace the selected image with a new variation' },
    { id: 'edit',   label: 'Edit brief',      hint: 'Change a description, character, brand field, etc.' },
    { id: 'chat',   label: 'Just chat',       hint: 'Answer in plain text, no actions' },
  ]
  const [intent, setIntent] = useState('auto')
  const [intentMenuOpen, setIntentMenuOpen] = useState(false)
  const intentBtnRef = useRef(null)
  useEffect(() => {
    if (!intentMenuOpen) return
    function onClick(e) {
      if (intentBtnRef.current && !intentBtnRef.current.contains(e.target)) setIntentMenuOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [intentMenuOpen])

  function openChatAttach() { chatFileInputRef.current?.click() }
  function handleChatAttach(files) {
    const list = Array.from(files || []).filter(f => f && f.type.startsWith('image/'))
    if (!list.length) return
    const next = []
    let pending = list.length
    list.forEach(file => {
      const reader = new FileReader()
      reader.onload = () => {
        next.push({ src: String(reader.result || ''), name: file.name })
        if (--pending === 0) setAttachedImages(prev => [...prev, ...next].slice(0, 4))
      }
      reader.onerror = () => {
        if (--pending === 0 && next.length) setAttachedImages(prev => [...prev, ...next].slice(0, 4))
      }
      reader.readAsDataURL(file)
    })
  }
  function removeAttachedImage(idx) {
    setAttachedImages(prev => prev.filter((_, i) => i !== idx))
  }
  const messagesRef = useRef(null)
  const abortRef = useRef(null)
  const recognitionRef = useRef(null)

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition

  function toggleMic() {
    if (!SpeechRecognition) return
    if (listening) {
      recognitionRef.current?.stop()
      return
    }
    const rec = new SpeechRecognition()
    rec.continuous = false
    rec.interimResults = true
    rec.lang = 'en-US'
    let baseInput = input
    rec.onstart = () => setListening(true)
    rec.onresult = e => {
      const transcript = Array.from(e.results).map(r => r[0].transcript).join('')
      setInput(baseInput + (baseInput ? ' ' : '') + transcript)
    }
    rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)
    recognitionRef.current = rec
    rec.start()
  }

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight
    }
  }, [messages])

  // (forceUpdate interval removed along with timeAgo — nothing else needs
  // a ticking re-render in the panel.)

  // Listen for ww-image-generated and patch the matching pending card
  // message with the result. Each chat round that fires a regen attaches
  // a unique requestId; when the event arrives with that id, we find the
  // message and fill in title / thumb / elapsed.
  useEffect(() => {
    function onGenerated(e) {
      const d = e.detail || {}
      if (!d.requestId) return
      setMessages(prev => prev.map(m => {
        if (m.kind !== 'card' || m.card?.requestId !== d.requestId) return m
        return {
          ...m,
          pending: false,
          card: {
            ...m.card,
            title: `${d.sectionTitle || 'Image'} — updated`,
            sectionLabel: d.label ? `${d.sectionTitle} / ${d.label}` : d.sectionTitle,
            src: d.src,
            prompt: d.prompt,
            elapsedMs: d.elapsedMs,
            previousSrc: d.previousSrc || null,
            previousIndex: d.previousIndex ?? null,
          },
        }
      }))
    }
    window.addEventListener('ww-image-generated', onGenerated)
    return () => window.removeEventListener('ww-image-generated', onGenerated)
  }, [])

  // Mirror of the success path: if a regen was blocked (typically by a
  // section lock), resolve the pending card with a "blocked" state so
  // the chat doesn't pulse forever.
  useEffect(() => {
    function onBlocked(e) {
      const d = e.detail || {}
      if (!d.requestId) return
      setMessages(prev => prev.map(m => {
        if (m.kind !== 'card' || m.card?.requestId !== d.requestId) return m
        return {
          ...m,
          pending: false,
          card: { ...m.card, title: 'Blocked — section is locked', blocked: true },
          text: 'I couldn\'t change that — the section is locked. Unlock it first, then ask me again.',
        }
      }))
    }
    window.addEventListener('ww-image-blocked', onBlocked)
    return () => window.removeEventListener('ww-image-blocked', onBlocked)
  }, [])

  async function send() {
    const text = input.trim()
    if (!text || streaming) return
    setInput('')
    setStreaming(true)

    // Snapshot + clear attached images. They ride along on the user
    // bubble for visual continuity AND get forwarded as referenceImages
    // on any regen action this round triggers.
    const snapshot = attachedImages
    setAttachedImages([])
    const editTsSnapshot = editingTs
    setEditingTs(null)
    setMessages(prev => {
      // Two setMessages calls happen back-to-back here and at line 397.
      // Date.now() can return the same millisecond for both, which produces
      // duplicate React keys (we use ts as the key on line 723) and corrupts
      // reconciliation enough to crash with "s.map is not a function" deep
      // in the tree. Ensure ts is strictly greater than the previous msg.
      const lastTs = prev.length ? (prev[prev.length - 1].ts || 0) : 0
      const newMsg = { role: 'user', text, attachments: snapshot, ts: Math.max(Date.now(), lastTs + 1) }
      // In edit mode: drop the original message AND everything after it,
      // then append the new attempt. Removes the stale agent response so
      // we don't have duplicates littering the history.
      if (editTsSnapshot != null) {
        const idx = prev.findIndex(m => m.ts === editTsSnapshot)
        if (idx >= 0) return [...prev.slice(0, idx), newMsg]
      }
      return [...prev, newMsg]
    })

    const hasActiveImage = !!activeImageTarget?.prompt
    // Intent override: when the user explicitly picked a mode via the
    // "Create ▾" dropdown, prepend a hard instruction so the model
    // doesn't second-guess. 'auto' is a no-op.
    const intentLock = intent === 'regen'
      ? `# MODE LOCK — user explicitly chose REGENERATE IMAGE\n- You MUST call regenerate_active_image, or refuse if no image is selected.\n- Do not call update_brief_field. Do not reply with plain text unless reporting a blocker.\n\n`
      : intent === 'edit'
      ? `# MODE LOCK — user explicitly chose EDIT BRIEF\n- You MUST call update_brief_field on the relevant entity field.\n- Do not call regenerate_active_image. Do not reply with plain text unless reporting a blocker.\n\n`
      : intent === 'chat'
      ? `# MODE LOCK — user explicitly chose JUST CHAT\n- Do NOT call any tools. Respond in plain text only, under 3 sentences.\n\n`
      : ''
    const systemPrompt = [
      `You are a creative production assistant working inside Wonder Workshop, a brief tool.`,
      ``,
      intentLock,
      `# Tool routing — pick the RIGHT tool:`,
      `- If the user wants to change a CHARACTER's appearance (hair, clothes, wardrobe, look) — or any property of the character / location / product entity — CALL update_brief_field on the relevant entity field (character.description, character.wardrobe, environment.heroEnvironment, productElements, etc.). When you edit a character's description or wardrobe, that character's Headshots and Full Body views re-fire automatically with the new value. The REFERENCE image stays put (so a locked reference is respected). Example: "make her have purple hair" → update_brief_field(path: "character.description", value: "<full original description, with purple hair added>"). Always include the FULL new value — your update REPLACES the field.`,
      `- If the user wants a ONE-OFF tweak to JUST the currently selected image (lighting, framing, mood, a stylistic variation), CALL regenerate_active_image with the FULL new prompt — describe subject, setting, lighting, framing, mood. This only affects the selected image, not other images of the same entity.`,
      `- If the user asks a question or wants conversation, respond with plain text only (no function calls). Keep replies under 3 sentences.`,
      `- NEVER just describe a change — always CALL the tool.`,
      ``,
      `# HARD CONSTRAINTS on update_brief_field — NEVER violate these:`,
      `- NEVER add new entries to user-managed arrays. These are: moodBoard, environments (additional locations beyond the hero), productElements, characters (additional characters beyond the primary), assets, shotList. Users add to these via dedicated "Add ___" buttons in the UI. You only EDIT EXISTING entries in place.`,
      `- If the user wants a NEW location / mood reference / product / character / shot, REPLY IN PLAIN TEXT telling them to click the "Add ___" button in the corresponding section. Do NOT call update_brief_field on those arrays.`,
      `- You MAY edit the contents of an existing entry by index (e.g. characters[0].description), but you may NOT append, prepend, or replace the array length.`,
      `- environment.heroEnvironment and environment.heroName ARE editable in place (single hero location). environments[] (the additional-locations array) is NOT — users add additional locations themselves.`,
      ``,
      `# Scope rules — read carefully`,
      hasActiveImage
        ? [
            `The user has CURRENTLY SELECTED a specific image. That is the focus.`,
            `When the user says "the prompt", "this prompt", "this image", "this one", or asks anything ambiguous, they mean the SELECTED IMAGE — NOT the project description.`,
            `If asked to show/print/explain the prompt, return ONLY the selected image's prompt verbatim, in quotes.`,
            `If asked to change/modify the image, call regenerate_active_image with the new full prompt.`,
            ``,
            `SELECTED IMAGE`,
            `  Section: ${activeImageTarget?.sectionTitle || activeSection}`,
            `  Label:   ${activeImageTarget?.label || ''}`,
            `  Prompt:  "${activeImageTarget.prompt}"`,
          ].join('\n')
        : [
            `The user has selected a SECTION (no specific image). The focus is "${activeSection}".`,
            `When the user says "the prompt" or asks ambiguous questions, they mean fields within this section, not the project description.`,
            ``,
            `IMPORTANT — NO ACTIVE IMAGE: regenerate_active_image WILL FAIL because no slot is selected. Do NOT call it.`,
            `If the user asks to generate or change a specific image, REPLY IN PLAIN TEXT telling them to click the image slot first, then ask again. Do not emit any tool-call syntax (not as a function call, not as text).`,
            `If the user asks to change section-level data (a character description, a location description, the brand, etc.), use update_brief_field — that does work without a selected image.`,
          ].join('\n'),
      ``,
      `# Full brief (for path resolution and broader context — use sparingly):`,
      sanitizeBriefForChat(brief ?? {}),
    ].join('\n')

    // Cap history at the last 30 turns. After long sessions the
    // unbounded payload either burns Gemini tokens for no benefit or
    // tips into a request that hangs / 5xxs. Strip card messages
    // (they're visual artifacts, not conversation) and card messages
    // with empty text — keep only meaningful user / agent exchanges.
    const meaningful = messages.filter(m => m.text && (m.role === 'user' || (m.role === 'agent' && m.kind !== 'card')))
    const recent = meaningful.slice(-30)
    const history = [
      { role: 'system', content: systemPrompt },
      ...recent.map(m => ({ role: m.role === 'agent' ? 'assistant' : 'user', content: m.text })),
      { role: 'user', content: text },
    ]

    setMessages(prev => {
      // See note above at the user-message setMessages call: Date.now()
      // can collide with the just-appended user msg's ts, which produces
      // duplicate React keys and crashes the chat tree.
      const lastTs = prev.length ? (prev[prev.length - 1].ts || 0) : 0
      return [...prev, { role: 'agent', text: '', ts: Math.max(Date.now(), lastTs + 1) }]
    })

    try {
      const controller = new AbortController()
      abortRef.current = controller
      // When user picked Just chat, send no tools at all so the model
      // physically cannot emit a function call.
      const effectiveTools = intent === 'chat' ? [] : TOOLS
      const { text: replyText, actions } = await chatWithTools(history, effectiveTools, controller.signal)

      // Apply each function call against the live brief. Track which
      // entity sections need their images re-fired afterwards (e.g.
      // when the agent edits character.description, every character
      // view should regenerate with the new description baked in).
      const applied = []
      const sectionsToRegen = new Set()
      // When the agent edits ONE character's field, regen should target only
      // that character's slots — not every CharacterBlock in the section.
      // Track which character indexes were touched. "primary" = brief.character,
      // numeric strings = brief.characters[N]. If the set stays empty after
      // processing all actions, we fire section-wide as before.
      const characterIndexesToRegen = new Set()
      // Collect blocker reasons so we can surface them to the user in
      // the chat instead of silently dropping their request.
      const blockers = []
      // Each regen action gets a pending card; the ww-image-generated
      // listener fills it in when the image lands.
      const pendingCards = []
      // Paths the agent is NOT allowed to write to wholesale — these are
      // user-managed lists the chat should never grow on its own. Editing
      // an existing index (e.g. characters[0].description) is fine; replacing
      // the whole array is not.
      const PROTECTED_ARRAYS = new Set([
        'moodBoard', 'environments', 'productElements',
        'characters', 'assets', 'shotList',
      ])
      function isProtectedRootWrite(path) {
        if (!path) return false
        // Block writes to the bare array name (e.g. "moodBoard") or any
        // attempt to overwrite the full array.
        return PROTECTED_ARRAYS.has(path)
      }
      // Block writes that would replace an entire ENTITY OBJECT with a
      // string. Without this, `update_brief_field(path: "character", value:
      // "Mid-twenties Latina...")` overwrote brief.character (an object) with
      // a string, which then fails isCharacterPopulated() and the primary
      // character silently disappears from the UI. Same applies to indexed
      // entries like characters.0 / environments.1 / etc. — those must be
      // edited via their subfields (character.description, characters.0.wardrobe).
      function wouldFlattenEntityObject(path, value) {
        if (typeof value !== 'string') return false
        if (path === 'character' || path === 'environment' || path === 'brandInfo' || path === 'creativeDirection' || path === 'brief') return true
        // characters.0 / environments.2 / productElements.1 / moodBoard.3 /
        // shotList.5 — anything matching <bareName>.<number> and nothing
        // after means the AI is trying to swap the whole indexed entry.
        if (/^(characters|environments|productElements|moodBoard|shotList|assets)\.\d+$/.test(path)) return true
        return false
      }
      // Locked-entity guard: if the field this write targets drives a
      // section the user has locked, refuse. Otherwise the brief data
      // would shift underneath frozen images — exactly what Ed flagged.
      function fieldDrivesLockedSection(path) {
        if (!path) return false
        const locks = brief?.locks || {}
        if ((path.startsWith('character.') || path === 'character'
          || path.startsWith('characters.') || path === 'characters') && locks.char) return 'Character Design'
        if ((path.startsWith('environment.') || path === 'environment'
          || path.startsWith('environments.') || path === 'environments') && locks.loc) return 'Locations / Set Design'
        if ((path.startsWith('productElements') || path === 'productElements') && locks.cp) return 'Product / Elements'
        if ((path.startsWith('shotList') || path === 'shotList') && locks.sl) return 'Storyboard'
        if ((path.startsWith('moodBoard') || path === 'moodBoard') && locks.mb) return 'Mood Board / Style References'
        if ((path.startsWith('brandInfo') || path === 'brandInfo') && locks.bi) return 'Brand Info'
        return false
      }
      // Per-character lock: refuse chat writes that target a specific
      // character the user has individually locked. brief.characterLocks
      // is keyed by "primary" (brief.character) or numeric string for
      // brief.characters[N]. We map the path to its character index using
      // the same logic that drives scoped regen below.
      function pathTargetsLockedCharacter(path) {
        if (!path) return null
        const charLocks = brief?.characterLocks || {}
        if (path === 'character' || path.startsWith('character.')) {
          return charLocks.primary ? 'primary' : null
        }
        const m = path.match(/^characters\.(\d+)/)
        if (m) return charLocks[m[1]] ? m[1] : null
        return null
      }
      for (const a of actions) {
        if (a.name === 'update_brief_field' && onUpdate) {
          const { path, value } = a.args || {}
          if (isProtectedRootWrite(path)) {
            blockers.push(`I can't add or replace the ${path} list directly. Use the "Add ___" button in that section, then I can help you fill in the new entry.`)
            continue
          }
          if (wouldFlattenEntityObject(path, value)) {
            blockers.push(`I almost flattened ${path} into a single string, which would have erased that entire entry. Edit a subfield instead (e.g. ${path}.description or ${path}.wardrobe).`)
            continue
          }
          const lockedSection = fieldDrivesLockedSection(path)
          if (lockedSection) {
            blockers.push(`Can't update that — the ${lockedSection} section is locked. Unlock it first, then ask me again.`)
            continue
          }
          const lockedChar = pathTargetsLockedCharacter(path)
          if (lockedChar) {
            const charLabel = lockedChar === 'primary' ? 'the primary character' : `character ${Number(lockedChar) + 2}`
            blockers.push(`Can't update that — ${charLabel} is locked. Click UNLOCK CHARACTER on their block first, then ask me again.`)
            continue
          }
          if (path && typeof value === 'string') {
            onUpdate(path, value)
            applied.push(a)
            // Identify which section's image prompts derive from this
            // field. Only entity-level fields trigger a regen — title
            // / projectInfo / creativeDirection.description don't
            // drive image generation directly.
            if (path.startsWith('character.') || path.startsWith('characters.') || path === 'character' || path === 'characters') {
              sectionsToRegen.add('Character Design')
              // Derive which character was touched so regen scopes to that
              // block only. brief.character (singular) = "primary"; the
              // brief.characters array uses numeric indexes.
              if (path === 'character' || path.startsWith('character.')) {
                characterIndexesToRegen.add('primary')
              } else if (path.startsWith('characters.')) {
                const m = path.match(/^characters\.(\d+)/)
                if (m) characterIndexesToRegen.add(m[1])
                // If the path is just "characters" (whole-array write — already
                // blocked by isProtectedRootWrite, but kept defensively),
                // we fall back to section-wide by NOT adding a specific index.
              }
            } else if (path.startsWith('environment.') || path.startsWith('environments.') || path === 'environment' || path === 'environments') {
              sectionsToRegen.add('Locations / Set Design')
            } else if (path.startsWith('productElements') || path === 'productElements') {
              sectionsToRegen.add('Product / Elements')
            }
          }
        } else if (a.name === 'regenerate_active_image' && onRegenerateImage) {
          const { new_prompt } = a.args || {}
          if (!new_prompt) {
            blockers.push('I tried to regenerate the image but no prompt was provided.')
          } else if (!activeImageTarget?.slotKey) {
            blockers.push('Click on the image you want me to change first, then ask again. I can only target a slot you\'ve selected — section context alone isn\'t enough.')
          } else {
            const referenceImages = snapshot.map(a => a.src).filter(Boolean)
            const result = onRegenerateImage(new_prompt, { referenceImages })
            if (result?.ok) {
              applied.push(a)
              pendingCards.push({
                requestId: result.requestId,
                slotKey: result.slotKey,
                sectionTitle: result.sectionTitle,
                label: result.label,
                prompt: new_prompt,
              })
            } else {
              blockers.push('I tried to regenerate the image but the slot didn\'t accept the request.')
            }
          }
        }
      }

      // Gemini 2.0 Flash sometimes hallucinates tool calls as plaintext
      // in the message body instead of emitting structured function
      // calls. Detect the pattern and surface guidance — otherwise the
      // user sees raw `regenerate_active_image({"..."})` syntax with
      // no actual side effect.
      const looksLikeStringifiedCall = !actions.length
        && /\b(regenerate_active_image|update_brief_field)\s*\(/.test(replyText || '')
      if (looksLikeStringifiedCall) {
        if (!activeImageTarget?.slotKey) {
          blockers.push('Click on the image you want me to change first — I can\'t target a slot from the section context alone.')
        } else {
          blockers.push('Something went wrong calling that tool. Try rephrasing — e.g. "regenerate this image with [new full description]".')
        }
      }

      // Auto-regen behavior — narrowed scope from earlier iterations.
      // Chat edits to a character's wardrobe / description SHOULD refresh
      // that character's views (otherwise the chat does nothing visible).
      // What we deliberately DON'T do:
      // - touch the REFERENCE image (no data-subgroup wrapper, so subgroup
      //   filter naturally excludes it — a locked reference stays locked,
      //   and changing the reference image itself doesn't cascade)
      // - touch OTHER characters (characterIndex filter scopes per-block)
      // - touch locked sections (Ed's lock-and-approve workflow)
      if (sectionsToRegen.size > 0) {
        const lockedTitles = new Set()
        const sectionIdByTitle = {
          'Brand Info': 'bi',
          'Mood Board / Style References': 'mb',
          'Locations / Set Design': 'loc',
          'Product / Elements': 'cp',
          'Character Design': 'char',
          'Storyboard': 'sl',
        }
        for (const [title, id] of Object.entries(sectionIdByTitle)) {
          if (brief?.locks?.[id]) lockedTitles.add(title)
        }
        setTimeout(() => {
          for (const sectionTitle of sectionsToRegen) {
            if (lockedTitles.has(sectionTitle)) continue
            if (sectionTitle === 'Character Design' && characterIndexesToRegen.size > 0) {
              // Per character, fire two scoped events: one for the
              // headshot grid, one for the full-body grid. Reference slot
              // has no [data-subgroup] ancestor so the listener's subgroup
              // filter skips it.
              for (const characterIndex of characterIndexesToRegen) {
                for (const subgroup of ['headshot', 'fullbody']) {
                  window.dispatchEvent(new CustomEvent('ww-regenerate-section', {
                    detail: { sectionTitle, characterIndex, subgroup },
                  }))
                }
              }
            } else {
              window.dispatchEvent(new CustomEvent('ww-regenerate-section', {
                detail: { sectionTitle },
              }))
            }
          }
        }, 80)
      }

      // Assemble the agent's reply. If Gemini sent text, use it; if there
      // were applied actions but no text, synthesise a short summary.
      // Blockers override everything — if the user's request couldn't
      // fire, the chat shows why instead of pretending it worked.
      const actionSummaries = applied.map(describeAction).filter(Boolean)
      let finalText = (replyText || '').trim()
      // Strip out hallucinated tool-call plaintext so the user doesn't
      // see raw function syntax in the bubble.
      finalText = finalText.replace(/\b(regenerate_active_image|update_brief_field)\s*\([^)]*\)\s*/g, '').trim()
      if (blockers.length) {
        finalText = blockers.join('\n\n')
      } else if (!finalText && actionSummaries.length && !pendingCards.length) {
        // If we have pending cards, the card itself will show the
        // result — no need to also dump the action summary line.
        finalText = actionSummaries.join(' · ')
      }

      // If we have pending cards from regen actions, replace the
      // placeholder text bubble with a card-bearing message. The
      // ww-image-generated listener will fill in the card data when
      // the image arrives. Otherwise fall back to the text path.
      setMessages(prev => {
        const next = [...prev]
        const lastTs = next[next.length - 1].ts
        if (pendingCards.length) {
          // One card per regen action. If the model added text on top,
          // keep it as a header line above the card; otherwise use a
          // deterministic conversational closer.
          const closer = finalText || pickCloser('regen')
          next.splice(next.length - 1, 1, ...pendingCards.map((c, i) => ({
            role: 'agent',
            kind: 'card',
            pending: true,
            card: {
              requestId: c.requestId,
              slotKey: c.slotKey,
              sectionTitle: c.sectionTitle,
              prompt: c.prompt,
              // title / src / elapsedMs filled in by the listener
            },
            // Only show the closer text after the LAST card in the round
            text: i === pendingCards.length - 1 ? closer : '',
            ts: lastTs + i,
          })))
        } else {
          if (!finalText && applied.length) {
            // Field updates without a visible card — append a closer
            finalText = `${actionSummaries.join(' · ')} — ${pickCloser('field')}`.trim()
          }
          if (!finalText) finalText = '(no response)'
          next[next.length - 1] = { role: 'agent', text: finalText, ts: lastTs }
        }
        return next
      })
    } catch (e) {
      if (e.name !== 'AbortError') {
        console.error('[AgentPanel] chat failed', e)
        // Translate the most common Gemini failure codes into something
        // a non-technical user can act on — 429 is the rate-limit hit
        // we keep seeing on the free-tier key.
        const raw = e?.message || String(e)
        const status = e?.status
        const body = typeof e?.body === 'string' ? e.body : (e?.body ? JSON.stringify(e.body) : '')
        // Surface the actual Gemini error body — most 5xx responses
        // include a useful message (model not found, content blocked,
        // quota exceeded, etc.) that's lost behind a generic label.
        let friendly
        if (status === 429 || /\b429\b/.test(raw)) {
          friendly = 'Gemini rate limit hit. Wait ~60s and try again.'
        } else if (status === 401 || status === 403 || /\b401\b|\b403\b/.test(raw)) {
          friendly = `Auth failed (${status || '401/403'}). Gemini API key may be invalid.${body ? ` Detail: ${body.slice(0, 200)}` : ''}`
        } else if ((status >= 500 && status < 600) || /\b5\d\d\b/.test(raw)) {
          friendly = body
            ? `Gemini server error (${status}): ${body.slice(0, 300)}`
            : 'Gemini server error. Try again in a few seconds.'
        } else if (status === 400) {
          friendly = `Bad request (400): ${body.slice(0, 300) || raw}`
        } else {
          friendly = `Something went wrong: ${raw.slice(0, 300)}`
        }
        setMessages(prev => {
          const next = [...prev]
          next[next.length - 1] = { role: 'agent', text: friendly, ts: next[next.length - 1].ts }
          return next
        })
      }
    } finally {
      setStreaming(false)
    }
  }

  function onKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  if (collapsed) {
    return (
      <aside className="agent-panel-collapsed">
        <button className="panel-expand-btn" onClick={() => setCollapsed(false)}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </aside>
    )
  }

  return (
    <aside className="agent-panel">
      {/* Active section / image header */}
      <div className="panel-active-header" key={activeSection}>
        {onClose && (
          <button className="panel-close-btn" onClick={onClose} title="Close panel">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        )}
        <div className="panel-active-label">Talking about</div>
        <div className="panel-active-section">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>{activeSection}</span>
        </div>
      </div>

      {/* Versions tracker — only when an image is selected on the left.
          Each generated version becomes a small thumbnail; click any
          thumbnail to make it the active version on the source slot. */}
      {activeSlotKey && versions.length > 0 && (
        <div className="panel-versions">
          <div className="panel-versions-label">
            Versions <span className="panel-versions-count">{versions.length}</span>
          </div>
          <div className="panel-versions-grid">
            {versions.map((v, i) => (
              <button
                key={(v.src || '') + i}
                className={`panel-version-thumb${i === activeVersion ? ' active' : ''}`}
                onClick={() => pickVersion(i)}
                title={`Version ${i + 1}${i === activeVersion ? ' (active)' : ''}`}
              >
                <img src={v.src} alt={`Version ${i + 1}`} />
                {i === activeVersion && <span className="panel-version-active-mark">●</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="panel-messages" ref={messagesRef}>
        {messages.map((m, i) => (
          <div key={m.ts ?? i} className={`msg ${m.role}${editingTs === m.ts ? ' editing' : ''}`} style={{ animationDelay: `${i * 60}ms` }}>
            {m.kind === 'card' ? (
              <>
                <ChatResultCard card={m.card} pending={m.pending} />
                {m.text && <div className="msg-bubble card-closer">{m.text}</div>}
              </>
            ) : (
              <div className="msg-bubble">
                {Array.isArray(m.attachments) && m.attachments.length > 0 && (
                  <div className="msg-attachments">
                    {m.attachments.map((a, ai) => (
                      <img key={ai} src={a.src} alt={a.name || `attachment ${ai + 1}`} />
                    ))}
                  </div>
                )}
                {m.text || (m.attachments?.length ? null : <span style={{ opacity: 0.4 }}>•••</span>)}
              </div>
            )}
            {m.role === 'user' && (
              <button
                type="button"
                className="msg-edit-btn"
                onClick={() => startEdit(m)}
                title="Edit this message and re-run"
              >
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                  <path d="M11.3 2.3l2.4 2.4L5.8 12.6 3 13.4l.8-2.8 7.5-8.3z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Edit
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="panel-input">
        {/* Active-slot context chip — confirms which image on the
            canvas the chat is targeting. Visible whenever a slot is
            selected; the slot's active thumbnail (if any) renders
            alongside the section / label. */}
        {activeImageTarget?.slotKey && (
          <div className="panel-active-context">
            {versions[activeVersion]?.src ? (
              <img
                className="panel-active-context-thumb"
                src={versions[activeVersion].src}
                alt={activeImageTarget.label || 'Selected image'}
              />
            ) : (
              <div className="panel-active-context-empty" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
            )}
            <div className="panel-active-context-meta">
              <span className="panel-active-context-eyebrow">Editing</span>
              <span className="panel-active-context-label">
                {activeImageTarget.sectionTitle} / {activeImageTarget.label || 'Image'}
              </span>
            </div>
          </div>
        )}
        {editingTs != null && (
          <div className="panel-editing-banner">
            <span>✎ Editing — sending will replace the previous message</span>
            <button type="button" className="panel-editing-cancel" onClick={cancelEdit}>Cancel</button>
          </div>
        )}
        {attachedImages.length > 0 && (
          <div className="panel-attached-row">
            {attachedImages.map((a, i) => (
              <div key={i} className="panel-attached-thumb" title={a.name}>
                <img src={a.src} alt={a.name} />
                <button
                  type="button"
                  className="panel-attached-remove"
                  onClick={() => removeAttachedImage(i)}
                  title="Remove this reference"
                >
                  <svg width="8" height="8" viewBox="0 0 12 12" fill="none">
                    <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
        <MentionInput
          className="panel-textarea"
          placeholder={attachedImages.length ? 'Tell me how to use these references…' : 'What do you want to change about this section?'}
          value={input}
          onChange={setInput}
          onKeyDown={onKey}
          disabled={streaming}
          brief={brief}
          rows={2}
          placement="top"
        />
        <input
          ref={chatFileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={e => { handleChatAttach(e.target.files); e.target.value = '' }}
        />
        <div className="panel-input-actions">
          <button className="panel-attach-btn" onClick={openChatAttach} title="Attach a reference image" type="button" disabled={streaming || attachedImages.length >= 4}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </button>
          <div className="panel-intent-wrap" ref={intentBtnRef}>
            <button
              type="button"
              className="panel-intent-btn"
              onClick={() => setIntentMenuOpen(o => !o)}
              disabled={streaming}
              title="Pick what you want me to do"
            >
              <span>{INTENTS.find(i => i.id === intent)?.label || 'Auto'}</span>
              <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
                <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
            </button>
            {intentMenuOpen && (
              <div className="panel-intent-menu">
                {INTENTS.map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    className={`panel-intent-option${intent === opt.id ? ' active' : ''}`}
                    onClick={() => { setIntent(opt.id); setIntentMenuOpen(false) }}
                  >
                    <span className="panel-intent-label">{opt.label}</span>
                    <span className="panel-intent-hint">{opt.hint}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {SpeechRecognition && (
            <button className={`panel-mic-btn${listening ? ' active' : ''}`} onClick={toggleMic} title={listening ? 'Stop listening' : 'Speak'}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <rect x="5.5" y="1" width="5" height="8" rx="2.5" stroke="currentColor" strokeWidth="1.4"/>
                <path d="M2 8c0 3 1.8 4.5 6 4.5s6-1.5 6-4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                <path d="M8 12.5v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
            </button>
          )}
          <button className="panel-send-btn" onClick={send} disabled={!input.trim() || streaming}>
            {streaming
              ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#fff" strokeWidth="2.5" strokeDasharray="28" strokeDashoffset="8"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.75s" repeatCount="indefinite"/></circle></svg>
              : <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
            }
          </button>
        </div>
      </div>
    </aside>
  )
}
