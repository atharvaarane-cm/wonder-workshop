import { useState, useRef, useEffect } from 'react'
import { streamChat } from '../hooks/useBrief.js'

export default function AgentPanel({ activeSection, brief }) {
  const [messages, setMessages] = useState([
    { role: 'agent', text: `Brief generated. I'm ready to help you refine any section — just ask.` }
  ])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const messagesRef = useRef(null)
  const abortRef = useRef(null)

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight
    }
  }, [messages])

  async function send() {
    const text = input.trim()
    if (!text || streaming) return
    setInput('')
    setStreaming(true)

    const userMsg = { role: 'user', text }
    setMessages(prev => [...prev, userMsg])

    const history = [
      {
        role: 'system',
        content: `You are a creative production assistant in Wonder Workshop. The user is viewing the "${activeSection}" section of their brief. Brief context: ${JSON.stringify(brief?.creativeDirection ?? {})}. Be concise and creative.`
      },
      ...messages.map(m => ({ role: m.role === 'agent' ? 'assistant' : 'user', content: m.text })),
      { role: 'user', content: text }
    ]

    const agentMsg = { role: 'agent', text: '' }
    setMessages(prev => [...prev, agentMsg])

    try {
      const controller = new AbortController()
      abortRef.current = controller
      await streamChat(
        history,
        fullText => {
          setMessages(prev => {
            const next = [...prev]
            next[next.length - 1] = { role: 'agent', text: fullText }
            return next
          })
        },
        controller.signal
      )
    } catch (e) {
      if (e.name !== 'AbortError') {
        setMessages(prev => {
          const next = [...prev]
          next[next.length - 1] = { role: 'agent', text: "Can't reach Ollama — make sure it's running: ollama serve" }
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

  return (
    <aside className="agent-panel">
      <div className="panel-header">
        <span className="panel-title">{activeSection}</span>
      </div>

      <div className="panel-messages" ref={messagesRef}>
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            <div className="msg-bubble">{m.text || '•••'}</div>
            <div className="msg-time">Just now</div>
          </div>
        ))}
      </div>

      <div className="panel-input">
        <div className="panel-input-box">
          <textarea
            placeholder="What do you want to change about this section?"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKey}
            disabled={streaming}
          />
          <div className="panel-input-actions">
            <button className="panel-send" onClick={send} disabled={!input.trim() || streaming}>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <path d="M3 8h10M9 4l4 4-4 4" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </aside>
  )
}
