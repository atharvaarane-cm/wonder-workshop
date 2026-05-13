import EditableText from '../EditableText.jsx'
import ImageSlot from '../ImageSlot.jsx'

export default function CreativeDirection({ data, update, onGoToShotList }) {
  const heroPrompt = `${data.brand} ${data.description} cinematic film still, professional photography, high quality`
  const toneKeywords = Array.isArray(data.toneKeywords) ? data.toneKeywords : []

  return (
    <div className="cd-wrap">

      {/* Gradient strip — orange→pink→purple, sits flush against the
          section card's edges. Visual hero of the Creative section
          per the Figma mockup. */}
      <div className="cd-gradient-strip" aria-hidden="true" />

    <div className="cd-layout">

      {/* Left — hero image */}
      <div className="cd-left">
        <ImageSlot className="cd-hero-img" label="Hero Image" prompt={heroPrompt} />
      </div>

      {/* Right — all creative info */}
      <div className="cd-right">

        {/* Brand + production type */}
        <div className="cd-header-row">
          <EditableText tag="h2" className="cd-brand" value={data.brand ?? ''} onChange={v => update('creativeDirection.brand', v)} placeholder="Brand" />
        </div>

        {/* Key message */}
        <EditableText
          tag="p"
          className="cd-key-message"
          value={data.keyMessage ?? ''}
          onChange={v => update('creativeDirection.keyMessage', v)}
          placeholder="Key message…"
        />

        <div className="cd-divider" />

        {/* Description */}
        <EditableText
          tag="p"
          className="cd-desc"
          value={data.description ?? ''}
          onChange={v => update('creativeDirection.description', v)}
          placeholder="Creative description…"
        />

        {/* Tone keywords */}
        {toneKeywords.length > 0 && (
          <div className="cd-tone-row">
            {toneKeywords.map((kw, i) => (
              <span key={i} className="cd-tone-chip">{kw}</span>
            ))}
          </div>
        )}

        <div className="cd-divider" />

        {/* Metadata grid */}
        <div className="cd-meta-grid">
          {[
            ['Format',   'format'],
            ['Duration', 'duration'],
          ].map(([label, key]) => (
            <div className="cd-meta-field" key={key}>
              <span className="cd-meta-label">{label}</span>
              <EditableText tag="div" className="cd-meta-val" value={String(data[key] ?? '')} onChange={v => update(`creativeDirection.${key}`, v)} />
            </div>
          ))}
          <div className="cd-meta-field">
            <span className="cd-meta-label">Shots</span>
            <button className="cd-shots-link" onClick={onGoToShotList} title="Jump to Shot List">
              {data.shots ?? '—'} shots ↓
            </button>
          </div>
        </div>

        {/* Location — full width */}
        <div className="cd-location">
          <span className="cd-meta-label">Location</span>
          <EditableText tag="div" className="cd-meta-val" value={data.location ?? ''} onChange={v => update('creativeDirection.location', v)} />
        </div>

      </div>
    </div>
    </div>
  )
}
