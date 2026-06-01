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
- DIRECT THE STORYBOARD LIKE A REAL COMMERCIAL — it must read as a deliberately
  shot spot, not 9 near-identical frames:
  • VARY THE COVERAGE: use a genuine range of framings and angles across the 9
    shots — wide establishers, mediums, close-ups, an over-the-shoulder, a POV,
    high/low angles, and at least one unexpected vantage. Do NOT shoot every
    shot from the same distance and angle on the same spot.
  • USE THE LOCATION: characters must actually INTERACT with the setting and
    occupy it the way real people would. If it's a pool, people are IN THE
    WATER (swimming, splashing, floating, jumping in) for several shots — not
    only standing dry beside it. Show the space from multiple vantage points.
  • SCENE LOGIC / CONTINUITY: every action must have its visible cause. Water
    splashing means the people are IN or AT the water's edge actually touching
    it. Never depict an effect whose source isn't in the shot. Wet hair/skin
    after a swim, dry before. Keep cause and effect consistent shot to shot.
  • WARDROBE MUST SUIT THE ACTIVITY/LOCATION: at a pool/beach EVERY character is
    in swimwear (and gets wet); at a gym, workout clothes; etc. Do not put
    characters in street clothes for an activity that demands otherwise.
  • Keep it interesting and on-brand: build the 9 shots around the brief and the
    key message with a clear beginning/middle/end and visual variety.
- WARDROBE FIELDS (character.wardrobe and characters[].wardrobe) MUST be specific
  and complete (named garments + colors, INCLUDING a top for everyone) and MUST
  suit the project's primary location/activity — e.g. a pool spot means a
  specific swimsuit/trunks for each person, not a generic shirt. Specific,
  complete wardrobe is what keeps each character consistent across every shot.
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

/**
 * Reconciliation suggestion. Given the current brief, the storyboard frames,
 * and one or more assets (characters / elements / locations) that aren't yet
 * represented in the brief and/or storyboard, ask the model to propose:
 *   - a rewritten brief that weaves the asset(s) in naturally, and
 *   - a few frame brief touch-ups (@mentioning the asset's handle) for any
 *     asset missing from the storyboard.
 * Returns { newBrief, frameEdits: [{ frameNumber, newBrief }] }.
 * Reuses the /api/chat tool-calling path so it shares the same model + auth.
 */
