import ImageSlot from '../ImageSlot.jsx'

export default function MoodBoard({ data }) {
  const base = `${data.brand} ${data.description}, mood board, cinematic aesthetic, editorial`
  return (
    <div className="moodboard-grid">
      <ImageSlot
        prompt={`${base}, hero reference, wide atmospheric shot`}
        style={{ width: '100%', height: 180, borderRadius: 10, marginBottom: 8 }}
      />
      <div className="moodboard-row">
        <ImageSlot prompt={`${base}, texture and colour palette`} style={{ width: '100%', height: 120, borderRadius: 10 }} />
        <ImageSlot prompt={`${base}, lighting reference, film still`} style={{ width: '100%', height: 120, borderRadius: 10 }} />
        <ImageSlot prompt={`${base}, talent energy, motion blur`} style={{ width: '100%', height: 120, borderRadius: 10 }} />
      </div>
    </div>
  )
}
