import ImageSlot from '../ImageSlot.jsx'

// Mood board ingredients are not bound to the project's output ratio.
// Hero is wide (cinematic feel), grid tiles are square. Heights are
// CAPPED — at full board width a raw 16:9 hero is ~620px tall and a
// 1:1 tile ~540px, which makes the section eat the whole screen. We
// fix explicit heights instead so the section stays compact.
export default function MoodBoard({ data }) {
  const base = `${data?.brand ?? ''} ${data?.description ?? ''}, mood board, cinematic aesthetic, editorial`
  return (
    <div className="mb-grid">
      <ImageSlot
        ratio="16:9"
        slimWhenEmpty
        prompt={`${base}, hero wide shot, atmospheric style reference`}
        style={{ width: '100%', height: 240, borderRadius: 10 }}
      />
      <div className="mb-tiles">
        <ImageSlot
          ratio="1:1"
          slimWhenEmpty
          prompt={`${base}, colour palette texture reference`}
          style={{ width: '100%', height: 200, borderRadius: 8 }}
        />
        <ImageSlot
          ratio="1:1"
          slimWhenEmpty
          prompt={`${base}, lighting reference, film still, cinematic`}
          style={{ width: '100%', height: 200, borderRadius: 8 }}
        />
        <ImageSlot
          ratio="1:1"
          slimWhenEmpty
          prompt={`${base}, texture and material reference, macro detail`}
          style={{ width: '100%', height: 200, borderRadius: 8 }}
        />
      </div>
    </div>
  )
}
