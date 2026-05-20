// Pull text out of a File so we can feed it into the brief generator as
// extra context. Supports PDFs via pdfjs-dist (lazy-loaded so it doesn't
// bloat the initial bundle) and plain-text formats via FileReader.

const TEXT_EXTENSIONS = ['txt', 'md', 'json', 'csv', 'rtf']

function extOf(filename) {
  const i = filename.lastIndexOf('.')
  return i >= 0 ? filename.slice(i + 1).toLowerCase() : ''
}

function readAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error || new Error('FileReader failed'))
    reader.readAsText(file)
  })
}

async function readPdf(file) {
  // Lazy-load pdfjs only when a PDF is attached. The build/pdf.mjs entry
  // ships an ES module; the worker needs to be pointed at the matching
  // worker file. Vite/Rollup will fingerprint both during build.
  const pdfjs = await import('pdfjs-dist/build/pdf.mjs')
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

  const buf = await file.arrayBuffer()
  const doc = await pdfjs.getDocument({ data: buf }).promise
  let text = ''
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    text += content.items.map(it => it.str).join(' ') + '\n\n'
  }
  return text.trim()
}

export async function extractFileText(file) {
  const ext = extOf(file.name)
  if (ext === 'pdf' || file.type === 'application/pdf') {
    return await readPdf(file)
  }
  if (TEXT_EXTENSIONS.includes(ext) || (file.type || '').startsWith('text/')) {
    return await readAsText(file)
  }
  throw new Error(`Unsupported file type: ${ext || file.type || 'unknown'}. Try PDF or a text file.`)
}
