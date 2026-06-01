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
//   ww_v2_state           — removed legacy single-project key
//
// Folders are tracked alongside each project's metadata (folder: string
// or null). The folder list is derived from metadata; empty folders
// stay in ww_v2_folders extras (added by future "New folder" action).

const PROJECTS_KEY = "ww_v2_projects";
const ACTIVE_KEY = "ww_v2_active";
const PROJECT_PREFIX = "ww_v2_project_";
const FOLDERS_KEY = "ww_v2_folders"; // list of empty folder names (folders with no projects yet)
const LEGACY_KEYS = [
  "ww_projects",
  "ww_active_project",
  "ww_extra_folders",
  "ww_recents",
  "ww_v2_state",
];

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

function applyProjectListName(id, data) {
  if (!id || !data) return data;
  const meta = listProjects().find(p => p.id === id);
  if (!meta?.name || data?.meta?.title === meta.name) return data;
  return {
    ...data,
    meta: {
      ...(data.meta || {}),
      title: meta.name,
    },
  };
}

function writeProjectFallback(id, data) {
  try {
    const stripped = stripBigImages(data);
    localStorage.setItem(projectKey(id), JSON.stringify({
      data: stripped, savedAt: Date.now(), stripped: true, version: 2,
    }));
    return true;
  } catch (e) {
    // Quota even on stripped data is rare but possible — drop the
    // localStorage fallback for this project. IndexedDB is still good.
    try { localStorage.removeItem(projectKey(id)); } catch {}
    return false;
  }
}

function writeProjectMetadata(id, data, opts = {}) {
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
}

// Save project — full data goes to IndexedDB (no quota worry), only
// the lightweight metadata list goes to localStorage. The sync entry
// point keeps older call sites simple, but callers that need a truthful
// save indicator should use saveProjectAsync().
export function saveProject(id, data, opts = {}) {
  if (!storageAvailable() || !id || !data) return false;
  blobSet(id, data).catch(e => console.warn("[persistence] IndexedDB write failed", e));
  writeProjectFallback(id, data);
  writeProjectMetadata(id, data, opts);
  return true;
}

export async function saveProjectAsync(id, data, opts = {}) {
  if (!storageAvailable() || !id || !data) return false;
  const idbOk = await blobSet(id, data);
  const fallbackOk = writeProjectFallback(id, data);
  writeProjectMetadata(id, data, opts);
  return idbOk || fallbackOk;
}

// beforeunload flush — synchronous best-effort. IndexedDB writes
// kicked off here may not complete before the page dies, but the
// localStorage fallback (stripped of data: URLs) will. Better than
// nothing for the "user closed the tab mid-edit" case.
export function saveProjectSync(id, data, opts = {}) {
  if (!storageAvailable() || !id || !data) return false;
  blobSetSync(id, data);
  writeProjectFallback(id, data);
  writeProjectMetadata(id, data, opts);
  return true;
}

// Read project — IndexedDB first (full fidelity), localStorage
// fallback for browsers where IDB is blocked or projects saved
// before this multi-store split.
export async function loadProjectAsync(id) {
  if (!id) return null;
  const fromIdb = await blobGet(id);
  if (fromIdb) return applyProjectListName(id, fromIdb);
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
    return applyProjectListName(id, parsed?.data || null);
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
  const cleaned = (newName || "").trim() || "Untitled";
  const list = listProjects();
  const idx = list.findIndex(p => p.id === id);
  if (idx < 0) return;
  list[idx] = { ...list[idx], name: cleaned, updatedAt: Date.now() };
  writeProjectsList(list);

  try {
    const raw = localStorage.getItem(projectKey(id));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.data) {
        const data = {
          ...parsed.data,
          meta: {
            ...(parsed.data.meta || {}),
            title: cleaned,
          },
        };
        localStorage.setItem(projectKey(id), JSON.stringify({
          ...parsed,
          data,
          savedAt: Date.now(),
          version: 2,
        }));
      }
    }
  } catch {}

  blobGet(id)
    .then(data => {
      if (!data) return null;
      return blobSet(id, {
        ...data,
        meta: {
          ...(data.meta || {}),
          title: cleaned,
        },
      });
    })
    .catch(() => {});
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

export function renameFolder(oldName, newName) {
  const from = (oldName || "").trim();
  const to = (newName || "").trim();
  if (!storageAvailable() || !from || !to) return false;
  if (from === to) return true;

  const list = listProjects();
  let changed = false;
  const nextProjects = list.map(p => {
    if (p.folder !== from) return p;
    changed = true;
    return { ...p, folder: to, updatedAt: Date.now() };
  });
  if (changed) writeProjectsList(nextProjects);

  const extras = loadExtraFolders();
  const nextExtras = [];
  for (const folder of extras) {
    const nextName = folder === from ? to : folder;
    if (!nextExtras.includes(nextName)) nextExtras.push(nextName);
  }
  if (!nextExtras.includes(to) && !changed) nextExtras.push(to);
  saveExtraFolders(nextExtras.filter(n => n !== from));

  return true;
}

export function purgeLegacyV1Storage() {
  if (!storageAvailable()) return;
  for (const key of LEGACY_KEYS) {
    try { localStorage.removeItem(key); } catch {}
  }
  try {
    if (typeof indexedDB !== "undefined") indexedDB.deleteDatabase("ww-images");
  } catch {}
}
