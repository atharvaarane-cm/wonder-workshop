// Generates a production treatment — a narrative-style, present-tense
// summary of the commercial — from the brief's storyboard captions.
// Treatments are pitch documents: a beginning / middle / end short story,
// not a shot list. Lives in the one-pager export after the storyboard.
//
// Cached in localStorage keyed by project ID + a fingerprint of the
// shot descriptions, so re-opening the export doesn't re-fire the API
// call. The fingerprint invalidates the cache automatically the moment
// any shot caption or framing changes.

import { chatWithTools } from '../hooks/useBrief.js'

const SYSTEM_PROMPT = [
  'You are a senior creative director writing a TREATMENT for a film / commercial pitch.',
  '',
  'A TREATMENT is a narrative-style summary written in PRESENT TENSE. It reads like a short story — beginning, middle, end — and is the document used to pitch the idea to producers, studios, or investors before a script is written.',
  '',
  'You will receive the storyboard shot list. Synthesize it into a flowing narrative that captures the arc of the spot.',
  '',
  'RULES:',
  '- PRESENT TENSE throughout ("She cracks open the can", never "she cracked").',
  '- ONE flowing paragraph, 150–220 words.',
  '- Narrative voice — story arc with beginning, middle, end. Not a shot list.',
  '- NO shot numbers, NO framing labels (CU/MS/WS/etc.), NO camera direction language.',
  '- Mention brand + named talent naturally where they appear in the shots.',
  '- Capture mood, setting, key beats, the emotional turn.',
  '- End with the feeling the spot leaves the viewer with — not a tagline.',
  '',
  'Return ONLY the treatment paragraph. No preamble, no headers, no quotes around it.',
].join('\n')

function shotFingerprint(shots) {
  return (shots || [])
    .map(s => `${s.framing || ''}|${s.camera || ''}|${s.description || ''}`)
    .join('::')
}

function cacheKey(projectId) {
  return `ww_treatment_${projectId}`
}

export function getCachedTreatment(projectId, shots) {
  if (!projectId) return null
  try {
    const raw = localStorage.getItem(cacheKey(projectId))
    if (!raw) return null
    const stored = JSON.parse(raw)
    if (stored?.fingerprint !== shotFingerprint(shots)) return null
    return stored.text || null
  } catch {
    return null
  }
}

export function cacheTreatment(projectId, shots, text) {
  if (!projectId || !text) return
  try {
    localStorage.setItem(cacheKey(projectId), JSON.stringify({
      fingerprint: shotFingerprint(shots),
      text,
      cachedAt: Date.now(),
    }))
  } catch {}
}

export async function generateTreatmentFromShots(brief, opts = {}) {
  const shots = brief?.shotList || []
  if (!shots.length) return ''

  const cd = brief?.creativeDirection || {}
  const pi = brief?.projectInfo || {}
  const env = brief?.environment || {}
  const brand = cd.brand || pi.clientName || ''
  const title = pi.brandCampaignName || brief?.title || ''
  const location = cd.location || env.heroName || env.heroEnvironment || ''
  const characters = [brief?.character, ...(brief?.characters || [])]
    .filter(c => c?.name)
    .map(c => c.name)

  const shotLines = shots.map((shot, i) => {
    const framing = shot.framing ? ` (${shot.framing})` : ''
    return `Shot ${i + 1}${framing}: ${shot.description || '(no description)'}`
  }).join('\n')

  const userContent = [
    brand && `Brand: ${brand}.`,
    title && `Campaign: ${title}.`,
    location && `Location: ${location}.`,
    characters.length && `Featured talent: ${characters.join(', ')}.`,
    '',
    'Storyboard sequence:',
    shotLines,
  ].filter(Boolean).join('\n')

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userContent },
  ]

  try {
    const { text } = await chatWithTools(messages, [], opts.signal)
    return (text || '').trim().replace(/^["'`]+|["'`]+$/g, '')
  } catch (e) {
    console.warn('[treatment] generation failed', e)
    return ''
  }
}
