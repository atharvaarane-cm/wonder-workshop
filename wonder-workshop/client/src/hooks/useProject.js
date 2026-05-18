import { createContext } from 'react'

const KEY = 'ww_projects'
const ACTIVE_KEY = 'ww_active_project'
// Folders that have been created but contain no projects yet. Folders with
// at least one project don't need to be tracked here — they're derived from
// the project list. This lets a user create an empty folder and then drop
// projects into it.
const FOLDERS_KEY = 'ww_extra_folders'

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
  // If the project just got moved into a folder, remove that folder from
  // the "empty folders" extras list — it's no longer empty.
  if (cleaned) {
    const extras = loadExtraFolders().filter(n => n !== cleaned)
    saveExtraFolders(extras)
  }
  return all[id]
}

function loadExtraFolders() {
  try {
    const raw = JSON.parse(localStorage.getItem(FOLDERS_KEY) || '[]')
    return Array.isArray(raw) ? raw.filter(s => typeof s === 'string' && s.trim()) : []
  } catch { return [] }
}
function saveExtraFolders(list) {
  try { localStorage.setItem(FOLDERS_KEY, JSON.stringify(list)) } catch {}
}

// Returns [{name, count}] for every folder in use across projects PLUS any
// empty folders the user created via createFolder(). Sorted alphabetically.
export function listFolders() {
  const projectsAll = Object.values(loadAll())
  const counts = new Map()
  for (const p of projectsAll) {
    if (!p?.folder) continue
    counts.set(p.folder, (counts.get(p.folder) || 0) + 1)
  }
  for (const name of loadExtraFolders()) {
    if (!counts.has(name)) counts.set(name, 0)
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function createFolder(name) {
  const cleaned = (name || '').trim()
  if (!cleaned) return null
  // No-op if a folder by this name already exists (either via a project
  // or in the extras list).
  const existing = listFolders().some(f => f.name === cleaned)
  if (existing) return cleaned
  const extras = loadExtraFolders()
  if (!extras.includes(cleaned)) {
    extras.push(cleaned)
    saveExtraFolders(extras)
  }
  return cleaned
}

export function deleteFolder(name) {
  const cleaned = (name || '').trim()
  if (!cleaned) return
  // Unfile every project in this folder.
  const all = loadAll()
  let changed = false
  for (const id of Object.keys(all)) {
    if (all[id]?.folder === cleaned) {
      all[id] = { ...all[id], folder: null, updatedAt: Date.now() }
      changed = true
    }
  }
  if (changed) saveAll(all)
  // Drop from the extras list as well.
  saveExtraFolders(loadExtraFolders().filter(n => n !== cleaned))
}

export function renameFolder(oldName, newName) {
  const from = (oldName || '').trim()
  const to = (newName || '').trim()
  if (!from || !to || from === to) return
  // Rewrite every project's folder field.
  const all = loadAll()
  let changed = false
  for (const id of Object.keys(all)) {
    if (all[id]?.folder === from) {
      all[id] = { ...all[id], folder: to, updatedAt: Date.now() }
      changed = true
    }
  }
  if (changed) saveAll(all)
  // Rewrite extras list.
  const extras = loadExtraFolders().map(n => (n === from ? to : n))
  // Dedupe in case `to` already existed.
  saveExtraFolders([...new Set(extras)])
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

// Append a freshly-generated version directly to a project's slot in
// localStorage. Called from the generation queue task so completed
// images persist even if the user navigated away from the Board
// before the queue caught up (the component is gone, but the queue
// keeps running module-side).
export function appendImageVersion(id, slotKey, version) {
  if (!id || !slotKey || !version) return null
  const all = loadAll()
  if (!all[id]) return null
  const existing = all[id].images?.[slotKey] || { versions: [], activeVersion: 0 }
  const nextVersions = [...(existing.versions || []), version]
  all[id] = {
    ...all[id],
    images: {
      ...all[id].images,
      [slotKey]: {
        versions: nextVersions,
        activeVersion: nextVersions.length - 1,
      },
    },
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
