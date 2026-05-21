import { useContext, useState } from 'react'
import EditableText from '../EditableText.jsx'
import ImageSlot from '../ImageSlot.jsx'
import ConfirmDialog from '../ConfirmDialog.jsx'
import { ProjectContext } from '../../hooks/useProject.js'

// One mood-board tile: image slot + editable caption + remove button.
// Caption seeds the generation prompt — typing "warm golden hour pool"
// builds a slot that generates that, with brand/description context
// folded in.
function MoodItem({ item, idx, creative, onUpdate, onRemove }) {
  const project = useContext(ProjectContext)
  const caption = (item.caption || '').trim()
  const brand = creative?.brand || ''
  const description = creative?.description || ''
  // Stable slot key based on item.id so uploads/generations persist
  // across reorder/delete. Prompt text is descriptive enough for the
  // generator to produce something useful when there's no caption.
  const prompt = caption
    ? `${caption}, ${brand} ${description}, mood board reference, cinematic aesthetic, editorial`
    : `mood-board:${item.id}`
  // Confirm before destroying populated tiles. Empty placeholder
  // tiles delete instantly.
  const [confirmRemove, setConfirmRemove] = useState(false)
  const versions = project?.images?.[prompt]?.versions
  const hasContent = !!(caption || versions?.length)

  return (
    <div className="mb-item">
      <button
        className="mb-item-remove"
        onClick={() => hasContent ? setConfirmRemove(true) : onRemove()}
        title="Remove this mood reference"
      >
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
          <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
        </svg>
      </button>
      <ImageSlot
        ratio="16:9"
        slimWhenEmpty
        prompt={prompt}
        slotId={item.id ? `mood.${item.id}` : undefined}
        style={{ width: '100%', aspectRatio: '16/9', borderRadius: 7 }}
      />
      <EditableText
        className="mb-item-caption"
        value={item.caption}
        onChange={v => onUpdate('caption', v)}
        placeholder="Describe this reference — e.g. warm golden hour, dusty palette, editorial vogue style…"
      />
      <ConfirmDialog
        open={confirmRemove}
        title={`Delete ${caption || 'this mood reference'}?`}
        message="The caption and image will be removed."
        confirmLabel="Delete reference"
        onConfirm={() => { setConfirmRemove(false); onRemove() }}
        onCancel={() => setConfirmRemove(false)}
      />
    </div>
  )
}

// Mood Board / Style References — a stack of mood images, each with its
// own caption. Mirrors the multi-location / multi-character pattern so
// users can build out a treatment-style mood reel.
export default function MoodBoard({ items = [], creative, addMoodItem, updateMoodItemAt, removeMoodItemAt }) {
  return (
    <div className="mb-list">
      {items.map((item, idx) => (
        <MoodItem
          key={item.id || idx}
          item={item}
          idx={idx}
          creative={creative}
          onUpdate={(field, value) => updateMoodItemAt?.(idx, field, value)}
          onRemove={() => removeMoodItemAt?.(idx)}
        />
      ))}
      <button className="mb-add-row" onClick={addMoodItem} type="button">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
        </svg>
        <span>Add mood reference</span>
      </button>
    </div>
  )
}
