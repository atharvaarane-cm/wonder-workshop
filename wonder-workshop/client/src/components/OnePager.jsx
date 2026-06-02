import { useEffect, useState } from 'react'
import {
  ChevronDownIcon,
  ClapperboardIcon,
  MapPinIcon,
  PaletteIcon,
  ShirtIcon,
  SlidersHorizontalIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Menu,
  MenuCheckboxItem,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuSub,
  MenuSubPopup,
  MenuSubTrigger,
  MenuTrigger,
} from '@/components/ui/menu'
import { VIEWS, closeupPrompt, fullbodyPrompt, referencePrompt } from '../utils/characterPrompts.js'
import { expandMentions } from '../utils/mentions.js'
import { exportPptx } from '../utils/pptxExport.js'
import { generateTreatmentFromShots, getCachedTreatment, cacheTreatment } from '../utils/treatment.js'

const SECTION_OPTIONS = {
  headerFooter: 'Header & Footer',
  storyboard: 'Storyboard',
  treatment: 'Treatment Brief',
  talent: 'Talent',
  locations: 'Locations',
  elements: 'Elements',
  mood: 'Mood',
}

const SECTION_VALUES = Object.keys(SECTION_OPTIONS)
const DEFAULT_SECTIONS = ['headerFooter', 'storyboard', 'treatment', 'locations', 'talent']

const VIEW_PRESET_GROUPS = [
  {
    id: 'viewAll',
    label: 'View All',
    icon: SlidersHorizontalIcon,
    presets: [
      {
        id: 'productionAll',
        label: 'Production Sheet',
        triggerLabel: 'View: All +4 more',
        description: 'Header, storyboard, treatment, locations, talent',
        sections: DEFAULT_SECTIONS,
      },
      {
        id: 'fullAll',
        label: 'Full Sheet',
        triggerLabel: 'View: All Sections',
        description: 'Every printable section',
        sections: SECTION_VALUES,
      },
      {
        id: 'coreThree',
        label: '3 Sections',
        triggerLabel: 'View: 3 Sections',
        description: 'Header, storyboard, treatment',
        sections: ['headerFooter', 'storyboard', 'treatment'],
      },
    ],
  },
  {
    id: 'art',
    label: 'Art Dept',
    icon: PaletteIcon,
    presets: [
      {
        id: 'artBoard',
        label: 'Art Dept (3)',
        triggerLabel: 'View: Art Dept (3)',
        description: 'Talent, elements, mood',
        sections: ['talent', 'elements', 'mood'],
      },
      {
        id: 'artBuild',
        label: 'Build Reference',
        triggerLabel: 'View: Art Build',
        description: 'Locations, elements, mood',
        sections: ['locations', 'elements', 'mood'],
      },
    ],
  },
  {
    id: 'camera',
    label: 'Camera Dept',
    icon: ClapperboardIcon,
    presets: [
      {
        id: 'cameraStoryboard',
        label: 'Storyboard Images',
        triggerLabel: 'View: Camera Dept',
        description: 'Storyboard only',
        sections: ['storyboard'],
      },
      {
        id: 'cameraContext',
        label: 'Shot Context',
        triggerLabel: 'View: Camera Dept (3)',
        description: 'Header, storyboard, treatment',
        sections: ['headerFooter', 'storyboard', 'treatment'],
      },
    ],
  },
  {
    id: 'location',
    label: 'Location Dept',
    icon: MapPinIcon,
    presets: [
      {
        id: 'locationScout',
        label: 'Scout Sheet',
        triggerLabel: 'View: Location Dept',
        description: 'Locations plus storyboard context',
        sections: ['headerFooter', 'storyboard', 'locations'],
      },
      {
        id: 'locationOnly',
        label: 'Locations Only',
        triggerLabel: 'View: Locations',
        description: 'Location thumbnails only',
        sections: ['locations'],
      },
    ],
  },
  {
    id: 'wardrobe',
    label: 'Wardrobe Dept',
    icon: ShirtIcon,
    presets: [
      {
        id: 'wardrobeTalent',
        label: 'Wardrobe Dept (3)',
        triggerLabel: 'View: Wardrobe Dept (3)',
        description: 'Talent, elements, mood',
        sections: ['talent', 'elements', 'mood'],
      },
      {
        id: 'wardrobeTalentOnly',
        label: 'Talent Only',
        triggerLabel: 'View: Talent',
        description: 'Talent references only',
        sections: ['talent'],
      },
    ],
  },
]

