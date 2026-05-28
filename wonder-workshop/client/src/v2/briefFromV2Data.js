// Translate v2's data shape (talent[]/products[]/locations[]/frames[]) into
// the v1 `brief` + `images` shape that the v1 OnePager expects. Lets us
// reuse the proven v1 export instead of maintaining a parallel v2 design.

// v2 uses lowercase keys (front/side/threeQuarter/back) for headshot and
// fullBody slots. v1 VIEWS uses FRONT/SIDE/3/4/BACK as IDs. Map between
// them when building the images record so OnePager's stable IDs resolve.
const VIEW_ID_TO_V2_KEY = {
  FRONT: 'front',
  SIDE: 'side',
  '3/4': 'threeQuarter',
  BACK: 'back',
}

function wrapImg(src) {
  if (!src) return null
  return { versions: [{ src }], activeVersion: 0 }
}

// Convert v2 data into the v1 brief shape OnePager expects.
export function briefFromV2Data(data) {
  if (!data) return { brief: {}, images: {} }
  const meta = data.meta || {}
  const brand = data.brand || {}
  const talent = data.talent || []
  const products = data.products || []
  const locations = data.locations || []
  const frames = data.frames || []

  const brief = {
    title: meta.title || '',
    creativeDirection: {
      brand: brand.name || meta.client || '',
      format: meta.format
        ? `${meta.format}s${meta.aspect ? ' · ' + meta.aspect : ''}`
        : '',
      duration: meta.format ? `${meta.format}s` : '',
      shots: frames.length ? String(frames.length) : '',
      location: locations[0]?.name || '',
      description: meta.treatment || '',
    },
    projectInfo: {
      clientName: meta.client || '',
      brandCampaignName: meta.title || '',
    },
    shotList: frames.map((f, i) => ({
      id: f.id,
      num: i + 1,
      framing: f.shotType || '',
      camera: f.camera || '',
      description: f.brief || '',
    })),
    character: talent[0]
      ? {
          name: talent[0].name || '',
          wardrobe: '',
          description: talent[0].note || '',
        }
      : null,
    characters: talent.slice(1).map(t => ({
      name: t.name || '',
      wardrobe: '',
      description: t.note || '',
    })),
    environment: locations[0]
      ? {
          heroName: locations[0].name || '',
          heroEnvironment: locations[0].note || '',
          keyElements: [],
        }
      : {},
    environments: locations.slice(1).map(l => ({
      heroName: l.name || '',
      heroEnvironment: l.note || '',
      keyElements: [],
    })),
    productElements: products.map(p => ({
      name: p.name || '',
      description: p.note || '',
    })),
  }

  // Build the images map keyed by OnePager's stable IDs. resolveSlot()
  // unwraps { versions, activeVersion } and falls back to the legacy
  // prompt — we only need to populate the stable-ID side here.
  const images = {}
  talent.forEach((t, i) => {
    const key = i === 0 ? 'primary' : String(i - 1)
    const ref = wrapImg(t.headshot)
    if (ref) images[`char.${key}.reference`] = ref
    if (t.headshots) {
      Object.entries(VIEW_ID_TO_V2_KEY).forEach(([viewId, v2Key]) => {
        const w = wrapImg(t.headshots?.[v2Key])
        if (w) images[`char.${key}.headshot.${viewId}`] = w
      })
    }
    if (t.fullBody) {
      Object.entries(VIEW_ID_TO_V2_KEY).forEach(([viewId, v2Key]) => {
        const w = wrapImg(t.fullBody?.[v2Key])
        if (w) images[`char.${key}.fullbody.${viewId}`] = w
      })
    }
  })
  locations.forEach((l, i) => {
    const key = i === 0 ? 'primary' : String(i - 1)
    const w = wrapImg(l.generatedImage || l.referenceImage)
    if (w) images[`env.${key}`] = w
  })
  products.forEach((p, i) => {
    const w = wrapImg(p.referenceImage)
    if (w) images[`product.${i}`] = w
  })
  frames.forEach((f, i) => {
    const w = wrapImg(f.uploadedImage)
    if (w) images[`shot.${f.id || `idx-${i}`}`] = w
  })

  return { brief, images }
}
