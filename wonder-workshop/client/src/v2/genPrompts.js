// Image-generation PROMPT BUILDERS — pure, dependency-free. Each takes an asset
// record (talent / location / product / mood / frame) and returns the prompt
// string for the image model. Extracted out of imageGen.js (which imports
// client-only code) so the SAME prompt logic can run server-side in the
// generation worker without dragging in localStorage / import.meta. imageGen.js
// re-exports these, so existing client imports are unchanged.

// Character notes from the brief often include expression / pose directions
// ("head-tilted laugh", "smiling warmly", "joyful"). Those get baked into every
// generated image of the character, making the headshot + each frame the same
// awkward pose. Strip them so the reference shots stay neutral.
//
// IMPORTANT: image-gen models are bad at negation — "no smile" often produces a
// smile. So we (a) strip expressive words and (b) stack POSITIVE neutral
// descriptors rather than relying on "NOT laughing".
export function neutralizeCharacterNote(note) {
  if (!note) return "";
  return note
    .replace(/\b(laugh(ing|s|ter|ed)?|smil(ing|es?|ed)|chuckl(ing|es?|ed)|grinn?(ing|s|ed)?|tears?|crying|cried|frown(ing|ed)?|scowl(ing|ed)?|wink(ing|ed|s)?|pout(ing|ed)?|sneer(ing|ed)?|gasp(ing|ed)?)\b/gi, "")
    .replace(/\b(head[- ]?tilt(ed|ing)?|tilt(ing|ed)? (her |his |their )?head|cocked head|head cocked|hand on (hip|chin|face)|arms? crossed|leaning|posed|posing)\b/gi, "")
    .replace(/\b(joyful|joyfully|cheerful|cheerfully|gleeful|gleefully|exuberant|exuberantly|enthusiastic|enthusiastically|playful|playfully|radiant|beaming|bright[- ]?eyed|wide[- ]?eyed|expressive|emotive|animated|dynamic|charismatic|warm[- ]?hearted|spirited|lively|vivacious)\b/gi, "")
    .replace(/\s+,/g, ",")
    .replace(/,\s*,/g, ",")
    .replace(/,\s*\./g, ".")
    .replace(/\s{2,}/g, " ")
    .replace(/^[,\s]+|[,\s]+$/g, "")
    .trim();
}

const NEUTRAL_FACE = "calm composed expression, mouth closed, lips relaxed and neutral, eyes open looking directly at camera, deadpan stoic face, passport-style neutral pose";
const HEADSHOT_FRAMING = "tight head-and-shoulders headshot crop, framed from the upper chest up, close portrait distance so the head and shoulders fill the frame, NOT a full-body or three-quarter or knee-up shot — do not show the waist, legs, or the full outfit";
const REFERENCE_STYLE = "photorealistic studio portrait photograph, neutral seamless gray studio backdrop, soft even diffused lighting, sharp focus, head facing forward squarely toward camera, head level not tilted, full-bleed image filling the entire frame edge to edge, no border, no white frame, no matte, no text, no caption, no label, no watermark";

export function talentPrompt(t) {
  const note = t.note ? `, ${neutralizeCharacterNote(t.note)}` : "";
  return `Photorealistic studio portrait headshot of ${t.name}${note}. ${HEADSHOT_FRAMING}. ${NEUTRAL_FACE}. ${REFERENCE_STYLE}.`;
}

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

const WARDROBE_LOCK = "WARDROBE: wear the exact same complete outfit in every view — identical garments, identical colors, identical fit as described and as shown in the reference image. Do NOT change, recolor, add, remove, or invent different clothing between views; if a top is described or shown, keep that exact same top in all four angles (never switch to shirtless or a different shirt).";

export function talentHeadshotPrompt(t, view) {
  const note = t.note ? `, ${neutralizeCharacterNote(t.note)}` : "";
  const phrase = HEADSHOT_VIEW_PHRASES[view] || HEADSHOT_VIEW_PHRASES.front;
  return `Photorealistic studio portrait of ${t.name}${note}, ${phrase}. ${HEADSHOT_FRAMING}. ${WARDROBE_LOCK} ${NEUTRAL_FACE}. ${REFERENCE_STYLE}.`;
}

