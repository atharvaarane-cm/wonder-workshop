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

export async function generateImage(prompt, opts = {}) {
  const { ratio = "16:9", referenceImages = [], provider = getImageProvider() } = opts;
  const dims = RATIO_DIMS[ratio] || RATIO_DIMS["16:9"];

  async function requestImage(activeProvider) {
    const endpoint = activeProvider === "gemini" ? "/api/image-gemini" : "/api/image";
    const payload = activeProvider === "gemini"
      ? {
          prompt,
          ratio,
          ...(referenceImages.length ? { referenceImages: referenceImages.slice(0, 4) } : {}),
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
        const e = new Error(`Image gen timed out after ${GENERATE_IMAGE_TIMEOUT_MS / 1000}s`);
        e.status = 504;
        throw e;
      }
      throw err;
    }
    clearTimeout(timeoutId);

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const e = new Error(`Image gen failed (${res.status})${body ? `: ${body.slice(0, 120)}` : ""}`);
      e.status = res.status;
      throw e;
    }

    const data = await res.json();
    if (!data.image) throw new Error("Image gen returned no image URL");
    return data.image;
  }

  return requestImage(provider);
}

// Prompt builders — tuned to make consistent, production-reference-
// quality images for each asset type. Each builder takes the asset
// record and returns a prompt string ready for generateImage().

// Character notes from the brief often include expression / pose
// directions ("head-tilted laugh", "smiling warmly", "joyful"). Those
// then get baked into every generated image of the character, which
// makes the headshot + each storyboard frame all look like the same
// awkward laughing pose. Strip those out so the reference shots stay
// neutral — the storyboard frames can still direct expression per-shot
// via the frame's own brief.
//
// IMPORTANT: image-gen models (Nano Banana, SDXL, etc.) are
// notoriously bad at negation — saying "no smile" often produces a
// smile. So we both (a) strip expressive words from the note, and (b)
// stack POSITIVE neutral descriptors in the prompt rather than relying
// on "NOT laughing".
function neutralizeCharacterNote(note) {
  if (!note) return "";
  return note
    // Expressions of emotion
    .replace(/\b(laugh(ing|s|ter|ed)?|smil(ing|es?|ed)|chuckl(ing|es?|ed)|grinn?(ing|s|ed)?|tears?|crying|cried|frown(ing|ed)?|scowl(ing|ed)?|wink(ing|ed|s)?|pout(ing|ed)?|sneer(ing|ed)?|gasp(ing|ed)?)\b/gi, "")
    // Pose / staging cues
    .replace(/\b(head[- ]?tilt(ed|ing)?|tilt(ing|ed)? (her |his |their )?head|cocked head|head cocked|hand on (hip|chin|face)|arms? crossed|leaning|posed|posing)\b/gi, "")
    // Mood adjectives that bias toward joyful performance
    .replace(/\b(joyful|joyfully|cheerful|cheerfully|gleeful|gleefully|exuberant|exuberantly|enthusiastic|enthusiastically|playful|playfully|radiant|beaming|bright[- ]?eyed|wide[- ]?eyed|expressive|emotive|animated|dynamic|charismatic|warm[- ]?hearted|spirited|lively|vivacious)\b/gi, "")
    // Tidy up punctuation
    .replace(/\s+,/g, ",")
    .replace(/,\s*,/g, ",")
    .replace(/,\s*\./g, ".")
    .replace(/\s{2,}/g, " ")
    .replace(/^[,\s]+|[,\s]+$/g, "")
    .trim();
}

// POSITIVE neutral descriptors — stacked because image models respond
// to repetition. We never use "no smile / not laughing" — that
// actively summons smiles in most diffusion models.
const NEUTRAL_FACE = "calm composed expression, mouth closed, lips relaxed and neutral, eyes open looking directly at camera, deadpan stoic face, passport-style neutral pose";
const REFERENCE_STYLE = "photorealistic studio reference photograph, neutral seamless gray studio backdrop, soft even diffused reference lighting, sharp focus, head facing forward squarely toward camera, head level not tilted, casting reference for production";

