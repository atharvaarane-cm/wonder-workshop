import EditableText from '../EditableText.jsx'
import ImageSlot from '../ImageSlot.jsx'

export default function BrandInfo({ data, update }) {
  return (
    <div>
      <ImageSlot className="brand-logo-slot" label="Logo" style={{ height: 56, marginBottom: 14, borderRadius: 8 }} />
      <div className="brand-colors">
        {(data.colors || []).map((c, i) => (
          <div className="color-swatch" key={i}>
            <div className="swatch-block" style={{ background: c.hex }} />
            <div className="swatch-hex">{c.hex}</div>
            <div className="swatch-name">{c.name}</div>
          </div>
        ))}
      </div>
      <EditableText
        tag="p"
        className="brand-rules"
        value={data.rules}
        onChange={v => update('brandInfo.rules', v)}
        placeholder="Brand rules…"
      />
    </div>
  )
}
