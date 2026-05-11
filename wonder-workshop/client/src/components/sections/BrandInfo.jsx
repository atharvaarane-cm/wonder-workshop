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
    if (srcIdx + 1 < fallbacks.length) setSrcIdx(srcIdx + 1)
    else setLogoFailed(true)
  }

  return (
    <div className="bi-layout">

      {/* Logo + source */}
      <div className="bi-logo-col">
        <div className="bi-logo-wrap">
          {fallbacks.length > 0 && !logoFailed
            ? <img src={fallbacks[srcIdx]} alt="Brand logo" onError={handleError} className="bi-logo-img" />
            : <ImageSlot label="Logo" style={{ width: '100%', height: '100%', borderRadius: 10 }} />
          }
        </div>
        {sourceUrl && (
          <a href={sourceUrl} target="_blank" rel="noreferrer" className="bi-source-link">
            {domain || 'Visit site'} ↗
          </a>
        )}
      </div>

      {/* Color palette */}
      <div className="bi-colors-col">
        <div className="bi-section-label">Color Palette</div>
        <div className="bi-swatches">
          {(data.colors || []).map((c, i) => (
            <div className="bi-swatch-row" key={i}>
              <div className="bi-swatch-block" style={{ background: c.hex }} />
              <div className="bi-swatch-info">
                <span className="bi-swatch-name">{c.name}</span>
                <span className="bi-swatch-hex">{c.hex}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Brand guidelines */}
      <div className="bi-rules-col">
        <div className="bi-section-label">Brand Guidelines</div>
        <EditableText
          tag="p"
          className="bi-rules-text"
          value={data.rules ?? ''}
          onChange={v => update('brandInfo.rules', v)}
          placeholder="Brand guidelines and rules…"
        />
      </div>

    </div>
  )
}
