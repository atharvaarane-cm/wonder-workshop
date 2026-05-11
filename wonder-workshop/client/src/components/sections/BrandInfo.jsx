import { useState } from 'react'
import EditableText from '../EditableText.jsx'
import ImageSlot from '../ImageSlot.jsx'

function domainFromUrl(url) {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' }
}

export default function BrandInfo({ data, update }) {
  const logoUrl = data.logoUrl || ''
  const sourceUrl = data.sourceUrl || ''
  const domain = domainFromUrl(sourceUrl) || domainFromUrl(logoUrl)
  const fallbacks = [
    logoUrl,
    domain && `https://www.google.com/s2/favicons?domain=${domain}&sz=256`,
    domain && `https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${domain}&size=256`,
  ].filter(Boolean)
  const [srcIdx, setSrcIdx] = useState(0)
  const [logoFailed, setLogoFailed] = useState(false)

  function handleError() {
    if (srcIdx + 1 < fallbacks.length) {
      setSrcIdx(srcIdx + 1)
    } else {
      setLogoFailed(true)
    }
  }

  return (
    <div>
      {fallbacks.length > 0 && !logoFailed ? (
        <div className="brand-logo-resolved">
          <img src={fallbacks[srcIdx]} alt="Brand logo" onError={handleError} />
          {sourceUrl && (
            <a href={sourceUrl} target="_blank" rel="noreferrer" className="brand-source-link">
              Source
            </a>
          )}
        </div>
      ) : (
        <ImageSlot className="brand-logo-slot" label="Logo" style={{ height: 56, marginBottom: 14, borderRadius: 8 }} />
      )}
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
