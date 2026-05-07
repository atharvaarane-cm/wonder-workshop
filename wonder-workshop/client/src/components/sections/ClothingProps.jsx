import ImageSlot from '../ImageSlot.jsx'

export default function ClothingProps({ data }) {
  const wardrobe = data?.wardrobe ?? 'athletic wear, professional outfit'
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
      <ImageSlot
        prompt={`${wardrobe}, clothing outfit flat lay, fashion product photography, clean white background, overhead view`}
        style={{ width: '100%', aspectRatio: '1/1', borderRadius: 10 }}
      />
      <ImageSlot
        prompt={`${wardrobe} shoes, sneakers product shot, isolated white background, studio lighting, commercial photography`}
        style={{ width: '100%', aspectRatio: '1/1', borderRadius: 10 }}
      />
      <ImageSlot
        prompt={`${wardrobe} accessories props sunglasses watch, product photography, white background, commercial`}
        style={{ width: '100%', aspectRatio: '1/1', borderRadius: 10 }}
      />
    </div>
  )
}
