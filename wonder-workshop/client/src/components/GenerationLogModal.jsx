import { useEffect, useState } from 'react'
import {
  getGenerationLog,
  clearGenerationLog,
  subscribeGenerationLog,
  formatGenerationLog,
} from '../utils/generationLog.js'

const STAGE_LABELS = {
  'ok': 'loaded',
  'fetch-threw': 'network error reaching /api/image',
  'http-error': '/api/image returned an error status',
  'no-image-field': '/api/image response had no image URL',
  'probe-failed': 'image URL returned but failed to load',
}

export default function GenerationLogModal({ onClose }) {
  const [log, setLog] = useState(() => [...getGenerationLog()])
  const [copyState, setCopyState] = useState(null)

  useEffect(() => subscribeGenerationLog(l => setLog([...l])), [])

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(formatGenerationLog())
      setCopyState('copied')
    } catch {
      setCopyState('failed')
    }
    setTimeout(() => setCopyState(null), 1500)
  }

  const fails = log.filter(e => e.stage !== 'ok').length

  return (
    <div className="genlog-modal" onClick={onClose}>
      <div className="genlog-content" onClick={e => e.stopPropagation()}>
        <div className="genlog-header">
          <div>
            <div className="genlog-eyebrow">Generation log</div>
            <div className="genlog-sub">{log.length} attempts · {fails} failed</div>
          </div>
          <div className="genlog-header-actions">
            <button className="genlog-btn" onClick={copyAll} disabled={!log.length}>
              {copyState === 'copied' ? '✓ Copied' : copyState === 'failed' ? 'Copy failed' : 'Copy all'}
            </button>
            <button className="genlog-btn" onClick={() => clearGenerationLog()} disabled={!log.length}>
              Clear
            </button>
            <button className="genlog-close" onClick={onClose} title="Close (Esc)">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>
        <div className="genlog-body">
          {!log.length && (
            <div className="genlog-empty">
              No generation attempts yet. Run Generate, then reopen this to see what happened.
            </div>
          )}
          {[...log].reverse().map((e, i) => (
            <div key={i} className={`genlog-row genlog-row-${e.stage === 'ok' ? 'ok' : 'fail'}`}>
              <div className="genlog-row-top">
                <span className={`genlog-badge genlog-badge-${e.stage === 'ok' ? 'ok' : 'fail'}`}>
                  {e.stage === 'ok' ? 'OK' : 'FAIL'}
                </span>
                <span className="genlog-stage">{STAGE_LABELS[e.stage] || e.stage}</span>
                {e.status != null && <span className="genlog-meta">HTTP {e.status}</span>}
                <span className="genlog-meta">attempt {e.attempt}/{e.maxAttempts}</span>
                {e.ms != null && <span className="genlog-meta">{e.ms}ms</span>}
                <span className="genlog-meta genlog-ts">{new Date(e.ts).toLocaleTimeString()}</span>
              </div>
              <div className="genlog-row-where">{e.section || '—'} / {e.label || '—'}</div>
              {e.detail && <div className="genlog-row-detail">{e.detail}</div>}
              {e.imageUrl && <div className="genlog-row-url">{e.imageUrl}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
