import ImageSlot from '../ImageSlot.jsx'

const VIEWS = [
  { id: 'FRONT', label: 'FRONT', promptFragment: 'front facing, full body, white studio background, editorial fashion photography' },
  { id: '3/4',   label: '3/4',   promptFragment: 'three quarter view, dynamic pose, editorial photography, studio lighting' },
  { id: 'SIDE',  label: 'SIDE',  promptFragment: 'side profile, clean editorial photography, minimal background' },
]

export default function CharRef({ data }) {
  const base = `${data?.description ?? 'professional talent'}`
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
      {VIEWS.map(v => (
        <div key={v.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <ImageSlot
            view={v.id}
            prompt={`${base}, ${v.promptFragment}`}
            style={{ width: '100%', aspectRatio: '3/4', borderRadius: 10 }}
          />
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textAlign: 'center', color: 'var(--muted)' }}>{v.label}</span>
        </div>
      ))}
    </div>
  )
}
