import { useState } from 'react'
import EditableText from '../EditableText.jsx'
import ImageSlot from '../ImageSlot.jsx'

function domainFromUrl(url) {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' }
}

// Brand color swatches were removed 2026-05-22 — Ravi flagged on the call
// that they "don't really do much for us" and Logan confirmed in
// follow-up review. Mood Board now carries visual direction. The
// brandInfo.colors data field is preserved in storage for back-compat,
// it just doesn't render anywhere.

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
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupError, setLookupError] = useState(null)

  // Pull brand metadata (logo, colors, guidelines) from the URL the
  // user typed. Hits /api/brand.js which has a known-brand table and
  // a DuckDuckGo fallback. Extracts the brand name from the domain —
  // "starbucks.com" → "starbucks" — so the endpoint can match.
  async function lookupBrand(rawInput) {
    const input = (rawInput || '').trim()
    if (!input) return
    let brand = input
    try {
      const normalized = /^https?:\/\//i.test(input) ? input : `https://${input}`
      const url = new URL(normalized)
      const host = url.hostname.replace(/^www\./, '')
      brand = host.split('.')[0]
    } catch {}
    setLookupLoading(true)
    setLookupError(null)
    try {
      const res = await fetch('/api/brand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand }),
      })
      const payload = await res.json()
      if (!res.ok || payload.error) throw new Error(payload.error || `HTTP ${res.status}`)
      if (payload.sourceUrl) update('brandInfo.sourceUrl', payload.sourceUrl)
      if (payload.logoUrl) update('brandInfo.logoUrl', payload.logoUrl)
      if (payload.colors?.length) update('brandInfo.colors', payload.colors)
      if (payload.rules) update('brandInfo.rules', payload.rules)
      if (payload.brand) update('creativeDirection.brand', payload.brand)
      setSrcIdx(0); setLogoFailed(false)
    } catch (e) {
      setLookupError(e?.message || 'Lookup failed')
    } finally {
      setLookupLoading(false)
    }
  }

  function handleError() {
    if (srcIdx + 1 < fallbacks.length) setSrcIdx(srcIdx + 1)
    else setLogoFailed(true)
  }

  return (
    <div className="bi-layout">

      {/* Left column: logo + URL lookup. Brand-color strip removed
          2026-05-22 per Ravi/Logan — visual direction lives in Mood Board. */}
      <div className="bi-left-col">
        <div className={`bi-logo-wrap${fallbacks.length > 0 && !logoFailed ? ' has-logo' : ''}`}>
          {fallbacks.length > 0 && !logoFailed
            ? <img src={fallbacks[srcIdx]} alt="Brand logo" onError={handleError} className="bi-logo-img" />
            : <ImageSlot label="Logo" style={{ width: '100%', height: '100%', borderRadius: 12 }} />
          }
        </div>

        {/* Paste a brand website URL — we derive the logo from the
            site's favicon (s2/faviconV2 endpoints). If the user provides
            an explicit logoUrl that takes priority; otherwise the domain
            from sourceUrl is used. */}
        <div className="bi-source-input-wrap">
          <input
            type="url"
            className="bi-source-input"
            placeholder="Paste brand URL (e.g. nike.com) — press Enter to fetch"
            value={sourceUrl}
            disabled={lookupLoading}
            onChange={e => {
              setSrcIdx(0); setLogoFailed(false)
              update('brandInfo.sourceUrl', e.target.value)
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); lookupBrand(e.currentTarget.value) }
            }}
            onBlur={e => {
              // Fire on blur too — only if the field has a value AND the
              // user hasn't already populated colors/rules (avoids
              // re-fetching on every blur in an existing brief).
              const v = e.currentTarget.value?.trim()
              const alreadyPopulated = !!(data.colors?.length || data.rules)
              if (v && !alreadyPopulated) lookupBrand(v)
            }}
          />
          {lookupLoading && <span className="bi-lookup-spinner" aria-hidden="true" />}
          {lookupError && <span className="bi-lookup-error" title={lookupError}>Lookup failed</span>}
        </div>

        {sourceUrl && (
          <a href={sourceUrl} target="_blank" rel="noreferrer" className="bi-source-link">
            {domain || 'Visit site'} ↗
          </a>
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

      {/* Additional brand reference uploads — drop in brand-book pages,
          existing campaign shots, mood references, etc. Each slot has a
          stable id so persistence survives reorder / delete. */}
      <BrandAssets data={data} update={update} />

    </div>
  )
}

function BrandAssets({ data, update }) {
  const assets = Array.isArray(data.assets) ? data.assets : []
  function addAsset() {
    const id = `brand_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
    update('brandInfo.assets', [...assets, { id, caption: '' }])
  }
  function updateAsset(idx, field, value) {
    update('brandInfo.assets', assets.map((a, i) => i === idx ? { ...a, [field]: value } : a))
  }
  function removeAsset(idx) {
    update('brandInfo.assets', assets.filter((_, i) => i !== idx))
  }
  return (
    <div className="bi-assets-col">
      <div className="bi-section-label">Brand Assets</div>
      <div className="bi-assets-grid">
        {assets.map((a, i) => (
          <div className="bi-asset-item" key={a.id || i}>
            <ImageSlot
              ratio="1:1"
              slimWhenEmpty
              prompt={`brand-asset:${a.id || `idx-${i}`}`}
              style={{ width: '100%', aspectRatio: '1/1', borderRadius: 8 }}
            />
            <EditableText
              className="bi-asset-caption"
              value={a.caption}
              onChange={v => updateAsset(i, 'caption', v)}
              placeholder="Caption…"
            />
            <button className="bi-asset-remove" onClick={() => removeAsset(i)} title="Remove asset">
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        ))}
        <button className="bi-asset-add" onClick={addAsset} type="button">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
          <span>Add asset</span>
        </button>
      </div>
    </div>
  )
}