export function talentPrompt(t) {
  const note = t.note ? `, ${neutralizeCharacterNote(t.note)}` : "";
  return `Character casting reference headshot of ${t.name}${note}. ${NEUTRAL_FACE}. ${REFERENCE_STYLE}.`;
}

// View-specific prompts for the 4-up Headshots and Full Body grids in
// the character detail view. Matches v1's FRONT / SIDE / 3-4 ANGLE /
// BACK taxonomy. Reference image (the character's primary headshot)
// should be passed via opts.referenceImages so all four views look
// like the same person.
const HEADSHOT_VIEW_PHRASES = {
  front: "front-facing headshot, looking directly at camera",
  side: "left side profile headshot, 90 degree side view",
  threeQuarter: "three-quarter angle headshot, 45 degree turn",
  back: "back-of-head view, subject facing away from camera",
};
const FULLBODY_VIEW_PHRASES = {
  front: "front-facing full body shot, standing pose, head to toe",
  side: "left side profile full body shot, standing pose",
  threeQuarter: "three-quarter angle full body shot, 45 degree turn",
  back: "back-facing full body shot, subject facing away from camera",
};

export function talentHeadshotPrompt(t, view) {
  const note = t.note ? `, ${neutralizeCharacterNote(t.note)}` : "";
  const phrase = HEADSHOT_VIEW_PHRASES[view] || HEADSHOT_VIEW_PHRASES.front;
  return `Character casting reference headshot of ${t.name}${note}, ${phrase}. ${NEUTRAL_FACE}. ${REFERENCE_STYLE}.`;
}

export function talentFullBodyPrompt(t, view) {
  const note = t.note ? `, ${neutralizeCharacterNote(t.note)}` : "";
  const phrase = FULLBODY_VIEW_PHRASES[view] || FULLBODY_VIEW_PHRASES.front;
  return `Character casting reference full body shot of ${t.name}${note}, ${phrase}. Calm composed expression, mouth closed, lips relaxed, eyes open, deadpan stoic face. Arms relaxed at sides, neutral upright standing posture, weight evenly distributed, feet shoulder-width apart, no performance gesture. Photorealistic studio reference photograph, neutral seamless gray backdrop, soft even diffused reference lighting, full body in frame head to toe, casting reference for production.`;
}

export function locationPrompt(l) {
  const note = l.note ? `, ${l.note}` : "";
  return `Cinematic establishing shot of ${l.name}${note}. Photorealistic location reference, no people in frame, atmospheric lighting, wide composition.`;
}

export function productPrompt(p) {
  const note = p.note ? `, ${p.note}` : "";
  return `Product photography of ${p.name}${note}. Studio lighting, clean neutral background, photorealistic, sharp focus, commercial advertising style.`;
}

// Upscale — Nano Banana Pro supports image conditioning, so "upscale"
// is regenerate-with-this-image-as-reference + an explicit enhance
// prompt. Result is appended (or replaces) the slot's image. Only
// works on Gemini; Pollinations doesn't support image conditioning.
export async function upscaleImage(sourceUrl, targetRes = "4k", ratio = "1:1") {
  const label = String(targetRes).toUpperCase();
  const prompt = `Upscaled to ${label} resolution, enhanced sharpness, preserve every detail and composition exactly, photorealistic high resolution.`;
  return generateImage(prompt, { ratio, referenceImages: [sourceUrl] });
}

export function moodPrompt(text) {
  return `${text}. Cinematic mood reference, evocative atmosphere, photorealistic, no text or watermarks, tone-setting visual.`;
}

export function framePrompt(frame) {
  const description = frame.brief || "";
  const shotType = frame.shotType ? `, ${frame.shotType} framing` : "";
  const camera = frame.camera ? `, ${frame.camera}` : "";
  return `${description}${shotType}${camera}. Cinematic film still, photorealistic, narrative production photography.`;
}
