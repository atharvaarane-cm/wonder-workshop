import { useEffect } from 'react'

// Generic confirmation modal — backdrop + centered card with title,
// message, Cancel, and Confirm buttons. Esc cancels; click outside
// the card cancels; clicking Confirm fires onConfirm and closes.
//
// Used for destructive actions (delete a character / shot / product /
// image) when the target has content the user might not want to lose.
export default function ConfirmDialog({
  open,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  destructive = true,
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    if (!open) return
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); onCancel?.() }
      else if (e.key === 'Enter') { e.preventDefault(); onConfirm?.() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onCancel, onConfirm])

  if (!open) return null

  return (
    <div
      className="ww-confirm-backdrop"
      onClick={onCancel}
      onMouseDown={e => e.stopPropagation()}
    >
      <div
        className="ww-confirm-modal"
        onClick={e => e.stopPropagation()}
      >
        <div className="ww-confirm-title">{title}</div>
        {message && <div className="ww-confirm-body">{message}</div>}
        <div className="ww-confirm-actions">
          <button className="ww-confirm-cancel" onClick={onCancel}>{cancelLabel}</button>
          <button
            className={`ww-confirm-primary${destructive ? ' ww-confirm-destructive' : ''}`}
            onClick={onConfirm}
            autoFocus
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
