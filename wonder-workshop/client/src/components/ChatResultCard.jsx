// Delivery card rendered in the chat after the agent completes an image
// action. Mirrors Luma's pattern: status dot, title, summary, thumbnail
// strip, time-elapsed badge, and a "Show process" expand. The card is a
// conversational artifact — you can scroll back through the chat and
// see what you generated, not just text that says "Done".

import { useState } from 'react'

function formatElapsed(ms) {
  if (!ms || ms < 1000) return '<1s'
  if (ms < 60000) return `${Math.round(ms / 1000)}s`
  const m = Math.floor(ms / 60000)
  const s = Math.round((ms % 60000) / 1000)
  return `${m}m ${s}s`
}

export default function ChatResultCard({ card, pending = false }) {
  const [showProcess, setShowProcess] = useState(false)

  if (pending) {
    return (
      <div className="chat-result-card pending">
        <div className="chat-result-header">
          <span className="chat-result-dot pending" />
          <span className="chat-result-title">Working on it…</span>
        </div>
      </div>
    )
  }

  if (!card) return null
  const { title, src, prompt, elapsedMs, sectionLabel, blocked } = card

  return (
    <div className={`chat-result-card${blocked ? ' blocked' : ''}`}>
      <div className="chat-result-header">
        <span className={`chat-result-dot${blocked ? ' blocked' : ''}`} />
        <span className="chat-result-title">{title}</span>
        {elapsedMs != null && !blocked && (
          <span className="chat-result-elapsed">{formatElapsed(elapsedMs)}</span>
        )}
      </div>
      {sectionLabel && <div className="chat-result-section">{sectionLabel}</div>}
      {src && (
        <div className="chat-result-thumb">
          <img src={src} alt={title || 'Result'} />
        </div>
      )}
      {prompt && (
        <button
          type="button"
          className="chat-result-process-toggle"
          onClick={() => setShowProcess(v => !v)}
        >
          {showProcess ? 'Hide process' : 'Show process'}
        </button>
      )}
      {showProcess && prompt && (
        <pre className="chat-result-process">{prompt}</pre>
      )}
    </div>
  )
}
