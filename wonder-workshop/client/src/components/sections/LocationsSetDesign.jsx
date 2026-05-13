import EditableText from '../EditableText.jsx'
import ImageSlot from '../ImageSlot.jsx'

// Locations are ingredients, not output — wide hero + two detail tiles
// regardless of the project's storyboard ratio.
// The hero has an editable "Sunset Beach"-style name that other prompts
// (e.g. Storyboard shot descriptions) can @mention.
export default function LocationsSetDesign({ data, update }) {
  const hero = data?.heroEnvironment ?? 'cinematic location'
  const elements = data?.keyElements?.slice(0, 3).join(', ') ?? ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="loc-hero-wrap">
        <ImageSlot
          ratio="16:9"
          prompt={`${hero}, ${elements}, wide establishing shot, golden hour, cinematic photography`}
          style={{ width: '100%', aspectRatio: '16/9', borderRadius: 10 }}
        />
        <div className="loc-hero-caption">
          <EditableText
            className="loc-hero-name"
            value={data?.heroName}
            onChange={v => update?.('environment.heroName', v)}
            placeholder="Name this location (used as @handle)…"
          />
        </div>
      </div>
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
