import { useContext } from 'react'
import EditableText from '../EditableText.jsx'
import ImageSlot from '../ImageSlot.jsx'
import { ProjectContext } from '../../hooks/useProject.js'
import { VIEWS, closeupPrompt, fullbodyPrompt, referencePrompt } from '../../utils/characterPrompts.js'

// Deterministic seed from the bio so each generation tends to land on the
// same character look (Pollinations' seed honors this loosely).
function hashStr(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return Math.abs(h)
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

// One character entity: REFERENCE + NAME + DESCRIPTION on top, then
// Headshots and Full Body 4-grids below. Used both for the primary
// character (brief.character) and any additional characters
// (brief.characters[i]) — the parent passes a setField callback that
// knows how to write back to the correct path.
function CharacterBlock({ character, setField, onRemove, label }) {
  const seed = hashStr((character?.description || '') + (character?.wardrobe || ''))
  const refPrompt = referencePrompt(character)

  return (
    <div className="character-block">
      {onRemove && (
        <div className="character-block-header">
          <span className="character-block-label">{label}</span>
          <button className="character-block-remove" onClick={onRemove} title="Remove this character">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      )}

      {/* Bio: reference image on the left, NAME + DESCRIPTION on the right. */}
      <div className="character-bio">
        <div className="character-bio-reference">
          <div className="character-bio-label">REFERENCE</div>
          <ImageSlot
            label="Reference"
            ratio="1:1"
            seed={seed}
            prompt={refPrompt}
            style={{ width: '100%', aspectRatio: '1/1', borderRadius: 7 }}
          />
          <ReferenceThumbs slotKey={refPrompt} />
        </div>

        <div className="character-bio-text">
          <div className="character-bio-label">NAME</div>
          <EditableText
            tag="p"
            className="character-bio-name"
            value={character?.name}
            onChange={v => setField('name', v)}
            placeholder="Character name…"
          />
          <div className="character-bio-label character-bio-label-desc">DESCRIPTION</div>
          <EditableText
            tag="p"
            className="character-bio-description"
            value={character?.description}
            onChange={v => setField('description', v)}
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
                ratio="3:4"
                prompt={closeupPrompt(character || {}, v)}
                style={{ width: '100%', aspectRatio: '177/268', borderRadius: 7 }}
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
                prompt={fullbodyPrompt(character || {}, v)}
                style={{ width: '100%', aspectRatio: '177/268', borderRadius: 7 }}
              />
              <div className="character-view-caption">{v.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function CharacterDesign({
  primaryCharacter,
  additionalCharacters,
  update,
  addCharacter,
  updateCharacterAt,
  removeCharacterAt,
}) {
  return (
    <div className="character-design">
      {/* Honest disclaimer about the current image generator. We're on
          Pollinations (free, no API key), which is pure text-to-image —
          it invents a new face per generation and can't lock identity
          across views, and follows pose instructions loosely. */}
      <div className="section-limitation-note">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.1"/>
          <path d="M6 5.2v3M6 3.6v.05" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
        <span>
          <strong>Image-generator limits:</strong> the current (free) generator can't lock a face across views, so each headshot / full-body may show a slightly different person, and poses (SIDE, BACK) are followed loosely. Identity-preserving generation is on the roadmap.
        </span>
      </div>

      {/* Primary character — backed by brief.character (the original
          single-character schema). */}
      <CharacterBlock
        character={primaryCharacter}
        setField={(field, value) => update(`character.${field}`, value)}
      />

      {/* Additional characters — backed by brief.characters[i]. */}
      {(additionalCharacters || []).map((c, idx) => (
        <CharacterBlock
          key={idx}
          character={c}
          label={c?.name ? `Character — ${c.name}` : `Character ${idx + 2}`}
          setField={(field, value) => updateCharacterAt?.(idx, field, value)}
          onRemove={() => removeCharacterAt?.(idx)}
        />
      ))}

      {/* Add-character footer bar — same style as other section add bars. */}
      <button className="char-add-row" onClick={addCharacter} type="button">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
        </svg>
        <span>Add character</span>
      </button>
    </div>
  )
}
