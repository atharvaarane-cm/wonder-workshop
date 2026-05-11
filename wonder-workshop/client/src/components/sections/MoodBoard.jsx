import ImageSlot from '../ImageSlot.jsx'

export default function MoodBoard({ data }) {
  const base = `${data?.brand ?? ''} ${data?.description ?? ''}, mood board, cinematic aesthetic, editorial`
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <ImageSlot
        prompt={`${base}, hero wide shot, atmospheric style reference`}
        style={{ width: '100%', borderRadius: 10 }}
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <ImageSlot
          prompt={`${base}, colour palette texture reference`}
          style={{ width: '100%', borderRadius: 8 }}
        />
        <ImageSlot
          prompt={`${base}, lighting reference, film still, cinematic`}
          style={{ width: '100%', borderRadius: 8 }}
        />
      </div>
    </div>
  )
}
