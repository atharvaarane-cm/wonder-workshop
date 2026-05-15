import ImageSlot from '../ImageSlot.jsx'

// Per the Figma mockup: a single wide mood-board slot, not a hero +
// tile grid. Slim and collapsed until populated, then expands to a
// 16:9 cinematic ratio when an image lands.
export default function MoodBoard({ data }) {
  const base = `${data?.brand ?? ''} ${data?.description ?? ''}, mood board, cinematic aesthetic, editorial`
  return (
    <ImageSlot
      ratio="16:9"
      slimWhenEmpty
      prompt={`${base}, hero wide shot, atmospheric style reference`}
      style={{ width: '100%', height: 240, borderRadius: 7 }}
    />
  )
}
