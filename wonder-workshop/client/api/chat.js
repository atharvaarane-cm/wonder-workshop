import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { messages = [], stream = false } = req.body

  // Separate system instruction from chat messages
  const systemMsg = messages.find(m => m.role === 'system')
  const chatMsgs  = messages.filter(m => m.role !== 'system')

  // Convert to Gemini history format (all but last message)
  const history = chatMsgs.slice(0, -1).map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))
  const lastMsg = chatMsgs[chatMsgs.length - 1]?.content ?? ''

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    ...(systemMsg ? { systemInstruction: systemMsg.content } : {}),
  })

  try {
    if (stream) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.setHeader('Transfer-Encoding', 'chunked')

      const chat   = model.startChat({ history })
      const result = await chat.sendMessageStream(lastMsg)

      for await (const chunk of result.stream) {
        const token = chunk.text()
        if (token) res.write(JSON.stringify({ message: { content: token } }) + '\n')
      }
      res.end()
    } else {
      const chat   = model.startChat({ history })
      const result = await chat.sendMessage(lastMsg)
      const text   = result.response.text()
      res.json({ message: { content: text } })
    }
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ error: err.message })
  }
}
