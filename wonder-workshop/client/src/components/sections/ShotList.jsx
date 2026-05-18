import { useContext, useEffect, useRef, useState } from 'react'
import EditableText from '../EditableText.jsx'
import ImageSlot from '../ImageSlot.jsx'
import MentionInput from '../MentionInput.jsx'
import ConfirmDialog from '../ConfirmDialog.jsx'
import { ProjectContext } from '../../hooks/useProject.js'
import { expandMentions, getMentionHandles } from '../../utils/mentions.js'

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Split a shot description into a sequence of {type:'text'|'mention'}
// tokens so @handles can render as styled, clickable spans. Matches
// against the brief's known handles only — unknown @-tokens stay as
// plain text.
function tokenizeDescription(text, handles) {
  if (!text) return []
  if (!handles.length) return [{ type: 'text', value: text }]
  const sorted = [...handles].sort((a, b) => b.key.length - a.key.length)
  const pattern = sorted.map(h => `@${escapeRe(h.key)}(?![A-Za-z0-9_])`).join('|')
  const re = new RegExp(`(${pattern})`, 'gi')
  const parts = text.split(re)
  const tokens = []
  for (const part of parts) {
    if (!part) continue
    if (part.startsWith('@')) {
      const handle = handles.find(h => '@' + h.key.toLowerCase() === part.toLowerCase())
      if (handle) {
        tokens.push({ type: 'mention', handle, raw: part })
        continue
      }
    }
    tokens.push({ type: 'text', value: part })
  }
  return tokens
}

// Click-to-edit description for a storyboard shot. When idle, renders
// the description with @handles as colored, clickable pills (clicking
// jumps to the referenced section). When clicked, swaps in the
// MentionInput textarea for editing. Click outside to commit + return
// to the display.
function ShotDescription({ value, onChange, brief, placeholder, onJumpToHandle }) {
  const [editing, setEditing] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!editing) return
    function onDocClick(e) {
      if (wrapRef.current?.contains(e.target)) return
      // Also keep editing open if the click is inside the mention
      // autocomplete dropdown (which lives in MentionInput).
      if (e.target.closest?.('.mention-dropdown')) return
      setEditing(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [editing])

  if (editing) {
    return (
      <div className="shot-desc-wrap" ref={wrapRef}>
        <MentionInput
          className="shot-desc"
          value={value}
          onChange={onChange}
          brief={brief}
          rows={3}
          placeholder={placeholder}
          autoFocus
        />
      </div>
    )
  }

  if (!value) {
    return (
      <div className="shot-desc-display empty" onClick={() => setEditing(true)}>
        {placeholder}
      </div>
    )
  }

  const handles = getMentionHandles(brief)
  const tokens = tokenizeDescription(value, handles)

  return (
    <div className="shot-desc-display" onClick={() => setEditing(true)}>
      {tokens.map((t, i) =>
        t.type === 'mention' ? (
          <button
            key={i}
            type="button"
            className={`shot-mention shot-mention-${t.handle.kind}`}
            onClick={e => {
              e.stopPropagation()
              onJumpToHandle?.(t.handle)
            }}
            title={`Jump to ${t.handle.kind === 'character' ? 'Character Design' : t.handle.kind === 'location' ? 'Locations' : 'Product / Elements'}`}
          >
            {t.raw}
          </button>
        ) : (
          <span key={i}>{t.value}</span>
        ),
      )}
    </div>
  )
}

