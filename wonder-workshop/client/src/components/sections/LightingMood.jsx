import EditableText from '../EditableText.jsx'
import ImageSlot from '../ImageSlot.jsx'

export default function LightingMood({ data, imagePrompts, updateMood }) {
  return (
    <div>
      <div className="mood-grid">
        {(data || []).map((mood, i) => (
          <div className="mood-swatch" key={mood.letter}>
            <ImageSlot
              label={`${mood.letter} — ${mood.name}`}
              style={{ width: '100%', height: 80, display: 'block' }}
            />
            <div
              className="mood-color"
              style={{ background: `linear-gradient(135deg, ${mood.colors[0]}, ${mood.colors[1] || mood.colors[0]})` }}
            />
            <div className="mood-info">
              <EditableText className="mood-letter" value={`${mood.letter} — ${mood.name}`} onChange={v => updateMood(i, 'name', v.replace(/^.\s*—\s*/, ''))} />
              <EditableText tag="p" className="mood-desc" value={mood.description} onChange={v => updateMood(i, 'description', v)} />
              <div className="mood-tags">
                {(mood.tags || []).map(t => <span className="mood-tag" key={t}>{t}</span>)}
              </div>
            </div>
          </div>
        ))}
      </div>

      {imagePrompts?.length > 0 && (
        <div className="img-gen-row">
          {imagePrompts.map((prompt, i) => {
            const hue = (i * 67 + 210) % 360
            return (
              <div key={i} className="img-gen-card" style={{ background: `linear-gradient(135deg, hsl(${hue},30%,12%), hsl(${(hue+40)%360},20%,22%))` }}>
                <div className="gen-badge">AI Visual Direction</div>
                <div className="img-gen-overlay">
                  <p className="img-gen-prompt">{prompt}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
