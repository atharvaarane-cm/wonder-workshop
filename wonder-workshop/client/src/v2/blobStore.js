// IndexedDB-backed blob store for v2 project data.
//
// Reason for existing: Gemini returns base64-encoded data URLs
// (~200KB-1MB each). A typical project with 25-30 generated images
// blows past localStorage's 5MB cap, so the metadata + image fields
// can't all live in localStorage together.
//
// Strategy: localStorage continues to hold project metadata (the
// projects list, active project pointer, folder list). The full
// project data — including all image fields and versionHistory —
// lives in IndexedDB keyed by project id. saveProject does both
// writes; loadProject reads from IndexedDB first, falls back to a
// legacy localStorage blob if a project was saved before this
// system existed.

const DB_NAME = "ww_v2_db";
const STORE_NAME = "projects";
const VERSION = 1;

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB not available"));
  }
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onerror = () => reject(req.error || new Error("IndexedDB open failed"));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
  });
  return dbPromise;
}

// Read-only get. Returns the stored payload (an object like
// { id, data, savedAt }) or null if missing/error.
export async function blobGet(id) {
  if (!id) return null;
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(id);
      req.onsuccess = () => resolve(req.result?.data || null);
      req.onerror = () => resolve(null);
    });
  } catch (e) {
    console.warn("[blobStore] get failed", e);
    return null;
  }
}

// Write a project's full data blob.
export async function blobSet(id, data) {
  if (!id || !data) return false;
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const req = tx.objectStore(STORE_NAME).put({ id, data, savedAt: Date.now() });
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    });
  } catch (e) {
    console.error("[blobStore] set failed", e);
    return false;
  }
}

// Synchronous best-effort: kicks the write off but doesn't await.
// Used from beforeunload where async won't complete in time.
export function blobSetSync(id, data) {
  blobSet(id, data).catch(() => {});
}

export async function blobDelete(id) {
  if (!id) return;
  try {
    const db = await openDb();
    await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const req = tx.objectStore(STORE_NAME).delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  } catch (e) {
    console.warn("[blobStore] delete failed", e);
  }
}
