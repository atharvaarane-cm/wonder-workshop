export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { prompt, width = 896, height = 512 } = req.body

  try {
    const encoded = encodeURIComponent(prompt)
    const url = `https://image.pollinations.ai/prompt/${encoded}?width=${width}&height=${height}&nologo=true&enhance=true&seed=${Date.now()}`

    const imgRes = await fetch(url)
    if (!imgRes.ok) return res.status(imgRes.status).json({ error: 'Image generation failed' })

    const buffer = await imgRes.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    res.json({ image: `data:image/jpeg;base64,${base64}` })
  } catch (err) {
    res.status(503).json({ error: err.message })
  }
}
