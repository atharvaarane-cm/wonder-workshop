import { GoogleGenerativeAI } from '@google/generative-ai'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured in Vercel environment variables' })
  }

  // Vercel may not auto-parse body — handle both string and object
  let body = req.body
  if (typeof body === 'string') {
    try { body = JSON.parse(body) } catch { return res.status(400).json({ error: 'Invalid JSON body' }) }
  }

  const { messages = [], stream = false } = body ?? {}

  const systemMsg = messages.find(m => m.role === 'system')
  const chatMsgs  = messages.filter(m => m.role !== 'system')
  const history   = chatMsgs.slice(0, -1).map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))
  const lastMsg = chatMsgs[chatMsgs.length - 1]?.content ?? ''

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    ...(systemMsg ? { systemInstruction: systemMsg.content } : {}),
  })

  try {
    if (stream) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.setHeader('Transfer-Encoding', 'chunked')
      const result = await model.startChat({ history }).sendMessageStream(lastMsg)
      for await (const chunk of result.stream) {
        const token = chunk.text()
        if (token) res.write(JSON.stringify({ message: { content: token } }) + '\n')
      }
      res.end()
    } else {
      const result = await model.startChat({ history }).sendMessage(lastMsg)
      res.json({ message: { content: result.response.text() } })
    }
  } catch (err) {
    console.error('Gemini error:', err.message)
    if (!res.headersSent) res.status(500).json({ error: err.message })
  }
}
