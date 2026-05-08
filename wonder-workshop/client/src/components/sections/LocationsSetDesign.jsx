import ImageSlot from '../ImageSlot.jsx'
import { ratioDimensions } from '../../hooks/useBrief.js'

export default function LocationsSetDesign({ data, ratio }) {
  const hero = data?.heroEnvironment ?? 'cinematic location'
  const elements = data?.keyElements?.slice(0, 3).join(', ') ?? ''
  const aspect = ratioDimensions(ratio).css

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <ImageSlot
        prompt={`${hero}, ${elements}, wide establishing shot, golden hour, cinematic photography, ${ratio || '16:9'}`}
        ratio={ratio}
        style={{ width: '100%', aspectRatio: aspect, borderRadius: 10 }}
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <ImageSlot
          prompt={`${hero}, interior detail shot, atmospheric lighting, production design`}
          ratio={ratio}
          style={{ width: '100%', aspectRatio: aspect, borderRadius: 8 }}
        />
        <ImageSlot
          prompt={`${hero}, ${data?.shotRoute ?? 'location'}, atmospheric wide angle, cinematic`}
          ratio={ratio}
          style={{ width: '100%', aspectRatio: aspect, borderRadius: 8 }}
        />
      </div>
    </div>
  )
}
