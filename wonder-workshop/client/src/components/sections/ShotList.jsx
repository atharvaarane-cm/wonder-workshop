import EditableText from '../EditableText.jsx'
import ImageSlot from '../ImageSlot.jsx'
import MentionInput from '../MentionInput.jsx'
import { expandMentions } from '../../utils/mentions.js'

export default function ShotList({ data, updateShot, brief }) {
  // Storyboard frames follow the project's output ratio — a 4:5 project
  // shouldn't show 16:9 shots. CSS aspect-ratio takes "4/5", so swap the colon.
  const ratio = brief?.generationSettings?.ratio || '16:9'
  const aspectCss = ratio.replace(':', '/')
  return (
    <div className="shot-grid">
      {(data || []).map((shot, i) => {
        // @Sarah / @Sunset Beach in the description get swapped for the
        // character/location's full description before we build the prompt.
        // If the user hasn't used any @handles, the description is sent as-is.
        const expandedDescription = expandMentions(shot.description, brief)
        const prompt = `${expandedDescription}, ${shot.framing} shot, ${shot.camera} camera, cinematic film still`
        return (
        <div className="shot-cell" key={shot.num}>

          {/* Image with overlaid badges */}
          <div className="shot-img-wrap" style={{ aspectRatio: aspectCss }}>
            <ImageSlot
              prompt={prompt}
              ratio={ratio}
              style={{ width: '100%', height: '100%', borderRadius: 8 }}
            />
            <span className="shot-badge-num">{String(shot.num).padStart(2, '0')}</span>
            <span className="shot-badge-framing">{shot.framing}</span>
          </div>

          {/* Info below image */}
          <div className="shot-info">
            <MentionInput
              className="shot-desc"
              value={shot.description || ''}
              onChange={v => updateShot(i, 'description', v)}
              brief={brief}
              rows={3}
              placeholder="Describe this shot — use @Sarah or @Sunset Beach to reference named entities…"
            />
            <div className="shot-meta-row">
              <EditableText className="shot-cam" value={shot.camera} onChange={v => updateShot(i, 'camera', v)} />
              <EditableText className="shot-dur" value={shot.duration} onChange={v => updateShot(i, 'duration', v)} />
            </div>
          </div>

        </div>
        )
      })}
    </div>
  )
}
