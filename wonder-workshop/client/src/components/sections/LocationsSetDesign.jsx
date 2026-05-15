import EditableText from '../EditableText.jsx'
import ImageSlot from '../ImageSlot.jsx'

// Matches the Wonder Workshop Figma mockup: a single wide hero image
// with an editable name caption overlaid bottom-left. The mockup
// intentionally simplifies to one location image — detail tiles for
// interior shots / shot routes were removed.
export default function LocationsSetDesign({ data, update }) {
  const hero = data?.heroEnvironment ?? 'cinematic location'
  const elements = data?.keyElements?.slice(0, 3).join(', ') ?? ''

  return (
    <div className="loc-hero-wrap">
      <ImageSlot
        ratio="16:9"
        slimWhenEmpty
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
  )
}
