import EditableText from '../EditableText.jsx'

// Matches the Wonder Workshop Figma mockup: a thin BLUE header bar
// containing the "Creative" label + DURATION + ASPECT RATIO inline,
// then a single-column dark body with just the prose description.
// Other fields (keyMessage / toneKeywords / format / shots / location)
// remain in the brief data — they're surfaced elsewhere (topbar
// production strip, aspect-ratio dropdown) so the CD card itself stays
// minimal per the mockup.
export default function CreativeDirection({ data, update }) {
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

      {/* Dark body — just the prose description, per the mockup. */}
      <div className="cd-body">
        <EditableText
          tag="p"
          className="cd-desc"
          value={data.description ?? ''}
          onChange={v => update('creativeDirection.description', v)}
          placeholder="Creative description…"
        />
      </div>

    </div>
  )
}
