import { blobGet, blobSet, blobSetSync, blobDelete } from "./blobStore.js";

// Multi-project persistence for v2.
// Metadata (projects list, active id, folder extras) lives in
// localStorage so the sidebar can render synchronously on first
// paint. Heavy data (full project state with image blobs) lives in
// IndexedDB via blobStore — Gemini returns ~500KB data URLs and a
// typical brief has 25-30 of them, way past localStorage's 5MB cap.
//
// Storage layout:
//   ww_v2_projects        — array of { id, name, updatedAt, folder }
//   ww_v2_active          — id of the currently active project
//   ww_v2_project_<id>    — { data, savedAt, version } for each project
//   ww_v2_state           — LEGACY single-project key, migrated on load
//
// Folders are tracked alongside each project's metadata (folder: string
// or null). The folder list is derived from metadata; empty folders
// stay in ww_v2_folders extras (added by future "New folder" action).

const PROJECTS_KEY = "ww_v2_projects";
const ACTIVE_KEY = "ww_v2_active";
const PROJECT_PREFIX = "ww_v2_project_";
const FOLDERS_KEY = "ww_v2_folders"; // list of empty folder names (folders with no projects yet)
const LEGACY_KEY = "ww_v2_state";

let storageOk = null;
function storageAvailable() {
  if (storageOk !== null) return storageOk;
  try {
    const k = "__ww_storage_probe__";
    localStorage.setItem(k, "1");
    localStorage.removeItem(k);
    storageOk = true;
  } catch {
    storageOk = false;
  }
  return storageOk;
}

function projectKey(id) { return PROJECT_PREFIX + id; }

export function newProjectId() {
  return "p_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6);
}

function isDataUrl(s) { return typeof s === "string" && s.startsWith("data:"); }
function stripBigImages(data) {
  return {
    ...data,
    talent: (data.talent || []).map(t => ({
      ...t,
      headshot: isDataUrl(t.headshot) ? null : t.headshot,
      headshots: t.headshots ? Object.fromEntries(
        Object.entries(t.headshots).map(([k, v]) => [k, isDataUrl(v) ? null : v]),
      ) : t.headshots,
      fullBody: t.fullBody ? Object.fromEntries(
        Object.entries(t.fullBody).map(([k, v]) => [k, isDataUrl(v) ? null : v]),
      ) : t.fullBody,
    })),
    products: (data.products || []).map(p => ({
      ...p,
      referenceImage: isDataUrl(p.referenceImage) ? null : p.referenceImage,
    })),
    locations: (data.locations || []).map(l => ({
      ...l,
      generatedImage: isDataUrl(l.generatedImage) ? null : l.generatedImage,
      referenceImage: isDataUrl(l.referenceImage) ? null : l.referenceImage,
    })),
    frames: (data.frames || []).map(f => ({
      ...f,
      uploadedImage: isDataUrl(f.uploadedImage) ? null : f.uploadedImage,
    })),
    moodBoard: (data.moodBoard || []).map(m => ({
      ...m,
      image: isDataUrl(m.image) ? null : m.image,
    })),
    brand: data.brand ? {
      ...data.brand,
      logo: isDataUrl(data.brand.logo) ? null : data.brand.logo,
    } : data.brand,
  };
}

