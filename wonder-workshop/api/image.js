export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { prompt, width = 896, height = 512, seed } = req.body || {}
  if (!prompt) return res.status(400).json({ error: 'Prompt required' })

  // Pollinations.ai takes 60–90s for a non-trivial prompt, which is past
  // Vercel's serverless function limit (10s Hobby / 60s Pro). Returning the
  // URL instead of fetching + base64-wrapping it lets the function exit
  // immediately and shifts the long load to the browser, which has no
  // timeout. The client treats data.image as <img src> either way.
  //
  // enhance=false is intentional: with enhance=true Pollinations runs the
  // prompt through its own enhancer LLM, which paraphrases the prompt and
  // often drops user-specific details. Our brief prompts are already detailed
  // (and users editing per-image prompts expect literal adherence), so we
  // skip the enhancer.
  const resolvedSeed = seed ?? Date.now()
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${width}&height=${height}&nologo=true&enhance=false&seed=${resolvedSeed}`
  res.json({ image: url })
}
