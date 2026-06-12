import { supabase, WORKSHOP_BUCKET } from "./supabaseClient.js";

// Cloud persistence — same surface as persistence.js, backed by Portal's
// Supabase (table public.workshop_projects + the workshop-images bucket).
//
// Shape parity with the local impl so persistence.js can flag-route between
// them without Workshop.jsx changing:
//   - sync reads (listProjects/loadProject/getActiveProjectId) serve a local
//     cache for instant first paint; *Async variants hit Supabase and refresh it.
//   - the active-project id stays per-browser in localStorage (a UI pointer, not
//     shared state) — matches the local impl.
//   - images are offloaded from the JSON to the bucket on save (no base64 in the
//     row), referenced by public URL; on load the URLs are already in the data.

const ACTIVE_KEY = "ww_v2_active";
const LIST_CACHE_KEY = "ww_v2_cloud_list";
const FOLDERS_KEY = "ww_v2_folders";

// ── tiny localStorage helpers (sync cache for first paint) ───────────────────
function lsGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function lsSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota / private mode */ }
}

let listCache = lsGet(LIST_CACHE_KEY, []);
const dataCache = new Map(); // id -> full project data (hydrated on load)

function setListCache(list) {
  listCache = list;
  lsSet(LIST_CACHE_KEY, list);
}

// ── ids / active pointer ─────────────────────────────────────────────────────
export function newProjectId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : "p_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}

export function getActiveProjectId() {
  try { return localStorage.getItem(ACTIVE_KEY) || null; } catch { return null; }
}
export function setActiveProjectId(id) {
  try { id ? localStorage.setItem(ACTIVE_KEY, id) : localStorage.removeItem(ACTIVE_KEY); } catch { /* ignore */ }
}

// ── image offload (base64 -> bucket, content-addressed) ──────────────────────
async function sha1(str) {
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}
function dataUrlToBlob(dataUrl) {
  const comma = dataUrl.indexOf(",");
  const meta = dataUrl.slice(0, comma);
  const b64 = dataUrl.slice(comma + 1);
  const mime = (meta.match(/data:([^;]+)/) || [])[1] || "image/png";
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return { blob: new Blob([arr], { type: mime }), mime };
}

// Upload one data URL; return its public bucket URL. Content-addressed by SHA-1
// so re-saving a project doesn't re-upload unchanged images.
async function offloadOne(projectId, dataUrl) {
  const hash = await sha1(dataUrl);
  const { blob, mime } = dataUrlToBlob(dataUrl);
  const ext = (mime.split("/")[1] || "png").replace(/[^a-z0-9]/gi, "");
  const path = `projects/${projectId}/${hash}.${ext}`;
  const { error } = await supabase.storage.from(WORKSHOP_BUCKET).upload(path, blob, {
    contentType: mime,
    upsert: true,
  });
  if (error && !/exists|duplicate/i.test(error.message)) throw error;
  return supabase.storage.from(WORKSHOP_BUCKET).getPublicUrl(path).data.publicUrl;
}

// Deep-walk the project data, replacing any inline base64 image with its bucket
// URL. Field-agnostic — works regardless of where images live in the shape.
async function offloadImages(projectId, data) {
  async function walk(node) {
    if (typeof node === "string") {
      return node.startsWith("data:image/") ? await offloadOne(projectId, node) : node;
    }
    if (Array.isArray(node)) {
      const out = [];
      for (const item of node) out.push(await walk(item));
      return out;
    }
    if (node && typeof node === "object") {
      const out = {};
      for (const [k, v] of Object.entries(node)) out[k] = await walk(v);
      return out;
    }
    return node;
  }
  return walk(data);
}

// ── projects ─────────────────────────────────────────────────────────────────
function metaName(data) {
  return (data?.meta?.title || "").trim() || "Untitled";
}
function metaFolder(data) {
  return (data?.meta?.client || "").trim() || null;
}

export function listProjects() {
  return listCache;
}

export async function refreshProjects() {
  if (!supabase) return listCache;
  const { data, error } = await supabase
    .from("workshop_projects")
    .select("id,name,folder,updated_at")
    .order("updated_at", { ascending: false });
  if (error) {
    console.warn("[cloud] listProjects failed:", error.message);
    return listCache;
  }
  setListCache(
    data.map(r => ({
      id: r.id,
      name: r.name || "Untitled",
      folder: r.folder || null,
      updatedAt: r.updated_at ? new Date(r.updated_at).getTime() : 0,
    })),
  );
  return listCache;
}

