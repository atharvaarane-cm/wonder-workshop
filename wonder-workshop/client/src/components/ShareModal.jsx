import { useState, useEffect } from 'react'

export default function ShareModal({ brief, images, onClose }) {
  const [copied, setCopied] = useState(false)

  const shareUrl = (() => {
    try {
      const payload = JSON.stringify({ brief, images: images || {} })
      const encoded = btoa(unescape(encodeURIComponent(payload)))
      return `${window.location.origin}${window.location.pathname}#share=${encoded}`
    } catch {
      return window.location.href
    }
  })()

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
      const el = document.createElement('textarea')
      el.value = shareUrl
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      el.remove()
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="share-modal" onClick={e => e.stopPropagation()}>
        <div className="share-modal-header">
          <div>
            <div className="share-modal-title">Share this brief</div>
            <div className="share-modal-sub">Anyone with the link can view — read only</div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="share-link-row">
          <input className="share-link-input" value={shareUrl} readOnly onClick={e => e.target.select()} />
          <button className={`share-copy-btn${copied ? ' copied' : ''}`} onClick={copyLink}>
            {copied ? '✓ Copied' : 'Copy link'}
          </button>
        </div>

        <div className="share-info">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M8 7v5M8 5.5v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          Viewers can browse the full board and make their own copy to edit.
        </div>
      </div>
    </div>
  )
}
