const sleep = ms => new Promise(r => setTimeout(r, ms))

async function callGemini(url, payload, retries = 3) {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (res.status === 429 && i < retries - 1) {
      await sleep(6000 * (i + 1)) // 6s, 12s, 18s
      continue
    }
    return res
  }
}

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

  const contents = chatMsgs.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))

  const payload = {
    contents,
    ...(systemMsg ? { systemInstruction: { parts: [{ text: systemMsg.content }] } } : {}),
    generationConfig: { temperature: 0.9, maxOutputTokens: 8192 },
  }

  const KEY  = process.env.GEMINI_API_KEY
  const BASE = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash`

  try {
    if (stream) {
      const gemRes = await callGemini(`${BASE}:streamGenerateContent?alt=sse&key=${KEY}`, payload)
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
      const gemRes = await callGemini(`${BASE}:generateContent?key=${KEY}`, payload)
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
