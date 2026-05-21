// Shared character-image prompt builders. The Character section AND
// the one-pager export both need to construct identical prompt strings
// so they look up the same generated images in project.images
// (slotKey = prompt). Keeping the logic in one place prevents drift.
//
// Each VIEWS entry has separate closeup and fullbody pose phrasings —
// Pollinations doesn't reliably honor terse pose terms, so each angle
// is described bluntly and redundantly to actually land.

export const VIEWS = [
  {
    id: 'FRONT', label: 'FRONT',
    closeup: 'looking straight at the camera, perfectly symmetrical front-facing view, full face centered and visible',
    fullbody: 'standing and facing the camera straight on, symmetrical front view, arms relaxed at sides',
  },
  {
    id: 'SIDE', label: 'SIDE',
    closeup: 'strict side profile, head turned a full 90 degrees so only the side of the face is visible, mugshot profile shot, gaze pointed straight ahead in profile, ear and jawline visible, NOT looking at the camera',
    fullbody: 'full side profile, entire body rotated 90 degrees to face left, standing straight, only the side of the body visible',
  },
  {
    id: '3/4', label: '3/4 ANGLE',
    closeup: 'three-quarter portrait, head and shoulders rotated about 45 degrees away from the camera, both eyes visible but face clearly angled, classic 3/4 angle',
    fullbody: 'three-quarter body view, whole body turned about 45 degrees away from the camera, standing naturally',
  },
  {
    id: 'BACK', label: 'BACK',
    closeup: 'viewed from directly behind, back of the head and hair fills the frame, face completely hidden, head facing the same direction as the body, natural unturned neck',
    fullbody: 'viewed from directly behind, full back of the body and head visible, face not visible at all, head and body both facing away from the camera, natural posture',
  },
]

// Suppression appended to every character-reference prompt. The reference
// grids are meant to be CLEAN identity sheets — face / hair / skin tone /
// body type — used as conditioning for storyboard shots later. We strip
// branded clothing and props here for two reasons:
// 1. Pollinations / flux can't render text reliably, so "Pepsi sweatshirt"
//    in the description came back with garbled fake-Pepsi text.
// 2. The reference should isolate the character so storyboard shots can
//    place them in any scene without baked-in props bleeding through.
const CLEAN_REFERENCE_SUFFIX = 'plain neutral solid-color t-shirt, no text on clothing, no logos, no brand graphics, no writing visible anywhere, no jewelry, no accessories, no props, no background objects, isolated subject'

export function closeupPrompt(data, view) {
  return `${data?.description || ''}, close-up portrait, head and shoulders, ${view.closeup}, sharp face detail, studio lighting, clean seamless white background, headshot, ${CLEAN_REFERENCE_SUFFIX}`
}

export function fullbodyPrompt(data, view) {
  return `${data?.description || ''}, ${view.fullbody}, full body shot head to toe, seamless white studio background, professional photography, character reference sheet, ${CLEAN_REFERENCE_SUFFIX}`
}

export function referencePrompt(data) {
  return `${data?.description || ''}, close-up portrait, head and shoulders, facing directly forward, front view, full face visible, sharp face detail, studio lighting, clean seamless white background, headshot, ${CLEAN_REFERENCE_SUFFIX}`
}
