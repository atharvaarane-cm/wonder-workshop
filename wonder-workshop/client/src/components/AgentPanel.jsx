import { useState, useRef, useEffect, useContext } from 'react'
import { chatWithTools } from '../hooks/useBrief.js'
import { ProjectContext } from '../hooks/useProject.js'

function timeAgo(ts) {
  const diff = Math.round((Date.now() - ts) / 60000)
  if (diff < 1) return 'Just now'
  if (diff === 1) return '1 min ago'
  return `${diff} min ago`
}

// Tool definitions exposed to Gemini — the model picks one when the user
// asks to change something. Schemas use Gemini's functionDeclarations format.
const TOOLS = [
  {
    name: 'update_brief_field',
    description: 'Update any text field in the brief using dot-path notation. Examples: "creativeDirection.brand", "creativeDirection.description", "character.description", "character.wardrobe", "environment.heroEnvironment", "brandInfo.rules". Use when the user asks to change/edit/rename/set a brief field.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Dot-path to the field within the brief JSON.' },
        value: { type: 'string', description: 'The new value as a plain string.' },
      },
      required: ['path', 'value'],
    },
  },
  {
    name: 'regenerate_active_image',
    description: 'Regenerate the currently-selected image with a new prompt. Only call this when the user has an active image selected AND they ask to remake/regenerate/redo/try the image differently. Provide the FULL new prompt, not just a delta — describe subject, setting, lighting, framing, mood.',
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

  const [messages, setMessages] = useState([
    { role: 'agent', text: `Here's the creative direction for the ${brief?.creativeDirection?.brand ?? ''} shoot. I've set ${brief?.creativeDirection?.shots ?? 9} shots across ${brief?.creativeDirection?.location ?? 'key locations'} with a strong hero narrative.`, ts: Date.now() }
  ])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [listening, setListening] = useState(false)
  const [, forceUpdate] = useState(0)
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

  useEffect(() => {
    const t = setInterval(() => forceUpdate(n => n + 1), 30000)
    return () => clearInterval(t)
  }, [])

  async function send() {
    const text = input.trim()
    if (!text || streaming) return
    setInput('')
    setStreaming(true)

    setMessages(prev => [...prev, { role: 'user', text, ts: Date.now() }])

    const hasActiveImage = !!activeImageTarget?.prompt
    const systemPrompt = [
      `You are a creative production assistant working inside Wonder Workshop, a brief tool.`,
      `When the user asks to change/edit/set/rename/update any field, CALL update_brief_field with the appropriate dot-path — do not just describe the change.`,
      `When the user asks to regenerate/remake/redo/change the active image, CALL regenerate_active_image with the FULL new prompt.`,
      `When the user asks a question or wants conversation, respond with plain text only (no function calls). Keep replies under 3 sentences.`,
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
          ].join('\n'),
      ``,
      `# Full brief (for path resolution and broader context — use sparingly):`,
      JSON.stringify(brief ?? {}),
    ].join('\n')

    const history = [
      { role: 'system', content: systemPrompt },
      ...messages.map(m => ({ role: m.role === 'agent' ? 'assistant' : 'user', content: m.text })),
      { role: 'user', content: text },
    ]

    setMessages(prev => [...prev, { role: 'agent', text: '', ts: Date.now() }])

    try {
      const controller = new AbortController()
      abortRef.current = controller
      const { text: replyText, actions } = await chatWithTools(history, TOOLS, controller.signal)

      // Apply each function call against the live brief.
      const applied = []
      for (const a of actions) {
        if (a.name === 'update_brief_field' && onUpdate) {
          const { path, value } = a.args || {}
          if (path && typeof value === 'string') {
            onUpdate(path, value)
            applied.push(a)
          }
        } else if (a.name === 'regenerate_active_image' && onRegenerateImage) {
          const { new_prompt } = a.args || {}
          if (new_prompt && activeImageTarget?.slotKey) {
            const ok = onRegenerateImage(new_prompt)
            if (ok) applied.push(a)
          }
        }
      }

      // Assemble the agent's reply. If Gemini sent text, use it; if there
      // were applied actions but no text, synthesise a short summary.
      const actionSummaries = applied.map(describeAction).filter(Boolean)
      let finalText = (replyText || '').trim()
      if (!finalText && actionSummaries.length) {
        finalText = actionSummaries.join(' · ')
      } else if (actionSummaries.length && !finalText.includes(actionSummaries[0])) {
        finalText = `${finalText}\n\n${actionSummaries.map(s => `↳ ${s}`).join('\n')}`
      }
      if (!finalText) finalText = '(no response)'

      setMessages(prev => {
        const next = [...prev]
        next[next.length - 1] = { role: 'agent', text: finalText, ts: next[next.length - 1].ts }
        return next
      })
    } catch (e) {
      if (e.name !== 'AbortError') {
        setMessages(prev => {
          const next = [...prev]
          next[next.length - 1] = { role: 'agent', text: 'Something went wrong. Please try again.', ts: next[next.length - 1].ts }
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
          <div key={i} className={`msg ${m.role}`} style={{ animationDelay: `${i * 60}ms` }}>
            <div className="msg-bubble">{m.text || <span style={{ opacity: 0.4 }}>•••</span>}</div>
            <div className="msg-time">{timeAgo(m.ts)}</div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="panel-input">
        <textarea
          className="panel-textarea"
          placeholder="What do you want to change about this section?"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKey}
          disabled={streaming}
          rows={2}
        />
        <div className="panel-input-actions">
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
