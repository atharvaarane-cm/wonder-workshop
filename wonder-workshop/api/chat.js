import { GoogleGenerativeAI } from '@google/generative-ai'

// One Gemini API key can call any Gemini model (text + image), so we
// accept either env var and fall back. Means setting just one of the
// two on Vercel is enough to unlock the whole app.
const apiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_IMAGE_API_KEY
const genAI = new GoogleGenerativeAI(apiKey)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { messages = [], stream = false, tools = [] } = req.body

  // Separate system instruction from chat messages
  const systemMsg = messages.find(m => m.role === 'system')
  const chatMsgs  = messages.filter(m => m.role !== 'system')

  // Convert to Gemini history format (all but last message). Gemini
  // requires the history to START with a 'user' role, so drop any
  // leading assistant messages (the AgentPanel seeds the chat with an
  // opening agent line that persists to localStorage — if not stripped,
  // Gemini returns "First content should be with role 'user'").
  let rawHistory = chatMsgs.slice(0, -1)
  while (rawHistory.length && rawHistory[0].role === 'assistant') {
    rawHistory = rawHistory.slice(1)
  }
  const history = rawHistory.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))
  const lastMsg = chatMsgs[chatMsgs.length - 1]?.content ?? ''

  const modelConfig = {
    model: process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash',
    ...(systemMsg ? { systemInstruction: systemMsg.content } : {}),
  }
  // Tool calling forces non-streaming. Streaming function-call responses are
  // more complex than the marginal UX win is worth for our use case.
  if (tools.length > 0) {
    modelConfig.tools = [{ functionDeclarations: tools }]
  }

  const model = genAI.getGenerativeModel(modelConfig)

  try {
    if (stream && tools.length === 0) {
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
      const response = result.response
      const text   = response.text()
      const functionCalls = (typeof response.functionCalls === 'function')
        ? (response.functionCalls() || [])
        : []
      res.json({
        message: { content: text },
        actions: functionCalls.map(c => ({ name: c.name, arguments: c.args || {} })),
        functionCalls,
      })
    }
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ error: err.message })
  }
}
