import ImageSlot from '../ImageSlot.jsx'

export default function CharRef({ data }) {
  const base = `${data?.description ?? 'professional talent'}`
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <ImageSlot
          prompt={`${base}, front facing, full body, white studio background, editorial fashion photography`}
          style={{ width: '100%', aspectRatio: '3/4', borderRadius: 10 }}
        />
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textAlign: 'center', color: 'var(--muted)' }}>FRONT</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <ImageSlot
          prompt={`${base}, three quarter view, dynamic pose, editorial photography, studio lighting`}
          style={{ width: '100%', aspectRatio: '3/4', borderRadius: 10 }}
        />
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textAlign: 'center', color: 'var(--muted)' }}>3/4</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <ImageSlot
          prompt={`${base}, side profile, clean editorial photography, minimal background`}
          style={{ width: '100%', aspectRatio: '3/4', borderRadius: 10 }}
        />
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textAlign: 'center', color: 'var(--muted)' }}>SIDE</span>
      </div>
    </div>
  )
}
