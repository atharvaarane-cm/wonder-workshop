// Server-side Gemini image generation, shared by the /api/image-gemini route AND
// the background generation worker. Pure async: build parts (text + reference
// images) → call Gemini → return a data: URL, or throw an Error with .status.

const DEFAULT_MODEL = 'gemini-3-pro-image-preview';

const RATIO_MAP = {
  '16:9': '16:9', '9:16': '9:16', '1:1': '1:1', '4:5': '4:5',
  '5:4': '5:4', '4:3': '4:3', '3:4': '3:4', '2:1': '16:9', '21:9': '16:9',
};

// SSRF guard for server-fetched reference images: https only, reject loopback /
// private / link-local / metadata hosts.
export function isSafeRemoteImageUrl(raw) {
  let u;
  try { u = new URL(raw); } catch { return false; }
  if (u.protocol !== 'https:') return false;
  const host = u.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) return false;
  if (/^(127\.|10\.|169\.254\.|192\.168\.|0\.)/.test(host)) return false;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;
  if (host === '::1' || host.startsWith('fe80') || host.startsWith('fc') || host.startsWith('fd')) return false;
  return true;
}

function err(message, status) { const e = new Error(message); e.status = status; return e; }

async function refToInlineData(refUrl) {
  if (refUrl.startsWith('data:')) {
    const m = refUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!m) return null;
    return { mimeType: m[1], data: m[2] };
  }
  if (!isSafeRemoteImageUrl(refUrl)) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const r = await fetch(refUrl, { signal: controller.signal });
    if (!r.ok) return null;
    const ct = r.headers.get('content-type') || '';
    if (!ct.startsWith('image/')) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 10 * 1024 * 1024) return null;
    return { mimeType: ct, data: buf.toString('base64') };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Generate one image. Returns a data: URL string. Throws Error(.status) on failure.
// timeoutMs guards a hung Gemini call (worker sets a tighter budget than the client).
export async function generateGeminiImage({ prompt, ratio = '1:1', referenceImages = [], timeoutMs = 90000 }) {
  const apiKey = process.env.GEMINI_IMAGE_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) throw err('Gemini API key not configured', 500);
  if (!prompt || typeof prompt !== 'string') throw err('Prompt required', 400);

  const model = process.env.GEMINI_IMAGE_MODEL || DEFAULT_MODEL;
  const aspectRatio = RATIO_MAP[ratio] || '1:1';

  const parts = [{ text: prompt }];
  for (const refUrl of (referenceImages || []).slice(0, 4)) {
    const inline = await refToInlineData(refUrl);
    if (inline) parts.push({ inlineData: inline });
  }

  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio } },
  };
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let geminiRes;
  try {
    geminiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    if (e?.name === 'AbortError') throw err('Gemini image timed out', 504);
    throw err('Gemini fetch failed: ' + String(e?.message || e), 502);
  } finally {
    clearTimeout(timer);
  }

  const text = await geminiRes.text();
  let data;
  try { data = JSON.parse(text); } catch { throw err('Gemini returned non-JSON', 502); }
  if (!geminiRes.ok) throw err(data?.error?.message || 'Gemini error', geminiRes.status);

  let imagePart = null, safetyText = null;
  for (const c of (data?.candidates || [])) {
    for (const p of (c?.content?.parts || [])) {
      if (p.inlineData?.data && (p.inlineData.mimeType || '').startsWith('image/')) { imagePart = p.inlineData; break; }
      if (p.text) safetyText = p.text;
    }
    if (imagePart) break;
  }
  if (!imagePart) throw err('No image in Gemini response' + (safetyText ? `: ${safetyText.slice(0, 200)}` : ''), 502);

  return `data:${imagePart.mimeType};base64,${imagePart.data}`;
}
