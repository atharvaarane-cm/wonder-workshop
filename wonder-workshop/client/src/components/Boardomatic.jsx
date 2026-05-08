import ImageSlot from './ImageSlot.jsx'

/**
 * Boardomatic — single-page production deliverable.
 * Tabloid landscape (17"x11") layout. Print to PDF for export.
 */
export default function Boardomatic({ brief, onBack }) {
  const cd = brief.creativeDirection || {}
  const bi = brief.brandInfo || {}
  const ch = brief.character || {}
  const env = brief.environment || {}
  const story = brief.story || {}
  const shots = (brief.shotList || []).slice(0, 9)
  const moods = (brief.lightingMood || []).slice(0, 4)

  const moodKeywords = moods.flatMap(m => (m.tags || [])).slice(0, 8)

  const heroPrompt = `${cd.brand} ${cd.description} cinematic film still`
  const envPrompt = `${env.heroEnvironment}, cinematic establishing shot, photographic, golden hour, wide angle`

  return (
    <div className="boardomatic-screen">
      <div className="boardomatic-toolbar print-hidden">
        <button className="boardomatic-back" onClick={onBack}>← Back to canvas</button>
        <span className="boardomatic-title-meta">
          {cd.brand} · {cd.description} · {cd.duration} · {cd.format}
        </span>
        <button className="boardomatic-print" onClick={() => window.print()}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <path d="M3 12h10M5 12V4h6v8M5 8h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Print / Save as PDF
        </button>
      </div>

      <div className="boardomatic-frame">
        <div className="boardomatic-page">
          {/* Header bar */}
          <div className="bom-header">
            <div className="bom-header-title">
              <span className="bom-num">1</span>
              <span className="bom-section-name">CREATIVE DIRECTION</span>
              <span className="bom-shots">{cd.shots ?? 9} shots.</span>
            </div>
            <div className="bom-swatches">
              {(bi.colors || []).slice(0, 5).map((c, i) => (
                <div key={i} className="bom-swatch">
                  <div className="bom-swatch-name">{c.name}</div>
                  <div className="bom-swatch-color" style={{ background: c.hex }} />
                </div>
              ))}
            </div>
            <div className="bom-header-meta">
              <span className="bom-meta-label">LOCATIONS:</span>{' '}
              <span className="bom-meta-value">{(cd.location || '').toUpperCase()}</span>
            </div>
            <div className="bom-header-meta">
              <span className="bom-meta-label">FORMAT:</span>{' '}
              <span className="bom-meta-value">{(cd.format || '').toUpperCase()}</span>
            </div>
            <div className="bom-header-headline">
              {cd.shots ?? 9} SHOTS · {cd.format || ''} · {(cd.brand || '').toUpperCase()} {cd.duration ? `· ${cd.duration}` : ''}
            </div>
          </div>

          {/* Middle 3 columns */}
          <div className="bom-middle">
            {/* Left: Character */}
            <div className="bom-block bom-character">
              <div className="bom-block-label"><span className="bom-num">2</span> CHARACTER + STYLING REFERENCE</div>
              <div className="bom-char-views">
                {(ch.views || ['FRONT', '3/4', 'SIDE']).slice(0, 5).map((v, i) => (
                  <div key={i} className="bom-char-row">
                    <div className="bom-char-img">
                      <ImageSlot
                        prompt={`${ch.description}, ${ch.wardrobe}, ${v.toLowerCase()} view portrait, cinematic, neutral background`}
                        style={{ width: '100%', height: '100%' }}
                      />
                    </div>
                    <div className="bom-char-label">{v}</div>
                  </div>
                ))}
              </div>
              <div className="bom-char-notes">
                <div className="bom-notes">{ch.wardrobe}</div>
              </div>
            </div>

            {/* Middle: Environment + Storyboard */}
            <div className="bom-middle-col">
              <div className="bom-block bom-env">
                <div className="bom-block-label"><span className="bom-num">3</span> ENVIRONMENT + SET DESIGN</div>
                <div className="bom-env-grid">
                  <div className="bom-env-hero">
                    <ImageSlot prompt={envPrompt} style={{ width: '100%', height: '100%' }} />
                  </div>
                  <div className="bom-env-map">
                    <div className="bom-env-map-label">CAMERA / LOCATION MAP</div>
                    <div className="bom-env-map-content">
                      {(env.shotRoute || '').split(/[→>,]/).map((loc, i) => (
                        <div key={i} className="bom-env-map-pin">{loc.trim()}</div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bom-block bom-storyboard">
                <div className="bom-block-label"><span className="bom-num">4</span> STORYBOARD SEQUENCE</div>
                <div className="bom-shot-grid">
                  {shots.map((shot, i) => (
                    <div key={i} className="bom-shot-cell">
                      <ImageSlot
                        prompt={`${shot.description}, ${shot.framing} shot, ${shot.camera} camera, cinematic film still`}
                        style={{ width: '100%', height: '100%' }}
                      />
                      <div className="bom-shot-num">{shot.num}</div>
                      <div className="bom-shot-cap">{shot.framing} · {shot.camera}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Lighting/Mood */}
            <div className="bom-block bom-lighting">
              <div className="bom-block-label"><span className="bom-num">5</span> LIGHTING / MOOD / STYLE</div>
              <div className="bom-mood-rows">
                {moods.map((m, i) => (
                  <div key={i} className="bom-mood-row">
                    <div className="bom-mood-img">
                      <ImageSlot
                        prompt={`${m.name}, ${m.description}, cinematic lighting reference, atmospheric`}
                        style={{ width: '100%', height: '100%' }}
                      />
                    </div>
                    <div className="bom-mood-info">
                      <div className="bom-mood-letter">{m.letter}</div>
                      <div className="bom-mood-name">{m.name}</div>
                      <div className="bom-mood-desc">{m.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom row */}
          <div className="bom-bottom">
            <div className="bom-block bom-mood-block">
              <div className="bom-block-label"><span className="bom-num">6</span> MOOD + KEYWORDS</div>
              <div className="bom-keywords">
                {moodKeywords.map((k, i) => (
                  <span key={i} className="bom-keyword">{k}</span>
                ))}
              </div>
            </div>
            <div className="bom-block bom-story-block">
              <div className="bom-block-label"><span className="bom-num">7</span> STORY</div>
              <div className="bom-story-treatment">{story.treatment || '—'}</div>
              <div className="bom-story-beats">
                {(story.beats || []).slice(0, 4).map((b, i) => (
                  <div key={i} className="bom-story-beat">
                    <span className="bom-story-beat-num">{b.num}.</span> {b.summary}
                  </div>
                ))}
              </div>
            </div>
            <div className="bom-block bom-cine-block">
              <div className="bom-block-label"><span className="bom-num">8</span> CINEMATOGRAPHY</div>
              <div className="bom-cine-text">{cd.description}</div>
              <div className="bom-cine-tags">
                {[...new Set(shots.map(s => s.camera))].slice(0, 6).map((t, i) => (
                  <span key={i} className="bom-cine-tag">{t}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
