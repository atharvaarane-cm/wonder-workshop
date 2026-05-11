import { useEffect } from 'react'

function getImg(images, prompt) {
  if (!images || !prompt) return null
  const slot = images[prompt]
  if (!slot?.versions?.length) return null
  return slot.versions[slot.activeVersion ?? 0]?.src || null
}

function hashStr(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

function ImgThumb({ src, alt, className }) {
  if (!src) return null
  return <img src={src} alt={alt || ''} className={className} />
}

function SectionLabel({ children }) {
  return <div className="op-section-label">{children}</div>
}

export default function OnePager({ brief, images = {}, onClose }) {
  const cd    = brief?.creativeDirection || {}
  const pi    = brief?.projectInfo || {}
  const bi    = brief?.brandInfo || {}
  const shots = brief?.shotList || []
  const moods = brief?.lightingMood || []
  const char  = brief?.character || {}
  const env   = brief?.environment || {}

  // ── Prompt reconstruction ──────────────────────────────────────
  const heroPrompt = `${cd.brand} ${cd.description} cinematic film still, professional photography, high quality`

  // Mood cards
  const moodPrompts = moods.map((m, i) =>
    brief?.imagePrompts?.[i] ||
    `${m.name}, ${m.description}, cinematic lighting, film still, ${(m.tags || []).join(', ')}`
  )

  // Mood Board
  const mbBase = `${cd.brand ?? ''} ${cd.description ?? ''}, mood board, cinematic aesthetic, editorial`
  const mbPrompts = [
    `${mbBase}, hero wide shot, atmospheric style reference`,
    `${mbBase}, colour palette texture reference`,
    `${mbBase}, lighting reference, film still, cinematic`,
  ]

  // Locations / Set Design
  const locBase     = env.heroEnvironment ?? 'cinematic location'
  const locElements = (env.keyElements || []).slice(0, 3).join(', ')
  const locPrompts  = [
    `${locBase}, ${locElements}, wide establishing shot, golden hour, cinematic photography`,
    `${locBase}, interior detail shot, atmospheric lighting, production design`,
    `${locBase}, ${env.shotRoute ?? 'location'}, atmospheric wide angle, cinematic`,
  ]

  // Char Ref (editorial style)
  const charRefBase = char.description ?? 'professional talent'
  const charRefPrompts = [
    `${charRefBase}, front facing, full body, white studio background, editorial fashion photography`,
    `${charRefBase}, three quarter view, dynamic pose, editorial photography, studio lighting`,
    `${charRefBase}, side profile, clean editorial photography, minimal background`,
  ]

  // Character Full Body
  const charFBBase   = `${char.description}, ${char.wardrobe}, full body, standing`
  const charFBSuffix = 'full body shot, white studio background, professional photography, character reference sheet'
  const charFBPrompts = [
    `${charFBBase}, facing directly forward, front view, ${charFBSuffix}`,
    `${charFBBase}, three-quarter view, angled 45 degrees left, ${charFBSuffix}`,
    `${charFBBase}, strict side profile, facing right, ${charFBSuffix}`,
  ]

  // Character Close Up
  const charCUBase   = `${char.description}, ${char.wardrobe}, close-up portrait, head and shoulders`
  const charCUSuffix = 'sharp face detail, studio lighting, clean white background, headshot'
  const charCUPrompts = [
    `${charCUBase}, facing directly forward, front view, ${charCUSuffix}`,
    `${charCUBase}, three-quarter view, angled 45 degrees left, ${charCUSuffix}`,
    `${charCUBase}, strict side profile, facing right, ${charCUSuffix}`,
  ]

  // Clothing / Props
  const wardrobe = char.wardrobe ?? 'athletic wear, professional outfit'
  const clothingPrompts = [
    `${wardrobe}, clothing outfit flat lay, fashion product photography, clean white background, overhead view`,
    `${wardrobe} shoes, sneakers product shot, isolated white background, studio lighting, commercial photography`,
    `${wardrobe} accessories props sunglasses watch, product photography, white background, commercial`,
  ]

  // ── Resolve images ─────────────────────────────────────────────
  const heroSrc       = getImg(images, heroPrompt)
  const moodSrcs      = moodPrompts.map(p => getImg(images, p))
  const mbSrcs        = mbPrompts.map(p => getImg(images, p))
  const locSrcs       = locPrompts.map(p => getImg(images, p))
  const charRefSrcs   = charRefPrompts.map(p => getImg(images, p))
  const charFBSrcs    = charFBPrompts.map(p => getImg(images, p))
  const charCUSrcs    = charCUPrompts.map(p => getImg(images, p))
  const clothingSrcs  = clothingPrompts.map(p => getImg(images, p))

  const charFrontAny  = charRefSrcs[0] || charFBSrcs[0]

  const hasMoodImgs     = moodSrcs.some(Boolean)
  const hasMbImgs       = mbSrcs.some(Boolean)
  const hasLocImgs      = locSrcs.some(Boolean)
  const hasCharRefImgs  = charRefSrcs.some(Boolean)
  const hasCharFBImgs   = charFBSrcs.some(Boolean)
  const hasCharCUImgs   = charCUSrcs.some(Boolean)
  const hasClothingImgs = clothingSrcs.some(Boolean)

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="onepager-backdrop" onClick={onClose}>
      <div className="onepager-shell" onClick={e => e.stopPropagation()}>

        {/* Toolbar */}
        <div className="onepager-toolbar no-print">
          <span className="onepager-toolbar-title">One Pager Preview</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="onepager-print-btn" onClick={() => window.print()}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <rect x="3" y="5" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M5 5V3.5A.5.5 0 015.5 3h5a.5.5 0 01.5.5V5" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M5 12.5v-3h6v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              Print / Save as PDF
            </button>
            <button className="onepager-close-btn" onClick={onClose}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        <div className="onepager-page">

          {/* ── Hero image ── */}
          {heroSrc ? (
            <div className="op-hero">
              <img src={heroSrc} alt="Hero" className="op-hero-img" />
              <div className="op-hero-overlay">
                <div className="op-hero-brand">{cd.brand || pi.clientName}</div>
                <div className="op-hero-campaign">{pi.brandCampaignName || brief?.title}</div>
              </div>
            </div>
          ) : (
            <div className="op-header">
              <div className="op-header-left">
                <div className="op-brand">{cd.brand || pi.clientName || '—'}</div>
                <div className="op-campaign">{pi.brandCampaignName || brief?.title || ''}</div>
              </div>
              <div className="op-header-right">
                {pi.projectName && <div className="op-meta-row"><span>Project</span>{pi.projectName}</div>}
                {pi.jobNumber   && <div className="op-meta-row"><span>Job #</span>{pi.jobNumber}</div>}
                {cd.format      && <div className="op-meta-row"><span>Format</span>{cd.format}</div>}
                {cd.duration    && <div className="op-meta-row"><span>Duration</span>{cd.duration}</div>}
                {cd.shots       && <div className="op-meta-row"><span>Shots</span>{cd.shots}</div>}
                {cd.location    && <div className="op-meta-row"><span>Location</span>{cd.location}</div>}
              </div>
            </div>
          )}

          {/* Meta strip after hero */}
          {heroSrc && (
            <div className="op-meta-strip">
              {[
                pi.projectName && ['Project',  pi.projectName],
                pi.jobNumber   && ['Job #',    pi.jobNumber],
                cd.format      && ['Format',   cd.format],
                cd.duration    && ['Duration', cd.duration],
                cd.shots       && ['Shots',    String(cd.shots)],
                cd.location    && ['Location', cd.location],
              ].filter(Boolean).map(([k, v]) => (
                <div key={k} className="op-meta-item">
                  <span className="op-meta-key">{k}</span>
                  <span className="op-meta-val">{v}</span>
                </div>
              ))}
            </div>
          )}

          {/* ── Creative Direction ── */}
          {cd.description && (
            <div className="op-section op-direction">
              <SectionLabel>Creative Direction</SectionLabel>
              <p className="op-body">{cd.description}</p>
            </div>
          )}

          {/* ── Main 2-col: info + shot list ── */}
          <div className="op-two-col">
            <div className="op-col">

              {/* Brand */}
              {(bi.colors?.length > 0 || bi.rules) && (
                <div className="op-section">
                  <SectionLabel>Brand</SectionLabel>
                  {bi.colors?.length > 0 && (
                    <div className="op-colors">
                      {bi.colors.map((c, i) => (
                        <div className="op-color" key={i}>
                          <div className="op-color-swatch" style={{ background: c.hex }} />
                          <div className="op-color-info">
                            <div className="op-color-hex">{c.hex}</div>
                            <div className="op-color-name">{c.name}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {bi.rules && <p className="op-body" style={{ marginTop: 6 }}>{bi.rules}</p>}
                </div>
              )}

              {/* Character */}
              {(char.description || char.wardrobe || charFrontAny) && (
                <div className="op-section">
                  <SectionLabel>Character</SectionLabel>
                  <div className="op-char-row">
                    {charFrontAny && <img src={charFrontAny} alt="Character" className="op-char-img" />}
                    <div>
                      {char.description && <p className="op-body">{char.description}</p>}
                      {char.wardrobe && (
                        <p className="op-body" style={{ marginTop: 4 }}>
                          <strong>Wardrobe:</strong> {char.wardrobe}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Clothing / Props */}
              {hasClothingImgs && (
                <div className="op-section">
                  <SectionLabel>Clothing &amp; Props</SectionLabel>
                  <div className="op-img-strip">
                    {clothingSrcs.map((src, i) => src && (
                      <img key={i} src={src} alt={`clothing ${i+1}`} className="op-strip-img op-strip-square" />
                    ))}
                  </div>
                </div>
              )}

              {/* Lighting & Mood */}
              {moods.length > 0 && (
                <div className="op-section">
                  <SectionLabel>Lighting &amp; Mood</SectionLabel>
                  <div className="op-moods">
                    {moods.map((m, i) => (
                      <div className="op-mood" key={i}>
                        {moodSrcs[i]
                          ? <img src={moodSrcs[i]} alt={m.name} className="op-mood-thumb" />
                          : (
                            <div className="op-mood-bar" style={{
                              background: m.colors?.length > 1
                                ? `linear-gradient(135deg, ${m.colors[0]}, ${m.colors[1]})`
                                : m.colors?.[0] || '#888'
                            }} />
                          )
                        }
                        <div className="op-mood-info">
                          <div className="op-mood-name">{m.letter} — {m.name}</div>
                          <div className="op-mood-desc">{m.description}</div>
                          {m.tags?.length > 0 && (
                            <div className="op-mood-tags">
                              {m.tags.map(t => <span key={t} className="op-mood-tag">{t}</span>)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Shot List */}
            {shots.length > 0 && (
              <div className="op-col">
                <div className="op-section">
                  <SectionLabel>Shot List</SectionLabel>
                  <table className="op-shot-table">
                    <thead>
                      <tr><th>#</th><th>Frame</th><th>Description</th><th>Camera</th><th>Dur</th></tr>
                    </thead>
                    <tbody>
                      {shots.map((s, i) => (
                        <tr key={i}>
                          <td className="op-shot-num">{s.num}</td>
                          <td className="op-shot-frame">{s.framing}</td>
                          <td>{s.description}</td>
                          <td className="op-shot-camera">{s.camera}</td>
                          <td className="op-shot-dur">{s.duration}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* ── Mood Board / Style Ref ── */}
          {hasMbImgs && (
            <div className="op-section">
              <SectionLabel>Mood Board / Style Ref</SectionLabel>
              <div className="op-img-strip">
                {mbSrcs.map((src, i) => src && (
                  <img key={i} src={src} alt={`mood board ${i+1}`}
                    className={`op-strip-img ${i === 0 ? 'op-strip-wide' : ''}`} />
                ))}
              </div>
            </div>
          )}

          {/* ── Locations / Set Design ── */}
          {hasLocImgs && (
            <div className="op-section">
              <SectionLabel>Locations / Set Design</SectionLabel>
              <div className="op-img-strip">
                {locSrcs.map((src, i) => src && (
                  <img key={i} src={src} alt={`location ${i+1}`}
                    className={`op-strip-img ${i === 0 ? 'op-strip-wide' : ''}`} />
                ))}
              </div>
            </div>
          )}

          {/* ── Character Reference (editorial) ── */}
          {hasCharRefImgs && (
            <div className="op-section">
              <SectionLabel>Char Ref</SectionLabel>
              <div className="op-char-ref-strip">
                {charRefSrcs.map((src, i) => src && (
                  <div key={i} className="op-char-ref-item">
                    <img src={src} alt={['FRONT','3/4','SIDE'][i]} className="op-char-ref-img" />
                    <span className="op-char-ref-label">{['FRONT','3/4','SIDE'][i]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Character Full Body ── */}
          {hasCharFBImgs && (
            <div className="op-section">
              <SectionLabel>Character — Full Body</SectionLabel>
              <div className="op-char-ref-strip">
                {charFBSrcs.map((src, i) => src && (
                  <div key={i} className="op-char-ref-item">
                    <img src={src} alt={['FRONT','3/4','SIDE'][i]} className="op-char-ref-img" />
                    <span className="op-char-ref-label">{['FRONT','3/4','SIDE'][i]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Character Close Up ── */}
          {hasCharCUImgs && (
            <div className="op-section">
              <SectionLabel>Character — Close Up</SectionLabel>
              <div className="op-char-ref-strip">
                {charCUSrcs.map((src, i) => src && (
                  <div key={i} className="op-char-ref-item">
                    <img src={src} alt={['FRONT','3/4','SIDE'][i]} className="op-char-ref-img" />
                    <span className="op-char-ref-label">{['FRONT','3/4','SIDE'][i]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="op-footer">
            <span>WONDER WORKSHOP</span>
            <span>{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
