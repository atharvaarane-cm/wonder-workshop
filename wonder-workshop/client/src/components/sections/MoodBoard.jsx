import ImageSlot from '../ImageSlot.jsx'

// Mood board ingredients are not bound to the project's output ratio.
// Hero is wide (cinematic feel), grid tiles are square.
export default function MoodBoard({ data }) {
  const base = `${data?.brand ?? ''} ${data?.description ?? ''}, mood board, cinematic aesthetic, editorial`
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <ImageSlot
        ratio="16:9"
        prompt={`${base}, hero wide shot, atmospheric style reference`}
        style={{ width: '100%', aspectRatio: '16/9', borderRadius: 10 }}
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <ImageSlot
          ratio="1:1"
          prompt={`${base}, colour palette texture reference`}
          style={{ width: '100%', aspectRatio: '1/1', borderRadius: 8 }}
        />
        <ImageSlot
          ratio="1:1"
          prompt={`${base}, lighting reference, film still, cinematic`}
          style={{ width: '100%', aspectRatio: '1/1', borderRadius: 8 }}
        />
      </div>
    </div>
  )
}
