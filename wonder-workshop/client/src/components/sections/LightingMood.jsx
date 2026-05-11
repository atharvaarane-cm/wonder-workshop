import EditableText from '../EditableText.jsx'
import ImageSlot from '../ImageSlot.jsx'

export default function LightingMood({ data, imagePrompts, updateMood }) {
  return (
    <div>
      <div className="mood-grid">
        {(data || []).map((mood, i) => {
          const colorBar = mood.colors?.length > 0
            ? `linear-gradient(135deg, ${mood.colors[0]}, ${mood.colors[1] || mood.colors[0]})`
            : 'var(--border)'
          const prompt = imagePrompts?.[i]
            || `${mood.name}, ${mood.description}, cinematic lighting, film still, ${mood.tags?.join(', ') || ''}`
          return (
            <div className="mood-swatch" key={mood.letter}>
              <ImageSlot
                prompt={prompt}
                style={{ width: '100%', borderRadius: 0 }}
              />
              <div className="mood-color" style={{ background: colorBar }} />
              <div className="mood-info">
                <EditableText
                  className="mood-letter"
                  value={`${mood.letter} — ${mood.name}`}
                  onChange={v => updateMood(i, 'name', v.replace(/^.\s*—\s*/, ''))}
                />
                <EditableText
                  tag="p"
                  className="mood-desc"
                  value={mood.description}
                  onChange={v => updateMood(i, 'description', v)}
                />
                <div className="mood-tags">
                  {(mood.tags || []).map(t => <span className="mood-tag" key={t}>{t}</span>)}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