export async function suggestReconciliation({ brief, frames, assets, signal }) {
  const PROPOSE_TOOL = {
    name: 'propose_reconciliation',
    description: 'Return the reconciled brief and any frame brief edits.',
    parameters: {
      type: 'object',
      properties: {
        newBrief: {
          type: 'string',
          description: 'The full rewritten project brief, weaving in the asset(s) naturally. Keep the existing content and voice; ADD the asset(s) where they fit.',
        },
        frameEdits: {
          type: 'array',
          description: 'Frame brief touch-ups for assets missing from the storyboard. Include one for EVERY asset that needs to appear in the storyboard (don\'t skip the location). Reference the asset by its @handle, or by its exact Name when it has no handle.',
          items: {
            type: 'object',
            properties: {
              frameNumber: { type: 'string', description: 'The frame number, e.g. "02".' },
              newBrief: { type: 'string', description: 'The rewritten brief for that frame.' },
            },
            required: ['frameNumber', 'newBrief'],
          },
        },
        newFrames: {
          type: 'array',
          description: 'NEW frames to ADD to the storyboard when editing existing ones isn\'t enough — e.g. an establishing shot for a new LOCATION. Use sparingly (0-2). Each becomes a real frame appended after the given frame (or at the end).',
          items: {
            type: 'object',
            properties: {
              brief: { type: 'string', description: 'The shot description. Reference assets by @handle or exact Name (set the shot AT the location by name).' },
              shotType: { type: 'string', description: 'e.g. "WIDE" for an establishing shot, "MED", "CU".' },
              afterFrameNumber: { type: 'string', description: 'Optional — insert right after this frame number; omit to append at the end.' },
            },
            required: ['brief'],
          },
        },
        plan: {
          type: 'string',
          description: 'One short line summarizing how you integrated each asset (e.g. "Mary (supporting) → added to the 2 group shots + frame 5; Parking Lot → new arrival shot at frame 1").',
        },
      },
      required: ['newBrief'],
    },
  }

  const assetLines = assets.map(a => {
    const missing = [!a.inBrief && 'the brief', !a.inStoryboard && 'the storyboard'].filter(Boolean).join(' and ')
    const ref = a.handle ? `reference it as ${a.handle}` : `it has no @handle, so reference it by name "${a.name}"`
    const kind = a.type === 'talent' ? 'Character' : a.type === 'products' ? 'Element' : 'Location'
    const weight = a.type === 'talent' ? `, ROLE: ${a.role || 'Supporting'}` : a.type === 'products' ? `, FOCUS: ${a.focus || 'Medium'}` : ''
    return `- ${kind} "${a.name}" (${ref})${weight}${a.note ? ` — ${a.note}` : ''}. Missing from: ${missing}.`
  }).join('\n')

  // Rich per-frame context so the model can stage logically (act position,
  // shot type, who's already in each frame, which frames are group shots).
  const frameLines = (frames || []).map(f => {
    const pos = f.position ? `${f.position}` : ''
    const meta = [pos, f.shotType, f.isGroup ? 'GROUP SHOT' : null].filter(Boolean).join(', ')
    const who = (f.characters && f.characters.length) ? `cast: ${f.characters.join(', ')}` : 'cast: none'
    const loc = f.location ? `at ${f.location}` : 'no location set'
    return `  ${f.number} [${meta}] — ${who}; ${loc} — ${f.brief}`
  }).join('\n')

  const system = [
    'You reconcile a commercial storyboard so every generated asset is reflected in BOTH the brief and the shots.',
    'You will be given the current brief, the storyboard frames, and one or more assets that are missing from the brief and/or the storyboard.',
    'CRITICAL: include EVERY asset in the "ASSETS TO RECONCILE" list — do not omit a single one (it is easy to forget the location; do not). Each listed asset must end up in BOTH the rewritten brief AND woven into at least one frame\'s text.',
    'Produce a rewritten brief that includes ALL the asset(s) naturally — preserve the existing creative, voice, and structure; weave each new asset in where it fits. Do NOT drop anything already in the brief.',
    'Integrate each asset with REAL PRODUCTION LOGIC — like an art director staging the spot, NOT by name-dropping it into one shot. Do not cap yourself at 1-2 frames; touch as many frames (and add/restructure frames) as the asset\'s weight and the story require. Each frame line shows its act position (opening/middle/closing third), shot type, who is already in it, and whether it is a GROUP SHOT.',
    'HONOR EACH ASSET\'S DESCRIPTION FIRST. Read the description in the asset list and stage the asset DOING WHAT IT IS — never override the user\'s stated intent. A character described as "a runner" RUNS (e.g. jogging along the beach); do NOT drop them into an unrelated group activity like a volleyball game. The description\'s intent outranks every rule below.',
    'CHARACTERS — within that intent, weave in PROPORTIONAL TO ROLE, matching how the existing cast is used:',
    '  • Lead → appears across most frames, the focal subject.',
    '  • Supporting → appears in a similar number of frames as the OTHER supporting characters. Put them in the GROUP SHOTS **only when the group\'s activity fits their description**; if their described role/activity is distinct (a lone runner), give them their own beat (foreground or background) doing that, near the group rather than joined into it.',
    '  • Extra → incidental / BACKGROUND only, a frame or two. An Extra must NOT be inserted as a participant in a hero group shot — at most a background figure.',
    'LOCATIONS — place by NARRATIVE LOGIC using act position. A location must be the actual SETTING of shots (set the scene there), not just mentioned. A secondary/auxiliary location (e.g. a parking lot for a beach spot) typically BOOKENDS the story — arrival in the OPENING or departure in the CLOSING third — so add or re-set a frame there at the start and/or end. A hero location carries the middle. Use newFrames for an establishing shot when it helps, and re-set existing frames\' location when that reads better.',
    'ELEMENTS — weight by FOCUS: High = feature it prominently (hero/close-up, possibly its own shot); Medium = clearly present across a few relevant shots; Low = a supporting background detail.',
    'Before finishing, double-check: is every listed asset in newBrief AND depicted in the storyboard with the RIGHT amount of presence for its role/focus (a Supporting character should NOT end up in just one frame while peers are in several; a Supporting character must be in the group shots; a location must be a setting placed where it makes sense)? If not, fix it.',
    'Also fill `plan` with one short line describing how you staged each asset.',
    'Call propose_reconciliation exactly once with your result.',
  ].join('\n')

  const user = [
    'CURRENT BRIEF:',
    brief || '(empty)',
    '',
    'STORYBOARD FRAMES:',
    frameLines || '(none)',
    '',
    'ASSETS TO RECONCILE:',
    assetLines,
  ].join('\n')

  const { actions } = await chatWithTools(
    [{ role: 'system', content: system }, { role: 'user', content: user }],
    [PROPOSE_TOOL],
    signal,
  )
  const call = (actions || []).find(a => a.name === 'propose_reconciliation')
  if (!call) throw new Error('The model did not return a reconciliation suggestion. Try again.')
  return {
    newBrief: call.args.newBrief || brief || '',
    frameEdits: Array.isArray(call.args.frameEdits) ? call.args.frameEdits : [],
    newFrames: Array.isArray(call.args.newFrames) ? call.args.newFrames : [],
    plan: (call.args.plan || '').trim(),
  }
}

