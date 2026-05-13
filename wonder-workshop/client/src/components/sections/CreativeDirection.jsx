import EditableText from '../EditableText.jsx'

// Matches the Wonder Workshop Figma mockup: a thin BLUE header bar
// containing the "Creative" label + DURATION + ASPECT RATIO inline,
// then a single-column dark body with the prose description and any
// supplemental text fields. No hero image — the section is text-only
// per the mockup.
export default function CreativeDirection({ data, update, onGoToShotList }) {
  const toneKeywords = Array.isArray(data.toneKeywords) ? data.toneKeywords : []
  const ratio = data.format || data.aspectRatio || '16:9'

  return (
    <div className="cd-wrap">

      {/* Blue header strip — "Creative" label on the left,
          metadata pills on the right. */}
      <div className="cd-feature-bar">
        <span className="cd-feature-label">Creative</span>
        <div className="cd-feature-meta">
          {data.duration && (
            <div className="cd-feature-meta-item">
              <span className="cd-feature-meta-label">DURATION</span>
              <span className="cd-feature-meta-val">{data.duration}</span>
            </div>
          )}
          <div className="cd-feature-meta-item">
            <span className="cd-feature-meta-label">ASPECT RATIO</span>
            <span className="cd-feature-meta-val">{ratio}</span>
          </div>
        </div>
      </div>

      {/* Dark body — prose description + metadata grid */}
      <div className="cd-body">
        {data.keyMessage && (
          <EditableText
            tag="p"
            className="cd-key-message"
            value={data.keyMessage}
            onChange={v => update('creativeDirection.keyMessage', v)}
          />
        )}

        <EditableText
          tag="p"
          className="cd-desc"
          value={data.description ?? ''}
          onChange={v => update('creativeDirection.description', v)}
          placeholder="Creative description…"
        />

        {toneKeywords.length > 0 && (
          <div className="cd-tone-row">
            {toneKeywords.map((kw, i) => (
              <span key={i} className="cd-tone-chip">{kw}</span>
            ))}
          </div>
        )}

        <div className="cd-divider" />

        <div className="cd-meta-grid">
          <div className="cd-meta-field">
            <span className="cd-meta-label">Format</span>
            <EditableText tag="div" className="cd-meta-val" value={String(data.format ?? '')} onChange={v => update('creativeDirection.format', v)} />
          </div>
          <div className="cd-meta-field">
            <span className="cd-meta-label">Shots</span>
            <button className="cd-shots-link" onClick={onGoToShotList} title="Jump to Shot List">
              {data.shots ?? '—'} shots ↓
            </button>
          </div>
          <div className="cd-meta-field">
            <span className="cd-meta-label">Location</span>
            <EditableText tag="div" className="cd-meta-val" value={data.location ?? ''} onChange={v => update('creativeDirection.location', v)} />
          </div>
        </div>
      </div>

    </div>
  )
}
