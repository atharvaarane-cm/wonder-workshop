import { useState } from 'react'
import EditableText from '../EditableText.jsx'
import ImageSlot from '../ImageSlot.jsx'

function domainFromUrl(url) {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' }
}

// Swatch tile per the May 13 mockup — joined into the strip, no labels
// visible by default. Hex code fades in over the color on hover, and
// clicking the swatch copies the hex to the clipboard.
function Swatch({ color, first, last }) {
  const [copied, setCopied] = useState(false)

  async function copy(e) {
    e?.stopPropagation()
    try {
      await navigator.clipboard.writeText(color.hex)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {}
  }

  return (
    <button
      type="button"
      className={`bi-swatch${first ? ' first' : ''}${last ? ' last' : ''}${copied ? ' copied' : ''}`}
      onClick={copy}
      style={{ background: color.hex }}
      title={color.name ? `${color.name} · ${color.hex}` : color.hex}
    >
      <span className="bi-swatch-hex-overlay">
        {copied ? '✓ Copied' : color.hex}
      </span>
    </button>
  )
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

  const colors = data.colors || []

  return (
    <div className="bi-layout">

      {/* Left column: logo on top, BRAND COLORS strip below. */}
      <div className="bi-left-col">
        <div className={`bi-logo-wrap${fallbacks.length > 0 && !logoFailed ? ' has-logo' : ''}`}>
          {fallbacks.length > 0 && !logoFailed
            ? <img src={fallbacks[srcIdx]} alt="Brand logo" onError={handleError} className="bi-logo-img" />
            : <ImageSlot label="Logo" style={{ width: '100%', height: '100%', borderRadius: 12 }} />
          }
        </div>

        {sourceUrl && (
          <a href={sourceUrl} target="_blank" rel="noreferrer" className="bi-source-link">
            {domain || 'Visit site'} ↗
          </a>
        )}

        {colors.length > 0 && (
          <div className="bi-colors">
            <div className="bi-section-label">Brand Colors</div>
            <div className="bi-swatches-strip">
              {colors.map((c, i) => (
                <Swatch
                  color={c}
                  key={i}
                  first={i === 0}
                  last={i === colors.length - 1}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right column: brand guidelines */}
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
