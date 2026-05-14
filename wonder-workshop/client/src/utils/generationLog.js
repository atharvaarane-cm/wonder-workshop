// In-memory diagnostic log for image generation. Every attempt — success
// or failure — appends one structured entry here so we can see *which
// stage* failed (network / bad HTTP status / no image URL / image didn't
// load) instead of the old behaviour where every failure looked identical.
//
// Surfaced two ways:
//   - the Generation Log modal (a button in the board topbar)
//   - window.__wwGenLog in the console, for power users
//
// Not persisted — it's a within-session diagnostic, cleared on reload.

const LOG = []
const MAX = 300
const listeners = new Set()

export function logGeneration(entry) {
  const full = { ts: new Date().toISOString(), ...entry }
  LOG.push(full)
  if (LOG.length > MAX) LOG.splice(0, LOG.length - MAX)
  if (typeof window !== 'undefined') window.__wwGenLog = LOG
  const tag = full.stage === 'ok' ? 'ok' : 'FAIL'
  // eslint-disable-next-line no-console
  console.debug(`[ww-gen ${tag}]`, full)
  for (const fn of listeners) fn(LOG)
  return full
}

export function getGenerationLog() {
  return LOG
}

export function clearGenerationLog() {
  LOG.length = 0
  for (const fn of listeners) fn(LOG)
}

export function subscribeGenerationLog(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

// Plain-text dump — what the modal's "Copy all" button writes to the
// clipboard. Designed to be pasted straight into a chat for diagnosis.
export function formatGenerationLog() {
  if (!LOG.length) return 'Generation log is empty.'
  return LOG.map(e => {
    const head = [
      e.ts,
      e.stage === 'ok' ? 'OK' : 'FAIL',
      `[${e.section || '?'} / ${e.label || '?'}]`,
      `attempt ${e.attempt}/${e.maxAttempts}`,
      e.stage,
      e.status != null ? `http ${e.status}` : '',
      e.ms != null ? `${e.ms}ms` : '',
    ].filter(Boolean).join('  ')
    let line = head
    if (e.detail) line += `\n    detail: ${e.detail}`
    if (e.imageUrl) line += `\n    url: ${e.imageUrl}`
    if (e.prompt) line += `\n    prompt: ${e.prompt}`
    return line
  }).join('\n')
}
