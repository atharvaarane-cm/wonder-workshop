export default function EditableText({ value, onChange, className, tag: Tag = 'span', placeholder = 'Click to edit' }) {
  return (
    <Tag
      className={`editable ${className || ''}`}
      contentEditable
      suppressContentEditableWarning
      onBlur={e => onChange?.(e.currentTarget.innerText.trim())}
      dangerouslySetInnerHTML={{ __html: value || '' }}
      data-placeholder={placeholder}
    />
  )
}
