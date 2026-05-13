import ImageSlot from '../ImageSlot.jsx'

// Locations are ingredients, not output — wide hero + two detail tiles
// regardless of the project's storyboard ratio.
export default function LocationsSetDesign({ data }) {
  const hero = data?.heroEnvironment ?? 'cinematic location'
  const elements = data?.keyElements?.slice(0, 3).join(', ') ?? ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <ImageSlot
        ratio="16:9"
        prompt={`${hero}, ${elements}, wide establishing shot, golden hour, cinematic photography`}
        style={{ width: '100%', aspectRatio: '16/9', borderRadius: 10 }}
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <ImageSlot
          ratio="4:3"
          prompt={`${hero}, interior detail shot, atmospheric lighting, production design`}
          style={{ width: '100%', aspectRatio: '4/3', borderRadius: 8 }}
        />
        <ImageSlot
          ratio="4:3"
          prompt={`${hero}, ${data?.shotRoute ?? 'location'}, atmospheric wide angle, cinematic`}
          style={{ width: '100%', aspectRatio: '4/3', borderRadius: 8 }}
        />
      </div>
    </div>
  )
}
