// Build a .pptx file from the brief + generated images so the team can
// open it in Google Slides / PowerPoint / Keynote and keep iterating.
// Mirrors the on-screen one-pager structure: title slide, brand colors,
// one character sheet per character, a locations slide, then the
// storyboard sequence as a 3-column grid of frames.

import PptxGenJS from 'pptxgenjs'
import { VIEWS, closeupPrompt, fullbodyPrompt, referencePrompt } from './characterPrompts.js'
import { expandMentions } from './mentions.js'

const LAYOUT_W = 13.333
const LAYOUT_H = 7.5
const SAFE_X = 0.5
const SAFE_W = LAYOUT_W - 1.0
const BG = '111111'
const CARD = '171717'
const TEXT = 'FFFFFF'
const MUTED = '999999'
const ACCENT = '006DD4'

function getSlot(images, prompt) {
  if (!images || !prompt) return null
  const slot = images[prompt]
  if (!slot?.versions?.length) return null
  return slot.versions[slot.activeVersion ?? 0]?.src || null
}

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

function addTextOrPlaceholder(slide, text, opts) {
  if (!text) return
  slide.addText(String(text), opts)
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
  const cd = brief?.creativeDirection || {}
  const pi = brief?.projectInfo || {}
  const bi = brief?.brandInfo || {}
  const env = brief?.environment || {}
  const shots = brief?.shotList || []

  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE'
  pptx.title = pi.projectName || brief?.title || 'Wonder Workshop Brief'
  pptx.company = 'Wonder Workshop'

  // ── Slide 1: Title ────────────────────────────────────────────────
  const s1 = pptx.addSlide()
  s1.background = { color: BG }
  addTextOrPlaceholder(s1, 'BRIEF', {
    x: SAFE_X, y: 0.55, w: SAFE_W, h: 0.4,
    fontSize: 11, fontFace: 'Instrument Sans', bold: true,
    color: MUTED, charSpacing: 4,
  })
  addTextOrPlaceholder(s1, pi.projectName || brief?.title || 'Untitled', {
    x: SAFE_X, y: 1.1, w: SAFE_W, h: 2.0,
    fontSize: 60, fontFace: 'Instrument Sans',
    color: 'D4D4D4',
  })
  // Meta strip
  const metaPairs = [
    pi.clientName && ['Client', pi.clientName],
    pi.brandCampaignName && ['Campaign', pi.brandCampaignName],
    cd.format && ['Format', String(cd.format)],
    cd.duration && ['Duration', String(cd.duration)],
    cd.shots && ['Shots', String(cd.shots)],
    cd.location && ['Location', String(cd.location)],
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

  // ── Slide 2: Creative direction + brand colors ────────────────────
  if (cd.description || (bi.colors && bi.colors.length > 0) || bi.rules) {
    const s2 = pptx.addSlide()
    s2.background = { color: BG }
    s2.addText('CREATIVE DIRECTION', {
      x: SAFE_X, y: 0.5, w: SAFE_W, h: 0.35,
      fontSize: 11, fontFace: 'Instrument Sans', bold: true,
      color: MUTED, charSpacing: 3,
    })
    if (cd.description) {
      s2.addText(cd.description, {
        x: SAFE_X, y: 1.0, w: SAFE_W, h: 3.0,
        fontSize: 16, fontFace: 'Instrument Sans',
        color: 'E2E2E2', valign: 'top',
      })
    }
    if (bi.colors && bi.colors.length > 0) {
      s2.addText('BRAND COLORS', {
        x: SAFE_X, y: 4.5, w: SAFE_W, h: 0.3,
        fontSize: 10, fontFace: 'Instrument Sans', bold: true,
        color: MUTED, charSpacing: 3,
      })
      const swatchW = Math.min(1.2, SAFE_W / bi.colors.length - 0.1)
      bi.colors.slice(0, 8).forEach((c, i) => {
        const x = SAFE_X + i * (swatchW + 0.1)
        s2.addShape('rect', {
          x, y: 4.9, w: swatchW, h: 1.0,
          fill: { color: (c.hex || '#888888').replace('#', '') },
          line: { color: '282828', width: 1 },
        })
        if (c.hex) {
          s2.addText(c.hex.toUpperCase(), {
            x, y: 5.95, w: swatchW, h: 0.25,
            fontSize: 9, fontFace: 'Instrument Sans',
            color: MUTED, align: 'center',
          })
        }
        if (c.name) {
          s2.addText(c.name, {
            x, y: 6.2, w: swatchW, h: 0.25,
            fontSize: 10, fontFace: 'Instrument Sans',
            color: TEXT, align: 'center',
          })
        }
      })
    }
  }

  // ── Character sheets (one slide per character) ────────────────────
  const characters = [brief?.character, ...(brief?.characters || [])]
    .filter(c => c?.name || c?.description)

  for (let i = 0; i < characters.length; i++) {
    const char = characters[i]
    const refDataUrl = await urlToDataUrl(getSlot(images, referencePrompt(char)))
    const headshotData = await Promise.all(
      VIEWS.map(v => urlToDataUrl(getSlot(images, closeupPrompt(char, v)))),
    )

    const s = pptx.addSlide()
    s.background = { color: BG }
    s.addText(`CHARACTER ${i + 1}${characters.length > 1 ? ` OF ${characters.length}` : ''}`, {
      x: SAFE_X, y: 0.5, w: SAFE_W, h: 0.35,
      fontSize: 11, fontFace: 'Instrument Sans', bold: true,
      color: MUTED, charSpacing: 3,
    })
    // Reference + bio (top half)
    addImageBox(s, refDataUrl, { x: SAFE_X, y: 1.0, w: 2.4, h: 2.4 })
    if (char.name) {
      s.addText(char.name, {
        x: SAFE_X + 2.7, y: 1.0, w: SAFE_W - 2.7, h: 0.6,
        fontSize: 32, fontFace: 'Instrument Sans', color: TEXT,
      })
    }
    if (char.description) {
      s.addText(char.description, {
        x: SAFE_X + 2.7, y: 1.8, w: SAFE_W - 2.7, h: 1.6,
        fontSize: 13, fontFace: 'Instrument Sans', color: 'E2E2E2',
        valign: 'top',
      })
    }
    // Headshots row (bottom half)
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

    // Second slide: full body
    const fullBodyData = await Promise.all(
      VIEWS.map(v => urlToDataUrl(getSlot(images, fullbodyPrompt(char, v)))),
    )
    const s2c = pptx.addSlide()
    s2c.background = { color: BG }
    s2c.addText(`${char.name || `CHARACTER ${i + 1}`} — FULL BODY`, {
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

  // ── Location slide ────────────────────────────────────────────────
  const locPrompt = `${env.heroEnvironment || 'cinematic location'}, ${(env.keyElements || []).slice(0, 3).join(', ')}, wide establishing shot, golden hour, cinematic photography`
  const locDataUrl = await urlToDataUrl(getSlot(images, locPrompt))
  if (env.heroName || env.heroEnvironment || locDataUrl) {
    const s = pptx.addSlide()
    s.background = { color: BG }
    s.addText('LOCATIONS', {
      x: SAFE_X, y: 0.5, w: SAFE_W, h: 0.35,
      fontSize: 11, fontFace: 'Instrument Sans', bold: true,
      color: MUTED, charSpacing: 3,
    })
    addImageBox(s, locDataUrl, { x: SAFE_X, y: 1.0, w: SAFE_W, h: 5.0 })
    if (env.heroName) {
      s.addText(env.heroName, {
        x: SAFE_X, y: 6.2, w: SAFE_W, h: 0.6,
        fontSize: 24, fontFace: 'Instrument Sans', color: TEXT,
      })
    }
  }

  // ── Storyboard slides (6 frames per slide, 3 cols × 2 rows) ───────
  if (shots.length > 0) {
    const FRAMES_PER_SLIDE = 6
    for (let i = 0; i < shots.length; i += FRAMES_PER_SLIDE) {
      const chunk = shots.slice(i, i + FRAMES_PER_SLIDE)
      const shotData = await Promise.all(
        chunk.map(shot => {
          const expanded = expandMentions(shot.description, brief)
          const prompt = `${expanded}, ${shot.framing} shot, ${shot.camera} camera, cinematic film still`
          return urlToDataUrl(getSlot(images, prompt))
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

  const safeName = (pi.projectName || brief?.title || 'wonder-workshop-brief')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'brief'
  await pptx.writeFile({ fileName: `${safeName}.pptx` })
  opts.onComplete?.()
}
