import { useState, useRef } from 'react'
import { generateBrief } from '../hooks/useBrief.js'

const HINTS = [
  'Nike Football — gritty urban',
  'Luxury fragrance — cinematic',
  'Tech product — minimal clean',
  'Streetwear — raw, handheld',
]

export default function Discover({ onGenerate }) {
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const textRef = useRef(null)

  async function handleSend() {
    const text = prompt.trim()
    if (!text || loading) return
    setLoading(true)
    setError(null)
    try {
      const brief = await generateBrief(text)
      onGenerate(brief)
    } catch (e) {
      setError(e.message)
      setLoading(false)
    }
  }

  function onKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  return (
    <div className="discover">
      <div className="discover-logo">Wonder Workshop</div>

      <div className="discover-heading">
        <h1>
          What are you <em>shooting?</em>
        </h1>
      </div>

      {error && (
        <div style={{ fontSize: 13, color: 'rgba(255,100,100,0.9)', background: 'rgba(255,60,60,0.08)', border: '1px solid rgba(255,60,60,0.2)', borderRadius: 10, padding: '10px 14px', maxWidth: 680, width: '100%' }}>
          {error}
        </div>
      )}

      <div className="prompt-box">
        <textarea
          ref={textRef}
          placeholder="Describe your campaign — brand, vibe, format, talent…"
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          onKeyDown={onKey}
          disabled={loading}
          autoFocus
        />
        <div className="prompt-actions">
          <div className="prompt-hints">
            {HINTS.map(h => (
              <span key={h} className="hint-pill" onClick={() => { setPrompt(h); textRef.current?.focus() }}>
                {h}
              </span>
            ))}
          </div>
          <button className="send-btn" onClick={handleSend} disabled={!prompt.trim() || loading}>
            {loading
              ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#1A1A1A" strokeWidth="2" strokeDasharray="31.4" strokeDashoffset="10"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite"/></circle></svg>
              : <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="#1A1A1A" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
            }
          </button>
        </div>
      </div>
    </div>
  )
}
