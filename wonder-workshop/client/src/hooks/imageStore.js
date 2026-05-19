// Image storage on IndexedDB. The localStorage 5MB quota was getting
// blown by accumulated Gemini base64 JPEGs (each ~1-2MB). IndexedDB
// gives us hundreds of MB and async writes.
//
// API kept synchronous via an in-memory cache: hydrate() loads everything
// from IDB at boot, then reads/writes hit the cache immediately while
// writes are also flushed to IDB in the background. Components keep
// using `project.images[slotKey]` like nothing changed.

const DB_NAME = 'ww-images'
const STORE = 'slots'
const VERSION = 1

let dbPromise = null
function openDB() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE) // key = `${projectId}::${slotKey}`
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

// In-memory cache: Map<projectId, { [slotKey]: { versions, activeVersion } }>
const cache = new Map()
const subscribers = new Set()
let hydrated = false
let hydratePromise = null

function notify() {
  for (const fn of subscribers) {
    try { fn() } catch (e) { console.error('[imageStore] subscriber threw', e) }
  }
}

export function subscribe(fn) {
  subscribers.add(fn)
  return () => subscribers.delete(fn)
}

function keyOf(projectId, slotKey) {
  return `${projectId}::${slotKey}`
}

export function getImagesForProject(projectId) {
  return cache.get(projectId) || {}
}

export function getSlotImage(projectId, slotKey) {
  return cache.get(projectId)?.[slotKey] || null
}

// Save and flush to IDB. Returns immediately; the flush happens async.
export function saveSlotImage(projectId, slotKey, data) {
  if (!projectId || !slotKey) return
  let proj = cache.get(projectId)
  if (!proj) { proj = {}; cache.set(projectId, proj) }
  proj[slotKey] = data
  notify()
  flushSlot(projectId, slotKey, data).catch(err => {
    console.error('[imageStore] flush failed', { projectId, slotKey, err })
  })
}

export function deleteSlotImage(projectId, slotKey) {
  const proj = cache.get(projectId)
  if (proj) {
    delete proj[slotKey]
    if (!Object.keys(proj).length) cache.delete(projectId)
  }
  notify()
  openDB().then(db => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(keyOf(projectId, slotKey))
  }).catch(err => console.error('[imageStore] delete failed', err))
}

export function deleteAllForProject(projectId) {
  cache.delete(projectId)
  notify()
  openDB().then(db => {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    // Walk keys and delete matching ones — IDB doesn't have a wildcard delete
    const req = store.openCursor()
    req.onsuccess = () => {
      const cur = req.result
      if (!cur) return
      if (String(cur.key).startsWith(`${projectId}::`)) cur.delete()
      cur.continue()
    }
  }).catch(err => console.error('[imageStore] deleteAllForProject failed', err))
}

async function flushSlot(projectId, slotKey, data) {
  const db = await openDB()
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(data, keyOf(projectId, slotKey))
    tx.oncomplete = resolve
    tx.onerror = () => reject(tx.error)
  })
}

// One-shot at boot: read every slot from IDB into cache, then migrate
// any leftover localStorage image data (clearing it as we go to free
// the quota that was the whole reason for this refactor).
export function hydrate() {
  if (hydratePromise) return hydratePromise
  hydratePromise = (async () => {
    try {
      const db = await openDB()
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly')
        const req = tx.objectStore(STORE).openCursor()
        req.onsuccess = () => {
          const cur = req.result
          if (!cur) { resolve(); return }
          const k = String(cur.key)
          const sep = k.indexOf('::')
          if (sep > 0) {
            const projectId = Number(k.slice(0, sep)) || k.slice(0, sep)
            const slotKey = k.slice(sep + 2)
            let proj = cache.get(projectId)
            if (!proj) { proj = {}; cache.set(projectId, proj) }
            proj[slotKey] = cur.value
          }
          cur.continue()
        }
        req.onerror = () => reject(req.error)
      })
      await migrateFromLocalStorage()
      hydrated = true
      notify()
    } catch (err) {
      console.error('[imageStore] hydrate failed', err)
      hydrated = true // don't block UI on a DB error
    }
  })()
  return hydratePromise
}

export function isHydrated() { return hydrated }

async function migrateFromLocalStorage() {
  let raw
  try { raw = localStorage.getItem('ww_projects') } catch { return }
  if (!raw) return
  let all
  try { all = JSON.parse(raw) } catch { return }
  if (!all || typeof all !== 'object') return

  let migratedCount = 0
  let changed = false
  for (const [id, project] of Object.entries(all)) {
    const images = project?.images
    if (!images || !Object.keys(images).length) continue
    const pid = Number(id) || id
    let proj = cache.get(pid)
    if (!proj) { proj = {}; cache.set(pid, proj) }
    for (const [slotKey, data] of Object.entries(images)) {
      // Skip if IDB already has it (shouldn't be possible on first migration
      // but safe — IDB wins if both exist).
      if (proj[slotKey]) continue
      proj[slotKey] = data
      try { await flushSlot(pid, slotKey, data); migratedCount++ } catch (e) {
        console.error('[imageStore] migration flush failed', { pid, slotKey, e })
      }
    }
    // Strip images from the localStorage copy — that's the whole point,
    // free the quota.
    project.images = {}
    changed = true
  }
  if (changed) {
    try {
      localStorage.setItem('ww_projects', JSON.stringify(all))
      console.log(`[imageStore] migrated ${migratedCount} slots from localStorage → IndexedDB`)
    } catch (e) {
      // If localStorage write still fails (somehow), the migration is in IDB —
      // we just can't strip the legacy bytes. Next boot will retry.
      console.error('[imageStore] could not strip legacy images from localStorage', e)
    }
  }
}
