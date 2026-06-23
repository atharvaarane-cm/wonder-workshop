// Build a .pptx file from the brief + generated images so the team can
// open it in Google Slides / PowerPoint / Keynote and keep iterating.
// Mirrors the on-screen one-pager structure: storyboard first, then
// talent, locations, elements, then the treatment block. Brand colors
// are intentionally absent (per Ravi 2026-05-21 call).
//
// Two modes:
//   - production (default): clean sheet — no full-body grids, no full
//     descriptions on talent / elements.
//   - full: detail sheet for the video-gen pipeline. Adds full-body
//     rotations and full descriptions.

// pptxgenjs is large and only needed when the user actually exports a deck,
// so it's loaded on demand (dynamic import in exportPptx) to keep it out of
// the initial bundle.
import { VIEWS, closeupPrompt, fullbodyPrompt, referencePrompt } from './characterPrompts.js'
import { expandMentions } from './mentions.js'

const LAYOUT_W = 13.333
const LAYOUT_H = 7.5
const SAFE_X = 0.5
const SAFE_W = LAYOUT_W - 1.0
const BG = '111111'
const TEXT = 'FFFFFF'
const MUTED = '999999'

// Resolve a generated image src by trying the stable slot ID first, then
// falling back to the legacy prompt-keyed entry. Mirrors ImageSlot's own
// readSaved() contract so the export sees the same images the UI does.
function getSlotSrc(images, stableId, legacyPrompt) {
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

// Stable-ID formulas — keep aligned with CharacterDesign, Locations,
// ClothingProps, and ShotList.
function charSlotId(key, kind, viewId) {
  if (kind === 'reference') return `char.${key}.reference`
  return `char.${key}.${kind}.${viewId}`
}
function envSlotId(key) { return `env.${key}` }
function productSlotId(idx) { return `product.${idx}` }
function shotSlotId(shot, idx) { return `shot.${shot.id || `idx-${idx}`}` }

// Fetch + base64-encode an image so pptxgenjs can embed it without
// hitting CORS issues at writeFile time. Returns null on failure
// (slot will be rendered as an empty placeholder).
async function urlToDataUrl(url) {
  if (!url) return null
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise(resolve => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

function addImageBox(slide, dataUrl, opts) {
  if (dataUrl) {
    slide.addImage({ data: dataUrl, ...opts })
  } else {
    slide.addShape('rect', {
      ...opts,
      fill: { color: '1A1A1A' },
      line: { color: '282828', width: 1 },
    })
  }
}

export async function exportPptx(brief, images, opts = {}) {
  const mode = opts.mode === 'full' ? 'full' : 'production'
  const cd = brief?.creativeDirection || {}
  const pi = brief?.projectInfo || {}
  const env = brief?.environment || {}
  const additionalLocations = brief?.environments || []
  const products = brief?.productElements || []
  const shots = brief?.shotList || []

  const { default: PptxGenJS } = await import('pptxgenjs')
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE'
  pptx.title = pi.projectName || brief?.title || 'Wonder Workshop Brief'
  pptx.company = 'Wonder Workshop'

  // ── Slide 1: Title ────────────────────────────────────────────────
  const s1 = pptx.addSlide()
  s1.background = { color: BG }
  s1.addText('BRIEF', {
    x: SAFE_X, y: 0.55, w: SAFE_W, h: 0.4,
    fontSize: 11, fontFace: 'Instrument Sans', bold: true,
    color: MUTED, charSpacing: 4,
  })
  s1.addText(pi.projectName || brief?.title || 'Untitled', {
    x: SAFE_X, y: 1.1, w: SAFE_W, h: 2.0,
    fontSize: 60, fontFace: 'Instrument Sans',
    color: 'D4D4D4',
  })
  const metaPairs = [
    pi.clientName && ['Client', pi.clientName],
    pi.brandCampaignName && ['Campaign', pi.brandCampaignName],
    cd.format && ['Format', String(cd.format)],
    cd.duration && ['Duration', String(cd.duration)],
    cd.shots && ['Shots', String(cd.shots)],
    cd.location && ['Location', String(cd.location)],
    [mode === 'full' ? 'Sheet' : 'Sheet', mode === 'full' ? 'Full Detail' : 'Production'],
  ].filter(Boolean)
  metaPairs.forEach(([k, v], i) => {
    const col = i % 3
    const row = Math.floor(i / 3)
    const x = SAFE_X + col * (SAFE_W / 3)
    const y = 5.3 + row * 0.7
    s1.addText(k.toUpperCase(), {
      x, y, w: SAFE_W / 3, h: 0.25,
      fontSize: 9, fontFace: 'Instrument Sans', bold: true,
      color: MUTED, charSpacing: 2,
    })
    s1.addText(v, {
      x, y: y + 0.25, w: SAFE_W / 3, h: 0.35,
      fontSize: 14, fontFace: 'Instrument Sans',
      color: TEXT,
    })
  })

  // ── Storyboard slides FIRST — the 95% conversation piece. ─────────
  if (shots.length > 0) {
    const FRAMES_PER_SLIDE = 6
    for (let i = 0; i < shots.length; i += FRAMES_PER_SLIDE) {
      const chunk = shots.slice(i, i + FRAMES_PER_SLIDE)
      const shotData = await Promise.all(
        chunk.map((shot, j) => {
          const expanded = expandMentions(shot.description, brief)
          const legacyPrompt = `${expanded}, ${shot.framing} shot, ${shot.camera} camera, cinematic film still`
          return urlToDataUrl(getSlotSrc(images, shotSlotId(shot, i + j), legacyPrompt))
        }),
      )
      const s = pptx.addSlide()
      s.background = { color: BG }
      const labelPart = shots.length > FRAMES_PER_SLIDE
        ? ` — ${i + 1}–${Math.min(i + chunk.length, shots.length)} of ${shots.length}`
        : ''
      s.addText('STORYBOARD' + labelPart, {
        x: SAFE_X, y: 0.4, w: SAFE_W, h: 0.35,
        fontSize: 11, fontFace: 'Instrument Sans', bold: true,
        color: MUTED, charSpacing: 3,
      })
      const cols = 3
      const rows = 2
      const gap = 0.2
      const frameW = (SAFE_W - gap * (cols - 1)) / cols
      const frameH = (LAYOUT_H - 1.3 - gap * (rows - 1)) / rows
      chunk.forEach((shot, idx) => {
        const col = idx % cols
        const row = Math.floor(idx / cols)
        const x = SAFE_X + col * (frameW + gap)
        const y = 0.95 + row * (frameH + gap + 0.5)
        addImageBox(s, shotData[idx], { x, y, w: frameW, h: frameH * 0.78 })
        s.addText(`${String(shot.num).padStart(2, '0')}  ·  ${shot.framing}`, {
          x, y: y + frameH * 0.78 + 0.05, w: frameW, h: 0.22,
          fontSize: 9, fontFace: 'Instrument Sans', bold: true,
          color: MUTED, charSpacing: 2,
        })
        if (shot.description) {
          s.addText(shot.description, {
            x, y: y + frameH * 0.78 + 0.28, w: frameW, h: 0.4,
            fontSize: 9, fontFace: 'Instrument Sans',
            color: 'C8C8C8', valign: 'top',
          })
        }
      })
    }
  }

  // ── Talent slides ─────────────────────────────────────────────────
  const characters = []
  if (brief?.character?.name || brief?.character?.description) {
    characters.push({ character: brief.character, key: 'primary' })
  }
  for (let i = 0; i < (brief?.characters || []).length; i++) {
    const c = brief.characters[i]
    if (c?.name || c?.description) characters.push({ character: c, key: String(i) })
  }

  for (let i = 0; i < characters.length; i++) {
    const { character: char, key } = characters[i]
    const refDataUrl = await urlToDataUrl(getSlotSrc(images, charSlotId(key, 'reference'), referencePrompt(char)))
    const headshotData = await Promise.all(
      VIEWS.map(v => urlToDataUrl(getSlotSrc(images, charSlotId(key, 'headshot', v.id), closeupPrompt(char, v)))),
    )

    const s = pptx.addSlide()
    s.background = { color: BG }
    s.addText(`TALENT ${i + 1}${characters.length > 1 ? ` OF ${characters.length}` : ''}`, {
      x: SAFE_X, y: 0.5, w: SAFE_W, h: 0.35,
      fontSize: 11, fontFace: 'Instrument Sans', bold: true,
      color: MUTED, charSpacing: 3,
    })
    addImageBox(s, refDataUrl, { x: SAFE_X, y: 1.0, w: 2.4, h: 2.4 })
    if (char.name) {
      s.addText(char.name, {
        x: SAFE_X + 2.7, y: 1.0, w: SAFE_W - 2.7, h: 0.6,
        fontSize: 32, fontFace: 'Instrument Sans', color: TEXT,
      })
    }
    // Production mode: wardrobe only. Full mode: wardrobe + description.
    if (char.wardrobe) {
      s.addText(`Wardrobe: ${char.wardrobe}`, {
        x: SAFE_X + 2.7, y: 1.7, w: SAFE_W - 2.7, h: 0.5,
        fontSize: 13, fontFace: 'Instrument Sans', color: 'E2E2E2',
        valign: 'top',
      })
    }
    if (mode === 'full' && char.description) {
      s.addText(char.description, {
        x: SAFE_X + 2.7, y: 2.3, w: SAFE_W - 2.7, h: 1.1,
        fontSize: 12, fontFace: 'Instrument Sans', color: 'C8C8C8',
        valign: 'top',
      })
    }
    // Headshots row
    s.addText('HEADSHOTS', {
      x: SAFE_X, y: 3.6, w: SAFE_W, h: 0.3,
      fontSize: 10, fontFace: 'Instrument Sans', bold: true,
      color: MUTED, charSpacing: 3,
    })
    const hsW = (SAFE_W - 0.6) / 4
    const hsH = 3.0
    VIEWS.forEach((v, idx) => {
      const x = SAFE_X + idx * (hsW + 0.2)
      addImageBox(s, headshotData[idx], { x, y: 4.0, w: hsW, h: hsH })
      s.addText(v.label, {
        x, y: 4.0 + hsH + 0.05, w: hsW, h: 0.25,
        fontSize: 9, fontFace: 'Instrument Sans', bold: true,
        color: MUTED, align: 'center', charSpacing: 2,
      })
    })

    // Full-body slide — only in 'full' mode.
    if (mode === 'full') {
      const fullBodyData = await Promise.all(
        VIEWS.map(v => urlToDataUrl(getSlotSrc(images, charSlotId(key, 'fullbody', v.id), fullbodyPrompt(char, v)))),
      )
      const s2c = pptx.addSlide()
      s2c.background = { color: BG }
      s2c.addText(`${char.name || `TALENT ${i + 1}`} — FULL BODY`, {
        x: SAFE_X, y: 0.5, w: SAFE_W, h: 0.35,
        fontSize: 11, fontFace: 'Instrument Sans', bold: true,
        color: MUTED, charSpacing: 3,
      })
      const fbW = (SAFE_W - 0.6) / 4
      const fbH = 5.5
      VIEWS.forEach((v, idx) => {
        const x = SAFE_X + idx * (fbW + 0.2)
        addImageBox(s2c, fullBodyData[idx], { x, y: 1.0, w: fbW, h: fbH })
        s2c.addText(v.label, {
          x, y: 1.0 + fbH + 0.05, w: fbW, h: 0.25,
          fontSize: 9, fontFace: 'Instrument Sans', bold: true,
          color: MUTED, align: 'center', charSpacing: 2,
        })
      })
    }
  }

  // ── Locations slide(s) ────────────────────────────────────────────
  const locations = []
  if (env?.heroName || env?.heroEnvironment) {
    const legacyPrompt = `${env.heroEnvironment || 'cinematic location'}, ${(env.keyElements || []).slice(0, 3).join(', ')}, wide establishing shot, golden hour, cinematic photography`
    locations.push({ data: env, src: await urlToDataUrl(getSlotSrc(images, envSlotId('primary'), legacyPrompt)) })
  }
  for (let i = 0; i < additionalLocations.length; i++) {
    const loc = additionalLocations[i]
    if (!loc?.heroName && !loc?.heroEnvironment) continue
    const legacyPrompt = `${loc.heroEnvironment || 'cinematic location'}, ${(loc.keyElements || []).slice(0, 3).join(', ')}, wide establishing shot, golden hour, cinematic photography`
    locations.push({ data: loc, src: await urlToDataUrl(getSlotSrc(images, envSlotId(String(i)), legacyPrompt)) })
  }
  if (locations.length > 0) {
    // One slide per location.
    for (const { data, src } of locations) {
      const s = pptx.addSlide()
      s.background = { color: BG }
      s.addText('LOCATION', {
        x: SAFE_X, y: 0.5, w: SAFE_W, h: 0.35,
        fontSize: 11, fontFace: 'Instrument Sans', bold: true,
        color: MUTED, charSpacing: 3,
      })
      addImageBox(s, src, { x: SAFE_X, y: 1.0, w: SAFE_W, h: 5.0 })
      if (data.heroName) {
        s.addText(data.heroName, {
          x: SAFE_X, y: 6.2, w: SAFE_W, h: 0.6,
          fontSize: 24, fontFace: 'Instrument Sans', color: TEXT,
        })
      }
    }
  }

  // ── Elements / Products slide ─────────────────────────────────────
  if (products.length > 0) {
    const elementData = await Promise.all(
      products.map(async (product, i) => {
        const userDesc = (product.description || '').trim()
        const userName = (product.name || '').trim()
        const legacyPrompt = userDesc
          ? `${userDesc}, product shot, clean white background, studio lighting, commercial photography`
          : `${userName || 'product'}, product shot, clean white background, studio lighting, commercial photography`
        const src = await urlToDataUrl(getSlotSrc(images, productSlotId(i), legacyPrompt))
        return { product, src }
      }),
    )
    // Render elements 4 per row.
    const PER_SLIDE = 8
    for (let i = 0; i < elementData.length; i += PER_SLIDE) {
      const chunk = elementData.slice(i, i + PER_SLIDE)
      const s = pptx.addSlide()
      s.background = { color: BG }
      const labelPart = elementData.length > PER_SLIDE
        ? ` — ${i + 1}–${Math.min(i + chunk.length, elementData.length)} of ${elementData.length}`
        : ''
      s.addText('ELEMENTS' + labelPart, {
        x: SAFE_X, y: 0.5, w: SAFE_W, h: 0.35,
        fontSize: 11, fontFace: 'Instrument Sans', bold: true,
        color: MUTED, charSpacing: 3,
      })
      const cols = 4
      const gap = 0.2
      const cellW = (SAFE_W - gap * (cols - 1)) / cols
      const cellH = 2.6
      chunk.forEach(({ product, src }, idx) => {
        const col = idx % cols
        const row = Math.floor(idx / cols)
        const x = SAFE_X + col * (cellW + gap)
        const y = 1.1 + row * (cellH + 0.7)
        addImageBox(s, src, { x, y, w: cellW, h: cellH })
        if (product?.name) {
          s.addText(product.name, {
            x, y: y + cellH + 0.05, w: cellW, h: 0.3,
            fontSize: 11, fontFace: 'Instrument Sans', bold: true,
            color: TEXT, align: 'center',
          })
        }
        if (mode === 'full' && product?.description) {
          s.addText(product.description, {
            x, y: y + cellH + 0.4, w: cellW, h: 0.25,
            fontSize: 8, fontFace: 'Instrument Sans',
            color: MUTED, align: 'center',
          })
        }
      })
    }
  }

  // ── Treatment slide (last). Caller passes opts.treatment — the
  // auto-generated present-tense narrative composed from the shot list
  // captions. Falls back to cd.description if no treatment was generated.
  const treatmentText = (opts.treatment || cd.description || '').trim()
  if (treatmentText) {
    const s = pptx.addSlide()
    s.background = { color: BG }
    s.addText('TREATMENT', {
      x: SAFE_X, y: 0.5, w: SAFE_W, h: 0.35,
      fontSize: 11, fontFace: 'Instrument Sans', bold: true,
      color: MUTED, charSpacing: 3,
    })
    s.addText(treatmentText, {
      x: SAFE_X, y: 1.0, w: SAFE_W, h: 5.5,
      fontSize: 16, fontFace: 'Instrument Sans',
      color: 'E2E2E2', valign: 'top',
    })
  }

  const safeName = (pi.projectName || brief?.title || 'wonder-workshop-brief')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'brief'
  const modeTag = mode === 'full' ? '-full-detail' : '-production'
  await pptx.writeFile({ fileName: `${safeName}${modeTag}.pptx` })
  opts.onComplete?.()
}
