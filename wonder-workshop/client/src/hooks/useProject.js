import { createContext } from 'react'

const KEY = 'ww_projects'
const ACTIVE_KEY = 'ww_active_project'

function loadAll() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') } catch { return {} }
}
function saveAll(map) {
  try { localStorage.setItem(KEY, JSON.stringify(map)) } catch {}
}

// One-time migration: convert legacy ww_recents → projects.
;(function migrateLegacy() {
  try {
    const legacyRaw = localStorage.getItem('ww_recents')
    if (!legacyRaw) return
    const legacy = JSON.parse(legacyRaw)
    if (!Array.isArray(legacy) || !legacy.length) return
    const all = loadAll()
    let changed = false
    for (const r of legacy) {
      if (r?.id && !all[r.id]) {
        all[r.id] = {
          id: r.id,
          name: r.name || 'Untitled brief',
          brief: r.brief,
          images: {},
          createdAt: r.id,
          updatedAt: r.id,
        }
        changed = true
      }
    }
    if (changed) saveAll(all)
    localStorage.removeItem('ww_recents')
  } catch {}
})()

export function listProjects() {
  return Object.values(loadAll()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
}

function deriveName(brief) {
  return brief?.projectInfo?.projectName
    || brief?.title
    || brief?.creativeDirection?.brand
    || 'Untitled brief'
}

export function createProject(brief) {
  const now = Date.now()
  const project = {
    id: now,
    name: deriveName(brief),
    brief,
    images: {},
    createdAt: now,
    updatedAt: now,
  }
  const all = loadAll()
  all[now] = project
  saveAll(all)
  localStorage.setItem(ACTIVE_KEY, String(now))
  return project
}

export function getActiveProject() {
  const id = Number(localStorage.getItem(ACTIVE_KEY) || 0)
  if (!id) return null
  return loadAll()[id] || null
}

export function setActiveProject(id) {
  if (id == null) localStorage.removeItem(ACTIVE_KEY)
  else localStorage.setItem(ACTIVE_KEY, String(id))
}

export function deleteProject(id) {
  const all = loadAll()
  delete all[id]
  saveAll(all)
  if (Number(localStorage.getItem(ACTIVE_KEY) || 0) === id) {
    localStorage.removeItem(ACTIVE_KEY)
  }
}

export function updateProjectBrief(id, brief) {
  const all = loadAll()
  if (!all[id]) return null
  // Preserve a user-set name (any name that diverges from the brief-derived
  // default) so brief edits don't overwrite a manual rename.
  const derived = deriveName(brief)
  const hasManualName = all[id].nameOverride === true
  all[id] = {
    ...all[id],
    brief,
    name: hasManualName ? all[id].name : derived,
    updatedAt: Date.now(),
  }
  saveAll(all)
  return all[id]
}

export function moveProjectToFolder(id, folder) {
  const all = loadAll()
  if (!all[id]) return null
  const cleaned = (folder || '').trim()
  all[id] = {
    ...all[id],
    folder: cleaned || null,
    updatedAt: Date.now(),
  }
  saveAll(all)
  return all[id]
}

// Deep-clone a project to a new id. Brief, images, name override, and
// folder placement all carry across. Image versions are copied by
// reference (they're just URL strings + metadata), so duplicating doesn't
// re-fetch anything from Pollinations.
export function duplicateProject(id) {
  const all = loadAll()
  const src = all[id]
  if (!src) return null
  const now = Date.now()
  const copy = {
    ...src,
    id: now,
    name: `${src.name || 'Untitled brief'} (Copy)`,
    nameOverride: true,
    createdAt: now,
    updatedAt: now,
    images: JSON.parse(JSON.stringify(src.images || {})),
  }
  all[now] = copy
  saveAll(all)
  return copy
}

export function renameProject(id, name) {
  const all = loadAll()
  if (!all[id]) return null
  const trimmed = (name || '').trim()
  if (!trimmed) return all[id]
  all[id] = {
    ...all[id],
    name: trimmed,
    nameOverride: true,
    updatedAt: Date.now(),
  }
  saveAll(all)
  return all[id]
}

export function saveImageForProject(id, slotKey, data) {
  const all = loadAll()
  if (!all[id]) return null
  all[id] = {
    ...all[id],
    images: { ...all[id].images, [slotKey]: data },
    updatedAt: Date.now(),
  }
  saveAll(all)
  return all[id]
}

// Move a generated version from one slot to another. The version is removed
// from the source slot's versions array and appended to the target slot's,
// becoming the target's new active version. Versions are identified by
// (src + createdAt) so duplicates with the same prompt are handled correctly.
export function moveImageBetweenSlots(id, fromSlotKey, toSlotKey, version) {
  if (fromSlotKey === toSlotKey) return null
  const all = loadAll()
  const project = all[id]
  if (!project) return null
  const images = { ...(project.images || {}) }

  const fromEntry = images[fromSlotKey]
  if (fromEntry?.versions?.length) {
    const idx = fromEntry.versions.findIndex(
      v => v.src === version.src && v.createdAt === version.createdAt,
    )
    if (idx >= 0) {
      const nextVersions = fromEntry.versions.filter((_, i) => i !== idx)
      const nextActive = Math.max(0, Math.min(fromEntry.activeVersion ?? 0, nextVersions.length - 1))
      images[fromSlotKey] = { versions: nextVersions, activeVersion: nextActive }
    }
  }

  const toEntry = images[toSlotKey] || { versions: [], activeVersion: 0 }
  const nextToVersions = [...(toEntry.versions || []), version]
  images[toSlotKey] = {
    versions: nextToVersions,
    activeVersion: nextToVersions.length - 1,
  }

  all[id] = { ...project, images, updatedAt: Date.now() }
  saveAll(all)
  return all[id]
}

export const ProjectContext = createContext(null)
