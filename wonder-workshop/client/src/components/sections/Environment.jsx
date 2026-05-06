import EditableText from '../EditableText.jsx'
import ImageSlot from '../ImageSlot.jsx'

export default function Environment({ data, update }) {
  const envPrompt = `${data.heroEnvironment}, cinematic location photography, professional film production`
  return (
    <div className="env-grid">
      <ImageSlot label="Hero Environment" prompt={envPrompt} style={{ width: '100%', height: 150, borderRadius: 10, marginBottom: 12 }} />
      <div className="env-field">
        <label>Hero Environment</label>
        <EditableText tag="p" value={data.heroEnvironment} onChange={v => update('environment.heroEnvironment', v)} />
      </div>
      <div className="env-field">
        <label>Shot Route</label>
        <EditableText tag="p" value={data.shotRoute} onChange={v => update('environment.shotRoute', v)} />
      </div>
      <div className="env-tags">
        {(data.keyElements || []).map((el, i) => <span className="env-tag" key={i}>{el}</span>)}
      </div>
    </div>
  )
}