export default function ShotList({ data, updateShot, addShot, removeShot, reorderShots, brief, onJumpToHandle }) {
  // Storyboard frames follow the project's output ratio — a 4:5 project
  // shouldn't show 16:9 shots. CSS aspect-ratio takes "4/5", so swap the colon.
  const ratio = brief?.generationSettings?.ratio || '16:9'
  const aspectCss = ratio.replace(':', '/')
  const [dragOverIdx, setDragOverIdx] = useState(null)
  // Shot indices pending confirmation before delete. Skipped (delete
  // happens immediately) when the shot has no description or image yet.
  const project = useContext(ProjectContext)
  const [confirmRemoveIdx, setConfirmRemoveIdx] = useState(null)

  function shotHasContent(shot) {
    if (!shot) return false
    if (shot.description?.trim()) return true
    // Image exists if project.images has at least one version for this slot.
    const expanded = expandMentions(shot.description, brief)
    const slotKey = `${expanded}, ${shot.framing} shot, ${shot.camera} camera, cinematic film still`
    const versions = project?.images?.[slotKey]?.versions
    return !!versions?.length
  }
  function requestRemoveShot(i) {
    if (!shotHasContent(data?.[i])) { removeShot(i); return }
    setConfirmRemoveIdx(i)
  }
  function confirmRemove() {
    const idx = confirmRemoveIdx
    setConfirmRemoveIdx(null)
    if (idx != null) removeShot(idx)
  }

  function onShotDragStart(e, idx) {
    // Don't initiate a card-drag when the user clicks into an interactive
    // child — text editing (.editable-text), the remove button, or any
    // form control inside the card. Those should still respond normally.
    if (e.target.closest('.editable-text, .shot-description, .shot-remove-btn, .shot-expanded-note, button, input, textarea, [contenteditable="true"]')) {
      e.preventDefault()
      return
    }
    e.dataTransfer.setData('application/x-ww-shot-index', String(idx))
    e.dataTransfer.effectAllowed = 'move'
  }
  function onShotCellDragOver(e, idx) {
    if (!e.dataTransfer.types.includes('application/x-ww-shot-index')) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverIdx(idx)
  }
  function onShotCellDragLeave() {
    setDragOverIdx(null)
  }
  function onShotCellDrop(e, idx) {
    setDragOverIdx(null)
    const raw = e.dataTransfer.getData('application/x-ww-shot-index')
    if (!raw) return
    const fromIdx = parseInt(raw, 10)
    if (Number.isNaN(fromIdx) || fromIdx === idx) return
    e.preventDefault()
    reorderShots?.(fromIdx, idx)
  }

  return (
    <div className="shot-grid">
      {(data || []).map((shot, i) => {
        // @Sarah / @Sunset Beach in the description get swapped for the
        // character/location's full description before we build the prompt.
        // If the user hasn't used any @handles, the description is sent as-is.
        const expandedDescription = expandMentions(shot.description, brief)
        const prompt = `${expandedDescription}, ${shot.framing} shot, ${shot.camera} camera, cinematic film still`
        // The generator gets the expanded text, not what the writer typed —
        // surface that so it's never a silent rewrite.
        const wasExpanded = expandedDescription !== (shot.description || '')
        return (
        <div
          className={`shot-cell${dragOverIdx === i ? ' drag-over' : ''}`}
          key={shot.id || shot.num}
          draggable
          onDragStart={e => onShotDragStart(e, i)}
          onDragOver={e => onShotCellDragOver(e, i)}
          onDragLeave={onShotCellDragLeave}
          onDrop={e => onShotCellDrop(e, i)}
          title="Drag this card to reorder shots"
        >

          {/* Image with overlaid badges */}
          <div className="shot-img-wrap" style={{ aspectRatio: aspectCss }}>
            <ImageSlot
              prompt={prompt}
              ratio={ratio}
              disableImageDrag
              style={{ width: '100%', height: '100%', borderRadius: 8 }}
            />
            <span className="shot-badge-num">
              {String(shot.num).padStart(2, '0')}
            </span>
            <span className="shot-badge-framing">{shot.framing}</span>
            <button
              className="shot-remove-btn"
              onClick={() => requestRemoveShot(i)}
              title="Remove this shot"
            >
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          {/* Info below image */}
          <div className="shot-info">
            <ShotDescription
              value={shot.description || ''}
              onChange={v => updateShot(i, 'description', v)}
              brief={brief}
              placeholder="Describe this shot — use @Sarah or @Sunset Beach to reference named entities…"
              onJumpToHandle={onJumpToHandle}
            />
            {wasExpanded && (
              <div
                className="shot-expanded-note"
                title={`Sent to the image generator:\n\n${expandedDescription}`}
              >
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                  <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.1"/>
                  <path d="M6 5.2v3M6 3.6v.05" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
                <span>@mentions are expanded to full descriptions on generate</span>
              </div>
            )}
            <div className="shot-meta-row">
              <EditableText className="shot-cam" value={shot.camera} onChange={v => updateShot(i, 'camera', v)} />
              <EditableText className="shot-dur" value={shot.duration} onChange={v => updateShot(i, 'duration', v)} />
            </div>
          </div>

        </div>
        )
      })}
      <div className="shot-cell shot-cell-add">
        <button
          className="shot-add-cell"
          style={{ aspectRatio: aspectCss }}
          onClick={addShot}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          <span>Add shot</span>
        </button>
      </div>
      <ConfirmDialog
        open={confirmRemoveIdx != null}
        title={`Delete shot ${confirmRemoveIdx != null ? data?.[confirmRemoveIdx]?.num : ''}?`}
        message="This shot has content. The image and description will be removed."
        confirmLabel="Delete shot"
        onConfirm={confirmRemove}
        onCancel={() => setConfirmRemoveIdx(null)}
      />
    </div>
  )
}