const VIEW_PRESETS = VIEW_PRESET_GROUPS.flatMap(group => group.presets.map(preset => ({
  ...preset,
  groupLabel: group.label,
})))

function sameSections(a = [], b = []) {
  if (a.length !== b.length) return false
  const set = new Set(a)
  return b.every(value => set.has(value))
}

function getViewTriggerLabel(value) {
  const preset = VIEW_PRESETS.find(option => sameSections(value, option.sections))
  if (preset) return preset.triggerLabel
  if (!value?.length) return 'View: No Sections'
  if (value.length === 1) return `View: ${SECTION_OPTIONS[value[0]] || '1 Section'}`
  return `View: ${value.length} Sections`
}

// Resolve a generated image src by trying the stable slot ID first, then
// falling back to the legacy prompt-keyed entry. Mirrors ImageSlot's own
// readSaved() contract so the export sees the same images the UI does,
// regardless of when (pre or post stable-ID rollout) the image was saved.
function resolveSlot(images, stableId, legacyPrompt) {
  if (!images) return null
  const fromStable = stableId ? images[stableId] : null
  if (fromStable?.versions?.length) {
    return fromStable.versions[fromStable.activeVersion ?? 0]?.src || null
  }
  const fromLegacy = legacyPrompt ? images[legacyPrompt] : null
  if (fromLegacy?.versions?.length) {
    return fromLegacy.versions[fromLegacy.activeVersion ?? 0]?.src || null
  }
  return null
}

// Stable-ID formulas — match the strings each section component uses so
// the export hits the same keys. Keep these aligned with CharacterDesign,
// LocationsSetDesign, ClothingProps, and ShotList. (Eventually consolidate
// to utils/slotIds.js — for now duplicated to keep this PR focused.)
function charSlotId(key, kind, viewId) {
  if (kind === 'reference') return `char.${key}.reference`
  return `char.${key}.${kind}.${viewId}`
}
function envSlotId(key) { return `env.${key}` }
function productSlotId(idx) { return `product.${idx}` }
function shotSlotId(shot, idx) { return `shot.${shot.id || `idx-${idx}`}` }
function moodSlotId(item, idx) { return `mood.${item.id || `idx-${idx}`}` }

function SectionLabel({ children }) {
  return <div className="op-section-label">{children}</div>
}