export function talentFullBodyPrompt(t, view) {
  const note = t.note ? `, ${neutralizeCharacterNote(t.note)}` : "";
  const phrase = FULLBODY_VIEW_PHRASES[view] || FULLBODY_VIEW_PHRASES.front;
  return `Photorealistic full-body studio portrait of ${t.name}${note}, ${phrase}. ${WARDROBE_LOCK} Calm composed expression, mouth closed, lips relaxed, eyes open, deadpan stoic face. Arms relaxed at sides, neutral upright standing posture, weight evenly distributed, feet shoulder-width apart, no performance gesture. Photorealistic studio portrait photograph, neutral seamless gray backdrop, soft even diffused lighting, full body in frame head to toe, full-bleed image filling the entire frame edge to edge, no border, no white frame, no matte, no text, no caption, no label, no watermark.`;
}

export function locationPrompt(l) {
  const note = l.note ? `, ${l.note}` : "";
  return `Cinematic establishing shot of ${l.name}${note}. Photorealistic location reference, no people in frame, atmospheric lighting, wide composition.`;
}

export function productPrompt(p) {
  const note = p.note ? `, ${p.note}` : "";
  return `Product photography of ${p.name}${note}. Studio lighting, clean neutral background, photorealistic, sharp focus, commercial advertising style.`;
}

export function moodPrompt(text) {
  return `${text}. Cinematic mood reference, evocative atmosphere, photorealistic, no text or watermarks, tone-setting visual.`;
}

const LENS_PROMPT = {
  wide: "shot on a wide-angle lens (~24mm equivalent): broad field of view, expansive framing that takes in more of the environment, mild wide-angle perspective",
  normal: "shot on a normal lens (~50mm equivalent): natural, true-to-the-eye field of view and perspective",
  telephoto: "shot on a telephoto lens (~85mm equivalent): narrow field of view, compressed perspective, subject isolated against a softly blurred background (shallow depth of field)",
};
const ANGLE_PROMPT = {
  front: "",
  "3qR": "the subject viewed from a three-quarter angle (turned slightly so the camera sees them from the front-right)",
  "3qL": "the subject viewed from a three-quarter angle (turned slightly so the camera sees them from the front-left)",
  back: "the subject viewed from behind (back of the subject toward the camera)",
};

export function framePrompt(frame, talent = [], products = []) {
  const description = frame.brief || "";
  const shotType = frame.shotType ? `, ${frame.shotType} framing` : "";
  const camera = frame.camera ? `, ${frame.camera}` : "";
  const lensTxt = frame.lens && LENS_PROMPT[frame.lens] ? `, ${LENS_PROMPT[frame.lens]}` : "";
  const angleTxt = frame.cameraAngle && ANGLE_PROMPT[frame.cameraAngle] ? `, ${ANGLE_PROMPT[frame.cameraAngle]}` : "";
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
  const adherence = " IMPORTANT — use the reference images for IDENTITY ONLY: copy the exact character faces and wardrobe and the exact product packaging/branding. The character and product references are studio cut-outs on plain gray backdrops — IGNORE those backgrounds; they are NOT the setting. The setting of THIS shot is the location described / the location reference image: place every character and product naturally INTO that environment with correct ground contact, realistic human scale, and perspective/lighting that matches the scene. Never output a plain gray or studio backdrop. Keep people physically grounded (feet on the ground unless the action is clearly a jump) and keep props held or resting naturally in someone's hands or on a surface — no floating, levitating, or pasted-on objects, no one hovering unnaturally high. Keep the SAME location across shots; do not substitute a generic place or product.";
  return `${description}${shotType}${camera}${angleTxt}${lensTxt}.${weighting}${elemWeight}${adherence} Cinematic film still, photorealistic, narrative production photography.`;
}
