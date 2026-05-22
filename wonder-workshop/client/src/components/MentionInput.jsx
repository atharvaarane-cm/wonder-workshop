import { useContext, useEffect, useRef, useState } from 'react'
import { ProjectContext } from '../hooks/useProject.js'
import { getMentionHandles } from '../utils/mentions.js'

// Textarea (or single-line input) with `@mention` autocomplete.
// Surfaces the brief's named handles (Character, Location) as a dropdown
// when the user types `@`. Selecting a handle inserts `@Name ` at the
// cursor and closes the dropdown. Arrow/Enter/Tab/Esc all behave the way
// Slack / Linear / GitHub trained people to expect.
export default function MentionInput({
  value = '',
  onChange,
  onKeyDown: externalKeyDown,
  placeholder,
  className = '',
  rows = 2,
  brief: briefProp,
  multiline = true,
  // Where the autocomplete dropdown opens relative to the input. 'bottom'
  // (default) anchors below — fine when there's room. 'top' flips it
  // above — needed for the chat input which sits at the bottom of the
  // panel and clips the dropdown.
  placement = 'bottom',
  ...rest
}) {
  const project = useContext(ProjectContext)
  const brief = briefProp ?? project?.brief
  // Alphabetical by label so the dropdown reads predictably regardless
  // of the order the entities appear in the brief.
  const handles = getMentionHandles(brief)
    .slice()
    .sort((a, b) => a.label.localeCompare(b.label))

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef(null)

  const filtered = handles.filter(h =>
    !query || h.key.toLowerCase().includes(query.toLowerCase()),
  )

  function handleChange(e) {
    const next = e.target.value
    onChange?.(next)
    const cursor = e.target.selectionStart
    const before = next.slice(0, cursor)
    // Match `@word-with-spaces` at the very end of the slice. We allow
    // letters / digits / spaces / dashes inside the partial since handle
    // names like "Sunset Beach" have spaces.
    const m = before.match(/@([A-Za-z0-9][A-Za-z0-9 _-]*)?$/)
    if (m) {
      setQuery(m[1] || '')
      setSelected(0)
      setOpen(true)
    } else {
      setOpen(false)
    }
  }

  function pickHandle(handle) {
    const el = inputRef.current
    if (!el) return
    const cursor = el.selectionStart
    const before = value.slice(0, cursor)
    const after = value.slice(cursor)
    const replaced = before.replace(/@([A-Za-z0-9][A-Za-z0-9 _-]*)?$/, `@${handle.key} `)
    const nextValue = replaced + after
    onChange?.(nextValue)
    setOpen(false)
    // Move caret to the end of the inserted handle + trailing space.
    setTimeout(() => {
      if (!inputRef.current) return
      const caret = replaced.length
      inputRef.current.setSelectionRange(caret, caret)
      inputRef.current.focus()
    }, 0)
  }

  function handleKeyDown(e) {
    // Autocomplete navigation when dropdown is open. We intercept first
    // and only forward the event to the caller's onKeyDown if we didn't
    // already consume it (e.g., Enter to insert a suggestion shouldn't
    // also submit the form).
    if (open && filtered.length) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelected(s => (s + 1) % filtered.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelected(s => (s - 1 + filtered.length) % filtered.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        pickHandle(filtered[selected])
        return
      }
      if (e.key === 'Escape') {
        setOpen(false)
        return
      }
    }
    // Dropdown wasn't open (or filter was empty) — forward the keydown to
    // the caller (e.g. chat panel's Enter-to-send handler).
    externalKeyDown?.(e)
  }

  // Hide dropdown when user clicks outside.
  useEffect(() => {
    if (!open) return
    function onDocClick(e) {
      if (e.target.closest('.mention-input-wrap')) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  const Field = multiline ? 'textarea' : 'input'

  return (
    <div className="mention-input-wrap">
      <Field
        ref={inputRef}
        className={`mention-input ${className}`}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={multiline ? rows : undefined}
        {...rest}
      />
      {open && filtered.length > 0 && (
        <div className={`mention-dropdown placement-${placement}`} role="listbox">
          <div className="mention-dropdown-label">Mention</div>
          {filtered.map((h, i) => (
            <button
              key={h.key + h.kind}
              role="option"
              aria-selected={i === selected}
              className={`mention-item${i === selected ? ' selected' : ''}`}
              onMouseDown={e => { e.preventDefault(); pickHandle(h) }}
              onMouseEnter={() => setSelected(i)}
            >
              <span className={`mention-item-kind kind-${h.kind}`}>
                {h.kind === 'character' ? 'TALENT'
                  : h.kind === 'location' ? 'LOCATION'
                  : h.kind === 'product' ? 'ELEMENT'
                  : String(h.kind || '').toUpperCase()}
              </span>
              <span className="mention-item-name">{h.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
