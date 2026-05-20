import { jsonrepair } from 'jsonrepair'

const SYSTEM_PROMPT = `You are a creative production brief generator for film and video shoots.
Given a user's prompt, return a JSON object with EXACTLY this structure — no extra text, no markdown fences, just valid JSON:

{
  "title": "<Brand — Campaign type>",
  "meta": "<format> · <n> shots · <aspect ratio>",
  "projectInfo": {
    "projectName": "<project name>",
    "jobNumber": "<job number if provided, otherwise empty string>",
    "clientName": "<client name>",
    "brandCampaignName": "<brand or campaign name>"
  },
  "creativeDirection": {
    "brand": "<brand>",
    "format": "<e.g. 16:9>",
    "duration": "<e.g. 30s>",
    "shots": <number>,
    "location": "<location1, location2>",
    "description": "<2-3 sentence cinematic creative direction>",
    "keyMessage": "<single punchy sentence — the one feeling or idea the viewer should walk away with>",
    "toneKeywords": ["<adjective1>", "<adjective2>", "<adjective3>", "<adjective4>"],
    "productionType": "<Video | Stills | Video + Stills>"
  },
  "brandInfo": {
    "logoUrl": "<public logo image URL if known, otherwise empty string>",
    "sourceUrl": "<official brand source URL if known, otherwise empty string>",
    "colors": [
      { "hex": "#000000", "name": "<name>" }
    ],
    "rules": "<brand guidelines in 1-2 sentences>"
  },
  "character": {
    "name": "<short character name for the primary subject, e.g. 'Sarah' or 'The Runner'>",
    "description": "<talent description>",
    "wardrobe": "<wardrobe details>",
    "views": ["FRONT", "3/4", "SIDE"]
  },
  "characters": [
    { "name": "<short name for an additional named character>", "description": "<talent description>", "wardrobe": "<wardrobe>" }
  ],
  "environment": {
    "heroName": "<short location name, e.g. 'Sunset Beach' or 'Times Square Diner'>",
    "heroEnvironment": "<main location description>",
    "shotRoute": "<location progression>",
    "keyElements": ["<element1>", "<element2>", "<element3>"]
  },
  "productElements": [
    { "name": "<short product/prop name, e.g. 'Frappuccino' or 'Air Force 1s'>", "description": "<detailed visual description for product photography>" }
  ],
  "shotList": [
    { "num": "01", "framing": "<EWS|WS|MS|CU|ECU|OTS|POV>", "description": "<shot description — see @-handle rule below>", "camera": "<Drone|Steadicam|Handheld|Tripod|Gimbal>", "duration": "<Xs>" }
  ],
  "imagePrompts": [
    "<detailed Stable Diffusion prompt for a key visual — cinematic, specific, evocative>",
    "<another key visual prompt>"
  ]
}

Rules:
- environment.heroEnvironment is REQUIRED — populate it with a vivid 1-2 sentence description of the main location pulled from the user's prompt (architecture, time of day, weather, surrounding context). Never leave empty.
- DO NOT populate moodBoard or environments arrays — those are user-driven sections; the user adds entries manually via "Add mood reference" / "Add location" buttons. Leave them out of the JSON entirely.
- shotList (the storyboard) must have exactly 9 items
- MULTIPLE CHARACTERS: the primary subject ALWAYS goes in the 'character' field.
  If the prompt clearly implies additional distinct named people (a
  couple, two friends, parent + child, a team, etc.), put each
  secondary character in the 'characters' array. If there is only one
  person in the scene, return characters as an empty array [].
- @-HANDLES — CRITICAL for storyboard consistency: every shotList[].description
  MUST reference the character(s), location, and products by their @handle —
  the exact name you assigned, prefixed with @. The handles are:
    @<character.name>        e.g. @Sarah
    @<each characters[].name> e.g. @Mike (additional characters)
    @<environment.heroName>  e.g. @Sunset Beach
    @<each productElements[].name>  e.g. @Frappuccino
  Example description: "@Sarah walks into @Sunset Beach holding her @Frappuccino, golden hour light"
  Multi-word names keep their spaces: "@The Concertgoer", not "@TheConcertgoer".
  This makes every storyboard frame regenerate with the exact character /
  location / product you designed, instead of a random stand-in.
- imagePrompts must have exactly 4 items — make them vivid, cinematographic descriptions
- brandInfo.colors must have 3-5 colors appropriate for the brand. If verified brand research is provided, use those exact colors first.
- If verified brand research is provided, preserve brandInfo.logoUrl and brandInfo.sourceUrl exactly.
- Return ONLY the JSON object, nothing else`

