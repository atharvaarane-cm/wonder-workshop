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
    })
  }
  return handles
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
