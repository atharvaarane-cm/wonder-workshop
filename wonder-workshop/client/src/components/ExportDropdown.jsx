import { useRef, useEffect } from 'react'
import PptxGenJS from 'pptxgenjs'

function downloadJson(brief) {
  const blob = new Blob([JSON.stringify(brief, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${brief?.creativeDirection?.brand || 'wonder'}-brief.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function exportPptx(brief) {
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE'
  pptx.title = brief?.title || 'Wonder Workshop Brief'

  const brand = brief?.creativeDirection?.brand || ''
  const campaign = brief?.projectInfo?.brandCampaignName || ''

  const s1 = pptx.addSlide()
  s1.background = { color: '111111' }
  s1.addText(brand.toUpperCase(), { x: 0.5, y: 1.8, w: 12, h: 1.2, fontSize: 48, bold: true, color: 'FFFFFF', align: 'center' })
  s1.addText(campaign, { x: 0.5, y: 3.2, w: 12, h: 0.6, fontSize: 18, color: 'AAAAAA', align: 'center' })
  const meta = `${brief?.creativeDirection?.format || ''} · ${brief?.creativeDirection?.shots || ''} shots · ${brief?.creativeDirection?.location || ''}`
  s1.addText(meta, { x: 0.5, y: 4.0, w: 12, h: 0.4, fontSize: 12, color: '888888', align: 'center' })

  const s2 = pptx.addSlide()
  s2.background = { color: 'FAFAFA' }
  s2.addText('Creative Direction', { x: 0.5, y: 0.4, w: 12, h: 0.6, fontSize: 22, bold: true, color: '111111' })
  const cd = brief?.creativeDirection || {}
  const cdRows = [['Format', cd.format], ['Duration', cd.duration], ['Shots', cd.shots], ['Location', cd.location]].filter(([, v]) => v)
  cdRows.forEach(([k, v], i) => {
    s2.addText(`${k}:  ${v}`, { x: 0.5, y: 1.2 + i * 0.5, w: 12, h: 0.4, fontSize: 13, color: '333333' })
  })
  if (cd.description) {
    s2.addText(cd.description, { x: 0.5, y: 1.2 + cdRows.length * 0.5 + 0.3, w: 12, h: 1.2, fontSize: 13, color: '555555', italic: true })
  }

  const bi = brief?.brandInfo
  if (bi) {
    const s3 = pptx.addSlide()
    s3.background = { color: 'FAFAFA' }
    s3.addText('Brand Info', { x: 0.5, y: 0.4, w: 12, h: 0.6, fontSize: 22, bold: true, color: '111111' });
    (bi.colors || []).forEach((c, i) => {
      s3.addShape(pptx.ShapeType.rect, { x: 0.5 + i * 1.8, y: 1.2, w: 1.4, h: 0.9, fill: { color: c.hex.replace('#', '') }, line: { color: 'DDDDDD', width: 0.5 } })
      s3.addText(c.hex, { x: 0.5 + i * 1.8, y: 2.2, w: 1.4, h: 0.3, fontSize: 9, color: '666666', align: 'center' })
      s3.addText(c.name, { x: 0.5 + i * 1.8, y: 2.5, w: 1.4, h: 0.3, fontSize: 9, color: '444444', align: 'center' })
    })
    if (bi.rules) s3.addText(bi.rules, { x: 0.5, y: 3.2, w: 12, h: 1.0, fontSize: 12, color: '555555', italic: true })
  }

  const shots = brief?.shotList || []
  if (shots.length) {
    const s4 = pptx.addSlide()
    s4.background = { color: 'FAFAFA' }
    s4.addText('Shot List', { x: 0.5, y: 0.4, w: 12, h: 0.6, fontSize: 22, bold: true, color: '111111' })
    const rows = [['#', 'Framing', 'Description', 'Camera', 'Duration']]
    shots.forEach(sh => rows.push([sh.num, sh.framing, sh.description, sh.camera, sh.duration]))
    s4.addTable(rows, { x: 0.5, y: 1.1, w: 12, fontSize: 10, color: '333333', border: { type: 'solid', color: 'DDDDDD', pt: 0.5 }, fill: { color: 'FFFFFF' }, colW: [0.5, 1.0, 6.5, 1.8, 1.2] })
  }

  const moods = brief?.lightingMood || []
  if (moods.length) {
    const s5 = pptx.addSlide()
    s5.background = { color: 'FAFAFA' }
    s5.addText('Lighting & Mood', { x: 0.5, y: 0.4, w: 12, h: 0.6, fontSize: 22, bold: true, color: '111111' })
    moods.forEach((m, i) => {
      const col = i % 2
      const row = Math.floor(i / 2)
      const x = 0.5 + col * 6.5
      const y = 1.2 + row * 2.2
      s5.addShape(pptx.ShapeType.rect, { x, y, w: 6.0, h: 0.7, fill: { color: (m.colors?.[0] || '#888888').replace('#', '') } })
      s5.addText(`${m.letter} — ${m.name}`, { x, y: y + 0.75, w: 6.0, h: 0.35, fontSize: 11, bold: true, color: '222222' })
      s5.addText(m.description || '', { x, y: y + 1.1, w: 6.0, h: 0.5, fontSize: 10, color: '666666' })
    })
  }

  pptx.writeFile({ fileName: `${brief?.creativeDirection?.brand || 'wonder'}-brief.pptx` })
}

export default function ExportDropdown({ brief, onClose, onOnePager, onShare, onToggleTheme, onOpenGenLog, theme }) {
  const ref = useRef()

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    function handleKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', handleClick)
    window.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      window.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  return (
    <div className="export-dropdown" ref={ref}>

      <button className="export-option" onClick={() => { onOnePager(); onClose() }}>
        <span className="export-option-icon">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
            <rect x="2.5" y="1.5" width="11" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M5 5h6M5 7.5h6M5 10h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
        </span>
        <span className="export-option-text">
          <span className="export-option-label">One Pager</span>
          <span className="export-option-hint">Full brief on one printable page</span>
        </span>
      </button>

      <div className="export-divider" />

      <button className="export-option" onClick={() => { window.print(); onClose() }}>
        <span className="export-option-icon">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
            <rect x="3" y="5" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M5 5V3.5A.5.5 0 015.5 3h5a.5.5 0 01.5.5V5" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M5 12.5v-3h6v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
        </span>
        <span className="export-option-text">
          <span className="export-option-label">Export PDF</span>
          <span className="export-option-hint">Print → Save as PDF</span>
        </span>
      </button>

      <button className="export-option" onClick={() => { exportPptx(brief); onClose() }}>
        <span className="export-option-icon">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
            <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M5 6h4M5 8.5h6M5 11h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
        </span>
        <span className="export-option-text">
          <span className="export-option-label">Google Slides / PowerPoint</span>
          <span className="export-option-hint">Download .pptx — import into Google Slides</span>
        </span>
      </button>

      <button className="export-option" onClick={() => { downloadJson(brief); onClose() }}>
        <span className="export-option-icon">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
            <path d="M8 2v8M5 7l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M3 13h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
        </span>
        <span className="export-option-text">
          <span className="export-option-label">Download JSON</span>
          <span className="export-option-hint">Backup · re-import later</span>
        </span>
      </button>

      {/* Utility actions tucked out of the visible topbar per the mockup. */}
      {(onShare || onToggleTheme || onOpenGenLog) && <div className="export-divider" />}

      {onShare && (
        <button className="export-option" onClick={() => { onShare(); onClose() }}>
          <span className="export-option-icon">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
              <circle cx="12" cy="3" r="1.6" stroke="currentColor" strokeWidth="1.3"/>
              <circle cx="12" cy="13" r="1.6" stroke="currentColor" strokeWidth="1.3"/>
              <circle cx="4" cy="8" r="1.6" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M10.6 3.9L5.4 7.1M5.4 8.9l5.2 3.2" stroke="currentColor" strokeWidth="1.3"/>
            </svg>
          </span>
          <span className="export-option-text">
            <span className="export-option-label">Share link</span>
            <span className="export-option-hint">Read-only URL anyone can open</span>
          </span>
        </button>
      )}

      {onOpenGenLog && (
        <button className="export-option" onClick={() => { onOpenGenLog(); onClose() }}>
          <span className="export-option-icon">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
              <path d="M2.5 3.5h11M2.5 8h11M2.5 12.5h7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          </span>
          <span className="export-option-text">
            <span className="export-option-label">Generation log</span>
            <span className="export-option-hint">Diagnose image-gen failures</span>
          </span>
        </button>
      )}

      {onToggleTheme && (
        <button className="export-option" onClick={() => { onToggleTheme(); onClose() }}>
          <span className="export-option-icon">
            {theme === 'dark'
              ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.7"/><path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
              : <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
            }
          </span>
          <span className="export-option-text">
            <span className="export-option-label">{theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}</span>
          </span>
        </button>
      )}

    </div>
  )
}
