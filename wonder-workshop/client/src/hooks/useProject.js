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
  all[id] = {
    ...all[id],
    brief,
    name: deriveName(brief),
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

export const ProjectContext = createContext(null)
