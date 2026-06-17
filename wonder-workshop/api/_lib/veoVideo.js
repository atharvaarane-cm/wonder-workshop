// Server-side Veo (Google) video generation via the Gemini API — the same
// generativelanguage.googleapis.com surface + key Workshop already uses for
// images. Video is a LONG-RUNNING op: start → poll → download. Helpers only;
// the route (api/video-veo.js) wires them to start/poll/file requests.

const DEFAULT_VEO_MODEL = process.env.VEO_MODEL || 'veo-3.1-generate-preview';
const BASE = 'https://generativelanguage.googleapis.com/v1beta';

function err(message, status) { const e = new Error(message); e.status = status; return e; }

function apiKey() {
  const k = process.env.GEMINI_VIDEO_API_KEY || process.env.GEMINI_API_KEY || process.env.GEMINI_IMAGE_API_KEY;
  if (!k) throw err('Gemini API key not configured', 500);
  return k;
}

function parseDataUrl(dataUrl) {
  const m = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/);
  if (!m) throw err('Image must be a base64 data URL', 400);
  return { mimeType: m[1], data: m[2] };
}

// Kick off an image-to-video (or text-to-video) job. Returns the operation name.
export async function startVeoVideo({ prompt, image, aspectRatio = '16:9', resolution = '720p', durationSeconds = '8' }) {
  const key = apiKey();
  if (!prompt && !image) throw err('Prompt or image required', 400);

  const instance = {};
  if (prompt) instance.prompt = prompt;
  if (image) {
    const { mimeType, data } = parseDataUrl(image);
    instance.image = { inlineData: { mimeType, data } };
  }
  const body = {
    instances: [instance],
    parameters: { aspectRatio, resolution, durationSeconds: String(durationSeconds) },
  };

  const r = await fetch(`${BASE}/models/${DEFAULT_VEO_MODEL}:predictLongRunning`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let data; try { data = JSON.parse(text); } catch { throw err('Veo returned non-JSON', 502); }
  if (!r.ok) throw err(data?.error?.message || 'Veo start failed', r.status);
  if (!data?.name) throw err('Veo did not return an operation name', 502);
  return data.name;
}

// Poll a job. { done:false } while running; { done:true, uri } when ready.
export async function pollVeoVideo(operationName) {
  const key = apiKey();
  if (!operationName) throw err('operation required', 400);
  const r = await fetch(`${BASE}/${operationName}`, { headers: { 'x-goog-api-key': key } });
  const text = await r.text();
  let data; try { data = JSON.parse(text); } catch { throw err('Veo returned non-JSON', 502); }
  if (!r.ok) throw err(data?.error?.message || 'Veo poll failed', r.status);
  if (!data.done) return { done: false };
  if (data.error) throw err(data.error.message || 'Veo generation failed', 502);
  const uri = data?.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
  if (!uri) throw err('Veo finished but returned no video', 502);
  return { done: true, uri };
}

// Download the finished video server-side (the uri needs the API key). Host-locked
// to google to avoid being turned into an open proxy.
const ALLOWED_VIDEO_HOST = /(^|\.)googleapis\.com$/;
export async function downloadVeoVideo(uri) {
  const key = apiKey();
  let u; try { u = new URL(uri); } catch { throw err('bad video uri', 400); }
  if (u.protocol !== 'https:' || !ALLOWED_VIDEO_HOST.test(u.hostname)) {
    throw err('refusing to fetch non-google video uri', 400);
  }
  const r = await fetch(uri, { headers: { 'x-goog-api-key': key } });
  if (!r.ok) throw err('Veo file download failed', r.status);
  return { contentType: r.headers.get('content-type') || 'video/mp4', buffer: Buffer.from(await r.arrayBuffer()) };
}