export function listProjects() {
  if (!storageAvailable()) return [];
  try {
    const raw = localStorage.getItem(PROJECTS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    // Most-recently-updated first.
    return [...arr].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  } catch { return []; }
}

function writeProjectsList(list) {
  if (!storageAvailable()) return;
  try { localStorage.setItem(PROJECTS_KEY, JSON.stringify(list)); } catch {}
}

// Save project — full data goes to IndexedDB (no quota worry), only
// the lightweight metadata list goes to localStorage. We also kick a
// best-effort localStorage fallback write with the stripped (no
// data:URL) version so a project at least has SOMETHING durable on
// browsers that block IndexedDB.
export function saveProject(id, data, opts = {}) {
  if (!storageAvailable() || !id || !data) return false;

  // Primary write — IndexedDB. Async but fire-and-forget here; the
  // caller's "Saved" toast comes from this returning true (which it
  // does optimistically — actual write is monitored via the next
  // saveProjectAsync entrypoint when caller wants confirmation).
  blobSet(id, data).catch(e => console.warn("[persistence] IndexedDB write failed", e));

  // Lightweight fallback — strip data:URLs so a project at least
  // round-trips on browsers where IndexedDB is blocked. If even the
  // stripped version doesn't fit we silently skip; IndexedDB is
  // the source of truth.
  try {
    const stripped = stripBigImages(data);
    localStorage.setItem(projectKey(id), JSON.stringify({
      data: stripped, savedAt: Date.now(), stripped: true, version: 2,
    }));
  } catch (e) {
    // Quota even on stripped data is rare but possible — drop the
    // localStorage fallback for this project. IndexedDB is still good.
    try { localStorage.removeItem(projectKey(id)); } catch {}
  }

  // Update metadata. Preserve existing folder + name if not overridden.
  const list = listProjects();
  const idx = list.findIndex(p => p.id === id);
  const derivedName = opts.name
    || data?.meta?.title
    || (idx >= 0 ? list[idx].name : null)
    || "Untitled";
  const meta = {
    id,
    name: derivedName,
    updatedAt: Date.now(),
    folder: opts.folder !== undefined ? opts.folder : (idx >= 0 ? list[idx].folder : null),
  };
  const next = [...list];
  if (idx >= 0) next[idx] = meta; else next.unshift(meta);
  writeProjectsList(next);
  return true;
}

// beforeunload flush — synchronous best-effort. IndexedDB writes
// kicked off here may not complete before the page dies, but the
// localStorage fallback (stripped of data: URLs) will. Better than
// nothing for the "user closed the tab mid-edit" case.
export function saveProjectSync(id, data, opts = {}) {
  if (!storageAvailable() || !id || !data) return false;
  blobSetSync(id, data);
  try {
    const stripped = stripBigImages(data);
    localStorage.setItem(projectKey(id), JSON.stringify({
      data: stripped, savedAt: Date.now(), stripped: true, version: 2,
    }));
  } catch {}
  const list = listProjects();
  const idx = list.findIndex(p => p.id === id);
  if (idx >= 0) {
    list[idx] = { ...list[idx], updatedAt: Date.now() };
    writeProjectsList(list);
  }
  return true;
}

// Read project — IndexedDB first (full fidelity), localStorage
// fallback for browsers where IDB is blocked or projects saved
// before this multi-store split.
export async function loadProjectAsync(id) {
  if (!id) return null;
  const fromIdb = await blobGet(id);
  if (fromIdb) return fromIdb;
  // Legacy fallback — read the lightweight localStorage copy.
  return loadProject(id);
}

// Synchronous read — used by the App's bootstrap on first paint.
// Returns localStorage-only data (stripped of data:URL images). The
// async loadProjectAsync() should fire right after to hydrate the
// full image data from IndexedDB.
export function loadProject(id) {
  if (!storageAvailable() || !id) return null;
  try {
    const raw = localStorage.getItem(projectKey(id));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.data || null;
  } catch { return null; }
}

export function deleteProject(id) {
  if (!storageAvailable() || !id) return;
  try {
    localStorage.removeItem(projectKey(id));
    blobDelete(id).catch(() => {}); // fire-and-forget IDB cleanup
    const list = listProjects().filter(p => p.id !== id);
    writeProjectsList(list);
    if (getActiveProjectId() === id) setActiveProjectId(null);
  } catch {}
}

export function renameProject(id, newName) {
  if (!storageAvailable() || !id) return;
  const list = listProjects();
  const idx = list.findIndex(p => p.id === id);
  if (idx < 0) return;
  list[idx] = { ...list[idx], name: newName || "Untitled", updatedAt: Date.now() };
  writeProjectsList(list);
}

export function setProjectFolder(id, folder) {
  if (!storageAvailable() || !id) return;
  const list = listProjects();
  const idx = list.findIndex(p => p.id === id);
  if (idx < 0) return;
  list[idx] = { ...list[idx], folder: folder || null, updatedAt: Date.now() };
  writeProjectsList(list);
}

export function getActiveProjectId() {
  if (!storageAvailable()) return null;
  try { return localStorage.getItem(ACTIVE_KEY) || null; } catch { return null; }
}

export function setActiveProjectId(id) {
  if (!storageAvailable()) return;
  try {
    if (id) localStorage.setItem(ACTIVE_KEY, id);
    else localStorage.removeItem(ACTIVE_KEY);
  } catch {}
}

// Folders — listed by combining all folder names referenced by
// projects + an extras list for empty folders the user created
// before assigning anything to them.

function loadExtraFolders() {
  if (!storageAvailable()) return [];
  try {
    const raw = localStorage.getItem(FOLDERS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter(s => typeof s === "string" && s.trim()) : [];
  } catch { return []; }
}

function saveExtraFolders(list) {
  if (!storageAvailable()) return;
  try { localStorage.setItem(FOLDERS_KEY, JSON.stringify(list)); } catch {}
}

export function listFolders() {
  const projectFolders = new Set();
  for (const p of listProjects()) {
    if (p.folder) projectFolders.add(p.folder);
  }
  for (const f of loadExtraFolders()) projectFolders.add(f);
  return [...projectFolders].sort((a, b) => a.localeCompare(b));
}

export function createFolder(name) {
  const cleaned = (name || "").trim();
  if (!cleaned) return null;
  if (listFolders().includes(cleaned)) return cleaned;
  const extras = loadExtraFolders();
  extras.push(cleaned);
  saveExtraFolders(extras);
  return cleaned;
}

export function deleteFolder(name) {
  const cleaned = (name || "").trim();
  if (!cleaned) return;
  // Unfile every project in this folder.
  const list = listProjects();
  let changed = false;
  for (const p of list) {
    if (p.folder === cleaned) {
      setProjectFolder(p.id, null);
      changed = true;
    }
  }
  // Drop from extras.
  saveExtraFolders(loadExtraFolders().filter(n => n !== cleaned));
}

// One-time migration: the previous version saved to a single
// ww_v2_state key. If that exists on first load of the multi-project
// system, promote it into a real project, mark it active, and clean
// up the legacy key.
export function migrateLegacyState() {
  if (!storageAvailable()) return null;
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.data) return null;
    const id = newProjectId();
    saveProject(id, parsed.data, { name: parsed.data?.meta?.title || "Untitled" });
    setActiveProjectId(id);
    localStorage.removeItem(LEGACY_KEY);
    return id;
  } catch { return null; }
}
