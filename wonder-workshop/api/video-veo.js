// Veo video route. One endpoint, three actions (so the client can do the whole
// async dance with auth on every hop — the file stream goes through fetch() so
// the Supabase token is attached, keeping the Gemini key server-side):
//   POST                       -> start a job        -> { operation }
//   GET ?op=<name>             -> poll               -> { done } | { done:true, ready:true }
//   GET ?op=<name>&file=1      -> stream the mp4 (when ready)
import { gate } from './_lib/auth.js'
import { startVeoVideo, pollVeoVideo, downloadVeoVideo } from './_lib/veoVideo.js'

export default async function handler(req, res) {
  if (!(await gate(req, res))) return // auth gate (no-op until cloud env is set)
  try {
    if (req.method === 'POST') {
      const { prompt, image, aspectRatio, resolution, durationSeconds } = req.body || {}
      const operation = await startVeoVideo({ prompt, image, aspectRatio, resolution, durationSeconds })
      return res.json({ operation })
    }

    if (req.method === 'GET') {
      const op = req.query?.op
      if (!op) return res.status(400).json({ error: 'op required' })

      if (req.query?.file) {
        const status = await pollVeoVideo(op)
        if (!status.done) return res.status(409).json({ error: 'video not ready' })
        const { contentType, buffer } = await downloadVeoVideo(status.uri)
        res.setHeader('Content-Type', contentType)
        res.setHeader('Content-Length', buffer.length)
        res.setHeader('Cache-Control', 'private, max-age=3600')
        return res.end(buffer)
      }

      const status = await pollVeoVideo(op)
      return res.json(status.done ? { done: true, ready: true } : { done: false })
    }

    return res.status(405).end()
  } catch (e) {
    res.status(e?.status || 502).json({ error: e?.message || 'Veo error' })
  }
}
