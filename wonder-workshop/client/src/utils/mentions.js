// @mention handles + expansion.
//
// Goal: writer types `@Sarah walks down @Sunset Beach` in a Storyboard shot
// description. When that shot generates an image, the prompt sent to
// Pollinations has @Sarah and @Sunset Beach expanded to their full
// descriptions, so the generated image actually looks like that character
// in that environment.
//
// Handles are derived from named brief entities — currently the Character
// (brief.character.name) and the hero Location (brief.environment.heroName).
// Future: per-Product/Element names, multiple locations.

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Each entity's slot key is derived the same way the section component
// derives it, so the storyboard can find the entity's image in
// project.images for identity-preserving generation.
function characterReferenceSlotKey(character) {
  if (!character) return null
  // Must match referencePrompt() in utils/characterPrompts.js verbatim.
  return `${character.description || ''}, ${character.wardrobe || ''}, close-up portrait, head and shoulders, facing directly forward, front view, full face visible, sharp face detail, studio lighting, clean white background, headshot`
}
function locationSlotKey(env) {
  if (!env?.heroEnvironment && !env?.heroName) return null
  const hero = env.heroEnvironment ?? 'cinematic location'
  const elements = (env.keyElements || []).join(', ')
  // Must match LocationsSetDesign.jsx hero slot.
  return `${hero}, ${elements}, wide establishing shot, golden hour, cinematic photography`
}
function productSlotKey(product) {
  if (!product) return null
  const userDesc = (product.description || '').trim()
  const userName = (product.name || '').trim()
  // Must match ClothingProps.jsx slot prompt.
  return userDesc
    ? `${userDesc}, product shot, clean white background, studio lighting, commercial photography`
    : `${userName || 'product'}, product shot, clean white background, studio lighting, commercial photography`
}

export function getMentionHandles(brief) {
  const handles = []
  // Primary character (brief.character) + any additional characters
  // (brief.characters[]). Each named character becomes a @handle.
  const allCharacters = [brief?.character, ...(brief?.characters || [])]
    .filter(c => c?.name)
  for (const character of allCharacters) {
    const parts = []
    if (character.description) parts.push(character.description)
    if (character.wardrobe) parts.push(character.wardrobe)
    handles.push({
      key: character.name,
      label: character.name,
      kind: 'character',
      expansion: [character.name, ...parts].join(', '),
      slotKey: characterReferenceSlotKey(character),
    })
  }
  // Primary location (brief.environment) + any additional locations
  // (brief.environments[]). Each named location becomes a @handle.
  const allLocations = [brief?.environment, ...(brief?.environments || [])]
  for (const env of allLocations) {
    if (!env?.heroName) continue
    const parts = []
    if (env.heroEnvironment) parts.push(env.heroEnvironment)
    const elements = (env.keyElements || []).slice(0, 3).join(', ')
    if (elements) parts.push(elements)
    handles.push({
      key: env.heroName,
      label: env.heroName,
      kind: 'location',
      expansion: [env.heroName, ...parts].join(', '),
      slotKey: locationSlotKey(env),
    })
  }
  // Named products/elements (e.g. @Frappuccino, @AirForce1s)
  for (const product of brief?.productElements || []) {
    if (!product?.name) continue
    const parts = []
    if (product.description) parts.push(product.description)
    handles.push({
      key: product.name,
      label: product.name,
      kind: 'product',
      expansion: [product.name, ...parts].join(', '),
      slotKey: productSlotKey(product),
    })
  }
  return handles
}

/**
 * For a given text + brief + project.images, return the active image
 * sources (data URLs) for every @handle referenced in the text. The
 * Storyboard uses these as Gemini reference images so each shot keeps
 * its products + characters + locations visually consistent — same
 * Pepsi can across all 9 shots, same Tony, same modern European city.
 *
 * Capped at 4 (Gemini's inline-image limit). Prefers characters >
 * products > locations when more than 4 are referenced.
 */
export function getMentionImageRefs(text, brief, projectImages) {
  if (!text || !brief || !projectImages) return []
  const handles = getMentionHandles(brief)
  if (!handles.length) return []
  const referenced = []
  for (const h of handles) {
    const re = new RegExp('@' + escapeRe(h.key) + '(?![A-Za-z0-9_])', 'i')
    if (re.test(text)) referenced.push(h)
  }
  if (!referenced.length) return []
  // Priority order: character refs are most identity-critical, then
  // products (brand consistency), then locations (already gets a lot
  // of detail through the expansion text).
  const priority = { character: 0, product: 1, location: 2 }
  referenced.sort((a, b) => (priority[a.kind] ?? 9) - (priority[b.kind] ?? 9))
  const refs = []
  for (const h of referenced) {
    if (!h.slotKey) continue
    const slot = projectImages[h.slotKey]
    const active = slot?.versions?.[slot?.activeVersion ?? 0]
    if (active?.src) refs.push(active.src)
    if (refs.length >= 4) break
  }
  return refs
}

/**
 * Replace `@HandleName` tokens in `text` with the handle's full expansion.
 * If a name has spaces ("Sunset Beach"), the regex still matches the full
 * literal name. Matching is case-insensitive. Unknown @tokens are left
 * unchanged so the model still sees them as a name hint.
 */
export function expandMentions(text, brief) {
  if (!text || typeof text !== 'string' || !brief) return text
  const handles = getMentionHandles(brief)
  if (!handles.length) return text

  // Sort longest-name-first so "@Sunset Beach Hotel" doesn't get matched
  // by "@Sunset Beach" first.
  const sorted = [...handles].sort((a, b) => b.key.length - a.key.length)

  let result = text
  for (const h of sorted) {
    const re = new RegExp('@' + escapeRe(h.key) + '(?![A-Za-z0-9_])', 'gi')
    result = result.replace(re, h.expansion)
  }
  return result
}
