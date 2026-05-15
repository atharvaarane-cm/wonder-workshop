import { useEffect } from 'react'
import { VIEWS, closeupPrompt, fullbodyPrompt, referencePrompt } from '../utils/characterPrompts.js'
import { expandMentions } from '../utils/mentions.js'

// Resolve a generated image for a given slotKey (= the exact prompt
// string the corresponding ImageSlot used). Returns the active version's
// src or null when no image has been generated for that slot.
function getImg(images, prompt) {
  if (!images || !prompt) return null
  const slot = images[prompt]
  if (!slot?.versions?.length) return null
  return slot.versions[slot.activeVersion ?? 0]?.src || null
}

function SectionLabel({ children }) {
  return <div className="op-section-label">{children}</div>
}

// One character "sheet": REFERENCE on the left, name + description on
// the right, then a strip of Headshots (4 views) and a strip of Full
// Body (4 views). Used for the primary character (brief.character) and
// any additional characters (brief.characters[]).
function CharacterSheet({ character, images, eyebrow }) {
  if (!character?.name && !character?.description) return null

  const refSrc = getImg(images, referencePrompt(character))
  const headshotSrcs = VIEWS.map(v => getImg(images, closeupPrompt(character, v)))
  const fullBodySrcs = VIEWS.map(v => getImg(images, fullbodyPrompt(character, v)))

  return (
    <div className="op-section op-character-sheet">
      {eyebrow && <SectionLabel>{eyebrow}</SectionLabel>}
      <div className="op-char-bio">
        {refSrc && <img src={refSrc} alt={character.name || 'Reference'} className="op-charsheet-ref" />}
        <div className="op-char-bio-text">
          {character.name && <div className="op-char-name">{character.name}</div>}
          {character.description && <p className="op-body">{character.description}</p>}
          {character.wardrobe && (
            <p className="op-body" style={{ marginTop: 6 }}>
              <strong>Wardrobe:</strong> {character.wardrobe}
            </p>
          )}
        </div>
      </div>
      {headshotSrcs.some(Boolean) && (
        <div className="op-char-views-group">
          <div className="op-char-views-label">Headshots</div>
          <div className="op-char-views">
            {headshotSrcs.map((src, i) => (
              <div key={`hs-${i}`} className="op-char-view">
                {src
                  ? <img src={src} alt={VIEWS[i].label} className="op-char-view-img" />
                  : <div className="op-char-view-empty" />
                }
                <span className="op-char-view-cap">{VIEWS[i].label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {fullBodySrcs.some(Boolean) && (
        <div className="op-char-views-group">
          <div className="op-char-views-label">Full Body</div>
          <div className="op-char-views">
            {fullBodySrcs.map((src, i) => (
              <div key={`fb-${i}`} className="op-char-view">
                {src
                  ? <img src={src} alt={VIEWS[i].label} className="op-char-view-img" />
                  : <div className="op-char-view-empty" />
                }
                <span className="op-char-view-cap">{VIEWS[i].label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// One-pager export — trimmed to the three sections the meeting brief
// called out as essential: character sheets, locations, storyboard
// sequence. Lighting & Mood, Mood Board / Style refs, the Clothing &
// Props strip, and the dense Shot List table were removed; the
// storyboard now renders as the actual generated frame images.
export default function OnePager({ brief, images = {}, onClose }) {
  const cd    = brief?.creativeDirection || {}
  const pi    = brief?.projectInfo || {}
  const bi    = brief?.brandInfo || {}
  const shots = brief?.shotList || []
  const env   = brief?.environment || {}

  // Hero image — uses the same prompt the project's hero generator
  // would use (no separate hero section in the current Board, so this
  // is best-effort and usually null).
  const heroPrompt = `${cd.brand || ''} ${cd.description || ''} cinematic film still, professional photography, high quality`
  const heroSrc = getImg(images, heroPrompt)

  // Locations — single hero per the current LocationsSetDesign.
  const locHero = env.heroEnvironment || 'cinematic location'
  const locElements = (env.keyElements || []).slice(0, 3).join(', ')
  const locPrompt = `${locHero}, ${locElements}, wide establishing shot, golden hour, cinematic photography`
  const locSrc = getImg(images, locPrompt)

  // Storyboard frames — same prompt construction as ShotList.jsx
  // (expanded @mentions + framing + camera + "cinematic film still").
  const shotFrames = shots.map(shot => {
    const expanded = expandMentions(shot.description, brief)
    const prompt = `${expanded}, ${shot.framing} shot, ${shot.camera} camera, cinematic film still`
    return { shot, src: getImg(images, prompt) }
  })

  // All characters: primary + any additional. CharacterSheet skips
  // entries with no name AND no description.
  const characters = [
    brief?.character,
    ...((brief?.characters) || []),
  ].filter(Boolean)

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="onepager-backdrop" onClick={onClose}>
      <div className="onepager-shell" onClick={e => e.stopPropagation()}>

        {/* Toolbar (hidden in print) */}
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

          {/* ── Hero / header ── */}
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

          {/* ── Creative direction prose ── */}
          {cd.description && (
            <div className="op-section op-direction">
              <SectionLabel>Creative Direction</SectionLabel>
              <p className="op-body">{cd.description}</p>
            </div>
          )}

          {/* ── Brand ── */}
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

          {/* ── Character sheets (primary + additional) ── */}
          {characters.map((c, idx) => (
            <CharacterSheet
              key={idx}
              character={c}
              images={images}
              eyebrow={idx === 0 ? 'Character' : `Character — ${c.name || idx + 1}`}
            />
          ))}

          {/* ── Locations ── */}
          {locSrc && (
            <div className="op-section">
              <SectionLabel>Locations</SectionLabel>
              <div className="op-loc-hero">
                <img src={locSrc} alt={env.heroName || 'Location'} className="op-loc-hero-img" />
                {env.heroName && <div className="op-loc-caption">{env.heroName}</div>}
              </div>
            </div>
          )}

          {/* ── Storyboard sequence (frames, not a table) ── */}
          {shotFrames.length > 0 && (
            <div className="op-section">
              <SectionLabel>Storyboard Sequence</SectionLabel>
              <div className="op-storyboard">
                {shotFrames.map(({ shot, src }, i) => (
                  <div key={i} className="op-sb-frame">
                    <div className="op-shot-img-wrap">
                      {src
                        ? <img src={src} alt={`Shot ${shot.num}`} className="op-shot-img" />
                        : <div className="op-shot-empty" />
                      }
                      <span className="op-shot-badge-num">{String(shot.num).padStart(2, '0')}</span>
                      <span className="op-shot-badge-framing">{shot.framing}</span>
                    </div>
                    {shot.description && (
                      <p className="op-shot-desc">{shot.description}</p>
                    )}
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
