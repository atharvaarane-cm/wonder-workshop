import EditableText from '../EditableText.jsx'
import ImageSlot from '../ImageSlot.jsx'

// Default starter items used when the brief has no productElements yet.
// Keeps the section from rendering empty for back-compat / new projects.
function defaultItems(wardrobe) {
  const base = wardrobe || ''
  return [
    { name: 'Clothing',    description: `${base} clothing outfit flat lay, fashion product photography, clean white background, overhead view` },
    { name: 'Shoes',       description: `${base} shoes product shot, isolated white background, studio lighting, commercial photography` },
    { name: 'Accessories', description: `${base} accessories props sunglasses watch, product photography, white background, commercial` },
  ]
}

// Each product/element is a named handle. The name shows under the image
// and is also the `@handle` users can reference inside Storyboard shot
// prompts (per the mockup pattern).
export default function ClothingProps({ brief, update }) {
  const stored = Array.isArray(brief?.productElements) ? brief.productElements : null
  const items = stored && stored.length
    ? stored
    : defaultItems(brief?.character?.wardrobe)

  function updateItem(idx, field, value) {
    const next = items.map((it, i) => i === idx ? { ...it, [field]: value } : it)
    update?.('productElements', next)
  }

  function addItem() {
    const next = [...items, { name: '', description: '' }]
    update?.('productElements', next)
  }

  return (
    <div className="prod-grid">
      {items.map((item, i) => {
        const prompt = item.description
          ? item.description
          : `${item.name || 'product'}, product shot, clean white background, studio lighting, commercial photography`
        return (
          <div className="prod-item" key={i}>
            <ImageSlot
              ratio="1:1"
              prompt={prompt}
              style={{ width: '100%', aspectRatio: '1/1', borderRadius: 10 }}
            />
            <EditableText
              className="prod-name"
              value={item.name}
              onChange={v => updateItem(i, 'name', v)}
              placeholder="Name this product…"
            />
          </div>
        )
      })}
      <button className="prod-add" onClick={addItem} type="button">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
        </svg>
        <span>Add product</span>
      </button>
    </div>
  )
}
