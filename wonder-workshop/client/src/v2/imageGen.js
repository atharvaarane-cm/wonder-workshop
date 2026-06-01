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
// Force a consistent TIGHT headshot crop. Without this the model frames
// wardrobe-heavy characters (a dress, a patterned shirt) as full- or
// three-quarter-body and you "see too much of them" — the crop should be
// the same head-and-shoulders distance for every character.
const HEADSHOT_FRAMING = "tight head-and-shoulders headshot crop, framed from the upper chest up, close portrait distance so the head and shoulders fill the frame, NOT a full-body or three-quarter or knee-up shot — do not show the waist, legs, or the full outfit";
// IMPORTANT: never say "casting reference" / "reference card" in the
// prompt — image models render that literally as a white photo frame
// with a "NAME · CASTING REFERENCE" caption (looks like an actor's
// headshot card). We want a clean, full-bleed studio portrait, so we
// describe the look directly and explicitly forbid any frame/border/text.
const REFERENCE_STYLE = "photorealistic studio portrait photograph, neutral seamless gray studio backdrop, soft even diffused lighting, sharp focus, head facing forward squarely toward camera, head level not tilted, full-bleed image filling the entire frame edge to edge, no border, no white frame, no matte, no text, no caption, no label, no watermark";

export function talentPrompt(t) {
  const note = t.note ? `, ${neutralizeCharacterNote(t.note)}` : "";
  return `Photorealistic studio portrait headshot of ${t.name}${note}. ${HEADSHOT_FRAMING}. ${NEUTRAL_FACE}. ${REFERENCE_STYLE}.`;
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
  return `Photorealistic studio portrait of ${t.name}${note}, ${phrase}. ${HEADSHOT_FRAMING}. ${NEUTRAL_FACE}. ${REFERENCE_STYLE}.`;
}

export function talentFullBodyPrompt(t, view) {
  const note = t.note ? `, ${neutralizeCharacterNote(t.note)}` : "";
  const phrase = FULLBODY_VIEW_PHRASES[view] || FULLBODY_VIEW_PHRASES.front;
  return `Photorealistic full-body studio portrait of ${t.name}${note}, ${phrase}. Calm composed expression, mouth closed, lips relaxed, eyes open, deadpan stoic face. Arms relaxed at sides, neutral upright standing posture, weight evenly distributed, feet shoulder-width apart, no performance gesture. Photorealistic studio portrait photograph, neutral seamless gray backdrop, soft even diffused lighting, full body in frame head to toe, full-bleed image filling the entire frame edge to edge, no border, no white frame, no matte, no text, no caption, no label, no watermark.`;
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

export function framePrompt(frame, talent = [], products = []) {
  const description = frame.brief || "";
  const shotType = frame.shotType ? `, ${frame.shotType} framing` : "";
  const camera = frame.camera ? `, ${frame.camera}` : "";
  // Weight referenced characters by role so the composition reflects who
  // matters: Leads get focal prominence, Extras stay background. Supporting
  // characters get no special clause (neutral). Only added when the frame
  // actually references talent we can resolve a role for.
  let weighting = "";
  const refd = (frame.talentIds || []).map(id => (talent || []).find(t => t.id === id)).filter(Boolean);
  if (refd.length) {
    const leads = refd.filter(t => /lead/i.test(t.role || "")).map(t => t.name);
    const extras = refd.filter(t => /extra/i.test(t.role || "")).map(t => t.name);
    const parts = [];
    if (leads.length) parts.push(`${leads.join(" and ")} ${leads.length === 1 ? "is the lead — primary focus" : "are the leads — primary focus"}, foreground, sharp and well-lit`);
    if (extras.length) parts.push(`${extras.join(" and ")} ${extras.length === 1 ? "is an extra" : "are extras"} — incidental background presence, not a focal point`);
    if (parts.length) weighting = ` Character emphasis: ${parts.join("; ")}.`;
  }
  // Weight referenced elements/props by FOCUS level (High = feature it,
  // Low = supporting; Medium = neutral). Same idea as character roles.
  let elemWeight = "";
  const refdP = (frame.productIds || []).map(id => (products || []).find(p => p.id === id)).filter(Boolean);
  if (refdP.length) {
    const high = refdP.filter(p => /high/i.test(p.focus || "")).map(p => p.name);
    const low = refdP.filter(p => /low/i.test(p.focus || "")).map(p => p.name);
    const parts = [];
    if (high.length) parts.push(`${high.join(" and ")} ${high.length === 1 ? "is the hero element — feature it prominently, very visible, sharp and well-lit (a close-up that showcases it is welcome)" : "are the hero elements — feature them prominently and very visibly"}`);
    if (low.length) parts.push(`${low.join(" and ")} ${low.length === 1 ? "is a supporting element — present in the scene but not featured" : "are supporting elements — present but not featured"}`);
    if (parts.length) elemWeight = ` Element emphasis: ${parts.join("; ")}.`;
  }
  // Reference adherence — the call attaches reference images for the
  // characters, location, and products. The model tends to drift (a beach
  // becomes a park, the branded can becomes a generic one), so instruct it to
  // MATCH those references exactly and keep the same setting across shots.
  const adherence = " IMPORTANT: match the provided reference images exactly — the same character faces and wardrobe, the SAME location/setting (do not change the environment — if the reference is a beach, stay on that beach), and the exact product packaging/branding shown. Do not invent a different place or substitute generic products.";
  return `${description}${shotType}${camera}.${weighting}${elemWeight}${adherence} Cinematic film still, photorealistic, narrative production photography.`;
}
