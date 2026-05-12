import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const MODEL = 'claude-haiku-4-5-20251001'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set on the server' })
  }

  const { messages = [], stream = false, tools = [] } = req.body

  const systemMsg = messages.find(m => m.role === 'system')
  const chatMsgs = messages.filter(m => m.role !== 'system')

  // Map OpenAI/Gemini-style roles to Anthropic. Anthropic only has "user" and
  // "assistant"; the system prompt is a top-level parameter.
  const anthropicMessages = chatMsgs.map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content,
  }))

  // Tool definitions arrive in Gemini's shape (parameters); Anthropic wants
  // input_schema. Translate.
  const anthropicTools = tools.map(t => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters,
  }))

  const params = {
    model: MODEL,
    max_tokens: 2048,
    messages: anthropicMessages,
    ...(systemMsg ? { system: systemMsg.content } : {}),
    ...(anthropicTools.length > 0 ? { tools: anthropicTools } : {}),
  }

  try {
    if (stream && anthropicTools.length === 0) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.setHeader('Transfer-Encoding', 'chunked')

      let full = ''
      const streamObj = client.messages.stream(params)
      for await (const event of streamObj) {
        if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
          full += event.delta.text
          res.write(JSON.stringify({ message: { content: full } }) + '\n')
        }
      }
      res.end()
      return
    }

    const response = await client.messages.create(params)

    let text = ''
    const functionCalls = []
    for (const block of response.content) {
      if (block.type === 'text') text += block.text
      else if (block.type === 'tool_use') {
        functionCalls.push({ name: block.name, args: block.input || {} })
      }
    }

    res.json({
      message: { content: text },
      functionCalls,
    })
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ error: err.message })
  }
}
