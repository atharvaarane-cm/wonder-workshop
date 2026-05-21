import { useContext, useState } from 'react'
import EditableText from '../EditableText.jsx'
import ImageSlot from '../ImageSlot.jsx'
import ConfirmDialog from '../ConfirmDialog.jsx'
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
function CharacterBlock({ character, setField, onRemove, label, dataIndex, locked }) {
  const project = useContext(ProjectContext)
  const seed = hashStr((character?.description || '') + (character?.wardrobe || ''))
  const refPrompt = referencePrompt(character)

  // Pull the active version of this character's reference image so it
  // can be passed as conditioning to every Headshots / Full Body view.
  // Nano Banana Pro uses inline image inputs to preserve identity
  // across angles — without it, each view comes back as a slightly
  // different person. Pollinations ignores referenceImages, so this is
  // a no-op for that provider.
  const refSlot = project?.images?.[refPrompt]
  const refActive = refSlot?.versions?.[refSlot?.activeVersion ?? 0]
  const referenceImages = refActive?.src ? [refActive.src] : []

  // View order is stored on the character (default = natural VIEWS order)
  // and SHARED between Headshots and Full Body so a reorder in one grid
  // applies to the other — keeps FRONT/SIDE/etc. visually aligned.
  const viewOrder = (character?.viewOrder?.length
    ? character.viewOrder
    : VIEWS.map(v => v.id))
  const orderedViews = viewOrder
    .map(id => VIEWS.find(v => v.id === id))
    .filter(Boolean)
  // Drives the "Generate All" vs "Regenerate All" label below. Looks up
  // each view's current prompt in project.images — best-effort, since a
  // slot whose key froze under an older prompt won't match this lookup.
  // Worst case: button still says "Generate All" but clicking it still
  // works (writes to the frozen key just like before).
  const headshotsHasAny = orderedViews.some(v => {
    const key = closeupPrompt(character || {}, v)
    return !!project?.images?.[key]?.versions?.length
  })
  const fullbodyHasAny = orderedViews.some(v => {
    const key = fullbodyPrompt(character || {}, v)
    return !!project?.images?.[key]?.versions?.length
  })
  // Backfill any missing views (e.g. if VIEWS gets a new entry later, or
  // the stored order is corrupted) so the grid stays complete.
  for (const v of VIEWS) {
    if (!orderedViews.some(o => o.id === v.id)) orderedViews.push(v)
  }
  const [dragOverIdx, setDragOverIdx] = useState(null)
  const [confirmRemove, setConfirmRemove] = useState(false)

  function onViewDragStart(e, idx) {
    // Don't initiate a card-drag from interactive children (buttons,
    // editable text, the ImageSlot's hover-nav). Without this guard,
    // clicking the Expand / Edit prompt / Regenerate / Delete buttons
    // could start a drag instead of firing the click.
    if (e.target.closest('button, input, textarea, [contenteditable="true"], .img-slot-hover-nav, .img-prompt-modal, .img-slot-broken')) {
      e.preventDefault()
      return
    }
    e.dataTransfer.setData('application/x-ww-view-index', String(idx))
    e.dataTransfer.effectAllowed = 'move'
  }
  function onViewDragOver(e, idx) {
    if (!e.dataTransfer.types.includes('application/x-ww-view-index')) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverIdx !== idx) setDragOverIdx(idx)
  }
  function onViewDragLeave() { setDragOverIdx(null) }
  function onViewDrop(e, idx) {
    setDragOverIdx(null)
    const raw = e.dataTransfer.getData('application/x-ww-view-index')
    if (!raw) return
    const fromIdx = parseInt(raw, 10)
    if (Number.isNaN(fromIdx) || fromIdx === idx) return
    e.preventDefault()
    const newOrder = orderedViews.map(v => v.id)
    const [moved] = newOrder.splice(fromIdx, 1)
    newOrder.splice(idx, 0, moved)
    setField('viewOrder', newOrder)
  }

  function toggleCharacterLock() {
    if (dataIndex == null) return
    window.dispatchEvent(new CustomEvent('ww-toggle-character-lock', {
      detail: { characterIndex: dataIndex },
    }))
  }

  return (
    <div
      className={`character-block${locked ? ' character-block-locked' : ''}`}
      data-character-index={dataIndex}
      data-character-locked={locked ? 'true' : undefined}
    >
      <div className="character-block-header">
        {label && <span className="character-block-label">{label}</span>}
        <button
          type="button"
          className={`character-block-lock${locked ? ' active' : ''}`}
          onClick={toggleCharacterLock}
          title={locked
            ? 'Unlock this character — chat edits and Regenerate All will affect this character again.'
            : 'Lock this character — protects every image in this block from regen, even when the chat edits another character.'}
        >
          {locked ? (
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
              <rect x="3" y="7" width="10" height="7.5" rx="1.2" stroke="currentColor" strokeWidth="1.6" fill="currentColor" fillOpacity="0.18"/>
              <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          ) : (
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
              <rect x="3" y="7" width="10" height="7.5" rx="1.2" stroke="currentColor" strokeWidth="1.6"/>
              <path d="M5.5 7V5a2.5 2.5 0 0 1 4.6-1.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          )}
          <span>{locked ? 'UNLOCK CHARACTER' : 'LOCK CHARACTER'}</span>
        </button>
        {onRemove && (
          <button className="character-block-remove" onClick={() => {
            // Only confirm if there's something to lose. Empty additional
            // character slots delete instantly.
            const hasContent = !!(character?.name?.trim() || character?.description?.trim() || character?.wardrobe?.trim())
            if (hasContent) setConfirmRemove(true)
            else onRemove()
          }} title="Remove this character">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </button>
        )}
      </div>
      <ConfirmDialog
        open={confirmRemove}
        title={`Delete ${character?.name?.trim() || 'this character'}?`}
        message="This will remove the character, their reference image, and all generated views."
        confirmLabel="Delete character"
        onConfirm={() => { setConfirmRemove(false); onRemove?.() }}
        onCancel={() => setConfirmRemove(false)}
      />

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

      {/* Headshots — 4-view grid, drag-to-reorder. viewOrder is shared
          with Full Body below so both grids stay aligned. */}
      <div className="character-views-group" data-subgroup="headshot">
        <div className="character-views-header">
          <div className="character-views-label">Headshots</div>
          <button
            type="button"
            className="character-views-populate"
            onClick={() => {
              // Force-regen ALL views in this character's headshot grid.
              // Scoped via characterIndex (so other CharacterBlocks stay
              // untouched) and subgroup (so the Full Body grid doesn't
              // also fire). Slots that are individually locked stay
              // frozen — the regen listener honors slot-level locks.
              window.dispatchEvent(new CustomEvent('ww-regenerate-section', {
                detail: { sectionTitle: 'Character Design', subgroup: 'headshot', characterIndex: dataIndex },
              }))
            }}
            disabled={locked}
            title={locked
              ? 'Character is locked — unlock to regenerate'
              : headshotsHasAny
              ? 'Regenerate all 4 headshot views (overwrites existing)'
              : 'Generate all 4 headshot views'}
          >
            <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
              <path d="M9.585.52a.5.5 0 0 1 .226.589L8.144 5.5h3.356a.5.5 0 0 1 .429.756l-5.5 9a.5.5 0 0 1-.846-.522L6.864 10.5H3.5a.5.5 0 0 1-.429-.756l5.5-9a.5.5 0 0 1 .614-.224z"/>
            </svg>
            {headshotsHasAny ? 'Regenerate All' : 'Generate All'}
          </button>
        </div>
        <div className="character-views character-views-4">
          {orderedViews.map((v, idx) => (
            <div
              className={`character-view${dragOverIdx === idx ? ' drag-over' : ''}`}
              key={`hs-${v.id}`}
              draggable
              onDragStart={e => onViewDragStart(e, idx)}
              onDragOver={e => onViewDragOver(e, idx)}
              onDragLeave={onViewDragLeave}
              onDrop={e => onViewDrop(e, idx)}
              title="Drag to reorder views"
            >
              <ImageSlot
                label={v.label}
                seed={seed}
                ratio="3:4"
                disableImageDrag
                priority="secondary"
                referenceImages={referenceImages}
                prompt={closeupPrompt(character || {}, v)}
                style={{ width: '100%', aspectRatio: '177/268', borderRadius: 7 }}
              />
              <div className="character-view-caption">{v.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Full Body — 4-view grid, drag-to-reorder (shares viewOrder). */}
      <div className="character-views-group" data-subgroup="fullbody">
        <div className="character-views-header">
          <div className="character-views-label">Full Body</div>
          <button
            type="button"
            className="character-views-populate"
            onClick={() => {
              // Same scoped regen as the headshots button — this character,
              // full-body grid only.
              window.dispatchEvent(new CustomEvent('ww-regenerate-section', {
                detail: { sectionTitle: 'Character Design', subgroup: 'fullbody', characterIndex: dataIndex },
              }))
            }}
            disabled={locked}
            title={locked
              ? 'Character is locked — unlock to regenerate'
              : fullbodyHasAny
              ? 'Regenerate all 4 full-body views (overwrites existing)'
              : 'Generate all 4 full-body views'}
          >
            <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
              <path d="M9.585.52a.5.5 0 0 1 .226.589L8.144 5.5h3.356a.5.5 0 0 1 .429.756l-5.5 9a.5.5 0 0 1-.846-.522L6.864 10.5H3.5a.5.5 0 0 1-.429-.756l5.5-9a.5.5 0 0 1 .614-.224z"/>
            </svg>
            {fullbodyHasAny ? 'Regenerate All' : 'Generate All'}
          </button>
        </div>
        <div className="character-views character-views-4">
          {orderedViews.map((v, idx) => (
            <div
              className={`character-view${dragOverIdx === idx ? ' drag-over' : ''}`}
              key={`fb-${v.id}`}
              draggable
              onDragStart={e => onViewDragStart(e, idx)}
              onDragOver={e => onViewDragOver(e, idx)}
              onDragLeave={onViewDragLeave}
              onDrop={e => onViewDrop(e, idx)}
              title="Drag to reorder views"
            >
              <ImageSlot
                label={v.label}
                seed={seed}
                ratio="3:4"
                disableImageDrag
                priority="secondary"
                referenceImages={referenceImages}
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

function isCharacterPopulated(c) {
  if (!c) return false
  return !!(c.name?.trim() || c.description?.trim() || c.wardrobe?.trim())
}

export default function CharacterDesign({
  primaryCharacter,
  additionalCharacters,
  characterLocks,
  update,
  addCharacter,
  updateCharacterAt,
  removeCharacterAt,
}) {
  const locks = characterLocks || {}
  const hasPrimary = isCharacterPopulated(primaryCharacter)
  const additional = additionalCharacters || []
  // Empty state per Ed's UX feedback: when no character is populated
  // yet, show ONLY the "Add character" affordance — don't render an
  // empty Reference / Headshots / Full Body skeleton.
  if (!hasPrimary && additional.length === 0) {
    return (
      <div className="character-design">
        <button className="char-add-row" onClick={addCharacter} type="button">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
          <span>Add character</span>
        </button>
      </div>
    )
  }

  return (
    <div className="character-design">
      {/* Primary character — backed by brief.character. Only rendered
          once populated (or once user has clicked Add character). */}
      {hasPrimary && (
        <CharacterBlock
          character={primaryCharacter}
          setField={(field, value) => update(`character.${field}`, value)}
          dataIndex="primary"
          locked={!!locks.primary}
        />
      )}

      {/* Additional characters — backed by brief.characters[i]. */}
      {additional.map((c, idx) => (
        <CharacterBlock
          key={idx}
          character={c}
          label={c?.name ? `Character — ${c.name}` : `Character ${idx + 2}`}
          setField={(field, value) => updateCharacterAt?.(idx, field, value)}
          onRemove={() => removeCharacterAt?.(idx)}
          dataIndex={String(idx)}
          locked={!!locks[String(idx)]}
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
