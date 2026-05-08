import EditableText from '../EditableText.jsx'

export default function Story({ data, update, updateBeat }) {
  if (!data) return <div className="story-empty">No story yet.</div>
  const beats = data.beats || []
  const isUser = data.source === 'user'
  return (
    <div className="story-section">
      <div className="story-meta">
        <span className={`story-badge ${isUser ? 'user' : 'synth'}`}>
          {isUser ? 'user-written' : 'synthesized'}
        </span>
      </div>
      <EditableText
        tag="p"
        className="story-treatment"
        value={data.treatment}
        onChange={v => update('story.treatment', v)}
        placeholder="Treatment / story…"
      />
      {beats.length > 0 && (
        <div className="story-beats">
          <div className="story-beats-label">BEATS</div>
          {beats.map((b, i) => (
            <div className="story-beat" key={i}>
              <span className="story-beat-num">{b.num}.</span>
              <EditableText
                tag="span"
                className="story-beat-text"
                value={b.summary}
                onChange={v => updateBeat(i, 'summary', v)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
