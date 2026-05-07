export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not set in environment variables' })
  }

  let body = req.body
  if (typeof body === 'string') {
    try { body = JSON.parse(body) } catch { return res.status(400).json({ error: 'Invalid JSON' }) }
  }

  const { messages = [], stream = false } = body ?? {}

  const systemMsg = messages.find(m => m.role === 'system')
  const chatMsgs  = messages.filter(m => m.role !== 'system')

  // Build Gemini contents array
  const contents = chatMsgs.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))

  const payload = {
    contents,
    ...(systemMsg ? { systemInstruction: { parts: [{ text: systemMsg.content }] } } : {}),
    generationConfig: { temperature: 0.9, maxOutputTokens: 8192 },
  }

  const KEY   = process.env.GEMINI_API_KEY
  const MODEL = 'gemini-2.5-flash-preview-04-17'
  const BASE  = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}`

  try {
    if (stream) {
      const url    = `${BASE}:streamGenerateContent?alt=sse&key=${KEY}`
      const gemRes = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })

      if (!gemRes.ok) {
        const err = await gemRes.text()
        return res.status(gemRes.status).json({ error: err })
      }

      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.setHeader('Transfer-Encoding', 'chunked')

      const reader  = gemRes.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const text = decoder.decode(value, { stream: true })
        // SSE lines look like: data: {...}
        for (const line of text.split('\n')) {
          if (!line.startsWith('data: ')) continue
          try {
            const json  = JSON.parse(line.slice(6))
            const token = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
            if (token) res.write(JSON.stringify({ message: { content: token } }) + '\n')
          } catch {}
        }
      }
      res.end()

    } else {
      const url    = `${BASE}:generateContent?key=${KEY}`
      const gemRes = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data   = await gemRes.json()

      if (!gemRes.ok) return res.status(gemRes.status).json({ error: data?.error?.message ?? 'Gemini error' })

      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      res.json({ message: { content: text } })
    }
  } catch (err) {
    console.error('chat error:', err.message)
    if (!res.headersSent) res.status(500).json({ error: err.message })
  }
}
