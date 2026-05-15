import { useEffect, useRef, useState } from 'react'
import EditableText from '../EditableText.jsx'

const RATIO_OPTIONS = ['16:9', '9:16', '1:1', '4:5', '4:3', '2:1']

// Matches the Wonder Workshop Figma mockup: a thin BLUE header bar
// containing the "Creative" label + DURATION + ASPECT RATIO inline,
// separated by thin light-blue vertical dividers. ASPECT RATIO is a
// dropdown — picking a new ratio fires onAspectRatioChange so the
// board can prompt the user about regenerating existing images.
export default function CreativeDirection({ data, update, currentRatio, onAspectRatioChange }) {
  const ratio = currentRatio || data.format || data.aspectRatio || '16:9'
  const [menuOpen, setMenuOpen] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!menuOpen) return
    function onDocClick(e) {
      if (wrapRef.current?.contains(e.target)) return
      setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [menuOpen])

  function pickRatio(r) {
    setMenuOpen(false)
    if (r === ratio) return
    onAspectRatioChange?.(r)
  }

  return (
    <div className="cd-wrap">

      {/* Blue header strip — "Creative" label on the left,
          dividers + DURATION + ASPECT RATIO (dropdown) on the right. */}
      <div className="cd-feature-bar">
        <span className="cd-feature-label">Creative</span>
        <div className="cd-feature-meta">
          {data.duration && (
            <>
              <span className="cd-feature-sep" aria-hidden="true" />
              <div className="cd-feature-meta-item">
                <span className="cd-feature-meta-label">DURATION</span>
                <span className="cd-feature-meta-val">{data.duration}</span>
              </div>
            </>
          )}
          <span className="cd-feature-sep" aria-hidden="true" />
          <div className="cd-ratio-wrap" ref={wrapRef}>
            <button
              type="button"
              className="cd-feature-meta-item cd-ratio-btn"
              onClick={() => setMenuOpen(o => !o)}
              title="Change aspect ratio"
            >
              <span className="cd-feature-meta-label">ASPECT RATIO</span>
              <span className="cd-feature-meta-val">
                {ratio}
                <svg className="cd-ratio-chevron" width="11" height="11" viewBox="0 0 12 12" fill="none">
                  <path d="M2.5 4.5l3.5 3.5 3.5-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
            </button>
            {menuOpen && (
              <div className="cd-ratio-menu" onClick={e => e.stopPropagation()}>
                {RATIO_OPTIONS.map(r => (
                  <button
                    key={r}
                    className={`cd-ratio-item${r === ratio ? ' active' : ''}`}
                    onClick={() => pickRatio(r)}
                  >
                    {r}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dark body — prose description + supporting-file chips, per the
          mockup. Attachments are name-only (no file content stored). */}
      <div className="cd-body">
        <EditableText
          tag="p"
          className="cd-desc"
          value={data.description ?? ''}
          onChange={v => update('creativeDirection.description', v)}
          placeholder="Creative description…"
        />
        <div className="cd-attachments">
          <label className="cd-attach-add" title="Add a supporting file">
            <input
              type="file"
              multiple
              style={{ display: 'none' }}
              onChange={e => {
                const files = Array.from(e.target.files || [])
                if (!files.length) return
                const next = [
                  ...(data.attachments || []),
                  ...files.map(f => ({ name: f.name })),
                ]
                update('creativeDirection.attachments', next)
                e.target.value = ''
              }}
            />
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </label>
          {(data.attachments || []).map((a, i) => (
            <button
              key={i}
              className="cd-attach-chip"
              title={`Remove ${a.name}`}
              onClick={() => {
                const next = (data.attachments || []).filter((_, j) => j !== i)
                update('creativeDirection.attachments', next)
              }}
            >
              <svg width="12" height="14" viewBox="0 0 12 14" fill="none">
                <path d="M2 1.5h5L10 4.5v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V1.5z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round"/>
                <path d="M7 1.5V4.5h3" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round"/>
                <path d="M4 7.5h4M4 9.5h4M4 11.5h2.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
              </svg>
              <span className="cd-attach-name">
                {a.name.length > 26 ? a.name.slice(0, 24) + '…' : a.name}
              </span>
            </button>
          ))}
        </div>
      </div>

    </div>
  )
}
