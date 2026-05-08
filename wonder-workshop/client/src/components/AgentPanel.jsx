import { useState, useRef, useEffect } from 'react'
import { streamChat } from '../hooks/useBrief.js'

function timeAgo(ts) {
  const diff = Math.round((Date.now() - ts) / 60000)
  if (diff < 1) return 'Just now'
  if (diff === 1) return '1 min ago'
  return `${diff} min ago`
}

export default function AgentPanel({ activeSection, brief }) {
  const [messages, setMessages] = useState([
    { role: 'agent', text: `Here's the creative direction for the ${brief?.creativeDirection?.brand ?? ''} shoot. I've set ${brief?.creativeDirection?.shots ?? 9} shots across ${brief?.creativeDirection?.location ?? 'key locations'} with a strong hero narrative.`, ts: Date.now() }
  ])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [, forceUpdate] = useState(0)
  const messagesRef = useRef(null)
  const abortRef = useRef(null)

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

    const history = [
      {
        role: 'system',
        content: `You are a creative production assistant. The user is viewing the "${activeSection}" section of their brief. Brief: ${JSON.stringify(brief?.creativeDirection ?? {})}. Be concise and creative. Keep responses under 3 sentences.`
      },
      ...messages.map(m => ({ role: m.role === 'agent' ? 'assistant' : 'user', content: m.text })),
      { role: 'user', content: text }
    ]

    setMessages(prev => [...prev, { role: 'agent', text: '', ts: Date.now() }])

    try {
      const controller = new AbortController()
      abortRef.current = controller
      await streamChat(history, fullText => {
        setMessages(prev => {
          const next = [...prev]
          next[next.length - 1] = { role: 'agent', text: fullText, ts: next[next.length - 1].ts }
          return next
        })
      }, controller.signal)
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
      {/* Active section header */}
      <div className="panel-active-header" key={activeSection}>
        <div className="panel-active-label">Talking about</div>
        <div className="panel-active-section">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>{activeSection}</span>
        </div>
      </div>

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
          <button className="panel-edit-btn">
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
            Edit
            <svg width="9" height="9" viewBox="0 0 10 10" fill="none"><path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
          </button>
          <button className="panel-mic-btn">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <rect x="5.5" y="1" width="5" height="8" rx="2.5" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M2 8c0 3 1.8 4.5 6 4.5s6-1.5 6-4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              <path d="M8 12.5v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </button>
          <div className="panel-section-label" key={activeSection}>
            <span>{activeSection}</span>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          </div>
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
