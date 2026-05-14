import { useContext } from 'react'
import EditableText from '../EditableText.jsx'
import ImageSlot from '../ImageSlot.jsx'
import { ProjectContext } from '../../hooks/useProject.js'

// Deterministic seed from the bio so each generation tends to land on the
// same character look (Pollinations' seed honors this loosely).
function hashStr(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

// 4-view rig per the May 13 mockup — FRONT / SIDE / 3/4 ANGLE / BACK.
// Pollinations ignores subtle pose language, so each angle is described
// bluntly and redundantly to actually land the pose.
const VIEWS = [
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

function closeupPrompt(data, view) {
  return `${data.description}, ${data.wardrobe}, close-up portrait, head and shoulders, ${view.closeup}, sharp face detail, studio lighting, clean white background, headshot`
}
function fullbodyPrompt(data, view) {
  return `${data.description}, ${data.wardrobe}, ${view.fullbody}, full body shot head to toe, white studio background, professional photography, character reference sheet`
}
function referencePrompt(data) {
  // The reference image — frontal close-up so it doubles as the "main"
  // face shot. Same prompt the FRONT headshot uses so versions show up
  // consistently in the variant thumbnails below.
  return `${data?.description || ''}, ${data?.wardrobe || ''}, close-up portrait, head and shoulders, facing directly forward, front view, full face visible, sharp face detail, studio lighting, clean white background, headshot`
}

// Small clickable thumbnails of every version of the reference image —
// matches the variant strip under the main portrait in the mockup.
function ReferenceThumbs({ slotKey }) {
  const project = useContext(ProjectContext)
  const slot = slotKey ? project?.images?.[slotKey] : null
  const versions = slot?.versions || []
  const activeVersion = slot?.activeVersion ?? 0
  if (versions.length < 2) return null
  const others = versions.map((v, i) => ({ v, i })).filter(({ i }) => i !== activeVersion)
  return (
    <div className="char-ref-thumbs">
      {others.slice(0, 3).map(({ v, i }) => (
        <button
          key={(v.src || '') + i}
          className="char-ref-thumb"
          title={`Switch to version ${i + 1}`}
          onClick={e => {
            e.stopPropagation()
            window.dispatchEvent(new CustomEvent('ww-set-active-version', {
              detail: { slotKey, versionIndex: i },
            }))
          }}
        >
          <img src={v.src} alt={`Reference variant ${i + 1}`} />
        </button>
      ))}
    </div>
  )
}

export default function CharacterDesign({ data, update }) {
  const seed = hashStr((data?.description || '') + (data?.wardrobe || ''))
  const refPrompt = referencePrompt(data)

  return (
    <div className="character-design">
      {/* Bio: reference image on the left, NAME + DESCRIPTION on the right. */}
      <div className="character-bio">
        <div className="character-bio-reference">
          <div className="character-bio-label">REFERENCE</div>
          <ImageSlot
            label="Reference"
            ratio="1:1"
            seed={seed}
            prompt={refPrompt}
            style={{ width: '100%', aspectRatio: '1/1', borderRadius: 10 }}
          />
          <ReferenceThumbs slotKey={refPrompt} />
        </div>

        <div className="character-bio-text">
          <div className="character-bio-label">NAME</div>
          <EditableText
            tag="p"
            className="character-bio-name"
            value={data?.name}
            onChange={v => update('character.name', v)}
            placeholder="Character name…"
          />
          <div className="character-bio-label character-bio-label-desc">DESCRIPTION</div>
          <EditableText
            tag="p"
            className="character-bio-description"
            value={data?.description}
            onChange={v => update('character.description', v)}
            placeholder="Character description…"
          />
        </div>
      </div>

      {/* Headshots — 4-view grid */}
      <div className="character-views-group">
        <div className="character-views-label">Headshots</div>
        <div className="character-views character-views-4">
          {VIEWS.map(v => (
            <div className="character-view" key={`hs-${v.id}`}>
              <ImageSlot
                label={v.label}
                seed={seed}
                ratio="4:5"
                prompt={closeupPrompt(data || {}, v)}
                style={{ width: '100%', aspectRatio: '4/5', borderRadius: 10 }}
              />
              <div className="character-view-caption">{v.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Full Body — 4-view grid */}
      <div className="character-views-group">
        <div className="character-views-label">Full Body</div>
        <div className="character-views character-views-4">
          {VIEWS.map(v => (
            <div className="character-view" key={`fb-${v.id}`}>
              <ImageSlot
                label={v.label}
                seed={seed}
                ratio="3:4"
                prompt={fullbodyPrompt(data || {}, v)}
                style={{ width: '100%', aspectRatio: '3/4', borderRadius: 10 }}
              />
              <div className="character-view-caption">{v.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
