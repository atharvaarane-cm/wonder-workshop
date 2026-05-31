// Runtime-toggleable image provider. Was build-time only via
// VITE_IMAGE_PROVIDER, but the team wants to flip between Gemini (paid
// preview, identity-preserving) and Pollinations (free, no identity)
// without redeploying — useful for demos where we don't want to burn
// Nano Banana credits.
//
// Precedence at read time:
//   1. localStorage 'ww_image_provider' (user toggle)
//   2. import.meta.env.VITE_IMAGE_PROVIDER (build default)
//   3. 'gemini'

const KEY = 'ww_image_provider'
const EVENT = 'ww-image-provider-change'

export function getImageProvider() {
  try {
    const stored = localStorage.getItem(KEY)
    if (stored === 'gemini' || stored === 'pollinations') return stored
  } catch {}
  const env = (import.meta.env.VITE_IMAGE_PROVIDER || 'gemini').toLowerCase()
  return env === 'pollinations' ? 'pollinations' : 'gemini'
}

export function setImageProvider(value) {
  const v = value === 'pollinations' ? 'pollinations' : 'gemini'
  try { localStorage.setItem(KEY, v) } catch {}
  try { window.dispatchEvent(new CustomEvent(EVENT, { detail: { provider: v } })) } catch {}
}

// Hook-friendly subscription — components useEffect into this and
// trigger their own re-render when the user flips the toggle.
export function subscribe(fn) {
  function handler(e) { fn(e.detail?.provider || getImageProvider()) }
  window.addEventListener(EVENT, handler)
  return () => window.removeEventListener(EVENT, handler)
}