// Compressed talent block. Production mode (the default) shows ONLY the
// reference image + name per character — per Logan's 2026-05-22 PDF
// review: "just one image and name per character please." Full mode adds
// wardrobe, description, headshots, and full-body for the video-gen
// pipeline that needs every angle.
function CharacterSheet({ character, characterKey, images, mode }) {
  if (!character?.name && !character?.description) return null

  const refSrc = resolveSlot(images, charSlotId(characterKey, 'reference'), referencePrompt(character))

  const headshotSrcs = mode === 'full'
    ? VIEWS.map(v => resolveSlot(
        images,
        charSlotId(characterKey, 'headshot', v.id),
        closeupPrompt(character, v),
      ))
    : []
  const fullBodySrcs = mode === 'full'
    ? VIEWS.map(v => resolveSlot(
        images,
        charSlotId(characterKey, 'fullbody', v.id),
        fullbodyPrompt(character, v),
      ))
    : []

  // Production layout: name ABOVE the headshot, characters sit in a row
  // (see the .op-talent-row container below). Full Detail keeps the
  // ref + bio side-by-side because wardrobe + description need horizontal
  // space + the headshots grid renders underneath.
  if (mode === 'production') {
    return (
      <div className="op-character-sheet op-character-sheet-compact">
        {character.name && <div className="op-char-name">{character.name}</div>}
        {refSrc
          ? <img src={refSrc} alt={character.name || 'Reference'} className="op-charsheet-ref" />
          : <div className="op-charsheet-ref-empty" />
        }
      </div>
    )
  }

  return (
    <div className="op-character-sheet">
      <div className="op-char-bio">
        {refSrc && <img src={refSrc} alt={character.name || 'Reference'} className="op-charsheet-ref" />}
        <div className="op-char-bio-text">
          {character.name && <div className="op-char-name">{character.name}</div>}
          {character.wardrobe && (
            <p className="op-body">
              <strong>Wardrobe:</strong> {character.wardrobe}
            </p>
          )}
          {character.description && (
            <p className="op-body" style={{ marginTop: 6 }}>{character.description}</p>
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

// One-pager export. Hierarchy per Ed + Ravi's 2026-05-21 PM call:
// storyboard at the top (the 95% conversation piece for production),
// then talent (compressed), locations, elements/products, then the
// treatment / creative direction block. Brand colors removed entirely.
//
// Two modes:
//   - production (default): clean sheet for crew / DP / cinematographer.
//     No full-body grid, no brand-asset chrome.
//   - full: detail sheet for the video-gen pipeline. Adds full-body
//     grids + the full description text.
export default function OnePager({ brief, images = {}, onClose, projectId = null }) {
  const cd    = brief?.creativeDirection || {}
  const pi    = brief?.projectInfo || {}
  const shots = brief?.shotList || []
  const env   = brief?.environment || {}
  const additionalLocations = brief?.environments || []
  const products = brief?.productElements || []

  const [mode, setMode] = useState('production')
  const [exportingPptx, setExportingPptx] = useState(false)
  const [treatment, setTreatment] = useState('')
  const [treatmentLoading, setTreatmentLoading] = useState(false)
  const [visibleSections, setVisibleSections] = useState(DEFAULT_SECTIONS)
  const isVisible = (section) => visibleSections.includes(section)
  const viewTriggerLabel = getViewTriggerLabel(visibleSections)

  function applyViewPreset(sections) {
    setVisibleSections(sections)
  }

  function toggleSection(section, checked) {
    setVisibleSections(current => {
      if (checked) return current.includes(section) ? current : [...current, section]
      return current.filter(value => value !== section)
    })
  }

  // Storyboard frames — stable ID per shot.id, legacy prompt as fallback.
  const shotFrames = shots.map((shot, idx) => {
    const expanded = expandMentions(shot.description, brief)
    const legacyPrompt = `${expanded}, ${shot.framing} shot, ${shot.camera} camera, cinematic film still`
    const src = resolveSlot(images, shotSlotId(shot, idx), legacyPrompt)
    return { shot, src }
  })

  // Primary character + additional characters with their stable index.
  const characters = []
  if (brief?.character?.name || brief?.character?.description) {
    characters.push({ character: brief.character, key: 'primary' })
  }
  for (let i = 0; i < (brief?.characters || []).length; i++) {
    const c = brief.characters[i]
    if (c?.name || c?.description) characters.push({ character: c, key: String(i) })
  }

  // Primary location + additional locations.
  const locations = []
  if (env?.heroName || env?.heroEnvironment) {
    const legacyPrompt = `${env.heroEnvironment || 'cinematic location'}, ${(env.keyElements || []).slice(0, 3).join(', ')}, wide establishing shot, golden hour, cinematic photography`
    locations.push({
      data: env,
      src: resolveSlot(images, envSlotId('primary'), legacyPrompt),
    })
  }
  additionalLocations.forEach((loc, i) => {
    if (!loc?.heroName && !loc?.heroEnvironment) return
    const legacyPrompt = `${loc.heroEnvironment || 'cinematic location'}, ${(loc.keyElements || []).slice(0, 3).join(', ')}, wide establishing shot, golden hour, cinematic photography`
    locations.push({
      data: loc,
      src: resolveSlot(images, envSlotId(String(i)), legacyPrompt),
    })
  })

  // Elements / Products.
  const elements = products.map((product, i) => {
    const userDesc = (product.description || '').trim()
    const userName = (product.name || '').trim()
    const legacyPrompt = userDesc
      ? `${userDesc}, product shot, clean white background, studio lighting, commercial photography`
      : `${userName || 'product'}, product shot, clean white background, studio lighting, commercial photography`
    return {
      product,
      src: resolveSlot(images, productSlotId(i), legacyPrompt),
    }
  }).filter(e => e.product?.name || e.product?.description || e.src)

  const moodItems = (brief?.moodBoard || []).map((item, i) => {
    const caption = (item.caption || '').trim()
    const brand = cd.brand || ''
    const description = cd.description || ''
    const legacyPrompt = caption
      ? `${caption}, ${brand} ${description}, mood board reference, cinematic aesthetic, editorial`
      : `mood-board:${item.id}`
    return {
      item,
      caption,
      src: resolveSlot(images, moodSlotId(item, i), legacyPrompt),
    }
  }).filter(m => m.caption || m.src)

  async function handleExportPptx() {
    if (exportingPptx) return
    setExportingPptx(true)
    try {
      await exportPptx(brief, images, { mode, treatment })
    } catch (e) {
      window.dispatchEvent(new CustomEvent('ww-toast', {
        detail: { type: 'error', msg: 'Slides export failed' },
      }))
    } finally {
      setExportingPptx(false)
    }
  }

  // Generate the treatment paragraph from the storyboard captions when
  // the one-pager opens. Synchronous read of the cache first; only fires
  // the API call when shots changed since last cache. Abort if the user
  // closes the modal mid-generation.
  useEffect(() => {
    let aborted = false
    const controller = new AbortController()
    const cached = getCachedTreatment(projectId, shots)
    if (cached) {
      setTreatment(cached)
      return () => { aborted = true; controller.abort() }
    }
    if (!shots.length) {
      setTreatment('')
      return () => { aborted = true; controller.abort() }
    }
    setTreatmentLoading(true)
    setTreatment('')
    generateTreatmentFromShots(brief, { signal: controller.signal })
      .then(text => {
        if (aborted) return
        setTreatment(text)
        setTreatmentLoading(false)
        if (text) cacheTreatment(projectId, shots, text)
      })
      .catch(() => { if (!aborted) setTreatmentLoading(false) })
    return () => { aborted = true; controller.abort() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, shots.length, shots.map(s => `${s.framing || ''}|${s.description || ''}`).join('::')])

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
          <div className="onepager-toolbar-controls">
            <div className="op-mode-switch" role="tablist" aria-label="Sheet mode">
              <button
                role="tab"
                aria-selected={mode === 'production'}
                className={`op-mode-btn${mode === 'production' ? ' active' : ''}`}
                onClick={() => setMode('production')}
                title="Clean sheet for crew / DP — storyboard, talent, locations, elements"
              >
                Production
              </button>
              <button
                role="tab"
                aria-selected={mode === 'full'}
                className={`op-mode-btn${mode === 'full' ? ' active' : ''}`}
                onClick={() => setMode('full')}
                title="Full detail sheet for the video-gen pipeline — adds full-body rotations + full descriptions"
              >
                Full detail
              </button>
            </div>
            <Menu>
              <MenuTrigger
                render={
                  <Button
                    aria-label="Select export sheet view"
                    className="op-view-menu-trigger"
                    size="sm"
                    variant="outline"
                  />
                }
              >
                <span className="op-view-menu-trigger-label">{viewTriggerLabel}</span>
                <ChevronDownIcon aria-hidden="true" className="size-4" />
              </MenuTrigger>
              <MenuPopup align="start" sideOffset={6} className="op-view-menu-popup">
                <MenuGroup>
                  <MenuGroupLabel>Departments</MenuGroupLabel>
                  {VIEW_PRESET_GROUPS.map((group) => {
                    const Icon = group.icon
                    return (
                      <MenuSub key={group.id}>
                        <MenuSubTrigger>
                          <Icon aria-hidden="true" />
                          {group.label}
                        </MenuSubTrigger>
                        <MenuSubPopup className="op-view-menu-popup">
                          {group.presets.map((preset) => (
                            <MenuItem key={preset.id} onClick={() => applyViewPreset(preset.sections)}>
                              <span className="op-view-preset-copy">
                                <span>{preset.label}</span>
                                <span>{preset.description}</span>
                              </span>
                            </MenuItem>
                          ))}
                        </MenuSubPopup>
                      </MenuSub>
                    )
                  })}
                </MenuGroup>
                <MenuSeparator />
                <MenuGroup>
                  <MenuGroupLabel>Custom sections</MenuGroupLabel>
                  {SECTION_VALUES.map((value) => (
                    <MenuCheckboxItem
                      key={value}
                      checked={visibleSections.includes(value)}
                      onCheckedChange={(checked) => toggleSection(value, checked)}
                    >
                      {SECTION_OPTIONS[value]}
                    </MenuCheckboxItem>
                  ))}
                </MenuGroup>
              </MenuPopup>
            </Menu>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="onepager-print-btn" onClick={handleExportPptx} disabled={exportingPptx}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M2 6h12" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M5 9l2 2 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {exportingPptx ? 'Exporting…' : 'Save as Slides (.pptx)'}
            </button>
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

        <div className={`onepager-page onepager-page--${mode}`}>

          {/* ── Header ── */}
          {isVisible('headerFooter') && (
            <div className="op-header">
              <div className="op-header-left">
                <div className="op-brand">{cd.brand || pi.clientName || '—'}</div>
                <div className="op-campaign">{pi.brandCampaignName || brief?.title || ''}</div>
              </div>
              <div className="op-header-right">
                {pi.projectName && <div className="op-meta-row op-meta-row--project"><span>Project</span>{pi.projectName}</div>}
                {pi.jobNumber   && <div className="op-meta-row op-meta-row--job"><span>Job #</span>{pi.jobNumber}</div>}
                {cd.format      && <div className="op-meta-row op-meta-row--format"><span>Format</span>{cd.format}</div>}
                {cd.duration    && <div className="op-meta-row op-meta-row--duration"><span>Duration</span>{cd.duration}</div>}
                {cd.shots       && <div className="op-meta-row op-meta-row--shots"><span>Shots</span>{cd.shots}</div>}
                {cd.location    && <div className="op-meta-row op-meta-row--location"><span>Location</span>{cd.location}</div>}
              </div>
            </div>
          )}

          <div className="op-sheet-body">
            <div className="op-sheet-main">
              {/* ── Storyboard FIRST — the 95% conversation piece in production. */}
              {isVisible('storyboard') && shotFrames.length > 0 && (
                <div className="op-section op-section--storyboard">
                  <SectionLabel>Storyboard</SectionLabel>
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

              {/* ── Treatment — auto-generated narrative from the storyboard
                  captions. Present-tense short story used to pitch the spot.
                  Falls back to the brief's creative-direction prose if
                  generation fails or shots are absent. */}
              {isVisible('treatment') && (treatment || treatmentLoading || cd.description) && (
                <div className="op-section op-direction">
                  <SectionLabel>Treatment</SectionLabel>
                  {treatmentLoading && !treatment && (
                    <p className="op-body op-treatment-loading">Composing treatment from the storyboard…</p>
                  )}
                  {treatment && <p className="op-body">{treatment}</p>}
                  {!treatment && !treatmentLoading && cd.description && (
                    <p className="op-body">{cd.description}</p>
                  )}
                </div>
              )}
            </div>

            <div className="op-sheet-rail">
              {/* ── Talent. Production mode lays the characters out in a row;
                  full-detail stacks the full bio + headshots + full-body grids
                  per character. */}
              {isVisible('talent') && characters.length > 0 && (
                <div className="op-section op-section--talent">
                  <SectionLabel>Talent</SectionLabel>
                  <div className={mode === 'production' ? 'op-talent-row' : 'op-talent-stack'}>
                    {characters.map(({ character, key }) => (
                      <CharacterSheet
                        key={key}
                        character={character}
                        characterKey={key}
                        images={images}
                        mode={mode}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* ── Locations ── */}
              {isVisible('locations') && locations.length > 0 && (
                <div className="op-section op-section--locations">
                  <SectionLabel>Locations</SectionLabel>
                  {locations.map(({ data, src }, i) => (
                    <div key={i} className="op-loc-hero">
                      {src
                        ? <img src={src} alt={data.heroName || 'Location'} className="op-loc-hero-img" />
                        : <div className="op-loc-hero-empty" />
                      }
                      {data.heroName && <div className="op-loc-caption">{data.heroName}</div>}
                    </div>
                  ))}
                </div>
              )}

              {/* ── Elements / Products ── */}
              {isVisible('elements') && elements.length > 0 && (
                <div className="op-section op-section--elements">
                  <SectionLabel>Elements</SectionLabel>
                  <div className="op-elements-grid">
                    {elements.map(({ product, src }, i) => (
                      <div key={i} className="op-element">
                        {src
                          ? <img src={src} alt={product?.name || 'Element'} className="op-element-img" />
                          : <div className="op-element-empty" />
                        }
                        {product?.name && <div className="op-element-name">{product.name}</div>}
                        {mode === 'full' && product?.description && (
                          <p className="op-body op-element-desc">{product.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Mood ── */}
              {isVisible('mood') && moodItems.length > 0 && (
                <div className="op-section op-section--mood">
                  <SectionLabel>Mood</SectionLabel>
                  <div className="op-mood-export-grid">
                    {moodItems.map(({ item, caption, src }, i) => (
                      <div key={item.id || i} className="op-mood-export-item">
                        {src
                          ? <img src={src} alt={caption || 'Mood reference'} className="op-mood-export-img" />
                          : <div className="op-mood-export-empty" />
                        }
                        {caption && <div className="op-mood-export-caption">{caption}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {isVisible('headerFooter') && (
            <div className="op-footer">
              <span>WONDER WORKSHOP</span>
              <span>{mode === 'full' ? 'Full Detail Sheet' : 'Production Sheet'}</span>
              <span>{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