function inferBrandName(userPrompt) {
  const cleaned = userPrompt
    .replace(/\([^)]*\)/g, ' ')
    .replace(/^(brand identity shoot for|full production brief for|detailed shot list for|marketing campaign for)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim()

  const forMatch = cleaned.match(/\bfor\s+([A-Z][\w&'.-]*(?:\s+[A-Z][\w&'.-]*){0,3})/)
  if (forMatch) return forMatch[1].trim()

  const firstWords = cleaned.match(/^([A-Z][\w&'.-]*(?:\s+[A-Z][\w&'.-]*){0,3})/)
  if (firstWords) return firstWords[1].trim()

  const lowerKnown = cleaned.match(/\b(starbucks|nike|apple)\b/i)
  if (lowerKnown) return lowerKnown[1]

  return ''
}

async function fetchBrandResearch(userPrompt) {
  const brand = inferBrandName(userPrompt)
  if (!brand) return null

  try {
    const res = await fetch('/api/brand', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brand }),
    })
    if (!res.ok) return null
    const data = await res.json()
    if (!data?.brand) return null
    return data
  } catch {
    return null
  }
}

function mergeBrandResearch(brief, brandResearch) {
  if (!brandResearch) return brief

  const colors = Array.isArray(brandResearch.colors) && brandResearch.colors.length > 0
    ? brandResearch.colors
    : brief.brandInfo?.colors

  return {
    ...brief,
    projectInfo: {
      ...brief.projectInfo,
      clientName: brief.projectInfo?.clientName || brandResearch.brand,
      brandCampaignName: brief.projectInfo?.brandCampaignName || brandResearch.brand,
    },
    creativeDirection: {
      ...brief.creativeDirection,
      brand: brief.creativeDirection?.brand || brandResearch.brand,
    },
    brandInfo: {
      ...brief.brandInfo,
      logoUrl: brandResearch.logoUrl || brief.brandInfo?.logoUrl || '',
      sourceUrl: brandResearch.sourceUrl || brief.brandInfo?.sourceUrl || '',
      colors,
      rules: brandResearch.rules || brief.brandInfo?.rules || '',
    },
    brandResearch,
  }
}

// Programmatically prefix the character / location / product names with @
// in every shotList description. We instruct the LLM to do this (see
// SYSTEM_PROMPT), but Gemini doesn't reliably follow it — so we enforce it
// here. expandMentions() downstream then swaps each @handle for the
// entity's full description at image-generation time, keeping every
// storyboard frame consistent with the designed character/location/product.
function injectMentionHandles(brief) {
  if (!brief || !Array.isArray(brief.shotList)) return brief
  const names = []
  if (brief.character?.name) names.push(brief.character.name)
  for (const c of brief.characters || []) {
    if (c?.name) names.push(c.name)
  }
  if (brief.environment?.heroName) names.push(brief.environment.heroName)
  for (const p of brief.productElements || []) {
    if (p?.name) names.push(p.name)
  }
  if (!names.length) return brief
  // Longest first so "The Concertgoer" wins over a stray "The".
  const sorted = [...names].sort((a, b) => b.length - a.length)
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  const shotList = brief.shotList.map(shot => {
    if (!shot?.description) return shot
    let desc = shot.description
    for (const name of sorted) {
      // Whole-phrase, case-insensitive, not already @-prefixed.
      const re = new RegExp(`(?<!@)\\b${esc(name)}\\b`, 'gi')
      desc = desc.replace(re, m => `@${m}`)
    }
    return { ...shot, description: desc }
  })
  return { ...brief, shotList }
}

