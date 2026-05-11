import EditableText from '../EditableText.jsx'
import ImageSlot from '../ImageSlot.jsx'

function hashStr(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

const VIEWS = [
  { id: 'FRONT', label: 'FRONT', angle: 'facing directly forward, front view' },
  { id: '3/4',   label: '3/4',   angle: 'three-quarter view, angled 45 degrees left' },
  { id: 'SIDE',  label: 'SIDE',  angle: 'strict side profile, facing right' },
]

export default function Character({ data, update, mode = 'fullbody' }) {
  const isClose = mode === 'closeup'
  const seed = hashStr((data.description || '') + (data.wardrobe || ''))

  const baseSubject = isClose
    ? `${data.description}, ${data.wardrobe}, close-up portrait, head and shoulders`
    : `${data.description}, ${data.wardrobe}, full body, standing`

  const baseSuffix = isClose
    ? 'sharp face detail, studio lighting, clean white background, headshot'
    : 'full body shot, white studio background, professional photography, character reference sheet'

  return (
    <div>
      <div className="character-views">
        {VIEWS.map(v => (
          <div className="character-view" key={v.id}>
            <ImageSlot
              label={v.label}
              view={v.id}
              seed={seed}
              prompt={`${baseSubject}, ${v.angle}, ${baseSuffix}`}
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