/**
 * Reverse reconcile: some assets were DELETED but the brief / storyboard still
 * reference them. Ask the model to rewrite the brief + affected frames so every
 * dangling reference to a deleted item is removed (or naturally replaced).
 * Returns { newBrief, frameEdits }.
 */
export async function suggestOrphanCleanup({ brief, frames, orphans, signal }) {
  const TOOL = {
    name: 'propose_cleanup',
    description: 'Return the brief and frame edits with all references to the deleted items removed.',
    parameters: {
      type: 'object',
      properties: {
        newBrief: { type: 'string', description: 'The brief rewritten so it no longer references ANY deleted item — drop each mention or replace it with fitting phrasing. Keep everything else and the voice.' },
        frameEdits: {
          type: 'array',
          description: 'Edits for frames that referenced a deleted item — rewrite each so the dangling reference is gone and the shot still makes narrative sense. Only include frames you changed.',
          items: {
            type: 'object',
            properties: {
              frameNumber: { type: 'string' },
              newBrief: { type: 'string' },
            },
            required: ['frameNumber', 'newBrief'],
          },
        },
      },
      required: ['newBrief'],
    },
  }
  const list = (orphans || []).map(o => `- ${o.type === 'talent' ? 'Character' : o.type === 'products' ? 'Element' : 'Location'} "${o.name}"${o.handle ? ` (${o.handle})` : ''}`).join('\n')
  const frameLines = (frames || []).map(f => `  ${f.number}: ${f.brief}`).join('\n')
  const system = [
    'Some assets were DELETED, but the brief and/or storyboard still reference them. Remove every dangling reference so the creative reads cleanly again.',
    'BRIEF: rewrite so it no longer mentions any deleted item — drop the reference, or replace it with something that fits (a remaining asset, or generic phrasing). Preserve everything else and the voice.',
    'FRAMES: for any frame mentioning a deleted item, rewrite it so the reference is gone and the shot still makes sense. If a frame existed ONLY for the deleted item, repurpose it rather than leaving it broken.',
    'Do NOT introduce new named assets — only remove/clean the deleted ones. Remove the @handles for deleted items entirely.',
    'Call propose_cleanup exactly once.',
  ].join('\n')
  const user = ['CURRENT BRIEF:', brief || '(empty)', '', 'STORYBOARD FRAMES:', frameLines || '(none)', '', 'DELETED ITEMS STILL REFERENCED (remove ALL references to these):', list].join('\n')
  const { actions } = await chatWithTools([{ role: 'system', content: system }, { role: 'user', content: user }], [TOOL], signal)
  const call = (actions || []).find(a => a.name === 'propose_cleanup')
  if (!call) throw new Error('The model did not return a cleanup suggestion. Try again.')
  return {
    newBrief: call.args.newBrief || brief || '',
    frameEdits: Array.isArray(call.args.frameEdits) ? call.args.frameEdits : [],
  }
}