export async function generateBrief(userPrompt) {
  const brandResearch = await fetchBrandResearch(userPrompt)
  const researchContext = brandResearch
    ? `\n\nVerified brand research:\n${JSON.stringify({
        brand: brandResearch.brand,
        domain: brandResearch.domain,
        sourceUrl: brandResearch.sourceUrl,
        logoUrl: brandResearch.logoUrl,
        colors: brandResearch.colors,
        rules: brandResearch.rules,
      })}`
    : ''

  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama3.2',
      stream: false,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `${userPrompt}${researchContext}` },
      ],
    }),
  })

  if (!res.ok) throw new Error(`Server error: ${res.status}`)

  const data = await res.json()
  const raw = data.message?.content ?? ''

  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Model did not return valid JSON')

  const repaired = jsonrepair(jsonMatch[0])
  const parsed = JSON.parse(repaired)
  const projectInfo = parsed.projectInfo || {}

  // Preserve the user's exact prompt as the visible creative direction
  // instead of the model's summary. The structured fields (character,
  // environment, productElements, shotList) still get extracted, but
  // the headline description reads like what the user typed — not a
  // generic paraphrase. Strip the generation-suffix markers we tack on
  // at submit time (aspect ratio, resolution, quick start).
  const cleanedPrompt = userPrompt
    .replace(/\s*\(quick start:[^)]*\)\s*$/i, '')
    .replace(/\s*\(resolution:[^)]*\)\s*$/i, '')
    .replace(/\s*\(aspect ratio:[^)]*\)\s*$/i, '')
    .trim()

  // Defense in depth: even with the system prompt telling Gemini not to
  // populate moodBoard / environments, the model occasionally returns
  // them anyway. Drop them here so sections start empty and the user
  // adds entries via "Add mood reference" / "Add location" buttons —
  // per Ed's UX feedback.
  delete parsed.moodBoard
  delete parsed.environments

  const merged = mergeBrandResearch({
    ...parsed,
    creativeDirection: {
      ...(parsed.creativeDirection || {}),
      description: cleanedPrompt,
    },
    projectInfo: {
      projectName: projectInfo.projectName || parsed.title || '',
      jobNumber: projectInfo.jobNumber || '',
      clientName: projectInfo.clientName || parsed.creativeDirection?.brand || '',
      brandCampaignName: projectInfo.brandCampaignName || parsed.creativeDirection?.brand || '',
    },
    originalPrompt: cleanedPrompt,
  }, brandResearch)

  return injectMentionHandles(merged)
}

export async function streamChat(messages, onToken, signal) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      model: 'llama3.2',
      stream: true,
      messages,
    }),
  })

  if (!res.ok) throw new Error(`Server error: ${res.status}`)

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let full = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const lines = decoder.decode(value, { stream: true }).split('\n').filter(Boolean)
    for (const line of lines) {
      try {
        const json = JSON.parse(line)
        const token = json?.message?.content ?? ''
        full += token
        onToken(full)
      } catch {}
    }
  }

  return full
}

/**
 * Chat with tool-calling. Non-streaming. Returns { text, actions }.
 * Each action is { name, args } where name matches one of the supplied tools.
 */
export async function chatWithTools(messages, tools, signal) {
  // Bound the request so a hung server (or a Gemini call that 5xxs
  // after a long stall) can't leave the chat pending forever. 90s is
  // generous for any reasonable text-only generation.
  const timeoutController = new AbortController()
  const timer = setTimeout(() => timeoutController.abort('timeout'), 90000)
  // Compose caller's signal with our timeout so either can abort.
  const onCallerAbort = () => timeoutController.abort('caller-aborted')
  signal?.addEventListener('abort', onCallerAbort)

  let res
  try {
    res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: timeoutController.signal,
      body: JSON.stringify({ messages, tools, stream: false }),
    })
  } catch (err) {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onCallerAbort)
    if (err?.name === 'AbortError') {
      const reason = timeoutController.signal.reason
      if (reason === 'timeout') {
        const e = new Error('Chat timed out after 90s. The server may be overloaded — try again in a minute.')
        e.status = 504
        throw e
      }
    }
    throw err
  }
  clearTimeout(timer)
  signal?.removeEventListener('abort', onCallerAbort)

  if (!res.ok) {
    // Include the response body so callers can show the real cause
    // (e.g. Gemini's "model not available" / "safety filter" / etc.)
    // instead of a generic status code.
    let body = ''
    try {
      const text = await res.text()
      try { body = JSON.parse(text)?.error || text } catch { body = text }
    } catch {}
    const err = new Error(`Server error: ${res.status}${body ? ` — ${String(body).slice(0, 300)}` : ''}`)
    err.status = res.status
    err.body = body
    throw err
  }

  const data = await res.json()
  const text = data.message?.content ?? ''
  const actions = (data.functionCalls || []).map(c => ({
    name: c.name,
    args: c.args || {},
  }))
  return { text, actions }
}
