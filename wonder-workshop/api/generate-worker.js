// Background generation worker — the Vercel CRON target. Each invocation claims
// one pending job and generates a time-boxed batch of its images, resuming on
// the next tick. Returns a small JSON summary.
//
// GUARDED: this spends Gemini budget unattended, so it only runs for callers
// presenting CRON_SECRET (Vercel cron sends `Authorization: Bearer $CRON_SECRET`
// automatically when the env var is set). If CRON_SECRET isn't configured the
// endpoint refuses — it's never an open relay.
import { runWorkerOnce } from './_lib/worker.js';

export const config = { maxDuration: 300 }; // allow long batches (Fluid Compute)

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return res.status(503).json({ error: 'worker disabled: set CRON_SECRET' });
  if ((req.headers.authorization || '') !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  try {
    const result = await runWorkerOnce();
    res.status(result.ok === false ? 500 : 200).json(result);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
}