// Rewrites just the shot list (storyboard) at a new total duration —
// preserves the rest of the brief (creative direction, characters,
// locations, products). Used by the editable duration in the Creative
// section header so changing 30s → 60s re-paces the storyboard
// without regenerating the whole brief.
//
// Keeps the existing shot count and shot ids by index so any images
// already generated for shot 1 still belong to shot 1 after rewrite
// (descriptions change, but the user can decide whether to regenerate
// images via the storyboard's section regenerate button).
export async function regenerateShotList(brief, newDuration) {
  const cd = brief.creativeDirection || {}
  const shotCount = brief.shotList?.length || 9

  // Collect every @handle the LLM should use, so the rewritten shots
  // keep referencing the same characters / locations / products.
  const handles = []
  if (brief.character?.name) handles.push(brief.character.name)
  for (const c of (brief.characters || [])) if (c?.name) handles.push(c.name)
  if (brief.environment?.heroName) handles.push(brief.environment.heroName)
  for (const e of (brief.environments || [])) if (e?.heroName) handles.push(e.heroName)
  for (const p of (brief.productElements || [])) if (p?.name) handles.push(p.name)

  const system = `You rewrite the shot list of an existing video production brief for a new total runtime.

Return ONLY this JSON shape — no markdown fences, no explanation:
{
  "shotList": [
    { "num": "01", "framing": "<EWS|WS|MS|CU|ECU|OTS|POV>", "description": "<short shot description, use @handles>", "camera": "<Drone|Steadicam|Handheld|Tripod|Gimbal>", "duration": "<Xs>" }
  ]
}

Rules:
- shotList must have EXACTLY ${shotCount} items
- Per-shot durations must SUM to exactly ${newDuration}
- Number shots zero-padded: 01, 02, 03, ...
- Vary framing across shots (mix of wide / medium / close)
- Use these @handles where appropriate: ${handles.map(h => '@' + h).join(', ') || '(none)'}
- Preserve the original creative direction, tone, and narrative arc
- Keep each description to one sentence`

  const context = JSON.stringify({
    creativeDirection: cd,
    character: brief.character,
    characters: brief.characters,
    environment: brief.environment,
    environments: brief.environments,
    productElements: brief.productElements,
  }, null, 2)

  const userMsg = `Rewrite the shot list for a total duration of ${newDuration}.

Brief context:
${context}

Return ONLY the JSON.`

  const { text } = await chatWithTools(
    [
      { role: 'system', content: system },
      { role: 'user', content: userMsg },
    ],
    [],
  )

  const cleaned = (text || '').replace(/^```(?:json)?\n?/i, '').replace(/```\s*$/, '').trim()
  let parsed
  try {
    parsed = JSON.parse(jsonrepair(cleaned))
  } catch (e) {
    throw new Error(`Couldn't parse model response: ${e?.message || e}`)
  }
  if (!Array.isArray(parsed?.shotList) || !parsed.shotList.length) {
    throw new Error('Model returned no shots')
  }
  // Preserve the existing shot.id by index so already-generated images
  // remain attached to their slot. Re-stamp num to stay in order.
  return parsed.shotList.map((s, i) => ({
    ...s,
    id: brief.shotList?.[i]?.id || `shot_${Date.now()}_${i}`,
    num: String(i + 1).padStart(2, '0'),
  }))
}
