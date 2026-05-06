import EditableText from '../EditableText.jsx'
import ImageSlot from '../ImageSlot.jsx'

export default function Character({ data, update }) {
  const base = `${data.description}, ${data.wardrobe}, professional photography, white background`
  return (
    <div>
      <div className="character-views">
        {(data.views || ['FRONT', '3/4', 'SIDE']).map((v, i) => (
          <div className="character-view" key={v}>
            <ImageSlot
              label={v}
              prompt={`${base}, ${v.toLowerCase()} view, full body shot`}
              style={{ width: '100%', height: '100%', borderRadius: 10 }}
            />
          </div>
        ))}
      </div>
      <p className="character-wardrobe">
        <strong>Wardrobe: </strong>
        <EditableText value={data.wardrobe} onChange={v => update('character.wardrobe', v)} placeholder="Wardrobe details…" />
      </p>
      <EditableText tag="p" className="cd-desc" value={data.description} onChange={v => update('character.description', v)} placeholder="Character description…" style={{ marginTop: 8 }} />
    </div>
  )
}
