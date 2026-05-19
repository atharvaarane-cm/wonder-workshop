// Diagnostic endpoint — confirms whether new API files deploy at all.
// If this returns 404 on production, the Vercel project's function
// detection is broken / cached / pointed at the wrong root.

export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    deployed_at: new Date().toISOString(),
    commit: process.env.VERCEL_GIT_COMMIT_SHA || 'unknown',
    message: 'If you can read this on wonder-workshop-eight.vercel.app/api/ping, new API files deploy correctly.',
  })
}
