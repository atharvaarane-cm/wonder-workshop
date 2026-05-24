// Image generation via Gemini. Returns a data: URL so the client can
// plug it straight into <img src> without an extra hop — matches the
// contract of /api/image (Pollinations).
//
// Requires GEMINI_IMAGE_API_KEY in env. Model can be overridden with
// GEMINI_IMAGE_MODEL if Google ships a newer/cheaper one.

const DEFAULT_MODEL = 'gemini-2.0-flash-preview-image-generation'

// Gemini accepts an aspectRatio hint via imageConfig; we map our common
// ratios to the supported set. Anything unrecognised falls back to 1:1.
const RATIO_MAP = {
  '16:9': '16:9',
  '9:16': '9:16',
  '1:1':  '1:1',
  '4:5':  '4:5',
  '5:4':  '5:4',
  '4:3':  '4:3',
  '3:4':  '3:4',
  '2:1':  '16:9',
  '21:9': '16:9',
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  // Either env var works — one Gemini key can call any model.
  const apiKey = process.env.GEMINI_IMAGE_API_KEY || process.env.GEMINI_API_KEY
  if (!apiKey) {
    return res.status(500).json({
      error: 'Gemini API key not configured',
      hint: 'Set GEMINI_IMAGE_API_KEY or GEMINI_API_KEY in Vercel env vars.',
    })
  }

  const { prompt, ratio = '1:1', referenceImages = [] } = req.body || {}
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Prompt required' })
  }

  const model = process.env.GEMINI_IMAGE_MODEL || DEFAULT_MODEL
  const aspectRatio = RATIO_MAP[ratio] || '1:1'

  // Gemini's generateContent expects a parts array — text + any
  // inline reference images (base64). Reference images are how we
  // get identity preservation across views.
  const parts = [{ text: prompt }]
  for (const refUrl of referenceImages.slice(0, 4)) {
    // Caller passes either a data URL or a remote URL. Data URLs we can
    // unpack directly; remote URLs we fetch + base64-encode.
    try {
      let mimeType, base64
      if (refUrl.startsWith('data:')) {
        const match = refUrl.match(/^data:([^;]+);base64,(.+)$/)
        if (!match) continue
        mimeType = match[1]
        base64 = match[2]
      } else {
        const r = await fetch(refUrl)
        if (!r.ok) continue
        mimeType = r.headers.get('content-type') || 'image/png'
        const buf = Buffer.from(await r.arrayBuffer())
        base64 = buf.toString('base64')
      }
      parts.push({ inlineData: { mimeType, data: base64 } })
    } catch {
      // Skip refs we couldn't load — better to generate without them
      // than to fail the whole request.
    }
  }

  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      responseModalities: ['IMAGE'],
      imageConfig: { aspectRatio },
    },
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

  let geminiRes
  try {
    geminiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch (err) {
    return res.status(502).json({ error: 'Gemini fetch failed', detail: String(err?.message || err) })
  }

  const text = await geminiRes.text()
  let data
  try { data = JSON.parse(text) } catch {
    return res.status(502).json({ error: 'Gemini returned non-JSON', detail: text.slice(0, 400) })
  }

  if (!geminiRes.ok) {
    return res.status(geminiRes.status).json({
      error: data?.error?.message || 'Gemini error',
      detail: data,
    })
  }

  // Walk the candidates → parts looking for the first inlineData with
  // an image mime type. Gemini occasionally returns text-only safety
  // refusals; surface those clearly so the user knows.
  const candidates = data?.candidates || []
  let imagePart = null
  let safetyText = null
  for (const c of candidates) {
    for (const p of c?.content?.parts || []) {
      if (p.inlineData?.data && (p.inlineData.mimeType || '').startsWith('image/')) {
        imagePart = p.inlineData
        break
      }
      if (p.text) safetyText = p.text
    }
    if (imagePart) break
  }

  if (!imagePart) {
    return res.status(502).json({
      error: 'No image in Gemini response',
      detail: safetyText || JSON.stringify(data).slice(0, 400),
    })
  }

  const dataUrl = `data:${imagePart.mimeType};base64,${imagePart.data}`
  res.json({ image: dataUrl })
}
