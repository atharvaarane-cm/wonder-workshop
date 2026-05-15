import EditableText from '../EditableText.jsx'
import ImageSlot from '../ImageSlot.jsx'
import MentionInput from '../MentionInput.jsx'
import { expandMentions } from '../../utils/mentions.js'

export default function ShotList({ data, updateShot, addShot, removeShot, brief }) {
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
        // The generator gets the expanded text, not what the writer typed —
        // surface that so it's never a silent rewrite.
        const wasExpanded = expandedDescription !== (shot.description || '')
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
            <button
              className="shot-remove-btn"
              onClick={() => removeShot(i)}
              title="Remove this shot"
            >
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              </svg>
            </button>
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
            {wasExpanded && (
              <div
                className="shot-expanded-note"
                title={`Sent to the image generator:\n\n${expandedDescription}`}
              >
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                  <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.1"/>
                  <path d="M6 5.2v3M6 3.6v.05" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
                <span>@mentions are expanded to full descriptions on generate</span>
              </div>
            )}
            <div className="shot-meta-row">
              <EditableText className="shot-cam" value={shot.camera} onChange={v => updateShot(i, 'camera', v)} />
              <EditableText className="shot-dur" value={shot.duration} onChange={v => updateShot(i, 'duration', v)} />
            </div>
          </div>

        </div>
        )
      })}
      <div className="shot-cell">
        <button
          className="shot-add-cell"
          style={{ aspectRatio: aspectCss }}
          onClick={addShot}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          <span>Add shot</span>
        </button>
      </div>
    </div>
  )
}
