import EditableText from '../EditableText.jsx'
import ImageSlot from '../ImageSlot.jsx'

export default function ShotList({ data, updateShot }) {
  return (
    <div className="shot-grid">
      {(data || []).map((shot, i) => (
        <div className="shot-cell" key={shot.num}>

          {/* Image with overlaid badges */}
          <div className="shot-img-wrap">
            <ImageSlot
              prompt={`${shot.description}, ${shot.framing} shot, ${shot.camera} camera, cinematic film still`}
              style={{ width: '100%', height: '100%', borderRadius: 8 }}
            />
            <span className="shot-badge-num">{String(shot.num).padStart(2, '0')}</span>
            <span className="shot-badge-framing">{shot.framing}</span>
          </div>

          {/* Info below image */}
          <div className="shot-info">
            <EditableText tag="p" className="shot-desc" value={shot.description} onChange={v => updateShot(i, 'description', v)} />
            <div className="shot-meta-row">
              <EditableText className="shot-cam" value={shot.camera} onChange={v => updateShot(i, 'camera', v)} />
              <EditableText className="shot-dur" value={shot.duration} onChange={v => updateShot(i, 'duration', v)} />
            </div>
          </div>

        </div>
      ))}
    </div>
  )
}
