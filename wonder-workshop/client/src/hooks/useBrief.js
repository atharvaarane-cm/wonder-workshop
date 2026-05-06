import { jsonrepair } from 'jsonrepair'

const SYSTEM_PROMPT = `You are a creative production brief generator for film and video shoots.
Given a user's prompt, return a JSON object with EXACTLY this structure — no extra text, no markdown fences, just valid JSON:

{
  "title": "<Brand — Campaign type>",
  "meta": "<format> · <n> shots · <aspect ratio>",
  "creativeDirection": {
    "brand": "<brand>",
    "format": "<e.g. 16:9>",
    "duration": "<e.g. 30s>",
    "shots": <number>,
    "location": "<location1, location2>",
    "description": "<2-3 sentence cinematic creative direction>"
  },
  "brandInfo": {
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
- brandInfo.colors must have 3-5 colors appropriate for the brand
- Return ONLY the JSON object, nothing else`

export async function generateBrief(userPrompt) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama3.2',
      stream: false,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    }),
  })

  if (!res.ok) throw new Error(`Server error: ${res.status}`)

  const data = await res.json()
  const raw = data.message?.content ?? ''

  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Model did not return valid JSON')

  const repaired = jsonrepair(jsonMatch[0])
  return { ...JSON.parse(repaired), originalPrompt: userPrompt }
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
