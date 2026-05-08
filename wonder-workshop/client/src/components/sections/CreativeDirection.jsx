import EditableText from '../EditableText.jsx'
import ImageSlot from '../ImageSlot.jsx'

const FIELDS = [
  { label: 'Client',   key: 'brand' },
  { label: 'Format',   key: 'format' },
  { label: 'Duration', key: 'duration' },
  { label: 'Shots',    key: 'shots' },
  { label: 'Location', key: 'location' },
]

export default function CreativeDirection({ data, update }) {
  const heroPrompt = `${data.brand} ${data.description} cinematic film still, professional photography, high quality`
  return (
    <div>
      <ImageSlot className="cd-hero-img" label="Hero Image" prompt={heroPrompt} />
      <div className="cd-grid">
        {FIELDS.map(({ label, key }) => (
          <div className="cd-field" key={key}>
            <label>{label}</label>
            <EditableText tag="div" className="val" value={String(data[key] ?? '')} onChange={v => update(`creativeDirection.${key}`, v)} />
          </div>
        ))}
      </div>
      <EditableText tag="p" className="cd-desc" value={data.description} onChange={v => update('creativeDirection.description', v)} placeholder="Creative description…" />
    </div>
  )
}
