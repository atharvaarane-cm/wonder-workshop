import EditableText from '../EditableText.jsx'
import ImageSlot from '../ImageSlot.jsx'

export default function Character({ data, update, mode = 'fullbody' }) {
  const isClose = mode === 'closeup'
  const base = isClose
    ? `${data.description}, ${data.wardrobe}, close up portrait, head and shoulders, studio lighting`
    : `${data.description}, ${data.wardrobe}, professional photography, white background`
  const suffix = isClose ? 'headshot, face detail, sharp focus' : 'full body shot'

  return (
    <div>
      <div className="character-views">
        {['FRONT', '3/4', 'SIDE'].map(v => (
          <div className="character-view" key={v}>
            <ImageSlot
              label={v}
              prompt={`${base}, ${v.toLowerCase()} view, ${suffix}`}
              style={{ width: '100%', height: '100%', borderRadius: 10 }}
            />
          </div>
        ))}
      </div>

      {isClose ? (
        <p className="character-wardrobe" style={{ marginTop: 10 }}>
          <strong>Head Shots: </strong>
          <span style={{ opacity: 0.5 }}>Front · Three-quarter · Side</span>
        </p>
      ) : (
        <>
          <p className="character-wardrobe">
            <strong>Wardrobe: </strong>
            <EditableText value={data.wardrobe} onChange={v => update('character.wardrobe', v)} placeholder="Wardrobe details…" />
          </p>
          <EditableText tag="p" className="cd-desc" value={data.description} onChange={v => update('character.description', v)} placeholder="Character description…" style={{ marginTop: 8 }} />
        </>
      )}
    </div>
  )
}
