import EditableText from '../EditableText.jsx'
import ImageSlot from '../ImageSlot.jsx'

export default function ShotList({ data, updateShot }) {
  return (
    <div className="shot-grid">
      {(data || []).map((shot, i) => (
        <div className="shot-cell" key={shot.num}>
          <ImageSlot
            prompt={`${shot.description}, ${shot.framing} shot, ${shot.camera} camera, cinematic film still`}
            style={{ width: '100%', height: 80, borderRadius: 7, marginBottom: 8 }}
          />
          <div className="shot-top">
            <EditableText className="shot-framing" value={shot.framing} onChange={v => updateShot(i, 'framing', v)} />
            <span className="shot-num">{shot.num}</span>
          </div>
          <EditableText tag="p" className="shot-desc" value={shot.description} onChange={v => updateShot(i, 'description', v)} />
          <div className="shot-bottom">
            <EditableText className="shot-cam" value={shot.camera} onChange={v => updateShot(i, 'camera', v)} />
            <EditableText className="shot-dur" value={shot.duration} onChange={v => updateShot(i, 'duration', v)} />
          </div>
        </div>
      ))}
    </div>
  )
}
