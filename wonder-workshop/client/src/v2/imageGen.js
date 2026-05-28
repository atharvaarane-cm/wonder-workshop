// Image generation bridge — calls /api/image-gemini (default) or
// /api/image (Pollinations fallback). Returns the generated image URL.
// Used by v2's auto-generation pipeline after a brief is created, and
// later by per-asset regenerate buttons.

const RATIO_DIMS = {
  "16:9": { width: 896, height: 504 },
  "9:16": { width: 504, height: 896 },
  "1:1":  { width: 768, height: 768 },
  "4:5":  { width: 640, height: 800 },
  "4:3":  { width: 896, height: 672 },
  "2.39": { width: 1024, height: 428 },
};

export async function generateImage(prompt, opts = {}) {
  const { ratio = "16:9", referenceImages = [], provider = "gemini" } = opts;
  const endpoint = provider === "gemini" ? "/api/image-gemini" : "/api/image";
  const dims = RATIO_DIMS[ratio] || RATIO_DIMS["16:9"];
  const payload = provider === "gemini"
    ? {
        prompt,
        ratio,
        ...(referenceImages.length ? { referenceImages: referenceImages.slice(0, 4) } : {}),
      }
    : { prompt, ...dims };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

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

// Prompt builders — tuned to make consistent, production-reference-
// quality images for each asset type. Each builder takes the asset
// record and returns a prompt string ready for generateImage().

export function talentPrompt(t) {
  const note = t.note ? `, ${t.note}` : "";
  return `Cinematic character portrait headshot of ${t.name}${note}. Photorealistic, neutral seamless studio background, soft natural lighting, professional photography, sharp focus on subject.`;
}

export function locationPrompt(l) {
  const note = l.note ? `, ${l.note}` : "";
  return `Cinematic establishing shot of ${l.name}${note}. Photorealistic location reference, no people in frame, atmospheric lighting, wide composition.`;
}

export function productPrompt(p) {
  const note = p.note ? `, ${p.note}` : "";
  return `Product photography of ${p.name}${note}. Studio lighting, clean neutral background, photorealistic, sharp focus, commercial advertising style.`;
}

export function framePrompt(frame) {
  const description = frame.brief || "";
  const shotType = frame.shotType ? `, ${frame.shotType} framing` : "";
  const camera = frame.camera ? `, ${frame.camera}` : "";
  return `${description}${shotType}${camera}. Cinematic film still, photorealistic, narrative production photography.`;
}