export function loadProject(id) {
  return dataCache.get(id) || null;
}

export async function loadProjectAsync(id) {
  if (!supabase) return dataCache.get(id) || null;
  const { data, error } = await supabase
    .from("workshop_projects")
    .select("data")
    .eq("id", id)
    .single();
  if (error) {
    console.warn("[cloud] loadProject failed:", error.message);
    return dataCache.get(id) || null;
  }
  dataCache.set(id, data.data);
  return data.data;
}

export async function saveProjectAsync(id, data) {
  if (!supabase) return;
  let payload = data;
  try {
    payload = await offloadImages(id, data);
  } catch (e) {
    console.warn("[cloud] image offload failed, saving inline:", e.message);
  }
  const row = { id, name: metaName(data), folder: metaFolder(data), data: payload };
  const { error } = await supabase.from("workshop_projects").upsert(row, { onConflict: "id" });
  if (error) {
    console.error("[cloud] saveProject failed:", error.message);
    return;
  }
  dataCache.set(id, payload);
  setListCache([
    { id, name: row.name, folder: row.folder, updatedAt: Date.now() },
    ...listCache.filter(p => p.id !== id),
  ]);
}

// Fire-and-forget variants for the optimistic save paths (autosave). The local
// cache updates immediately; the network write resolves in the background.
export function saveProject(id, data) { void saveProjectAsync(id, data); }
export function saveProjectSync(id, data) { void saveProjectAsync(id, data); }

export async function deleteProject(id) {
  if (!supabase) return;
  const { error } = await supabase.from("workshop_projects").delete().eq("id", id);
  if (error) { console.error("[cloud] deleteProject failed:", error.message); return; }
  dataCache.delete(id);
  setListCache(listCache.filter(p => p.id !== id));
}

export async function renameProject(id, newName) {
  if (!supabase) return;
  const name = (newName || "").trim() || "Untitled";
  const { error } = await supabase.from("workshop_projects").update({ name }).eq("id", id);
  if (error) { console.error("[cloud] renameProject failed:", error.message); return; }
  setListCache(listCache.map(p => (p.id === id ? { ...p, name } : p)));
  const cached = dataCache.get(id);
  if (cached?.meta) dataCache.set(id, { ...cached, meta: { ...cached.meta, title: name } });
}

export async function setProjectFolder(id, folder) {
  if (!supabase) return;
  const f = (folder || "").trim() || null;
  const { error } = await supabase.from("workshop_projects").update({ folder: f }).eq("id", id);
  if (error) { console.error("[cloud] setProjectFolder failed:", error.message); return; }
  setListCache(listCache.map(p => (p.id === id ? { ...p, folder: f } : p)));
}

// ── folders (derived from projects + a local "empty folders" extras list) ────
function extraFolders() {
  const arr = lsGet(FOLDERS_KEY, []);
  return Array.isArray(arr) ? arr.filter(s => typeof s === "string" && s.trim()) : [];
}
function setExtraFolders(list) { lsSet(FOLDERS_KEY, list); }

export function listFolders() {
  const set = new Set();
  for (const p of listCache) if (p.folder) set.add(p.folder);
  for (const f of extraFolders()) set.add(f);
  return [...set].sort((a, b) => a.localeCompare(b));
}

export function createFolder(name) {
  const cleaned = (name || "").trim();
  if (!cleaned) return null;
  if (!listFolders().includes(cleaned)) setExtraFolders([...extraFolders(), cleaned]);
  return cleaned;
}

export async function deleteFolder(name) {
  const cleaned = (name || "").trim();
  if (!cleaned) return;
  for (const p of listCache.filter(p => p.folder === cleaned)) await setProjectFolder(p.id, null);
  setExtraFolders(extraFolders().filter(n => n !== cleaned));
}

export async function renameFolder(oldName, newName) {
  const from = (oldName || "").trim();
  const to = (newName || "").trim();
  if (!from || !to || from === to) return from === to;
  for (const p of listCache.filter(p => p.folder === from)) await setProjectFolder(p.id, to);
  setExtraFolders(extraFolders().map(n => (n === from ? to : n)));
  return true;
}

// No legacy v1 storage in the cloud — local impl handles the one-time purge.
export function purgeLegacyV1Storage() {}
