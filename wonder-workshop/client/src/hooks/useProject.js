import { createContext } from 'react'
import {
  saveSlotImage,
  deleteAllForProject as deleteImagesForProject,
  getImagesForProject,
  getSlotImage,
} from './imageStore.js'

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

// Attach images from the in-memory imageStore cache. The localStorage
// project record no longer carries image data (we strip it on migration);
// components keep reading `project.images[slotKey]` via the context,
// which now reflects whatever's in IndexedDB.
function withImages(project) {
  if (!project) return project
  return { ...project, images: getImagesForProject(project.id) }
}
// localStorage has a ~5-10MB origin quota. Base64-encoded Gemini images run
// ~1-2MB each; a handful of projects with full storyboards blows past that.
// When saves fail, we prune the OLDEST projects' images (keeping the brief
// metadata intact) until the write succeeds — better to lose the oldest
// generated images than the current one the user is working on.
function saveAll(map) {
  try {
    localStorage.setItem(KEY, JSON.stringify(map))
    return
  } catch (err) {
    if (err?.name !== 'QuotaExceededError' && !String(err).includes('exceeded')) {
      console.error('[useProject] saveAll failed (non-quota)', err)
      throw err
    }
    // Quota hit — drop oldest projects' images until write fits, oldest
    // first by updatedAt. Brief metadata is preserved so projects still
    // appear in the sidebar; they just lose their generated images.
    const sorted = Object.values(map)
      .filter(p => p?.images && Object.keys(p.images).length > 0)
      .sort((a, b) => (a.updatedAt || 0) - (b.updatedAt || 0))
    for (const victim of sorted) {
      const slots = Object.keys(victim.images || {})
      console.warn('[useProject] localStorage quota exceeded — dropping images from project', { id: victim.id, name: victim.name, slots: slots.length })
      victim.images = {}
      try {
        localStorage.setItem(KEY, JSON.stringify(map))
        // Notify the user once
        try {
          window.dispatchEvent(new CustomEvent('ww-toast', { detail: {
            type: 'error',
            msg: `Storage full — cleared images from older project "${victim.name}" to make room. Consider deleting old projects.`,
          } }))
        } catch {}
        return
      } catch { /* try the next victim */ }
    }
    // Last resort: nothing freed enough space. Surface loudly.
    console.error('[useProject] saveAll: localStorage quota exceeded and no projects could be pruned')
    try {
      window.dispatchEvent(new CustomEvent('ww-toast', { detail: {
        type: 'error',
        msg: 'Storage full. Delete old projects to free space — new images can\'t be saved.',
      } }))
    } catch {}
  }
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
  return Object.values(loadAll())
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .map(withImages)
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
  return withImages(project)
}

export function getActiveProject() {
  const id = Number(localStorage.getItem(ACTIVE_KEY) || 0)
  if (!id) return null
  const p = loadAll()[id]
  return p ? withImages(p) : null
}

export function setActiveProject(id) {
  if (id == null) localStorage.removeItem(ACTIVE_KEY)
  else localStorage.setItem(ACTIVE_KEY, String(id))
}

export function deleteProject(id) {
  const all = loadAll()
  delete all[id]
  saveAll(all)
  deleteImagesForProject(id)
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
  return withImages(all[id])
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
  return withImages(all[id])
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
// folder placement all carry across. Images live in IndexedDB now —
// duplicate each slot under the new id so the copy is self-contained.
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
    images: {},
  }
  all[now] = copy
  saveAll(all)
  // Copy each slot from the source's images cache into the new project.
  const srcImages = getImagesForProject(id)
  for (const [slotKey, data] of Object.entries(srcImages)) {
    saveSlotImage(now, slotKey, JSON.parse(JSON.stringify(data)))
  }
  return withImages(copy)
}

export function renameProject(id, name) {
  const all = loadAll()
  if (!all[id]) return null
  const trimmed = (name || '').trim()
  if (!trimmed) return withImages(all[id])
  all[id] = {
    ...all[id],
    name: trimmed,
    nameOverride: true,
    updatedAt: Date.now(),
  }
  saveAll(all)
  return withImages(all[id])
}

// Image data now lives in IndexedDB via imageStore. The legacy localStorage
// `project.images` field is kept on the returned object only as a synthesised
// view so existing components don't need to change.
export function saveImageForProject(id, slotKey, data) {
  if (!id || !slotKey) {
    console.error('[useProject] saveImageForProject: missing id or slotKey', { id, slotKey })
    return null
  }
  const all = loadAll()
  if (!all[id]) {
    console.error('[useProject] saveImageForProject: project not found in localStorage', { id, slotKey, knownIds: Object.keys(all) })
    return null
  }
  saveSlotImage(id, slotKey, data)
  // Touch the project's updatedAt for sorting freshness, but no longer
  // serialize image data into localStorage.
  all[id] = { ...all[id], images: {}, updatedAt: Date.now() }
  saveAll(all)
  return { ...all[id], images: getImagesForProject(id) }
}

// Append a freshly-generated version directly to a project's slot in
// localStorage. Called from the generation queue task so completed
// images persist even if the user navigated away from the Board
// before the queue caught up (the component is gone, but the queue
// keeps running module-side).
export function appendImageVersion(id, slotKey, version) {
  if (!id || !slotKey || !version) {
    console.error('[useProject] appendImageVersion: missing arg', { id, slotKey, hasVersion: !!version })
    return null
  }
  const all = loadAll()
  if (!all[id]) {
    console.error('[useProject] appendImageVersion: project not found in localStorage', { id, slotKey, knownIds: Object.keys(all) })
    return null
  }
  const existing = getSlotImage(id, slotKey) || { versions: [], activeVersion: 0 }
  const nextVersions = [...(existing.versions || []), version]
  const next = { versions: nextVersions, activeVersion: nextVersions.length - 1 }
  saveSlotImage(id, slotKey, next)
  all[id] = { ...all[id], images: {}, updatedAt: Date.now() }
  saveAll(all)
  return { ...all[id], images: getImagesForProject(id) }
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

  const fromEntry = getSlotImage(id, fromSlotKey)
  if (fromEntry?.versions?.length) {
    const idx = fromEntry.versions.findIndex(
      v => v.src === version.src && v.createdAt === version.createdAt,
    )
    if (idx >= 0) {
      const nextVersions = fromEntry.versions.filter((_, i) => i !== idx)
      const nextActive = Math.max(0, Math.min(fromEntry.activeVersion ?? 0, nextVersions.length - 1))
      saveSlotImage(id, fromSlotKey, { versions: nextVersions, activeVersion: nextActive })
    }
  }

  const toEntry = getSlotImage(id, toSlotKey) || { versions: [], activeVersion: 0 }
  const nextToVersions = [...(toEntry.versions || []), version]
  saveSlotImage(id, toSlotKey, {
    versions: nextToVersions,
    activeVersion: nextToVersions.length - 1,
  })

  all[id] = { ...project, images: {}, updatedAt: Date.now() }
  saveAll(all)
  return { ...all[id], images: getImagesForProject(id) }
}

export const ProjectContext = createContext(null)
