import ImageSlot from '../ImageSlot.jsx'
import { ratioDimensions } from '../../hooks/useBrief.js'

export default function MoodBoard({ data, ratio }) {
  const base = `${data?.brand ?? ''} ${data?.description ?? ''}, mood board, cinematic aesthetic, editorial`
  const aspect = ratioDimensions(ratio).css
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <ImageSlot
        prompt={`${base}, hero wide shot, atmospheric style reference`}
        ratio={ratio}
        style={{ width: '100%', aspectRatio: aspect, borderRadius: 10 }}
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <ImageSlot
          prompt={`${base}, colour palette texture reference`}
          ratio={ratio}
          style={{ width: '100%', aspectRatio: aspect, borderRadius: 8 }}
        />
        <ImageSlot
          prompt={`${base}, lighting reference, film still, cinematic`}
          ratio={ratio}
          style={{ width: '100%', aspectRatio: aspect, borderRadius: 8 }}
        />
      </div>
    </div>
  )
}
