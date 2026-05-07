export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: 'GROQ_API_KEY not set in environment variables' })
  }

  let body = req.body
  if (typeof body === 'string') {
    try { body = JSON.parse(body) } catch { return res.status(400).json({ error: 'Invalid JSON' }) }
  }

  const { messages = [] } = body ?? {}

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages,
        temperature: 0.9,
        max_tokens: 8192,
      }),
    })

    const data = await groqRes.json()
    if (!groqRes.ok) return res.status(groqRes.status).json({ error: data?.error?.message ?? 'Groq error' })

    const text = data?.choices?.[0]?.message?.content ?? ''
    res.json({ message: { content: text } })
  } catch (err) {
    console.error('chat error:', err.message)
    if (!res.headersSent) res.status(500).json({ error: err.message })
  }
}
