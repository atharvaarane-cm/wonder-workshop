// Image generation via Gemini's Nano Banana Pro. Thin route over the shared
// helper (api/_lib/geminiImage.js) — the SAME logic the background generation
// worker uses, so there's no drift between the two.
//
// Contract (unchanged): POST { prompt, ratio?, referenceImages? } → { image: <dataURL> }
// on success, or { error } with a 4xx/5xx status.
import { gate } from './_lib/auth.js'
import { generateGeminiImage } from './_lib/geminiImage.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!(await gate(req, res))) return // auth gate (no-op until cloud env is set)

  const { prompt, ratio = '1:1', referenceImages = [] } = req.body || {}
  try {
    const image = await generateGeminiImage({ prompt, ratio, referenceImages })
    res.json({ image })
  } catch (e) {
    res.status(e?.status || 502).json({ error: e?.message || 'Image generation failed' })
  }
}
