import ImageSlot from '../ImageSlot.jsx'

export default function LocationsSetDesign({ data }) {
  const hero = data?.heroEnvironment ?? 'cinematic location'
  const elements = data?.keyElements?.slice(0, 3).join(', ') ?? ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <ImageSlot
        prompt={`${hero}, ${elements}, wide establishing shot, golden hour, cinematic photography, 16:9`}
        style={{ width: '100%', height: 200, borderRadius: 10 }}
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <ImageSlot
          prompt={`${hero}, interior detail shot, atmospheric lighting, production design`}
          style={{ width: '100%', height: 120, borderRadius: 8 }}
        />
        <ImageSlot
          prompt={`${hero}, ${data?.shotRoute ?? 'location'}, atmospheric wide angle, cinematic`}
          style={{ width: '100%', height: 120, borderRadius: 8 }}
        />
      </div>
    </div>
  )
}
