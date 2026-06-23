// Image generation bridge — calls /api/image-gemini (default) or
// /api/image (Pollinations fallback). Returns the generated image URL.
// Used by v2's auto-generation pipeline after a brief is created, and
// later by per-asset regenerate buttons.

import { getImageProvider } from "../utils/imageProvider.js";

const RATIO_DIMS = {
  "16:9": { width: 896, height: 504 },
  "9:16": { width: 504, height: 896 },
  "1:1":  { width: 768, height: 768 },
  "4:5":  { width: 640, height: 800 },
  "4:3":  { width: 896, height: 672 },
  "2.39": { width: 1024, height: 428 },
};

// Hard cap on a single image generation. Gemini Nano Banana Pro
// typically returns within 10-30s; if we're past 90s something is
// stuck (rate-limit retry storm, Vercel cold-start chain, etc) and
// the user shouldn't see the tile shimmer indefinitely. Without
// this, a failed fetch could hang the promise forever and the
// caller's status flag would stay at "generating" until reload —
// which is exactly the bug that stranded Maya during kickoff.
const GENERATE_IMAGE_TIMEOUT_MS = 90_000;

// Turn a raw server status + body into a short, human message. The
// backend surfaces Gemini's raw JSON (safety blocks, quota errors, 5xx)
// which is useless and scary in a toast — map the common cases to plain
// language so callers can show e.message directly.
function friendlyImageError(status, body = "") {
  const b = String(body).toLowerCase();
  if (status === 429 || /quota|rate.?limit|exceeded|too many|resource.?exhausted/.test(b)) {
    return "Image generation is rate-limited right now (quota reached). Wait a moment and try again.";
  }
  if (/image_safety|safety|blocked|prohibited|policy/.test(b)) {
    return "That image was blocked by the content safety filter. Try rephrasing the description.";
  }
  if (status === 504 || /timed out|timeout|deadline/.test(b)) {
    return "The image service timed out. Try again in a moment.";
  }
  if (/no image/.test(b)) {
    return "The image service returned no image (often a safety block). Try rephrasing or generate again.";
  }
  if (status >= 500) {
    return "The image service hit a problem. Try again in a moment.";
  }
  return "Couldn't generate the image. Try again.";
}

export async function generateImage(prompt, opts = {}) {
  const { ratio = "16:9", referenceImages = [], provider = getImageProvider() } = opts;
  const dims = RATIO_DIMS[ratio] || RATIO_DIMS["16:9"];

  async function requestImage(activeProvider) {
    const endpoint = activeProvider === "gemini" ? "/api/image-gemini" : "/api/image";
    const payload = activeProvider === "gemini"
      ? {
          prompt,
          ratio,
          ...(referenceImages.length ? { referenceImages: referenceImages.slice(0, 8) } : {}),
        }
      : { prompt, ...dims };

    // 90s per-request timeout (prod's Maya fix) wrapped around Court's
    // per-provider request helper, so a hung fetch throws 504 instead of
    // stranding the caller's status at "generating".
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GENERATE_IMAGE_TIMEOUT_MS);
    let res;
    try {
      res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timeoutId);
      if (err?.name === "AbortError") {
        const e = new Error("The image service timed out. Try again in a moment.");
        e.status = 504;
        e.raw = `timeout after ${GENERATE_IMAGE_TIMEOUT_MS / 1000}s`;
        throw e;
      }
      throw err;
    }
    clearTimeout(timeoutId);

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const e = new Error(friendlyImageError(res.status, body));
      e.status = res.status;
      e.raw = body;
      throw e;
    }

    const data = await res.json();
    if (!data.image) throw new Error(friendlyImageError(200, "No image in response"));
    return data.image;
  }

  return requestImage(provider);
}

// Prompt builders now live in genPrompts.js (pure + dependency-free so the
// server-side generation worker can use the SAME prompts). Re-exported here so
// existing imports from imageGen.js keep working unchanged.
export {
  neutralizeCharacterNote,
  talentPrompt,
  talentHeadshotPrompt,
  talentFullBodyPrompt,
  locationPrompt,
  productPrompt,
  moodPrompt,
  framePrompt,
} from "./genPrompts.js";

// Upscale — Nano Banana Pro supports image conditioning, so "upscale" is
// regenerate-with-this-image-as-reference + an enhance prompt. Stays here
// because it calls generateImage (a client fetch). Only works on Gemini.
export async function upscaleImage(sourceUrl, targetRes = "4k", ratio = "1:1") {
  const label = String(targetRes).toUpperCase();
  const prompt = `Upscaled to ${label} resolution, enhanced sharpness, preserve every detail and composition exactly, photorealistic high resolution.`;
  return generateImage(prompt, { ratio, referenceImages: [sourceUrl] });
}

