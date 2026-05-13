import EditableText from '../EditableText.jsx'
import ImageSlot from '../ImageSlot.jsx'

// Deterministic seed from the bio so each generation tends to land on the
// same character look (Pollinations' seed honors this loosely).
function hashStr(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

const VIEWS = [
  { id: 'FRONT', label: 'FRONT', angle: 'facing directly forward, front view' },
  { id: '3/4',   label: '3/4',   angle: 'three-quarter view, angled 45 degrees left' },
  { id: 'SIDE',  label: 'SIDE',  angle: 'strict side profile, facing right' },
]

// Prompts must match the strings the previous Character.jsx (modes 'fullbody'
// and 'closeup') sent — they're the slotKey for persistence, so existing
// projects' versions still hydrate from localStorage in the right slot.
function closeupPrompt(data, view) {
  return `${data.description}, ${data.wardrobe}, close-up portrait, head and shoulders, ${view.angle}, sharp face detail, studio lighting, clean white background, headshot`
}
function fullbodyPrompt(data, view) {
  return `${data.description}, ${data.wardrobe}, full body, standing, ${view.angle}, full body shot, white studio background, professional photography, character reference sheet`
}

export default function CharacterDesign({ data, update }) {
  const seed = hashStr((data?.description || '') + (data?.wardrobe || ''))

  // Bio portrait: small headshot beside the name + description, per mockup.
  // Uses the same FRONT close-up prompt as the Headshots row so the
  // portrait stays consistent with the rest of the character refs.
  const portraitPrompt = `${data?.description || ''}, ${data?.wardrobe || ''}, close-up portrait, head and shoulders, facing directly forward, front view, sharp face detail, studio lighting, clean white background, headshot`

  return (
    <div className="character-design">
      {/* Bio */}
      <div className="character-bio">
        <div className="character-bio-portrait">
          <ImageSlot
            label="Portrait"
            view="FRONT"
            seed={seed}
            ratio="1:1"
            prompt={portraitPrompt}
            style={{ width: '100%', aspectRatio: '1/1', borderRadius: 10 }}
          />
        </div>
        <div className="character-bio-text">
          <div className="character-bio-label">BIO</div>
          <EditableText
            tag="p"
            className="character-bio-name"
            value={data?.name}
            onChange={v => update('character.name', v)}
            placeholder="Character name…"
          />
          <EditableText
            tag="p"
            className="character-bio-description"
            value={data?.description}
            onChange={v => update('character.description', v)}
            placeholder="Character description…"
          />
          <p className="character-bio-wardrobe">
            <strong>Wardrobe: </strong>
            <EditableText
              value={data?.wardrobe}
              onChange={v => update('character.wardrobe', v)}
              placeholder="Wardrobe details…"
            />
          </p>
        </div>
      </div>

      {/* Headshots */}
      <div className="character-views-group">
        <div className="character-views-label">Headshots</div>
        <div className="character-views">
          {VIEWS.map(v => (
            <div className="character-view" key={`hs-${v.id}`}>
              <ImageSlot
                label={v.label}
                view={v.id}
                seed={seed}
                ratio="4:5"
                prompt={closeupPrompt(data || {}, v)}
                style={{ width: '100%', aspectRatio: '4/5', borderRadius: 10 }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Full Body */}
      <div className="character-views-group">
        <div className="character-views-label">Full Body</div>
        <div className="character-views">
          {VIEWS.map(v => (
            <div className="character-view" key={`fb-${v.id}`}>
              <ImageSlot
                label={v.label}
                view={v.id}
                seed={seed}
                ratio="3:4"
                prompt={fullbodyPrompt(data || {}, v)}
                style={{ width: '100%', aspectRatio: '3/4', borderRadius: 10 }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
