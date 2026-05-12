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
    "description": "<talent description>",
    "wardrobe": "<wardrobe details>",
    "views": ["FRONT", "3/4", "SIDE"]
  },
  "environment": {
    "heroEnvironment": "<main location description>",
    "shotRoute": "<location progression>",
    "keyElements": ["<element1>", "<element2>", "<element3>"]
  },
  "shotList": [
    { "num": "01", "framing": "<EWS|WS|MS|CU|ECU|OTS|POV>", "description": "<shot description>", "camera": "<Drone|Steadicam|Handheld|Tripod|Gimbal>", "duration": "<Xs>" }
  ],
  "lightingMood": [
    { "letter": "A", "name": "<mood name>", "description": "<lighting description>", "colors": ["<hex1>", "<hex2>"], "tags": ["<tag1>", "<tag2>"] }
  ],
  "imagePrompts": [
    "<detailed Stable Diffusion prompt for a key visual — cinematic, specific, evocative>",
    "<another key visual prompt>"
  ]
}

Rules:
- shotList must have exactly 9 items
- lightingMood must have exactly 4 items
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

  return mergeBrandResearch({
    ...parsed,
    projectInfo: {
      projectName: projectInfo.projectName || parsed.title || '',
      jobNumber: projectInfo.jobNumber || '',
      clientName: projectInfo.clientName || parsed.creativeDirection?.brand || '',
      brandCampaignName: projectInfo.brandCampaignName || parsed.creativeDirection?.brand || '',
    },
    originalPrompt: userPrompt,
  }, brandResearch)
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
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({ messages, tools, stream: false }),
  })

  if (!res.ok) throw new Error(`Server error: ${res.status}`)

  const data = await res.json()
  const text = data.message?.content ?? ''
  const actions = (data.functionCalls || []).map(c => ({
    name: c.name,
    args: c.args || {},
  }))
  return { text, actions }
}
